---
layout: default
title: "LVS-NAT、DR、TUN"
permalink: /lessons/09-lvs/
---

## 核心问题
客户端连接的是 VIP，为什么后端 Real Server 能收到请求？

Linux IPVS 在四层根据连接信息选择后端，并维持连接到后端的转发关系。

```text
Client → VIP 203.0.113.100:443 → Director
                                  ├→ RS1 10.0.1.11
                                  └→ RS2 10.0.1.12
```

## 三种经典模式

| 模式 | 请求转发 | 响应路径 | 关键条件 |
|---|---|---|---|
| LVS-NAT | DNAT 到 RIP | 经 Director 反向 NAT | 回程必须经过 Director |
| LVS-DR | 修改目的 MAC，IP 目标仍是 VIP | RS 直接返回 | RS 配 VIP、二层可达、处理 ARP |
| LVS-TUN | IP-in-IP 封装 | RS 直接返回 | RS 支持隧道与 VIP |

DR 模式中，RS 必须接受目标地址为 VIP 的报文；经典部署通常将 VIP 配在 loopback 并避免 RS 对 VIP 直接响应 ARP。

## Linux 实验
```bash
apt install ipvsadm
ipvsadm -A -t 203.0.113.100:443 -s rr
ipvsadm -a -t 203.0.113.100:443 -r 10.0.1.11:443 -m
ipvsadm -a -t 203.0.113.100:443 -r 10.0.1.12:443 -m
ipvsadm -Ln --stats
ipvsadm -Ln --rate
```

以上是 NAT 模式规则示例，真实部署还需配置 VIP、IP 转发、后端回程路由和安全策略。

## 设计权衡
NAT 模式部署相对简单但双向流量经过 Director；DR/TUN 减少回程流量压力，但增加网络和后端配置约束。

## 思考题
1. LVS-DR 中，RS 没配置 VIP 会怎样？
2. 请求 1 KB、响应 10 MB 时，DR 和 NAT 对 Director 的流量压力有何区别？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
