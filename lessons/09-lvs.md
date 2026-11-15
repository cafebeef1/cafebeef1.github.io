---
layout: default
title: "四层负载均衡：LVS-NAT、DR 与 TUN 的数据路径"
permalink: /lessons/09-lvs/
---

## 1. VIP 与 Real Server 之间的抽象

四层负载均衡对外暴露 VIP（Virtual IP），后端由多个 Real Server（RS）组成。客户端只知道 VIP，Director 根据调度算法为新连接选择 RS。

```text
Client 198.51.100.10:50000
         │
         ▼
VIP 203.0.113.100:443
         │ Director / IPVS
         ├── RS1 10.0.1.11:443
         └── RS2 10.0.1.12:443
```

LVS（Linux Virtual Server）中的 IPVS 是 Linux 内核四层负载均衡实现。它与 Nginx 等七层反向代理不同：经典 IPVS 主要根据 L3/L4 信息处理报文，而不是解析 HTTP URL 后决定后端。

## 2. LVS-NAT：双向经过 Director

客户端 SYN：

```text
198.51.100.10:50000 → 203.0.113.100:443
```

Director 选择 RS1 后，将目的地址改为 `10.0.1.11`；RS1 的响应必须经过 Director，后者将源地址改回 VIP。连接两侧观察到的地址不同，但 TCP 会话保持一致。

```text
Client → Director(DNAT) → RS1
Client ← Director(SNAT) ← RS1
```

NAT 模式部署相对直观，但 Director 承担请求与响应双向流量。后端默认网关或回程路由若绕过 Director，连接可能失败。

## 3. LVS-DR：只改目标 MAC

DR（Direct Routing）模式保留原始目的 IP=VIP，只在二层将帧转交给选中的 RS。RS 必须把 VIP 视为本机地址，通常在 loopback 上配置 VIP，并避免与 Director 发生 ARP 冲突。

```text
Client → Director ──(改目标 MAC)──→ RS1
Client ←────────────────────────── RS1
```

RS1 直接以 VIP 作为源 IP 返回客户端，响应不经过 Director。经典 DR 要求 Director 与 RS 之间具有合适的二层可达条件，因此不适合直接跨任意三层网络转发。

## 4. LVS-TUN：跨三层的直接返回

TUN 模式将原始客户端 IP 包封装在 IP-in-IP 隧道中：

```text
Outer IP: Director IP → RS IP
Inner IP: Client IP   → VIP
```

RS 解封装并处理内层目标为 VIP 的包，响应直接回客户端。与 DR 相比，TUN 可以跨三层网络，但需要后端支持隧道与 VIP，并付出封装开销。

| 模式 | 请求 | 响应 | 主要代价 |
|---|---|---|---|
| NAT | 经 Director | 经 Director | 双向带宽与状态压力 |
| DR | 经 Director，改 MAC | RS 直接返回 | 二层可达、VIP/ARP 配置 |
| TUN | 经 Director，隧道封装 | RS 直接返回 | 隧道配置与封装开销 |

## 5. Linux IPVS 配置与观测

```bash
apt install ipvsadm
ipvsadm -A -t 203.0.113.100:443 -s rr
ipvsadm -a -t 203.0.113.100:443 -r 10.0.1.11:443 -m
ipvsadm -a -t 203.0.113.100:443 -r 10.0.1.12:443 -m
ipvsadm -Ln --stats
ipvsadm -Ln --rate
ipvsadm -Lnc
```

`-m` 表示 NAT，`-g` 表示 DR，`-i` 表示 TUN。以上仅是 IPVS 规则，完整部署还需配置 VIP、转发、回程路由、ARP 和健康检查。

## 6. 工业实践与高可用

Keepalived 常将健康检查与 VRRP 主备切换用于 LVS 部署；但 VRRP 解决 VIP/Director 可达性，并不自动迁移后端 TCP Socket 状态。Kubernetes 的 kube-proxy 曾广泛使用 IPVS 模式，现代实现也存在 iptables、nftables 或 eBPF 等路线。云厂商的托管四层负载均衡可能使用分布式数据平面、硬件卸载或 DSR，不能把产品实现直接等同于经典 LVS。

当响应远大于请求时，DR/TUN 的直接返回可显著降低 Director 出站带宽压力；但故障排查必须注意请求和响应走不同路径，不能仅在 Director 上抓包验证完整 TCP 往返。

## 参考资料
- [Linux Virtual Server Project](http://www.linuxvirtualserver.org/)
- [IPVS Administration](https://www.linuxvirtualserver.org/docs/index.html)
- [Keepalived Documentation](https://www.keepalived.org/doc/)
- [Kubernetes — Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)

---

[← 上一篇：云上公网出口：EIP、Internet Gateway 与 NAT Gateway]({{ '/lessons/08-egress/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
