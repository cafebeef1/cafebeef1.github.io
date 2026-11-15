---
layout: default
title: "分布式网关：VPC 跨子网流量如何转发"
permalink: /lessons/04-distributed-routing/
---

## 1. 跨子网转发的关键不是“换目标 IP”

假设 VM-A 为 `10.0.1.10/24`，VM-B 为 `10.0.2.20/24`，属于同一个 VPC。VM-A 发现目的 IP 不在直连子网，因而把报文交给默认网关 `10.0.1.1`。

```text
VM-A 10.0.1.10
   │ 目标 IP 仍是 10.0.2.20
   │ 目标 MAC = 默认网关 MAC
   ▼
Host-A 分布式三层网关
   │ 路由查表、TTL - 1、二层重写
   ▼
Overlay / Underlay
   ▼
Host-B → VM-B 10.0.2.20
```

路由器处理的是三层目的地址，**不会把目标 IP 改写为网关 IP**。只有发生 DNAT 等地址转换时，IP 目的地址才会变化。每经过一次三层路由，TTL/Hop Limit 会减少；出站链路使用新的二层封装。

## 2. 集中式网关与分布式网关

集中式方案把跨子网流量送到一台或一组路由节点，规则集中、便于观测，但可能产生东西向流量绕行。

分布式方案让宿主机的数据平面执行逻辑网关功能。VM-A 仍然看到 `10.0.1.1`，但实际路由处理可能发生在 Host-A，随后直接把报文封装到 VM-B 所在的 Host-B。

这意味着“网关 IP 是同一个”并不意味着“所有流量经过同一台机器”。

## 3. Linux 如何观察

```bash
ip route get 10.0.2.20
ip neigh show
ip rule show
ip -d link show
tcpdump -ni eth0 'host 10.0.2.20'
```

`ip route get` 只显示当前 Linux 网络命名空间中的路由选择。云 VM 内的结果通常只能看到逻辑默认网关，不能直接观察宿主机上的分布式路由表。

## 4. 工业实现与技术路线

OVN 使用逻辑路由器表示跨逻辑交换机的三层连接，再将逻辑流水线转换为各宿主机上的转发规则。Linux VRF 和策略路由可提供隔离路由域；eBPF/XDP 也可以承担部分查表与转发工作，但是否在 XDP、TC、OVS 或智能网卡处理，取决于平台架构。

AWS VPC 对用户提供 VPC 本地路由等逻辑能力，用户无需部署一台普通 Linux 路由器来实现同 VPC 子网互通。产品文档定义了可见的路由行为，不等于公开了全部内部数据平面细节。

## 5. 设计与故障排查

分布式路由的优势是减少跨宿主机流量绕行；挑战是规则一致性、端点迁移、连接状态以及可观测性。排障时应分别检查 VM 路由、VPC 路由与策略、端点定位、隧道封装和回程路径，避免把所有丢包都归因于默认网关。

## 参考资料
- [OVN Architecture](https://www.ovn.org/en/architecture/)
- [AWS — Route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html)
- [Linux kernel — VRF](https://docs.kernel.org/networking/vrf.html)
- [Linux ip-rule(8)](https://man7.org/linux/man-pages/man8/ip-rule.8.html)

---

[← 上一篇：跨宿主机二层通信：VXLAN 封装与端点发现]({{ '/lessons/03-overlay-path/' | relative_url }}) · [下一篇：云 NAT 网关：连接跟踪、端口容量与扩展性 →]({{ '/lessons/05-nat/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
