---
layout: default
title: "EIP、NAT Gateway 与路由表"
permalink: /lessons/08-egress/
---

## 核心问题
一台有 EIP 的 VM，访问公网时是否必然使用该 EIP？

不必然。要区分**虚拟机内路由**、**VPC 路由/出口策略**和**公网地址转换**。

```text
VM-A 10.0.1.10
  → Linux default via 10.0.1.1
  → 云网络 VPC 出口选择
       ├→ EIP 出口：203.0.113.10
       └→ NAT Gateway：203.0.113.20
```

不同云平台对此有不同产品限制。例如 AWS 的典型公有子网通过 Internet Gateway 出站；私有子网通过 NAT Gateway 出站，EIP 本身不是 VPC 路由表中的下一跳。

## Linux 排查
```bash
ip route get 8.8.8.8
curl -4 https://api.ipify.org
env | grep -i proxy
ss -tn
```

`ip route get` 只能说明 VM 如何交付给逻辑网关，不能独立证明云平台后续选择哪个公网出口。

## 设计权衡
公网服务通常通过 EIP 或公网 LB 暴露；只需出站的私网服务器通过 NAT Gateway；内部云服务尽量使用私有网络端点。

## 思考题
1. 仅凭 VM 的默认路由能判断实际公网源 IP 吗？
2. 如果请求实际经过 NAT Gateway SNAT，公网目标看到的是谁的地址？

---

[← 返回课程目录]({{ '/lessons/' | relative_url }})
