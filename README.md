# figma-spec — spec 驱动设计工具包

> 「spec → Figma → Vue」工作流：**spec 是唯一事实源**，画布与页面代码都是它的下游产物；人工改了画布也能反向同步收回。
> 供任何项目安装复用；一个 skill 装完即获得全部能力。

## 能力总览

| 能力 | 入口 |
|---|---|
| 写 spec（38 块类型契约 + **A/B 变体标识** + rd- 冻结码） | `skill/figma-spec/references/spec-format.md` |
| abtest 多变体（一个 spec 声明任意变体空间，按变体出画布/出代码） | 同上 §2 + `tools/resolve-ver.mjs` |
| spec 契约校验（JSON Schema + 脚本级检查） | `tools/validate-specs.mjs` |
| 连 Figma（插件桥安装/启动/频道/体检） | `docs/figma-setup.md`、`tools/bridge-status.mjs` |
| 改 Figma 页面（MCP 手术 / regen 整页矢量重建） | `references/spec-figma.md`、`tools/regen.mjs` |
| **反向同步（人工改过的画布 → 差异提取 → 回写 spec）** | `tools/figma-diff.mjs` |
| QC 截图验收（导 PNG 交视觉走查） | `tools/export-qc.mjs` |
| 生成 Vue 页面（自包含 SFC 原型，含点击契约；多变体分文件） | `references/spec-vue.md`、`tools/gen-vue.mjs` |
| 生成评审 Word 文档（总览/截图/变体差异/区块/可点码，发甲方评审） | `references/spec-doc.md`、`tools/gen-doc.mjs` |
| 风格令牌（换肤/版式） | `references/style-tokens.md` |

## 快速开始（在本仓库试跑）

```bash
cd skill/figma-spec
node tools/new-spec.mjs home02 工作台 --kind=home --dir=examples/specs   # 起 spec 骨架（--variants=a,b 声明变体）
node tools/validate-specs.mjs --specs=examples/specs                     # 契约校验
node tools/gen-vue.mjs home02 --specs=examples/specs --out=examples/vue  # 生成 Vue 原型页
node tools/bridge-status.mjs                                             # 桥体检（画布操作前置）
node tools/regen.mjs home02 --specs=examples/specs                       # 上 Figma 画布（桥在线时）
# 人工在 Figma 改了文案之后：
node tools/figma-diff.mjs home02 --specs=examples/specs --write          # 差异提取 + 回写 spec

# 出评审 Word 文档（自动嵌入 qc 截图）
node tools/export-qc.mjs --out=examples/qc
node tools/gen-doc.mjs --specs=examples/specs --qc=examples/qc --out=examples/design-review.docx
```

## Figma 插件安装（画布读写前置，一次性）

画布读写靠 **WebSocket 桥 + Figma 社区插件**（`cursor-talk-to-figma-mcp` 项目）：

| 项 | 值 |
|---|---|
| 插件名称 | **cursor-talk-to-figma-mcp-plugin**（Figma 社区，免费） |
| 官方社区页 | https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin |
| 开源仓库 | https://github.com/grab/cursor-talk-to-figma-mcp（含 MCP server 与 WebSocket 桥 `src/socket.ts`） |
| 桥地址 | `ws://127.0.0.1:3055`（本机，`bun run src/socket.ts` 启动） |

安装与启动三步：

1. **装插件**：Figma 桌面端 → Community 搜 `cursor-talk-to-figma` → 打开插件页点 Install（或直接开上方社区链接）。
2. **启桥**：`git clone https://github.com/grab/cursor-talk-to-figma-mcp && cd cursor-talk-to-figma-mcp && bun install && bun run src/socket.ts`（常驻；探活 `curl -s http://127.0.0.1:3055/` 返回 200 即在跑）。
3. **配频道**：Figma 打开目标文件 → Plugins → 运行 `cursor-talk-to-figma-mcp-plugin` → 面板出现 `Channel: xxx` → `echo -n xxx > skill/figma-spec/tools/.channel` → `node tools/bridge-status.mjs` 全绿即就绪。

完整手册（含 ZCode MCP 注册、故障排查表）：`docs/figma-setup.md`。

## 目录

```
figma_spec/
├── README.md               本文件
├── install.md / install.sh 装到其他项目
├── skill/figma-spec/       ← 完整自包含 skill 包（安装单位）
│   ├── SKILL.md            入口技能：铁律 + 场景路由 + 工具速查
│   ├── references/         6 份 runbook（spec-format / figma-bridge / spec-figma / spec-vue / spec-doc / style-tokens）
│   ├── tools/              11 个脚本（新增 gen-doc：评审 Word 文档）（driver/bridge-status/new-spec/validate-specs/resolve-ver(-lib)/build-lib/regen/export-qc/figma-diff/gen-vue）
│   ├── schema/spec.schema.json   spec 契约（draft-07，64 定义；变体后缀全层级放行）
│   ├── examples/           home01/login01/detail01 三份脱敏示例（含变体演示）+ vue 产物 + qc 截图
│   └── assets/icons/       图标资产目录（PNG 自备，缺省占位兜底）
└── docs/
    ├── figma-setup.md      插件桥安装/启动/排障手册
    └── workflow.md         完整工作流手册（含反向同步场景）
```

## 来源与演化

- 源自实战交付项目的 spec 驱动设计管线，独立化为零业务耦合的通用工具包。
- 关键设计：**A/B 变体模型（variants/ver/@<变体>，单源多变体）**；契约校验与生成器互补；渲染库全部 spec 驱动（无业务硬编码）；图标缺失占位兜底；gen-vue 原型模式 + 可演进薄壳模式；figma-diff 反向同步（画布差异回写 spec）。
- 扩展纪律：新增块类型/字段 = 四处同步（build-lib + gen-vue + schema + spec-format §4）。

## 运行依赖

- node ≥ 22（原生 WebSocket）或 bun；regen/export-qc/figma-diff 需 Figma 桥在线（`docs/figma-setup.md`）。
- 可选：`ajv`（validate-specs 的 schema 精校；缺省自动降级精简校验）。
