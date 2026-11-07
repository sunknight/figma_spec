# spec 编写规范（spec-format）

> 单页契约：`design/specs/<pageId>.json`。改设计永远从改 spec 开始。
> 校验：`node tools/validate-specs.mjs --specs=<specs目录>`（schema 精校须 `npm i -D ajv`）。

## 1. 页级骨架

```jsonc
{
  "pageId": "bd30",            // = 文件名（去 .json）= 页面目录名
  "title": "公告详情",          // 页标题（frame 名 / Vue 页注释）
  "size": [375, 812],          // 画布尺寸（移动端宽固定 375，超高自动扩）
  "at": [120, 2495],           // Figma 画布网格坐标（按分区摆放；缺省 [0,0]）
  "variants": ["a", "b"],      // ← 声明 A/B 变体空间（可选；用变体标记前必须声明，见 §2）
  "blocks": [ ... ]            // 块序列（自上而下）
}
```

- 落盘形制：`JSON.stringify(obj, null, 1)`、**不带末尾换行**、中文不转义。
- pageId 前缀分区是项目自约定（如 s=登录 bd=投标人），通用约束 `^[a-z][a-z0-9]{1,11}$`，且 == 文件名。

## 2. A/B 变体标识（一个 spec 表达任意多个变体，单源）

一份 spec 同时表达多个 abtest 变体形态，靠三层标识（解析器 `tools/resolve-ver-lib.mjs`）：

| 粒度 | 写法 | 语义 |
|---|---|---|
| 页级 | `"variants": ["a", "b"]` | **声明本页变体空间**（用变体标记前必须声明；不用变体可整个省略） |
| 块 / 对象数组项 | `"ver": "a"`（缺省 = 所有变体共有） | 该块/项只在对应变体输出 |
| 字段 | `"k@a": 值` / `"disabled@b": true` | 值仅作用于对应变体并覆盖裸键；裸键 = 各变体共有值 |
| 字符串数组 | `"tabs@a": [...]` | 整组覆盖（字符串项无法逐项带标识） |

- 变体名形制 `^[a-z][a-z0-9_]{0,15}$`（a / b / lite / pro / cn / global…），**只能引用页内声明过的变体**，`all` 为保留字不可用。
- 标识键定名 `ver`，勿挪作数据字段；`@` 后缀即变体名。
- 解析：`node tools/resolve-ver.mjs <spec> --ver=b` 输出目标变体纯 spec（剥标识/冻结码；下游渲染器不识标识时先过它）。
- **多变体示例**：`examples/specs/home01.json`（a 版带统计条、hero 副文案分变体）、`detail01.json`（主按钮文案分变体）。

## 3. 可点编码（id 冻结纪律）

- 块 `"id"` = 块基码（如 `"rd-hero"`，形制 `rd-{type}{序}`）；**可点数组项 `"id"` = 最终码**（如 `"rd-svc-guarantee"`）。
- links 项形制：`{"t": "忘记密码？", "id": "rd-loginCard-link-0"}`（对象才能携带 id）。
- 规则：**新增可点元素必须带唯一 `id`**（`^rd-[A-Za-z0-9][A-Za-z0-9-]*$`、页内唯一）；重复/缺 id 由校验与生成链拦截。
- **码一旦被下游引用（埋点/绑定/DB）不可改值**；确需换码 = 新增新码 + 人工迁移绑定。
- gen-vue 会把 id 渲染为 `data-ele-id` 属性（点击契约：冒泡到根统一 emit）。

## 4. 块类型清单（38 类）

**chrome 块**（4，编译/生成时剥离或转页面壳，不进内容区）：`statusbar`（`dark?`）、`navbar`（`title, back?`）、`tabbar`（`active, tabs:[{key,label,badge?}]`）、`spacer`（`h`，可负=叠卡）。

**内容块**（33 + 1 库保留）：完整字段形制见 `schema/spec.schema.json` 的 `blk<Type>` 定义（VS Code 经 `.vscode/settings.json` 映射后打开 spec 即有补全）。速记：

| 族 | 类型 |
|---|---|
| 横幅 | hero（`title,sub,h?,ca?`）/ heroStats / brandHero / findpwHero / intro |
| 卡片内容 | infoCard（kv 行）/ listCard·annList（列表行）/ attachRows / msgList / timeline / typeCards / profileCard / certBadge / scanView / videoCard / cardGroup |
| 表单 | formCard / loginCard / agreeRow / submitBtn / btnRow / flowSteps |
| 宫格统计 | quickGrid / serviceGrid（badge: new/hot/wait）/ stats4 / statPanels |
| 搜索筛选 | searchBar / filterChips / segTabs / vipStrip / annFlow |
| 空态页脚 | emptyHint / footer / bottomTip / helpStrip（库保留） |

**新增块类型 = 四处同步**：`tools/build-lib.mjs` 渲染器 + `tools/gen-vue.mjs` 渲染器 + `schema/spec.schema.json` + 本文件 §4；然后重跑校验与生成链。

## 5. 编写硬规则（继承 0075 实战）

1. **页面内标题唯一**：有 navbar 就不要再有 hero 大标题（反之亦然）；列表/表单页用 navbar，工作台/首页/登录用 hero 族。
2. 第一个 block 通常 `statusbar`（hero 族自带头部的登录类页可省）。
3. 有底部 tab 的页（工作台/首页/消息/我的）最后加 `tabbar`；二级页不加。
4. 文案用**真实业务文案**（从需求描述提炼），不要 lorem；数字用合理示例值。
5. 图标只能引用 `assets/icons/` 现有资产名；没有合适的就不用图标或用 `vicon` 矢量拼装。
6. `links` 前缀 `R:` 的条目右对齐（`R:还没有账号？立即注册`）。

## 6. 起步

```bash
node tools/new-spec.mjs home02 工作台 --kind=page    # 或 --kind=login / --kind=home；--variants=a,b 声明变体空间
node tools/validate-specs.mjs --specs=./specs        # 校验
node tools/regen.mjs home02 --specs=./specs          # 上画布（桥须在线）
```

样例（全部为通用脱敏内容）：`examples/specs/home01.json`（工作台，A/B 变体演示）、`login01.json`（登录，无变体最简形态）、`detail01.json`（活动详情，按钮文案分变体）。
