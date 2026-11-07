# 画布风格令牌（style-tokens）

> 风格唯一落点：`tools/build-lib.mjs` 头部常量 `C`（Figma 渲染）与 `tools/gen-vue.mjs` 的 `CSS` 变量（Vue 渲染）——**两处同步改**，然后重跑生成链。本文是口径文档（提取自 zh_code 0075 STYLE.md v1）。

## 1. 画布与栅格

| 项 | 值 | 说明 |
|---|---|---|
| 页面宽度 | 375px | frame 高 812 起步，内容超高自动扩展 |
| 页边距 | 左右 16px | 页面级元素（卡片/通栏按钮/页级 CTA） |
| 卡片 | 白底，圆角 12px，卡内左右内边距 18px | |
| 卡片间距 | 纵向 12px | 叠卡（hero 上压统计/登录卡）上提 -24 ~ -32px |
| 首末元素 | 距卡顶/卡底 ≥ 18px | |
| navbar → 首块间距 | 通栏块（hero 族/segTabs）= 0 直连；浮层内容块 = 12px 呼吸 | |
| tabbar | 贴页面底，不参与 12px 节奏 | |

## 2. 配色令牌（默认 = 中航深蓝评审版，换肤改这里）

| 令牌 | 值 | 用途 |
|---|---|---|
| primary | `#003399` | 主色：按钮/banner/选中态/强调数字 |
| bg | `#F6F6FA` | 页面底色 |
| card | `#FFFFFF` | 卡片 |
| inputBg | `#F5F6FA` | 输入框底（圆角 8） |
| soft | `#E9EFFB` | 图标底/标签底（随主色派生） |
| text / text2 / text3 / text4 | `#1A1A1A` / `#444653` / `#8A8F99` / `#A6ABB8` | 主文字/次文字/占位/最弱说明 |
| danger | `#E54545` | 必填星号/红点/紧急状态 |
| gold / goldBg | `#B07A00` / `#FBF3DD` | 中标/公示/会员标签 |
| hot（角标） | `#FF7D00` | 宫格 hot 角标 |
| 禁用 | 底 `#E3E6EE` + 字 `#9AA0AC` | 不可用/禁用态按钮 |

**换肤**：改 build-lib `C` + gen-vue `:root` CSS 变量两处（值保持一致），重跑 regen/gen-vue。**禁止**出现令牌之外的颜色。

## 3. 字体

- 默认 `Noto Sans SC`（云端字体四档 400/500/600/700 全有，最稳）；本机装了普惠体等可切 `fontFamily`（改 build-lib `mk.txt` 默认值 + gen-vue font-family）。
- 字号体系：页面主标 20 / 卡片标题 15 / 正文 14 / 次要 12.5 / 辅助 11.5 / 角标 9-11。

## 4. 图标

- PNG 资产：`assets/icons/<名>.png`（命名与 spec `icon` 字段一致）；缺资产时 build-lib 画 soft 色圆角占位（不中断），gen-vue 渲染 `.ic` 色块（`data-icon` 属性带资产名，宿主可换真图标组件）。
- 矢量拼装（无 PNG 时的库内方案）：`vicon` 字段（stamp/lock/unlock/qr/torch/cert/building）由 build-lib 矩形拼装。
- **插件无法凭空生成新图标**——新元素复用现有资产或调布局。

## 5. 文本宽度估算（Figma 侧自动排版依据）

`estW`：CJK 1.0em / 大写 0.66 / 数字小写 0.56 / 空格 0.3 / 其他 0.42；超宽先缩字号（至 minSize 10）再截断加 `…`。写长文案时不必精确测宽——渲染器自动适配，但**关键单行文案尽量 ≤ 18 个汉字**防截断。
