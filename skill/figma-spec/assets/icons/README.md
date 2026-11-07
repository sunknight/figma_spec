# 图标资产目录

spec 的 `icon` 字段引用此目录的 PNG 资产名（如 `user` → `user.png`），供 build-lib 画布渲染 image fill。

- 本目录**不随包分发二进制**：缺资产时 Figma 侧画 soft 色圆角占位、Vue 侧渲染 `.ic` 色块（带 `data-icon="<名>"`，宿主可替换为真图标组件），不中断生成。
- 放置：`<名>.png`，建议 96×96 以上正方形、透明底。
- 常用资产名参考：`user lock lockfill phone mail code eye search folder globe star building clock service chat invoice shieldpay eyeview plane chevback chevright` + tab 系 `home project message mine service`（tabbar 直接用 key）。
- 新图标优先复用现有资产；Figma 插件无法凭空生成新图标。
