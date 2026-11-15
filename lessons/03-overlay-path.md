---
layout: default
title: "跨宿主机二层通信：VXLAN 封装与端点发现"
permalink: /lessons/03-overlay-path/
---

## 1. 同子网通信为何需要跨物理网络

设 VM-A 为 `10.0.1.10/24`，位于 Host-A（`192.168.1.10`）；VM-B 为 `10.0.1.20/24`，位于 Host-B（`192.168.1.20`）。两台 VM 在逻辑上属于同一二层子网，但宿主机之间可能隔着多台三层交换机。

```mermaid
flowchart LR
    subgraph A["宿主机 A · 192.168.1.10"]
        direction TB
        VA["VM-A · 10.0.1.10"] --> TA["VTEP-A"]
    end
    subgraph B["宿主机 B · 192.168.1.20"]
        direction TB
        TB["VTEP-B"] --> VB["VM-B · 10.0.1.20"]
    end
    TA -- "VXLAN over Underlay" --> TB
```

VM-A 查找路由后认为目的地址“直连”，因此会尝试解析 VM-B 的 MAC，而不是把报文发送到默认网关。ARP 请求可能被宿主机转发、代理应答，或由控制平面提供的端点信息处理。

## 2. 报文封装的逐跳变化

VM-A 发出的内层帧大致如下：

```text
Inner Ethernet: VM-A-MAC → VM-B-MAC
Inner IP:       10.0.1.10 → 10.0.1.20
```

Host-A 的 VTEP 根据目标 MAC/IP 与端点表查出 VM-B 位于 Host-B，并进行 VXLAN 封装：

```text
Outer Ethernet: Host-A next-hop MAC → ...
Outer IP:       192.168.1.10 → 192.168.1.20
Outer UDP:      dst port 4789
VXLAN:          VNI 1001
Inner Ethernet: VM-A-MAC → VM-B-MAC
Inner IP:       10.0.1.10 → 10.0.1.20
```

Underlay 路由器只处理外层 IP；Host-B 收到后解封装，将原始二层帧交给 VM-B。中间三层设备无需维护每台租户 VM 的私网路由。

## 3. MAC、ARP 与端点位置从哪里来

经典 VXLAN 可以通过数据平面学习远端 MAC；大规模云网络则常使用控制平面下发端点位置，避免大范围泛洪。EVPN 提供了基于 BGP 分发 MAC/IP 可达信息的标准化方案；OVN 通过逻辑端口与流表实现类似的端点寻址目标，但控制协议和实现路径不同。

虚拟机迁移时，必须更新 MAC/IP 到 VTEP 的映射；若远端仍指向旧宿主机，就可能出现短时黑洞或绕行。

## 4. MTU 的隐性代价

在常见 IPv4 VXLAN 场景下，外层 Ethernet、IPv4、UDP 和 VXLAN 合计约增加 50 字节（具体取决于 VLAN、IPv6 和可选头）。如果 Underlay 只有 1500 MTU，却允许租户发出完整 1500 字节的内层 IP 包，就可能遇到分片、PMTU 问题或丢包。

```bash
ip -d link show
bridge fdb show
tcpdump -ni eth0 'udp port 4789'
tracepath 10.0.1.20
```

## 5. 工业实现

[Linux VXLAN 设备](https://docs.kernel.org/networking/vxlan.html) 与 Linux Bridge 可以构建双宿主机实验；[Open vSwitch](https://docs.openvswitch.org/en/latest/) 能通过隧道端口与 OpenFlow 规则实现转发；[OVN](https://docs.ovn.org/en/stable/tutorials/ovn-openstack.html) 则负责把逻辑网络配置转换为宿主机数据平面的规则。

### 可复现的 Linux VXLAN 配置与封装观察

按照 [Linux VXLAN 内核文档](https://docs.kernel.org/networking/vxlan.html)，在两台 Underlay 地址分别为 `192.168.1.10`、`192.168.1.20` 的 Linux 主机上，可以用一对固定远端的 VXLAN 设备验证封装逻辑。以下是 Host-A 一侧的关键命令；Host-B 需要交换 `local` 和 `remote`，并把各自的 VXLAN 接口接入对应的 Linux Bridge 与 VM TAP 接口：

```bash
ip link add br-tenant type bridge
ip link set br-tenant up
ip link add vxlan100 type vxlan id 1001 dev eth0 \
  local 192.168.1.10 remote 192.168.1.20 dstport 4789
ip link set vxlan100 master br-tenant
ip link set vxlan100 up
ip -d link show vxlan100
bridge fdb show dev vxlan100
tcpdump -ni eth0 'udp port 4789'
```

`remote` 是对端 VTEP 的 Underlay IP，`id` 是 VXLAN VNI。用 `tcpdump` 在物理出口观察外层 IP/UDP，再在 VM 内抓包观察内层以太帧，可以区分封装前后的两种视角。固定远端只是小规模实验方式；生产系统通常还需要处理多端点、BUM 流量和地址迁移。

**[OVS 的隧道实现](https://docs.openvswitch.org/en/latest/howto/userspace-tunneling/)** 可以在 `br-int` 上创建 `type=vxlan` 隧道端口，通过流表或 `remote_ip` 选定端点，而不是一定使用上述 Linux VXLAN netdevice。在同一节点上，可用 `ovs-vsctl show`、`ovs-ofctl dump-flows br-int` 与 `ovs-appctl dpif/dump-flows br-int` 分别观察端口、OpenFlow 规则与实际 datapath 缓存；这些命令分别对应网桥端口配置、OpenFlow 规则与 [datapath 流缓存](https://docs.openvswitch.org/en/stable/faq/design/)。

## 6. 排障经验

先在 VM-A 确认路由和邻居表，再观察 Host-A 的端点映射与封装流量；在 Host-B 验证是否收到外层 UDP、能否解封装以及内层帧是否到达 VM-B。只在 VM 内抓包，无法区分“未封装”“Underlay 丢包”和“远端解封装失败”。

## 参考资料
- [RFC 7348 — VXLAN](https://www.rfc-editor.org/rfc/rfc7348)
- [RFC 7432 — BGP MPLS-Based Ethernet VPN](https://www.rfc-editor.org/rfc/rfc7432)
- [Linux kernel — VXLAN](https://docs.kernel.org/networking/vxlan.html)
- [Open vSwitch Documentation](https://docs.openvswitch.org/en/latest/)

---

[← 上一篇：VPC 的本质：逻辑隔离、地址空间与数据平面]({{ '/lessons/02-vpc/' | relative_url }}) · [下一篇：分布式网关：VPC 跨子网流量如何转发 →]({{ '/lessons/04-distributed-routing/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
