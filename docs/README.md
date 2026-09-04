# Canvases Sports 文档

- [产品定义](产品定义.md)
- [技术架构](技术架构.md)
- [数据源调查](数据源调查.md)
- [苏超积分榜设计](苏超积分榜设计.md)
- [Canvas Grid Template](canvas-template.md)
- [Shortcut 构建指南](shortcut.md)
- [v0.1 Dynamic Standings PoC 归档](v0.1-dynamic-standings-poc.md)
- [v0.2 Dynamic Fixtures 真机验证归档](v0.2-dynamic-fixtures.md)
- [v0.2 Match Result Settlement](v0.2-match-result-settlement.md)
- [v0.2 Phase 3 Match Result Ingestion](v0.2-match-result-ingestion.md)
- [v0.2 Phase 4 ResultCandidate Entry](v0.2-result-candidate-entry.md)
- [v0.2 Phase 5 Result Adapter](v0.2-result-adapter.md)
- [v0.2 Production Data Sync](v0.2-production-data-sync.md)
- [开发日志](开发日志.md)
- [决策记录](决策记录.md)
- [Roadmap](Roadmap.md)

v0.2 的 Candidate 测试以独立内存/临时数据为输入；正式候选文件允许处于空、待审核或已确认状态，测试不依赖其数量。

Phase 5 将固定权威转载快照解析为 Observation，再经严格 fixture 匹配进入同一 Candidate 合同。机器负责发现，人负责确认；Adapter 不写正式赛果。

生产同步仅在两个独立可信来源一致时自动跨越 Candidate → Fact，并继续复用既有 settlement 与 standings builder。异常仍由人工处理。
