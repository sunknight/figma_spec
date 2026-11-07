# spec → Vue 页面（spec-vue）

> 生成器：`node tools/gen-vue.mjs`。产物 = **可运行原型页**（每页一个自包含 Vue 3 SFC，零运行时依赖）。
> 生成物勿手改：改 spec 重跑；要手工演化先复制改名（文件头有生成标记）。

## 用法

```bash
node tools/gen-vue.mjs home01 --specs=./specs --out=src/pages        # 单页（文件名或 pageId）
node tools/gen-vue.mjs --specs=./specs --out=src/pages --all         # 全量
node tools/gen-vue.mjs home01 --ver=b --specs=./specs                # 指定 A/B 变体形态
```

产物：`<outDir>/<PageId 帕斯卡>.vue`（如 `home01` → `Home01.vue`）；**多变体页按变体分文件**（`Home01.a.vue` / `Home01.b.vue`），宿主按实验分流加载。

## 产物结构与约定

```vue
<template>
  <div class="page" data-page-id="bd30" @click="handleClick">…块…</div>
</template>
<script setup>
defineProps({ data: { type: Object, default: () => ({}) } })   // 接口数据回填口（键名与 spec 字段对应）
const emit = defineEmits(['eleClick'])                          // 点击契约
function handleClick(e) { …closest('[data-ele-id]')… }          // 冻结码统一冒泡上报
</script>
<style scoped>…令牌 + 版式（对应 style-tokens.md）…</style>
```

- **点击契约**：spec 里的 `id` 冻结码 → 元素 `data-ele-id` 属性；点击冒泡到根组件统一 `emit('eleClick', code)`。父层拿 code 做路由/埋点/门控——**跳转关系不在 spec 里决定**（spec 只声明「可点」，去哪由宿主应用的配置/交互层定，继承 zh_code 红线）。
- **数据回填**：静态内容来自 spec（原型态）；`props.data` 预留给接口数据（键名与 spec 字段对应），宿主接线后可覆盖静态值。
- **未收录类型**：渲染为通用卡（类型名 + 字段清单）不中断；项目补渲染器 = `tools/gen-vue.mjs` 的 `T.<type>` 加一段（四处同步纪律）。

## 多变体形态

`--ver=<变体>` 先过 resolve-ver（剥标识）：各变体产物冻结码天然对齐（同码不同形态）——宿主按 abtest 分流逻辑加载对应变体文件即可（参考 zh_code 的 FEATURE_MODE 构建期常量模式，H5 侧禁运行时 env 判断）。

## 两种落地模式（按项目成熟度选）

| 模式 | 适用 | 做法 |
|---|---|---|
| **原型模式（本工具默认）** | 新项目 / 评审对照 / 快速落地 | 直接用 gen-vue 产物；页面自包含，改 spec 重跑覆盖 |
| **薄壳 + 稳定层模式（zh_code 模式）** | 长期维护的正式项目 | 块类型组件手写一次（`Rd<Type>.vue`，33 类）+ 生成器只产每页薄壳（内嵌 spec 数据 + 可点码 + 接口绑定注释）+ 注册表自动追加；视觉改动只碰稳定层，页面增删重跑生成 |

切换到薄壳模式的改造点（zh_code gen-redesign-blocks.mjs 的机制）：
1. 薄壳 = `<RdPageShell :blocks="…内嵌 spec…" :data="…">` + `defineClickables([...最终码])` 声明宏（供扫描器提取）。
2. 生成器维护码清单 manifest（页→码，入 git），每次生成 diff 报**码漂移**（消失码被引用须人工核对）。
3. 生成链幂等：CustomBlock/注册行重复跑不重复追加。

## 红线（继承）

- 冻结码不可改值（改码 = 下游孤儿）；新增可点元素必须带唯一 id。
- 跳转关系人工/配置层确认，生成物只声明「可点」不决定「去哪」。
- 生成物（.vue / 注册行 / manifest）勿手改——改 spec 或稳定层，重跑。
