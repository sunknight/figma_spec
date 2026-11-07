# spec → 评审 Word 文档（spec-doc）

> 生成器：`node tools/gen-doc.mjs`。产物 = 一份 .docx 设计评审文档：总览 + 每页一章（截图/变体差异/区块清单/可点码）。
> 场景：发甲方或团队评审确认、设计归档、交接说明书。生成物勿手改——改 spec/截图后重跑。

## 用法

```bash
node tools/export-qc.mjs --out=qc                       # 先导最新截图（文档自动嵌入 qc/<pageId>.png）
node tools/gen-doc.mjs --specs=./specs --out=评审文档.docx          # 全量页
node tools/gen-doc.mjs --specs=./specs --pages=home01 --out=d.docx  # 指定页
node tools/gen-doc.mjs --specs=./specs --title="XX项目 · 页面设计评审" --out=d.docx
```

参数：`--specs`（spec 目录）、`--pages`（逗号分隔过滤）、`--qc`（截图目录，默认 ./qc）、`--out`（产物路径）、`--title`（文档标题）。
依赖：`docx`（skill 目录 `bun install` / `npm i`；缺失时脚本有提示）。

## 文档结构（每页一章，自动分页）

| 节 | 内容 |
|---|---|
| 封面 | 文档标题 · 生成时间 · 页面数 · 「由 spec 自动生成勿手改」声明 |
| 页面总览 | 全页表格：pageId / 标题 / 变体 / 块数 / 可点码数 / 截图有无 |
| 每页章 | 元信息（尺寸/画布坐标/变体空间）→ **评审截图**（qc PNG，缺失则红字提示先 export-qc）→ **A/B 变体差异**（哪些块/字段带变体标记、各变体取值）→ **区块清单**（# / 类型 / 摘要 / 冻结码 / 变体）→ **可点编码清单**（冻结码 + 文案载体 + 「不可改值」注） |

## 约定

1. **先图后文**：截图与画布一致性靠 export-qc 保证——改过设计先 regen + export-qc 再 gen-doc，否则文档嵌的是旧图。
2. 评审意见回收：甲方在 Word 里批注 → 改动落回 spec（改文案/结构），重跑生成链，勿直接改文档当事实源。
3. 版式定制（字体/表格样式/加封面页眉）改 `tools/gen-doc.mjs` 的文档模板段——改完重跑即生效，模板也是代码。
4. 样例产物：`examples/design-review.docx`（三页示例 spec + qc 截图生成）。
