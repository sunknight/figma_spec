---
name: figma-spec
description: figma-spec 工具包：spec 驱动设计工作流（写 spec → 生成/修改 Figma 画布 → 生成 Vue 页面 / 评审 Word 文档，含反向同步）。含 spec 编写规范（A/B 变体标识 variants/ver/@<变体> + rd- 冻结可点码）、Figma 插件桥（WebSocket 3055 直驱/MCP 手术）、契约校验、整页矢量重建、画布差异提取回写（figma-diff）、QC 截图走查、Vue SFC 与评审 Word 文档生成器、工具脚本。凡用户提到「写 spec / 改设计稿 / 改 Figma 页面 / 上画布 / 出评审图 / 生成 vue 页面 / 生成评审文档 / 出 word / 设计说明书 / 从 Figma 提取修改回 spec / abtest 变体 / spec 驱动」，或在任何项目要采用 spec 驱动设计模式时触发本 skill。
---

# figma-spec：spec 驱动设计工作流

> 源自实战交付项目的 spec 驱动设计管线，独立化为可安装复用的工具包。
> **spec 是唯一事实源**：Figma 画布与 Vue 页面都是 spec 的下游产物；人工改了画布也要经反向同步收回 spec。

## 三条铁律（先读再动手）

1. **spec 唯一事实源**：一切设计改动先落 spec 文件；不承认「只改了 Figma / 只改了代码」的设计变更。人工已在 Figma 上改了的，用 `figma-diff --write` 把差异收回到 spec（见 references/spec-figma.md §反向同步）。
2. **spec 先行**：改设计 = ①改 spec → ②同步 Figma 画布 → ③重跑生成链，顺序不可倒置。
3. **生成物勿手改**：Figma 画布上 regen 生成的 frame、`gen-vue` 产出的 `.vue` 都是生成物——改上游 spec 再重跑；要手工演化先复制改名。

## 架构一图

```
<项目>/design/specs/<pageId>.json    ← 唯一事实源（A/B 变体标识 variants/ver/@<变体> + rd- 冻结码）
   ├──→ Figma 画布（视觉呈现/评审）     小改走桥手术；整页走 regen 矢量重建；人工改动走 figma-diff 收回
   ├──→ Vue 页面（可运行原型 SFC）      gen-vue：每页一个自包含 .vue（多变体按变体分文件）
   └──→ 评审 Word 文档（.docx）          gen-doc：总览+每页截图/变体差异/区块/可点码
```

## 场景路由（按用户意图读对应 runbook）

| 用户说法（示例） | runbook |
|---|---|
| 写 spec / 新页面设计 / spec 怎么写 / 加块 / abtest 变体 | `references/spec-format.md` |
| 连不上 Figma / 装插件 / 启动桥 / 频道 / 体检 | `references/figma-bridge.md` |
| 改画布 / 改设计稿 / 上画布 / 出评审图 / 截图走查 / **Figma 改了同步回 spec** | `references/spec-figma.md` |
| 生成 vue / 出页面代码 / 前端原型页 | `references/spec-vue.md` |
| 生成评审文档 / 出 word / 设计说明书 / 甲方评审 | `references/spec-doc.md` |
| 换主色 / 改风格 / 调版式间距 | `references/style-tokens.md` |

判断不了就问用户（AskUserQuestion），参数（pageId、标题、目标文件、变体名）能从上下文推断就直接用。

## 工具速查（tools/ 相对本 skill 目录）

| 命令 | 作用 |
|---|---|
| `node tools/bridge-status.mjs` | 桥体检：桥进程→频道→插件→画布，一跑定位断点 |
| `node tools/new-spec.mjs <pageId> <标题> --kind=page\|login\|home [--variants=a,b]` | 生成 spec 骨架（--variants 声明 A/B 变体空间） |
| `node tools/validate-specs.mjs --specs=./specs` | 契约校验（schema 精校 + pageId==文件名 + 变体标识合法） |
| `node tools/regen.mjs <pageId>... --specs=./specs [--ver=a]` | 整页矢量重建上 Figma（删旧 frame→重建→挂 Section→QC 截图） |
| `node tools/export-qc.mjs [--out=qc]` | 画布 frame 导出 PNG 走查图 |
| `node tools/figma-diff.mjs <pageId>... --specs=./specs [--write]` | **反向同步**：画布↔spec 差异报告；--write 回写文案修改 |
| `node tools/resolve-ver.mjs <spec.json> --ver=b` | 单源 spec → 目标变体纯 spec（剥标识/冻结码） |
| `node tools/gen-vue.mjs <spec\|pageId> --specs=./specs --out=src/pages [--ver=b]` | spec → 自包含 Vue 3 SFC 原型页（多变体分文件） |
| `node tools/gen-doc.mjs --specs=./specs --qc=./qc --out=评审.docx` | spec+截图 → 评审 Word 文档（总览/变体差异/区块/可点码） |

前提依赖：`node ≥ 22`（原生 WebSocket）或 `bun`；Figma 桥在线（`bridge-status` 绿灯）才能跑 regen/export-qc/figma-diff；gen-doc 需 skill 目录 `bun install`（docx 依赖）。

## 全局纪律（任何操作都适用）

1. **冻结码不可改值**：`rd-` 前缀可点码一旦被下游（埋点/绑定/DB）引用，改码=孤儿；换码 = 新增新码 + 人工迁移。
2. **新增块类型/字段 = 四处同步**：`tools/build-lib.mjs` 渲染器 + `tools/gen-vue.mjs` 渲染器 + `schema/spec.schema.json` + `references/spec-format.md` §块类型；漏同步会被 validate-specs 拦下。
3. **spec 落盘形制**：`JSON.stringify(obj, null, 1)`、无末尾换行、中文不转义——脚本改写保持一致避免无谓 diff。
4. 改完 spec 必跑 `validate-specs`；上完画布必跑 `export-qc` 交视觉走查（字段齐全/对齐/无重叠/无残留）。
5. **变体标记三步法**：页级声明 `variants` → 块/项级 `ver` → 字段级 `k@<变体>`；标记只能引用声明过的变体名。figma-diff/gen-vue/regen 缺省取 `variants[0]`。
6. figma-diff 的结构类差异（新增/缺失文本）**必须人工决策**——工具只回写文案类；回写后 validate + regen + diff 复验全绿才算闭环。
7. 图标：PNG 资产放 `assets/icons/<名>.png`（缺失时画占位色块不中断）；新图标优先复用现有资产。
