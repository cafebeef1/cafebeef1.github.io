---
layout: default
title: 云网络技术文章
permalink: /lessons/
---

本系列围绕数据包的实际转发路径、Linux 内核实现、工业系统与设计权衡展开。文章按知识依赖顺序组织，但均可独立阅读。

## 云网络架构与虚拟化
1. [云网络架构演进：从物理网络到多租户虚拟网络]({{ '/lessons/01-cloud-network/' | relative_url }})
2. [VPC 的本质：逻辑隔离、地址空间与数据平面]({{ '/lessons/02-vpc/' | relative_url }})
3. [跨宿主机二层通信：VXLAN 封装与端点发现]({{ '/lessons/03-overlay-path/' | relative_url }})
4. [分布式网关：VPC 跨子网流量如何转发]({{ '/lessons/04-distributed-routing/' | relative_url }})

## 公网、NAT 与安全
5. [云 NAT 网关：连接跟踪、端口容量与扩展性]({{ '/lessons/05-nat/' | relative_url }})
6. [云网络访问控制：安全组、ACL 与有状态防火墙]({{ '/lessons/06-security/' | relative_url }})
7. [弹性公网 IP：地址映射、回程路径与故障切换]({{ '/lessons/07-eip/' | relative_url }})
8. [云上公网出口：EIP、Internet Gateway 与 NAT Gateway]({{ '/lessons/08-egress/' | relative_url }})

## 负载均衡
9. [四层负载均衡：LVS-NAT、DR 与 TUN 的数据路径]({{ '/lessons/09-lvs/' | relative_url }})

## 后续专题
IPVS 连接调度与高可用、VXLAN/EVPN、OVS/OVN、SDN、Kubernetes 网络、云网络故障排查。
