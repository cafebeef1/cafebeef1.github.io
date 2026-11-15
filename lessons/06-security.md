---
layout: default
title: "安全组与网络 ACL"
permalink: /lessons/06-security/
---

## 核心问题
虚拟机内部 iptables 没有拒绝规则，为什么云平台仍能阻断连接？

因为云平台可以在**宿主机虚拟交换机、eBPF 数据平面或其他虚拟网络组件**中执行安全策略。

| 特性 | 安全组 | 网络 ACL |
|---|---|---|
| 常见作用范围 | 虚拟网卡/实例 | 子网 |
| 常见状态特征 | 有状态 | 无状态 |
| 返回流量 | 允许连接的返回包通常自动放行 | 通常需要显式双向规则 |

## 报文路径
```text
VM-A → 出站策略 → VPC 路由 → Overlay
     → 入站 ACL/安全组 → VM-B
```

逻辑顺序示意，实际数据平面可能融合多个规则检查阶段。

## Linux 实验
```bash
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp -s 10.0.1.0/24 --dport 443 -m conntrack --ctstate NEW -j ACCEPT
conntrack -L
tcpdump -ni eth0 'tcp port 443'
```

## 思考题
1. 为什么 VM-A 能访问 VM-B，不代表 VM-B 能主动访问 VM-A？
2. 为什么无状态 ACL 容易漏配客户端临时端口范围？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
