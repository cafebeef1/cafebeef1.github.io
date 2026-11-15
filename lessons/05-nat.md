---
layout: default
title: "云 NAT 网关：连接跟踪、端口容量与扩展性"
permalink: /lessons/05-nat/
---

## 1. NAT Gateway 解决的是地址共享问题

云上私有子网中的虚拟机通常使用 RFC 1918 地址，不能直接以这些地址作为公网通信的可路由源地址。出站 NAT Gateway 在公网出口执行源地址转换（SNAT），使多台私网实例共享一个或多个公网 IPv4 地址。

```text
VM-A 10.0.1.10:50000 ─┐
                      ├→ NAT Gateway 203.0.113.20 → Internet
VM-B 10.0.1.11:50000 ─┘
```

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

分布式 NAT 可以扩展处理能力，但需要解决流量分片、双向一致性、状态迁移与故障恢复。无论产品名叫“一个 NAT Gateway”，底层都不必然是一台物理机器。

## 5. 工业实现对比

Linux 可以用 `SNAT` 或 `MASQUERADE` 实现出站转换：前者适合明确固定出口地址，后者适合动态接口地址。AWS NAT Gateway 是托管式 NAT 服务；阿里云 NAT 网关也提供 SNAT 等能力，但具体公网 IP 绑定、带宽计费和会话限制应以各自产品文档为准。

```bash
iptables -t nat -A POSTROUTING -s 10.0.0.0/16 -o eth0 -j MASQUERADE
iptables -t nat -L -n -v
```

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
