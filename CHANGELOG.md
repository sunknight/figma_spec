# Changelog

本工具包面向「想在任何项目复用 spec 驱动设计（spec → Figma → Vue）」的团队与 agent。spec 是页面唯一事实源，画布与代码都是下游产物。

## [0.1.0] - 2026-11-08
### Added
- 用一份 JSON spec 作为页面唯一事实源：38 类区块契约 + `validate-specs` 契约校验，写错字段名、非法变体标识、可点码形制不符都会被拦下。
- 一个 spec 可声明任意多个 A/B 变体（页级 `variants` + 块级 `ver` + 字段级 `@变体` 覆盖），画布与代码按变体各出形态。
- 可把 spec 一键重建到 Figma 画布（`regen`，产出原生可编辑矢量节点，非贴图），并导出整页 PNG 交视觉走查（`export-qc`）。
- 人工直接在 Figma 上改过的画布，可提取与 spec 的差异并回写（`figma-diff --write`）：文案修改自动回写，结构增删只报告、由人决策。
- 可从 spec 生成自包含 Vue 3 原型页（`gen-vue`）：每页一个 `.vue`、零运行时依赖、带 `data-ele-id` 点击契约；多变体页自动按变体分文件。
- 提供一键安装（`install.sh <项目>`）：拷一个目录即把上述能力与全套操作手册装成 agent skill。
- 附 Figma 插件桥安装与排障手册：社区插件 `cursor-talk-to-figma-mcp-plugin` + 本机 WebSocket 桥 + 频道配对 + 四级体检。
