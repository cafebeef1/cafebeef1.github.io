---
layout: default
title: "EIP 的实现原理"
permalink: /lessons/07-eip/
---

## 核心问题
云服务器绑定 EIP 后，为什么 `ip addr` 里可能只有私网 IP？

很多云平台将 EIP 实现为**公网地址资源与私网资源的映射**，不要求虚拟机自己配置公网 IP。

```text
Client 198.51.100.20
  → EIP 203.0.113.10
  → 公网转换层 DNAT
  → VM-A 10.0.1.10
```

入站：`198.51.100.20:50000 → 203.0.113.10:443` 转换为 `198.51.100.20:50000 → 10.0.1.10:443`。

回程：源地址 `10.0.1.10` 被转换为 `203.0.113.10`。

## Linux 模拟
```bash
sysctl -w net.ipv4.ip_forward=1
iptables -t nat -A PREROUTING -d 203.0.113.10 -j DNAT --to-destination 10.0.1.10
iptables -t nat -A POSTROUTING -s 10.0.1.10 -o eth0 -j SNAT --to-source 203.0.113.10
```

实验还需正确配置公网地址可达性、回程路由与 FORWARD 放行。

## 设计权衡
EIP 可重新关联到其他实例，但公网地址不变**不等于**现有 TCP 连接能迁移：新实例通常没有旧 Socket 状态。

## 思考题
1. VM-A 抓到的入站包目标 IP 通常是什么？
2. EIP 重新关联后，已有 TCP 连接为什么可能断开？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
