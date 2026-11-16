---
layout: default
title: "云网络架构演进：从物理网络到多租户虚拟网络"
permalink: /lessons/01-cloud-network/
section: tech
section_name: TECH / CLOUD NETWORK
updated: 2026-11-15
show_in_updates: true
summary: "云网络的架构演进、Underlay / Overlay 以及控制与数据平面。"
---

## 1. 问题背景：物理网络为何难以直接承载云计算

传统数据中心通常以机架、交换机、VLAN 和静态地址规划组织网络。业务系统部署周期较长，网络拓扑相对稳定，网络团队可以手动分配网段、配置交换机端口和调整路由。虚拟化改变了这些假设：一台宿主机上可运行数十台虚拟机，虚拟机可能被频繁创建、销毁或迁移，不同租户还可能使用完全相同的私网地址。

如果继续让每个租户直接占用物理 VLAN，会遇到三个问题。首先，VLAN ID 只有 12 位，不能无限扩展；其次，租户网络拓扑与物理位置耦合，迁移虚拟机可能牵涉物理网络配置；最后，手工操作难以跟上云平台的资源生命周期。

因此，云网络的目标不只是“让虚拟机能通信”，而是让网络像计算资源一样可以按 API 声明、创建、隔离和回收。

## 2. 两层网络：Underlay 与 Overlay

<figure class="article-figure">
  <img src="{{ '/assets/diagrams/overlay-underlay.svg' | relative_url }}" alt="Underlay 与 Overlay 分层网络架构：VM-A、VM-B 分别运行于 Host-A、Host-B，通过 VTEP 在物理网络上承载逻辑二层通信">
  <figcaption>图：VM-A 和 VM-B 的逻辑二层通信由各自宿主机的 VTEP 通过 Underlay 网络承载。</figcaption>
</figure>

**Underlay** 是承载宿主机之间通信的物理 IP 网络，负责将报文送到目标宿主机；**Overlay** 是建立在其上的租户逻辑网络，借助 VXLAN、Geneve 等封装把租户二层帧跨三层传送。租户可以看到自己的子网、网关和 MAC 地址，而 Underlay 路由器只需知道宿主机的地址。

以 VXLAN 为例，原始租户以太网帧成为内层载荷，外层 UDP/IP 以源、目的 VTEP 地址标识宿主机。VNI 用于标识逻辑网络。[RFC 7348](https://www.rfc-editor.org/rfc/rfc7348) 规定的 VXLAN UDP 目的端口是 4789。

## 3. 控制平面与数据平面的分离

云控制平面负责管理租户网络、分配地址、记录虚拟机所在宿主机、计算路由和下发安全策略。数据平面负责按已有规则逐包处理，包括查表、过滤、封装、转发和统计。

<figure class="article-figure">
  <img src="{{ '/assets/diagrams/control-data-plane.svg' | relative_url }}" alt="控制平面处理云 API、网络配置、策略编译与规则下发；数据平面由 VM、TAP、虚拟交换机和物理网卡逐包转发">
  <figcaption>图：控制平面维护和下发规则，数据平面按已安装的规则处理报文。</figcaption>
</figure>

当 VM 从 Host-A 迁移到 Host-B 时，控制平面需要更新端点位置；如果数据平面仍保留旧映射，报文可能继续被封装到 Host-A。这解释了为什么云网络故障排查必须同时关注**逻辑配置**和**实际生效的转发表**。

## 4. Linux 与开源项目中的实现

Linux 的 network namespace 提供网络栈隔离，VRF 提供路由域隔离，Bridge/OVS 提供二层转发，VXLAN 设备提供隧道封装。它们是构建云网络的积木，而非某个组件单独等同于 VPC。

```bash
ip netns list
ip -d link show
bridge fdb show
ip rule show
```

一个可追踪的开源实现是 **[Neutron](https://docs.openstack.org/neutron/latest/) + [OVN](https://docs.ovn.org/en/stable/tutorials/ovn-openstack.html) + [OVS](https://docs.openvswitch.org/en/latest/)**。Neutron 管理 `network/subnet/port/router` 等 API 对象；OVN Northbound Database 保存逻辑交换机、逻辑路由器与 ACL 等意图；`ovn-northd` 将它们编译为逻辑流并写入 Southbound Database；各宿主机的 `ovn-controller` 读取与本机相关的逻辑信息，把它们转换为 OVS 可执行的 OpenFlow 规则。实际转发报文的是本地数据平面，而不是 Neutron API 服务。

因此，“创建子网”与“流量已经按新规则转发”之间存在配置传播过程。可沿以下路径逐层核实：

```bash
# 在安装 OVN/OVS 的对应控制节点或计算节点上执行
ovn-nbctl show                 # 逻辑网络对象
ovn-sbctl show                 # 宿主机和逻辑端口绑定
ovn-sbctl lflow-list           # 编译后的逻辑流
ovs-vsctl show                 # 本机网桥与端口
ovs-ofctl dump-flows br-int    # OVS OpenFlow 规则
```

## 5. 工程取舍与排障思路

Overlay 提高了租户网络的独立性，却引入封装头、MTU、端点同步和额外的观测难度。设计时应分别确认逻辑网络 MTU、物理网卡 MTU 和隧道开销。排障时按“VM 路由 → 虚拟交换机 → VTEP → Underlay → 远端 VTEP → 目标 VM”逐层定位，而不是只检查两端的 `ping`。

## 参考资料
- [RFC 7348 — Virtual eXtensible Local Area Network (VXLAN)](https://www.rfc-editor.org/rfc/rfc7348)
- [Linux kernel — VRF](https://docs.kernel.org/networking/vrf.html)
- [Open vSwitch Documentation](https://docs.openvswitch.org/en/latest/)
- [OpenStack Neutron](https://docs.openstack.org/neutron/latest/)
- [OVN OpenStack Tutorial：NB/SB DB 与 ovn-controller](https://docs.ovn.org/en/stable/tutorials/ovn-openstack.html)
- [Open vSwitch：OpenFlow 与 datapath 规则区别](https://docs.openvswitch.org/en/stable/faq/design/)

---

[下一篇：VPC 的本质：逻辑隔离、地址空间与数据平面 →]({{ '/lessons/02-vpc/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
