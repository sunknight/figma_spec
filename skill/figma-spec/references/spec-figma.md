# spec → Figma 画布（spec-figma）

> 前提：桥在线（`node tools/bridge-status.mjs` 绿灯），Figma 桌面端打开目标文件。
> 铁律：先改 spec，再动画布（spec-figma 同步是第 ② 步，不是起点）。

## 两条路径，按改动幅度选

### 路径 A · 小改手术（默认：几处节点增删/挪位/文案/换色）

用 MCP `figma-canvas` 工具直接在画板上操作，改完与 spec 逐项核对。常用工具与套路（实战范式）：

| 意图 | 工具链 |
|---|---|
| 看结构 | `get_node_info` / `get_document_info` / `scan_text_nodes` / `scan_nodes_by_types` |
| 改文案 | `set_text_content`（批量：`set_multiple_text_contents`） |
| 删元素 | `delete_node` / `delete_multiple_nodes`，删后**手动补位**：下方节点 `move_node` 上移、frame `resize_node` 缩高 |
| 加元素 | `create_frame/rectangle/text` + `set_fill_color/set_corner_radius…`；或 `clone_node` 复制同类节点再改 |
| 挪位/换父 | `move_node` / `set_parent`（保持绝对坐标） |
| 排宫格 | 删项后重排列位：x 按步进（如 `x = 起点 + 列号×79`）逐个 `move_node` |
| 换图标 | `set_image_fill`（imagePath/imageBase64）；图标节点名带 `[文件名]` 标签便于定位 |

手术要点：
1. 动手前 `get_node_info` 记下目标节点树与坐标（改后要核对/补位）。
2. 改完必须把 spec 同步改到位（若手术源于临时调整，反向回写 spec 再收工）。
3. 结构性变化超过 ~1/3 页 → 别手术了，走路径 B 整页重建更省。

### 路径 B · 整页重建 / 新页（结构大改）

```bash
node tools/regen.mjs <pageId>... --specs=<specs目录>          # 删旧 frame → 矢量重建 → 挂 Section → QC 截图
node tools/regen.mjs <pageId> --ver=b                         # 指定 A/B 变体形态（自动剥变体标识）
node tools/regen.mjs <pageId> --dry                           # 只看 spec 清单不动画布
node tools/regen.mjs <pageId> --expect='评审稿'               # 文件守卫：插件绑定文件名不含关键词则拒绝
```

- 渲染器 = `tools/build-lib.mjs`（矢量重建：原生可编辑节点，非贴图）；风格令牌在文件头 `C`（换肤见 style-tokens.md）。
- Section 挂载（可选）：specs 目录放 `sections.json`：`{"sections":{"组名":"SectionId"},"pageGroups":{"bd30":"组名"}}`；无配置则 frame 落 `spec.at` 坐标（当前页顶层）。
- ⚠ regen 会**先删除当前页所有与 pageId 同名前缀的旧 frame**（Section 内 + 顶层）；确认画布是生成稿而非手稿再跑。

## 验收（出评审图，必做）

```bash
node tools/export-qc.mjs [--out=qc] [pageId ...]    # 全部页面 frame → PNG，平铺 <pageId>.png
```

AI 视觉走查清单（把 PNG 交给视觉模型/自己逐张核对）：
1. **字段齐全**：spec 里每个字段/条目都在图上出现，无漏渲染。
2. **对齐**：页边距 16、卡内边距 18、块间净空 12（见 style-tokens.md）。
3. **无重叠错位**：无文字叠文字、按钮出框、图标压字。
4. **无残留**：删掉的元素不残影；占位色块（图标缺资产的兜底）要识别出来，补 PNG 后重跑。

经验（踩坑）：`export_node_as_image` 的 URL 直传视觉模型偶发 1210 解析错误——稳定做法是先导出本地 PNG 再走查（export-qc 已如此）。

## 多变体画布（A/B test）

同一份 spec 的每个变体各重建一次：`--ver=a` / `--ver=b`（缺省 = variants[0]）。多变体通常各占画布一列（spec 的 `at` 坐标错开）或各放一个 Figma 文件/页面（切文件 = Figma 里切到目标文件重跑插件，注意 `--expect` 守卫防画错文件）。变体语义见 spec-format.md §2。

## 反向同步：人工改过的画布 → 提差异回写 spec

现实中设计师常直接改 Figma 生成稿。**收复单源地位的流程**（铁律 1 的回路）：

```bash
node tools/figma-diff.mjs <pageId>... --specs=<specs目录>            # 只报告差异
node tools/figma-diff.mjs <pageId>... --specs=<specs目录> --write    # 报告 + 文案修改回写 spec
```

报告分四类：
- **✏️ 文案修改**：画布文本 ↔ spec 文本叶按阅读序 LCS 对齐配对；`--write` 回写（路径含 `@变体` 后缀时精准落到变体专属字段；`R:` 右对齐标记保留）。
- **➕ 画布独有 / ➖ spec 有画布无**：结构增删信号——**不自动回写**（反向工程不安全），人工判断后改 spec 再 regen。
- **↔ 渲染等价**：一条 spec 文本被渲染器拆成多段画布节点（如混合链接行）或纯 y 微差换序——自动消除不算差异。
- **⚠ 结构信号**：frame 高度收缩（内容被删迹象）。

要点：
1. 对比的是**目标变体**形态（缺省 variants[0]，`--ver=b` 指定）。
2. 状态栏时间/返回箭头/「下载」等渲染器常量自动滤除。
3. 回写后必跑 `validate-specs` + `regen` 重建，diff 复验全绿（画布↔spec 重新一致）才算闭环。
4. 退出码：0 = 一致/已全部回写；1 = 有待人工处理的差异（可挂 CI/流程检查）。

## 新增页面全链（场景串讲）

1. `node tools/new-spec.mjs <pageId> <标题> --kind=...` 起 skeleton，编辑 spec 到位（真实文案 + 可点 id）。
2. `node tools/validate-specs.mjs --specs=...` 过校验。
3. 定 `at` 坐标（画布分区网格；同区分辨率内不重叠即可）。
4. 路径 B 上画布 → export-qc → 视觉走查 → 改 spec 重跑，直到过审。
5. `node tools/gen-vue.mjs ...` 生成 Vue 原型页（spec-vue.md）。
