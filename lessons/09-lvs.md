---
layout: default
title: "四层负载均衡：LVS-NAT、DR 与 TUN 的数据路径"
permalink: /lessons/09-lvs/
---

## 1. VIP 与 Real Server 之间的抽象

四层负载均衡对外暴露 VIP（Virtual IP），后端由多个 Real Server（RS）组成。客户端只知道 VIP，Director 根据调度算法为新连接选择 RS。

<figure class="article-figure">
  <img src="{{ '/assets/diagrams/lvs-architecture.svg' | relative_url }}" alt="客户端访问 VIP，IPVS Director 为连接选择 Real Server">
  <figcaption>Director 根据调度算法将新连接分配至其中一个 Real Server。</figcaption>
</figure>

[LVS（Linux Virtual Server）](https://www.linuxvirtualserver.org/) 中的 IPVS 是 Linux 内核四层负载均衡实现。它与 Nginx 等七层反向代理不同：经典 IPVS 主要根据 L3/L4 信息处理报文，而不是解析 HTTP URL 后决定后端。

## 2. LVS-NAT：双向经过 Director

客户端 SYN：

```text
198.51.100.10:50000 → 203.0.113.100:443
```

Director 选择 RS1 后，将目的地址改为 `10.0.1.11`；RS1 的响应必须经过 Director，后者将源地址改回 VIP。连接两侧观察到的地址不同，但 TCP 会话保持一致。

NAT 模式部署相对直观，但 Director 承担请求与响应双向流量。后端默认网关或回程路由若绕过 Director，连接可能失败。

## 3. LVS-DR：只改目标 MAC

DR（Direct Routing）模式保留原始目的 IP=VIP，只在二层将帧转交给选中的 RS。RS 必须把 VIP 视为本机地址，通常在 loopback 上配置 VIP，并避免与 Director 发生 ARP 冲突。

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

<figure class="article-figure">
  <img src="{{ '/assets/diagrams/lvs-forwarding-modes.svg' | relative_url }}" alt="LVS NAT 模式请求和响应均经过 Director；DR 模式只修改目标 MAC、响应直接返回；TUN 模式通过 IP-in-IP 隧道传输请求、响应直接返回">
  <figcaption>蓝绿实线表示请求方向，灰色虚线表示回包方向。</figcaption>
</figure>

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

[Keepalived](https://www.keepalived.org/doc/) 将健康检查与 VRRP 主备切换用于 LVS 部署；VRRP 负责 VIP 的主备接管，后端 TCP Socket 状态仍由对应 Real Server 维护。

当响应远大于请求时，DR/TUN 的直接返回可显著降低 Director 出站带宽压力；但故障排查必须注意请求和响应走不同路径，不能仅在 Director 上抓包验证完整 TCP 往返。

### 连接调度、转发表与故障转移的边界

IPVS 的职责不是“每包重新选一个 RS”。以 TCP 为例，新连接到来时按 `rr`、`wrr`、`lc` 等调度器选择 Real Server，然后在内核 IPVS 连接表中记录关联；同一连接的后续包根据已有条目转发。与仅观察虚拟服务配置的 `ipvsadm -Ln` 不同，`ipvsadm -Lnc` 可查看当前 IPVS 连接项，`ipvsadm -Ln --stats`/`--rate` 可用于对比 RS 方向的包数与速率。

```bash
ipvsadm -Ln              # VIP、调度算法、RS 与转发模式
ipvsadm -Lnc             # 当前连接和选定的 RS
ipvsadm -Ln --stats      # 连接数及流量统计
ipvsadm -Ln --rate       # 当前速率
cat /proc/net/ip_vs      # 内核导出的虚拟服务表
```

Keepalived 的两类功能需要分开理解：**健康检查/LVS 配置**根据后端探测结果增删 RS，**VRRP** 在 Director 节点故障时转移 VIP。两者配合可以恢复新连接，但主备切换并不自动保证旧 TCP 流量继续可用；还涉及 IPVS 状态同步、邻居缓存刷新以及后端业务自身的连接状态。

**Linux IPVS 与 Kubernetes Service 的 kube-proxy IPVS 模式需要区分**：[Kubernetes v1.35 将 kube-proxy 的 `ipvs` 模式标记为弃用](https://v1-35.docs.kubernetes.io/docs/reference/networking/virtual-ips/)，建议新部署评估 `nftables` 模式；这项变更针对 Kubernetes 代理实现，不涉及 Linux 内核 IPVS 本身。

## 参考资料
- [Linux Virtual Server Project](http://www.linuxvirtualserver.org/)
- [IPVS Administration](https://www.linuxvirtualserver.org/docs/index.html)
- [Keepalived Documentation](https://www.keepalived.org/doc/)
- [Kubernetes — Virtual IPs and Service Proxies](https://kubernetes.io/docs/reference/networking/virtual-ips/)

---

[← 上一篇：云上公网出口：EIP、Internet Gateway 与 NAT Gateway]({{ '/lessons/08-egress/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
