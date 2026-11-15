---
layout: default
title: "跨子网通信与分布式网关"
permalink: /lessons/04-distributed-routing/
---

## 核心问题
同一个 VPC 内，不同子网的 VM 通信是否必须经过一台中央路由器？

不一定。云平台常采用**分布式三层网关**，在靠近虚拟机的宿主机上执行逻辑路由。

```text
VM-A 10.0.1.10/24
  → 默认网关 10.0.1.1
  → Host-A 分布式路由
  → Overlay / Underlay
  → Host-B
  → VM-B 10.0.2.20/24
```

VM-A 发送给网关 MAC，但 IP 目标仍是 10.0.2.20。路由过程会递减 TTL，并在下一跳重新构造二层头。

## Linux 实验
```bash
ip route get 10.0.2.20
ip neigh show
ip rule show
tcpdump -ni eth0 host 10.0.2.20
```

## 设计权衡
集中式路由便于统一管理，但可能引入流量绕行和瓶颈；分布式路由减少绕行，却需要控制平面向多个节点同步路由与端点位置。

## 思考题
1. 为什么跨子网时 IP 目标地址不需要改成网关 IP？
2. 分布式网关如何知道远端 VM 位于哪台宿主机？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
