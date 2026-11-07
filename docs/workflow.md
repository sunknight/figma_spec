# spec 驱动设计工作流手册（workflow）

> 本手册是 Z07 figma-spec 的完整工作流速查（泛化自 zh_code `docs/spec-workflow.md`，任务 0016/0020 落档版）。
> 日常会话直接用 skill（`figma-spec`）里的 runbook；本文件供人通读全貌与按场景对号。

## 0. 总览与三条铁律

```
<项目>/design/specs/<pageId>.json   ← 唯一事实源（A/B 变体标识 variants/ver/@<变体> + rd- 冻结码）
   ├──→ Figma 画布（视觉呈现 / 评审）   小改走桥手术；整页走 regen 矢量重建；人工改动走 figma-diff 收回
   └──→ Vue 页面（可运行原型 SFC）      gen-vue 每页一个自包含 .vue（多变体分文件）
```

1. **spec 唯一事实源**：Figma 与代码都是 spec 的下游；不承认「只改了 Figma / 只改了代码」的设计变更。
2. **spec 先行**：改设计 = ①改 spec → ②同步 Figma → ③重跑生成链，顺序不可倒置。
3. **生成物勿手改**：画布 frame、gen-vue 产物、manifest 都是生成物；改上游再重跑。

## 1. 新项目接入（一次性）

1. 安装 skill 到项目（见根 `install.md`）：`skill/figma-spec/` → `<项目>/.zcode/skills/figma-spec/`。
2. 建 spec 目录 `<项目>/design/specs/`（或项目惯用路径，命令里 `--specs=` 指过去）。
3. 装桥（一次性，见 `docs/figma-setup.md`），`bridge-status` 绿灯。
4. （推荐）VS Code schema 映射：项目 `.vscode/settings.json` 加

```json
"json.schemas": [{ "fileMatch": ["design/specs/*.json"], "url": "./.zcode/skills/figma-spec/schema/spec.schema.json" }]
```

5. （可选）`npm i -D ajv` 开启 validate-specs 的 schema 精校。

## 2. spec 编写（规范细节见 skill references/spec-format.md）

```bash
node .zcode/skills/figma-spec/tools/new-spec.mjs bd40 招标计划 --kind=page --dir=design/specs --at 120,600
```

要点：真实业务文案；可点元素带唯一 `rd-` id；abtest 差异用 variants/ver/@<变体> 表达；写完必跑 `validate-specs`。

## 3. 生成 Figma（细节见 references/spec-figma.md）

- 小改（几处节点）→ MCP 手术（get_node_info/set_text_content/move_node/resize_node…），改完与 spec 逐项核对。
- 整页/新页 → `node tools/regen.mjs <pageId> --specs=design/specs`（删旧重建 + 挂 Section + 自动 QC 截图）。
- **人工已在画布上改过** → `node tools/figma-diff.mjs <pageId> --specs=design/specs [--write]`（差异报告/文案回写；细节见 skill references/spec-figma.md §反向同步）。
- 验收 → `export-qc` 导 PNG 交视觉走查（字段齐全/对齐/无重叠/无残留），不过改 spec 重跑。

## 4. 生成 Vue（细节见 references/spec-vue.md）

```bash
node tools/gen-vue.mjs home02 --specs=design/specs --out=src/pages   # 多变体页自动分文件 Home02.a.vue / Home02.b.vue
```

- 原型模式：产物即用（自包含 SFC，`data-ele-id` 点击契约 + `props.data` 数据回填口）。
- 薄壳 + 稳定层模式（长期项目）：块组件手写一次 + 生成器只产薄壳与 manifest（码漂移报告）；参考 zh_code gen-redesign-blocks.mjs 机制。

## 5. 场景速查

| 场景 | 步骤 |
|---|---|
| 改既有页文案/数据 | 改 spec → regen 该页 → export-qc 核对 → gen-vue 该页 |
| 加可点元素 | spec 项带唯一 id → 校验 → regen → gen-vue → 宿主接线（跳转关系宿主定） |
| abtest 多变体 | spec 声明 `variants` + ver/@<变体> 差异 → regen `--ver=a`/`--ver=b` 各画 → gen-vue 各出（分变体文件） |
| **人工改了 Figma 画布** | `figma-diff <pageId>` 报差异 → `--write` 回写文案类 → 结构类人工决策改 spec → validate → regen → diff 复验全绿 |
| 新增页面 | new-spec → 编辑 → 校验 → regen 上画布 → 走查过审 → gen-vue |
| 新增块类型 | 四处同步（build-lib + gen-vue + schema + spec-format §4）→ spec 用之 → 重跑 |
| 换肤/改风格 | style-tokens 两处令牌同步改 → regen --all + gen-vue --all |
| 删除页面 | 删 spec → 画布删 frame（手术路径）→ gen-vue 侧删产物；冻结码留 manifest 档案 |

## 6. 红线提醒（继承 zh_code）

- 冻结码不可改值（改码 = 下游孤儿）；换码 = 新增新码 + 人工迁移。
- 跳转关系由宿主/配置层/人工确认，spec 与生成物只声明「可点」不决定「去哪」。
- 密钥不入库；桥频道不是密钥但避免无关扩散。
- 生成物勿手改；spec 落盘形制（1 空格缩进/无末尾换行/中文不转义）由脚本保持。
