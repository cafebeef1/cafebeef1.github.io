---
layout: default
title: "VPC 的本质：逻辑隔离、地址空间与数据平面"
permalink: /lessons/02-vpc/
---

> 本文围绕可验证的网络机制与工程实现展开。文中地址为教学示例，具体云产品行为应以官方文档和实际配置为准。

## 1. VPC 不是一台虚拟路由器

VPC（Virtual Private Cloud）是云平台提供的**逻辑网络边界**。它包含地址空间、子网、路由、安全策略以及与外部网络的连接关系。用户可以将 VPC 理解为一个可独立规划的网络环境，但不能据此推断云平台为每个 VPC 创建了一台独占的物理路由器。

例如两个租户都配置 `10.0.0.0/16`，其 IP 地址可以重叠：

```text
VPC-A / Tenant-A         VPC-B / Tenant-B
10.0.0.0/16              10.0.0.0/16
  └ VM 10.0.1.10           └ VM 10.0.1.10
```

云平台在查找路由和端点时不仅使用目的 IP，还需要识别该流量所属的租户或逻辑网络上下文。因此两个完全相同的目的地址，可以被转发到不同的虚拟机。

## 2. 地址空间、子网与路由表的关系

CIDR 描述一个 IP 地址集合，例如 `10.0.0.0/16`。子网从中划分更小的地址段，例如 `10.0.1.0/24` 和 `10.0.2.0/24`。子网通常与可用区、路由表和网络 ACL 等配置关联，但**子网不是必然对应一台物理交换机**。

VPC 路由表描述逻辑下一跳：

```text
Destination     Target
10.0.0.0/16     local
0.0.0.0/0       NAT Gateway
```

其中 `local` 表示 VPC 内地址空间的内部转发能力；它不意味着所有流量都经过某个集中式网关。不同云平台对路由表的关联范围、优先级和目标类型存在差异。

## 3. 为什么不把整个 VPC 做成一个大二层？

纯二层方案依赖 MAC 学习、ARP/ND 和广播域管理。随着虚拟机数量增长，广播与未知单播扩散、MAC 表容量和跨机迁移都会增加复杂度。

云平台常通过分布式三层网关、ARP 抑制或代理应答减少广播传播。对于虚拟机而言，网关地址可以是固定的逻辑地址；在底层，它可能由多台宿主机协同实现。

## 4. Linux 中的隔离机制

```bash
# 创建两个独立网络命名空间
ip netns add tenant-a
ip netns add tenant-b

# 观察策略路由与链路类型
ip rule show
ip -d link show
```

Network namespace 隔离接口、路由和部分网络协议栈状态；VRF 使多个三层路由域共存；OVS、VXLAN、eBPF 可以承担实际数据平面工作。生产级 VPC 还需要集中配置、生命周期管理、安全规则和故障恢复机制。

## 5. 产业实现对比

AWS VPC、阿里云专有网络 VPC 均向用户暴露私网 CIDR、子网/交换机、路由表和安全策略等概念，但它们对可用区、路由目标、网关资源和默认行为的定义不完全相同。

OpenStack Neutron 提供 Network、Subnet、Router 等资源对象；OVN 则将逻辑网络转化为分布式流表。云产品的控制台概念与底层 Linux 对象不是一一对应关系，理解抽象边界比猜测厂商使用哪条内核命令更重要。

## 6. 工程经验

规划 VPC 时，应预留地址空间并提前考虑 VPC Peering、VPN、专线和跨云互联的 CIDR 冲突。**VPC 内允许重叠地址**不代表两个重叠地址空间能够无障碍互联；一旦需要路由互通，地址冲突就会成为实际限制。

## 参考资料
- [AWS — What is Amazon VPC?](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html)
- [阿里云 — 专有网络 VPC](https://help.aliyun.com/zh/vpc/)
- [OpenStack Neutron](https://docs.openstack.org/neutron/latest/)
- [Linux kernel — VRF](https://docs.kernel.org/networking/vrf.html)

---

[← 上一篇：云网络架构演进：从物理网络到多租户虚拟网络]({{ '/lessons/01-cloud-network/' | relative_url }}) · [下一篇：跨宿主机二层通信：VXLAN 封装与端点发现 →]({{ '/lessons/03-overlay-path/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
