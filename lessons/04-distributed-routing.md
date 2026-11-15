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

以 [OVN 分布式逻辑路由器](https://docs.ovn.org/en/stable/tutorials/ovn-openstack.html) 为例，Host-A 的数据平面可以执行逻辑网关的转发规则，并将报文发送到 VM-B 所在的 Host-B；VM-A 仍把 `10.0.1.1` 作为逻辑网关。

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

[AWS VPC 路由表](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html) 包含用于 VPC 内部通信的 `local` 路由，子网间通信不要求用户自行部署 Linux 路由器。

### 用 OVN 验证一次真实的跨子网逻辑转发

在 OVN 中，逻辑交换机表示二层广播域，逻辑路由器通过路由器端口连接两个逻辑交换机。VM-A 发往 `10.0.2.20` 的报文首先命中对应子网的逻辑网关 MAC，再进入逻辑路由器的入口流水线；经过路由选择后，TTL 减 1，源/目标 MAC 改写为出接口和下一跳对应的 MAC，随后进入目标逻辑交换机流水线。**这里可先完成逻辑三层处理，再在发送宿主机选择远端 chassis/VTEP 并封装**，不需要把包送到一台集中式路由 VM。

[OVN Sandbox 官方教程](https://docs.ovn.org/en/stable/tutorials/ovn-sandbox.html) 使用 `ovn-trace` 模拟一包跨网段流量，可直接观察 `ip.ttl--`、`eth.src`/`eth.dst` 的修改以及最后的逻辑输出端口。这比只看 VM 内的 `ip route` 更接近实际路由机制：

```bash
# 在已创建逻辑网络的 OVN 实验环境中
ovn-nbctl show
ovn-sbctl lflow-list
ovn-trace --help
ovs-ofctl dump-flows br-int
```

排障时先核实逻辑路由器是否存在正确的路由和端口，再核实源、目的逻辑端口的 chassis 绑定，最后检查宿主机物理网卡上的隧道报文。如果逻辑 trace 能转发而 Underlay 看不到外层包，故障范围通常已缩小至本机流表、端口绑定或隧道出口，而不是 VM 的三层目标 IP。

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
