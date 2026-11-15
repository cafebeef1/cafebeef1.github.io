---
layout: default
title: 云网络技术博客
---

从 Linux 网络栈与实际报文路径出发，系统分析云网络的核心机制、工业实现与工程取舍。

文章围绕 VPC、分布式网关、NAT、网络安全、EIP、LVS 与 Overlay 等主题展开。每篇尽量回答四个问题：**机制为何存在、数据包如何流动、实际系统怎样实现、工程上如何验证与取舍**。

[阅读全部技术文章 →]({{ '/lessons/' | relative_url }})

## 推荐阅读

- [VPC 的本质：逻辑隔离、地址空间与数据平面]({{ '/lessons/02-vpc/' | relative_url }})
- [跨宿主机二层通信：VXLAN 封装与端点发现]({{ '/lessons/03-overlay-path/' | relative_url }})
- [云 NAT 网关：连接跟踪、端口容量与扩展性]({{ '/lessons/05-nat/' | relative_url }})
- [四层负载均衡：LVS-NAT、DR 与 TUN 的数据路径]({{ '/lessons/09-lvs/' | relative_url }})

> 本站将厂商公开产品行为与通用技术模型分开描述，避免将单一实现误认为所有云平台的统一架构。
