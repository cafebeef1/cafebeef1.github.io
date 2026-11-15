---
layout: default
title: "云网络访问控制：安全组、ACL 与有状态防火墙"
permalink: /lessons/06-security/
---

> 本文围绕可验证的网络机制与工程实现展开。文中地址为教学示例，具体云产品行为应以官方文档和实际配置为准。

## 1. 为什么 VM 内没有规则也会被拦截

云平台的安全策略可以执行在虚拟机外部，例如宿主机虚拟交换机、OVS 流表、eBPF 程序或网络硬件中。因此虚拟机执行 `iptables -L` 看不到拒绝规则，并不能说明云平台没有过滤流量。

安全组通常关联虚拟网卡或实例，网络 ACL 通常关联子网。以 AWS 的语义为例，安全组有状态，网络 ACL 无状态；其他厂商的规则优先级、默认行为和对象粒度可能不同。

## 2. 从一个 TCP SYN 观察过滤过程

```text
VM-A 10.0.1.10:50000
  → 源侧出站策略
  → VPC 路由 / Overlay
  → 目标子网 ACL
  → VM-B 入站安全组
  → VM-B 10.0.2.20:443
```

这是逻辑检查点，不代表所有云平台都按这一物理执行顺序逐项检查；实际流水线可能融合过滤、路由和封装。

如果入站安全组允许 `10.0.1.0/24 → TCP 443`，一个有状态实现可识别该连接的返回 SYN-ACK，通常无需单独配置对应出站返回规则。无状态 ACL 则仍需要允许返回方向的端口与地址范围。

## 3. Stateful 与 Stateless 的区别

有状态过滤器会记录连接信息，并依据 `NEW`、`ESTABLISHED`、`RELATED` 等状态处理后续包；无状态过滤器只依据当前包的头字段和规则判断。后者实现直观，但 TCP 客户端的临时端口范围容易被漏配。

```bash
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -p tcp -s 10.0.1.0/24 --dport 443 \
  -m conntrack --ctstate NEW -j ACCEPT
conntrack -L
```

这些 Linux 规则用于理解状态匹配，**不等于**云平台直接在 VM 内运行这些命令。

## 4. 工业实现

AWS Security Group 采用有状态规则模型，Network ACL 采用无状态规则模型；AWS 还定义了部分连接跟踪的特殊情况，应参考官方连接跟踪文档。阿里云安全组同样提供实例级网络访问控制，但默认策略、规则优先级和具体产品能力需要按其文档确认。

在开源领域，OVN 的 ACL 可以在逻辑交换机/路由器流水线中表达访问策略，Open vSwitch 的 conntrack action 可以与流表结合实现有状态处理；eBPF 也可用于实现高性能过滤和可观测性。

## 5. 排障方法：从抓包现象缩小范围

```bash
ip route get 10.0.2.20
ss -lntp | grep ':443'
tcpdump -ni eth0 'host 10.0.1.10 and tcp port 443'
nft list ruleset
```

- 目标 VM 看不到 SYN：检查源侧策略、路由、Overlay、目标侧 ACL 和安全组。
- 收到 SYN 但没有 SYN-ACK：检查本机防火墙、监听状态与 TCP 栈。
- 发出了 SYN-ACK 但客户端未收到：重点检查回程路由、无状态 ACL 与中间设备。
- 三次握手完成仍超时：继续检查 TLS 和应用层。

单个抓包点只能限定故障区间，不能直接证明某条云规则命中。

## 参考资料
- [AWS — Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)
- [AWS — Network ACLs](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html)
- [AWS — Connection tracking](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-connection-tracking.html)
- [OVN Architecture](https://www.ovn.org/en/architecture/)

---

[← 上一篇：云 NAT 网关：连接跟踪、端口容量与扩展性]({{ '/lessons/05-nat/' | relative_url }}) · [下一篇：弹性公网 IP：地址映射、回程路径与故障切换 →]({{ '/lessons/07-eip/' | relative_url }})

[返回全部文章]({{ '/lessons/' | relative_url }})
