---
layout: default
title: "NAT Gateway 与连接跟踪"
permalink: /lessons/05-nat/
---

## 核心问题
为什么多台私网 VM 可以共用一个公网 IP？NAT Gateway 会成为瓶颈吗？

典型出站 NAT Gateway 通过 **SNAT + PAT** 将不同私网连接映射到公网地址和端口。

```text
10.0.1.10:51000 ─┐
                 ├→ NAT → 203.0.113.20:40001 → Internet
10.0.1.11:51000 ─┘       203.0.113.20:40002
```

## 连接跟踪
连接由协议、源/目的 IP 和端口等字段标识。NAT 在首包建立映射，后续报文通过连接状态进行双向转换。

```bash
conntrack -L -p tcp
conntrack -E
sysctl net.netfilter.nf_conntrack_count
sysctl net.netfilter.nf_conntrack_max
iptables -t nat -L -n -v
```

**容量并非简单等于 65535 条总连接**。相同目标 IP:端口下通常受可用源端口数量约束；不同目标可能允许复用公网源端口，具体取决于 NAT 实现。还需考虑 PPS、BPS、连接跟踪表、CPU 和云平台配额。

## 设计权衡
集中 NAT 简单但可能成为带宽与状态瓶颈；分布式 NAT 更易扩展，但回程一致性与故障状态同步更复杂。

## 思考题
1. 为什么回程包需要匹配到原连接映射？
2. 两个连接访问不同目标 IP 时，公网源端口一定不能重复吗？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
