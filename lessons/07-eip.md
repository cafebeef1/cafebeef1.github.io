---
layout: default
title: "弹性公网 IP：地址映射、回程路径与故障切换"
permalink: /lessons/07-eip/
---

## 1. EIP 是地址资源，不必是 VM 网卡地址

很多云平台将弹性公网 IP（EIP）作为可独立分配、绑定和解绑的公网地址资源。VM 的网卡可能只配置 `10.0.1.10`，而外部客户端访问的地址为 `203.0.113.10`。

```text
Internet Client
  198.51.100.20:50000
         │
         ▼
EIP 203.0.113.10:443
         │ DNAT
         ▼
VM 10.0.1.10:443
```

这里使用 RFC 5737 的文档示例地址，不能作为真实公网服务地址。

## 2. 入站和回程的地址变化

客户端发起连接：

```text
转换前：198.51.100.20:50000 → 203.0.113.10:443
转换后：198.51.100.20:50000 → 10.0.1.10:443
```

目的地址转换（DNAT）使 VM 能在不知道 EIP 的情况下接收请求。VM 回应：

```text
转换前：10.0.1.10:443 → 198.51.100.20:50000
转换后：203.0.113.10:443 → 198.51.100.20:50000
```

反向 SNAT 保证客户端始终认为自己与 EIP 通信。上述是一种常见的一对一映射模型；云厂商可能在不同数据平面位置执行转换。

## 3. 为什么绑定 EIP 不需要重启应用

应用通常监听 `0.0.0.0:443` 或私网地址。EIP 的绑定变化由云控制平面更新公网映射及转发策略，不要求应用直接监听公网地址。这也解释了为什么 `ip addr` 可能看不到 EIP。

```bash
ip -4 addr show
ss -lntp
tcpdump -ni eth0 'tcp port 443'
```

若公网入口已经完成 DNAT，VM 内抓包通常看到目标私网地址，而非 EIP。

## 4. 用 Linux 模拟一对一转换

```bash
sysctl -w net.ipv4.ip_forward=1
iptables -t nat -A PREROUTING -d 203.0.113.10 \
  -j DNAT --to-destination 10.0.1.10
iptables -t nat -A POSTROUTING -s 10.0.1.10 -o eth0 \
  -j SNAT --to-source 203.0.113.10
```

实验还需让公网地址可达、设置 VM 回程网关并允许 FORWARD 流量。

## 5. 工业实践与故障切换

AWS Elastic IP 可与特定资源关联，Amazon VPC 的 Internet Gateway 在典型公有 IPv4 路径中提供地址转换。阿里云 EIP 也将公网地址与云资源解耦，但支持绑定的资源类型和网络限制以产品文档为准。

EIP 重新绑定到新 VM 后，新的连接可以使用相同公网地址；**已有 TCP 连接通常不能仅靠迁移 EIP 自动延续**，因为新 VM 缺少旧连接的 Socket、序列号和应用状态。高可用通常还需健康检查、流量切换和应用状态管理。

## 6. 工程经验

不要把“EIP 稳定”与“服务无中断”画等号。设计故障切换时，应区分地址可达性恢复、路由收敛、连接恢复和应用可用性四个时间尺度。

## 参考资料
- [AWS — Elastic IP addresses](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html)
- [AWS — Internet Gateways](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html)
- [阿里云 — 弹性公网 IP](https://help.aliyun.com/zh/eip/)
- [RFC 5737 — IPv4 Address Blocks for Documentation](https://www.rfc-editor.org/rfc/rfc5737)

---

[← 上一篇：云网络访问控制：安全组、ACL 与有状态防火墙]({{ '/lessons/06-security/' | relative_url }}) · [下一篇：云上公网出口：EIP、Internet Gateway 与 NAT Gateway →]({{ '/lessons/08-egress/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
