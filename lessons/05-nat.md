---
layout: default
title: "云 NAT 网关：连接跟踪、端口容量与扩展性"
permalink: /lessons/05-nat/
section: tech
section_name: TECH / CLOUD NETWORK
updated: 2026-11-15
show_in_updates: true
summary: "云 NAT 网关的连接跟踪、端口容量与扩展性。"
---

## 1. NAT Gateway 解决的是地址共享问题

云上私有子网中的虚拟机通常使用 RFC 1918 地址，不能直接以这些地址作为公网通信的可路由源地址。出站 NAT Gateway 在公网出口执行源地址转换（SNAT），使多台私网实例共享一个或多个公网 IPv4 地址。

<figure class="article-figure">
  <img src="{{ '/assets/diagrams/nat-gateway.svg' | relative_url }}" alt="两个私网虚拟机经 NAT Gateway 的 SNAT 共享公网 IP 访问互联网">
  <figcaption>两个不同内部连接通过 NAT Gateway 的地址、端口映射共享出口。</figcaption>
</figure>

典型 PAT（Port Address Translation）还会改写源端口，以便区分连接。它与简单的一对一静态 NAT 不同，通常需要逐连接状态。

## 2. 首包如何建立 NAT 映射

以 TCP SYN 为例：

```text
原始方向：10.0.1.10:50000 → 198.51.100.20:443
转换方向：203.0.113.20:40001 → 198.51.100.20:443

返回方向：198.51.100.20:443 → 203.0.113.20:40001
还原方向：198.51.100.20:443 → 10.0.1.10:50000
```

Linux netfilter 的 conntrack 记录连接的 original/reply tuple，并关联 NAT 转换信息。通常在首包确定映射，后续包依据连接状态处理，而不是对每个包重新执行完整 NAT 规则选择。

```bash
conntrack -L -p tcp -o extended
conntrack -E
conntrack -S
sysctl net.netfilter.nf_conntrack_count
sysctl net.netfilter.nf_conntrack_max
```

## 3. 一个公网 IP 到底能承载多少连接

答案不是固定的 65535 条。若所有连接都访问同一个目标 IP、目标端口和协议，那么该公网 IP 的可用源端口会构成主要限制之一。若目标不同，部分 NAT 实现可以对不同远端复用相同公网源端口，因为完整连接元组仍可区分。

容量还受以下因素约束：连接跟踪表容量、端口分配策略、PPS/BPS、CPU、内存、连接创建速率、空闲超时以及厂商配额。AWS NAT Gateway 文档给出的一个具体约束是：每个 IPv4 地址针对**每个唯一目的地址和端口组合**最多支持约 55,000 个同时连接；这不能推广为所有 NAT 实现的通用上限。

## 4. NAT 为什么容易成为瓶颈

普通路由可以接近无状态地逐包查表，PAT 却必须维护连接状态。流量集中后可能出现端口耗尽、状态表压力和回程路径依赖。若主备切换时未同步 NAT 状态，已有 TCP 连接可能因回程映射丢失而中断。

分布式 NAT 的关键约束是让同一连接的双向报文命中一致的 NAT 状态，并在节点故障时处理未同步的连接映射。

## 5. 工业实现对比

Linux 可以用 `SNAT` 或 `MASQUERADE` 实现出站转换：前者适合固定出口地址，后者适合动态接口地址。[AWS NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) 是托管服务，在公有 NAT Gateway 连接互联网的路径上，Internet Gateway 将 NAT Gateway 的私网地址映射为关联的 EIP。

```bash
iptables -t nat -A POSTROUTING -s 10.0.0.0/16 -o eth0 -j MASQUERADE
iptables -t nat -L -n -v
```

### 为什么托管 NAT Gateway 与 Linux MASQUERADE 不能直接画等号

[Linux netfilter conntrack](https://docs.kernel.org/networking/nf_conntrack-sysctl.html) 为 NAT 连接维护双向地址/端口映射：新建连接在 NAT hook 中匹配规则，后续报文按已建立的映射转换。`MASQUERADE` 适用于出口网卡地址可能变化的场景；地址固定时 `SNAT --to-source` 可以明确指定源 IP。转发主机还需要 `ip_forward=1`、允许 FORWARD、让回包重新经过同一套状态表。`iptables -t nat -L` 只能看规则，观察连接与耗尽风险还得看 `conntrack -L/-S` 和 `nf_conntrack_count/max`。

**AWS 公有 NAT Gateway 的链路存在两级转换**：私有子网 VM 的源地址先由 NAT Gateway 转换为 NAT Gateway 的**私有 IPv4**，再由 Internet Gateway 映射为 NAT Gateway 绑定的 EIP。公网看到的是 EIP，但不能据此认定 NAT Gateway 内部直接把源地址改为 EIP。跨 AZ 设计时还要注意：NAT Gateway 创建在具体可用区中，多个 AZ 共用同一网关会引入跨区依赖。

高并发时，AWS 提供 [`ErrorPortAllocation`、`PacketsDropCount` 和 `IdleTimeoutCount` 等 CloudWatch 指标](https://docs.aws.amazon.com/vpc/latest/userguide/metrics-dimensions-nat-gateway.html)。应先区分同一热点目标的端口瓶颈、连接空闲超时、总体 PPS/带宽瓶颈，再决定是增加 NAT 地址、优化连接复用还是调整子网出口拓扑。

## 6. 排障经验

当 TCP 连接偶发超时且高峰期明显加重，应同时看 NAT 端口分配失败、conntrack 表、出口带宽和 SYN 重传。抓包应覆盖 NAT 前后两侧，重点比对源地址、源端口与回程是否对称。

## 参考资料
- [Linux kernel — Netfilter Conntrack Sysctl](https://docs.kernel.org/networking/nf_conntrack-sysctl.html)
- [Netfilter Conntrack Tools](https://conntrack-tools.netfilter.org/)
- [AWS — NAT Gateway basics](https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html)
- [RFC 4787 — NAT Behavioral Requirements for UDP](https://www.rfc-editor.org/rfc/rfc4787)

---

[← 上一篇：分布式网关：VPC 跨子网流量如何转发]({{ '/lessons/04-distributed-routing/' | relative_url }}) · [下一篇：云网络访问控制：安全组、ACL 与有状态防火墙 →]({{ '/lessons/06-security/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
