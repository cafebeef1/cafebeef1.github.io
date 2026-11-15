---
layout: default
title: "跨宿主机的同子网通信"
permalink: /lessons/03-overlay-path/
---

## 核心问题
两台虚拟机处于同一子网，但分别运行在不同物理宿主机上，如何通信？

```text
VM-A 10.0.1.10        VM-B 10.0.1.20
    |                     |
Host-A 192.168.1.10 → Host-B 192.168.1.20
       VXLAN / Underlay
```

## 报文路径
1. VM-A 判断 10.0.1.20 属于直连子网，尝试解析目的 MAC。
2. 宿主机虚拟交换机查找目标虚拟机的位置；ARP 可能由代理应答。
3. VTEP 将**原始以太网帧**封装为 VXLAN/UDP/IP，外层目的 IP 是 Host-B。
4. Underlay 根据宿主机 IP 转发；Host-B 解封装后交付 VM-B。

```text
Outer IP: 192.168.1.10 → 192.168.1.20
UDP dst: 4789
VXLAN VNI: 1001
Inner IP: 10.0.1.10 → 10.0.1.20
```

## Linux 观察命令
```bash
ip -d link show
bridge fdb show
tcpdump -ni eth0 udp port 4789
```

VXLAN 增加报文头开销，若 Underlay MTU 不足，可能产生分片或丢包。

## 思考题
1. Underlay 路由器需要知道 VM-B 的私网 IP 吗？
2. 为什么 VXLAN 容易引出 MTU 问题？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
