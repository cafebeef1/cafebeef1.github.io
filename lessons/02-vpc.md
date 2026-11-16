---
layout: default
title: "VPC 的本质：逻辑隔离、地址空间与数据平面"
permalink: /lessons/02-vpc/
section: tech
section_name: TECH / CLOUD NETWORK
updated: 2026-11-15
show_in_updates: true
summary: "VPC 的逻辑隔离、地址空间与数据平面基础。"
---

## 1. VPC 不是一台虚拟路由器

VPC（Virtual Private Cloud）是云平台提供的**逻辑网络边界**。它包含地址空间、子网、路由、安全策略以及与外部网络的连接关系。用户可以将 VPC 理解为一个可独立规划的网络环境，但不能据此推断云平台为每个 VPC 创建了一台独占的物理路由器。

例如两个租户都配置 `10.0.0.0/16`，其 IP 地址可以重叠：

<figure class="article-figure">
  <img src="{{ '/assets/diagrams/vpc-isolation.svg' | relative_url }}" alt="VPC A 与 VPC B 相互隔离，均包含地址为 10.0.1.10 的虚拟机">
  <figcaption>两套逻辑 VPC 可以使用相同的私网 CIDR 与主机地址。</figcaption>
</figure>

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

在 [OVN 的逻辑路由器](https://docs.ovn.org/en/stable/tutorials/ovn-openstack.html) 实现中，三层网关由逻辑路由器及宿主机上的转发规则共同实现；虚拟机通过逻辑网关地址发送跨子网报文。

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

[AWS VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) 通过 Subnet 和 Route Table 组织网络，[阿里云 VPC](https://help.aliyun.com/zh/vpc/) 使用交换机（vSwitch）定义子网资源。两者都提供 CIDR 规划与安全策略，但网络对象的名称与配置接口不同。

OpenStack Neutron 提供 Network、Subnet、Router 等资源对象；OVN 则将逻辑网络转化为分布式流表。云产品的控制台概念与底层 Linux 对象不是一一对应关系，理解抽象边界比猜测厂商使用哪条内核命令更重要。

### 路由表如何落地：AWS 与 OVN 的不同层次

按照 [AWS 子网路由表文档](https://docs.aws.amazon.com/vpc/latest/userguide/subnet-route-tables.html)，每个子网只能显式关联一张子网路由表；未关联自定义路由表的子网使用 Main Route Table。路由条目由目的 CIDR（或 Prefix List）和目标资源组成，查找遵循最长前缀匹配等 AWS 定义的优先级规则。例如，将 `0.0.0.0/0` 指向 NAT Gateway，改变的是**关联子网的出站路径**，而不是 VM 内的默认网关地址。排查前应先确定 ENI 所在子网、子网关联的路由表、下一跳是否存在且可用。

在 **[OpenStack Neutron + OVN](https://docs.ovn.org/en/stable/tutorials/ovn-openstack.html)** 中，Neutron `network` 和 `subnet` 负责地址与网络对象，Neutron `port` 代表连接到网络的虚拟接口，`router` 负责连接不同子网。OVN 的逻辑交换机端口、逻辑路由器端口和端点绑定并不等同于 Linux 中固定的一块网卡。跨主机数据转发时，逻辑网络被编译为计算节点上的流表；同一个子网的 VM 即使位于不同宿主机，也不要求把宿主机物理网卡放进租户的 VLAN。

比较两种实现时，可以分别检查**网络对象、逻辑路由和转发规则**：[AWS 路由表](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html) 定义目的网段到网关等目标资源的映射；OVN 则通过 Northbound/Southbound DB 与宿主机 OpenFlow 规则串联配置和转发。

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
