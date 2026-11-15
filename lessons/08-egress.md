---
layout: default
title: "云上公网出口：EIP、Internet Gateway 与 NAT Gateway"
permalink: /lessons/08-egress/
---

## 1. 一个容易混淆的问题

某台 VM 已关联 EIP，但所在子网的默认路由又指向 NAT Gateway，它访问公网时会使用哪个地址？

关键是区分三个层次：

1. **VM 内路由表**：决定报文交给哪个逻辑网关。
2. **VPC 路由与出口策略**：决定逻辑网关后续如何处理。
3. **公网地址转换**：决定公网服务器看到哪个源 IP。

```text
VM 10.0.1.10
   │ Linux: default via 10.0.1.1
   ▼
云平台 VPC 出口决策
   ├── EIP 公网出口 → 203.0.113.10
   └── NAT Gateway   → 203.0.113.20
```

这只是帮助理解的逻辑示意。真实云平台未必允许在同一实例上自由组合两种路径。

## 2. 为什么 ip route 看不出云出口

VM 内运行：

```bash
ip route get 8.8.8.8
```

可能显示：

```text
8.8.8.8 via 10.0.1.1 dev eth0 src 10.0.1.10
```

它只表明 Linux 把报文交给 `10.0.1.1`。云平台内部如何选择 Internet Gateway、NAT Gateway 或其他公网服务，通常不能从这条输出推断。

## 3. AWS 的具体产品模型

AWS VPC 的典型公有子网通过 `0.0.0.0/0 → Internet Gateway` 提供公网路径。实例还需要公有 IPv4 地址或 EIP，并满足安全组、网络 ACL 等条件。Internet Gateway 为公有 IPv4 流量提供一对一地址转换。

私有子网常通过 `0.0.0.0/0 → NAT Gateway` 出站。公有 NAT Gateway 本身位于具有 Internet Gateway 路径的公有子网，并使用分配给它的公网地址对外通信。

**EIP 本身不是 AWS VPC 路由表中的下一跳目标**。其他云厂商可能通过不同的产品抽象提供公网出站能力，不能直接套用 AWS 路由对象。

## 4. 出站地址怎么验证

```bash
ip route
ip route get 8.8.8.8
env | grep -i proxy
curl -4 https://api.ipify.org
ss -tn
```

外部回显 IP 可以显示某次请求最终使用的公网源地址，但代理、VPN、策略路由和应用出口也会影响结果。应将观测结果与云控制台中的子网路由表、EIP 关联、NAT 配置交叉验证。

## 5. 设计取舍

需要公网主动访问的服务通常通过 EIP 或公网负载均衡器暴露；只需要出站访问的应用服务器使用 NAT Gateway；不需要互联网的工作负载应尽量避免默认公网出口。访问云平台托管服务时，可以评估 Private Endpoint / VPC Endpoint 等私有路径，以降低公网依赖。

## 6. 常见误区

“有 EIP 就一定不用 NAT”是错误的：EIP 映射本身可能涉及地址转换；“没有独立 NAT Gateway 就没有 NAT”同样不成立。需要区分 NAT 作为**转换机制**与 NAT Gateway 作为**云产品服务**。

## 参考资料
- [AWS — Internet Gateways](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html)
- [AWS — NAT Gateway basics](https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html)
- [AWS — Route tables](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Route_Tables.html)
- [阿里云 — 专有网络 VPC](https://help.aliyun.com/zh/vpc/)

---

[← 上一篇：弹性公网 IP：地址映射、回程路径与故障切换]({{ '/lessons/07-eip/' | relative_url }}) · [下一篇：四层负载均衡：LVS-NAT、DR 与 TUN 的数据路径 →]({{ '/lessons/09-lvs/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
