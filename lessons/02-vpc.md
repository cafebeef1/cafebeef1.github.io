---
layout: default
title: "VPC 与虚拟网络"
permalink: /lessons/02-vpc/
---

## 核心问题
VPC 是一台路由器，还是一个独立的物理网络？

都不是。VPC 是**逻辑隔离的网络资源集合**，通常包含地址空间、子网、路由表、网关和安全策略。

```text
VPC-A 10.0.0.0/16        VPC-B 10.0.0.0/16
  ├─ Subnet-A              └─ Subnet-B
  └─ VM-A                     VM-B
```

两侧 CIDR 可以重叠，因为转发查询还受 VPC/租户上下文约束。

## Linux 类比
```bash
ip netns add tenant-a
ip netns add tenant-b
ip -d link show
ip rule show
```

netns、VRF、Bridge、OVS、VXLAN 等都能帮助理解 VPC 的实现组件，但任何单一 Linux 功能都不等于完整 VPC。

## 设计权衡
大二层方便迁移，却扩大广播域；分布式三层网关通常更容易扩展。

## 思考题
1. 为什么不同 VPC 可以使用重叠 CIDR？
2. VRF 与 netns 在隔离路由表方面有什么区别？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
