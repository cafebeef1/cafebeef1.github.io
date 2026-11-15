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

[AWS VPC Internet Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) 的公有子网通过 `0.0.0.0/0 → Internet Gateway` 提供公网路径。实例还需要公有 IPv4 地址或 EIP，并满足安全组、网络 ACL 等条件。Internet Gateway 为公有 IPv4 流量提供一对一地址转换。

[AWS 私有子网的公有 NAT Gateway 出站路径](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) 使用 `0.0.0.0/0 → NAT Gateway`。公有 NAT Gateway 本身位于具有 Internet Gateway 路径的公有子网，并使用分配给它的公网地址对外通信。

**EIP 本身不是 AWS VPC 路由表中的下一跳目标**；路由表目标包括 Internet Gateway、NAT Gateway 等资源。

### 把 AWS 的两条公网路径画成具体的地址转换链

**公有子网实例直接出站：** 实例私网 IP → 子网路由表 `0.0.0.0/0 → IGW` → IGW 对实例关联的公有 IPv4/EIP 执行映射 → Internet。EIP 并不是一个可单独填写进 VPC 路由表的网关目标。

**[私有子网通过 AWS 公有 NAT Gateway 出站](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)：** VM 私网 IP → 私有子网路由表 `0.0.0.0/0 → NAT Gateway` → NAT Gateway 将源地址转换成自己的私网 IP/端口 → NAT 所在公有子网的 `0.0.0.0/0 → IGW` → IGW 将 NAT 的私网 IP 映射为 NAT EIP → Internet。两条路径的源地址最终不同，回程也须返回对应的映射与连接状态。

根据 [AWS NAT Gateway 文档](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html)，**NAT Gateway 绑定 EIP，并不等于可以跳过 Internet Gateway**。在 AWS 公有 NAT Gateway 通往互联网的场景中，IGW 仍是公网出口必需的一环。AWS 私有 NAT Gateway 则不绑定 EIP，用于到其他 VPC 或本地网络等路径；不能把所有名为 NAT Gateway 的服务都默认视为公网网关。

在多可用区部署时，应核对每个私有子网关联的是哪个 NAT Gateway 以及网关所在 AZ，避免无意间形成跨 AZ 出站的单点依赖。

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
