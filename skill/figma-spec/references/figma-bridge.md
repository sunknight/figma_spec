# Figma 插件桥（figma-bridge）

> 读写 Figma 画布的唯一通道：**WebSocket 桥（127.0.0.1:3055）+ Figma 社区插件 + 频道配对**。
> 提取自 zh_code 0074/0075 实战配置。详细安装手册（含本机现状）见工具包 `docs/figma-setup.md`。

## 1. 组件与拓扑

```
脚本(tools/driver.mjs) ──┐
                         ├── ws://127.0.0.1:3055（Bun WebSocket 桥，频道广播）── Figma 桌面端插件（频道 ID 配对）
MCP figma-canvas 工具 ───┘
```

- **桥**：[grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) 仓库的 `src/socket.ts`（Bun 运行，常驻；ZCode 退出不退）。
- **插件**：Figma 社区插件 **cursor-talk-to-figma-mcp-plugin**（免费，[社区页直达](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin)），在 Figma 桌面端运行，面板显示频道 ID 与在线状态。
- **两条使用路径**：① agent 用 MCP 工具（`get_node_info`/`set_text_content`/`clone_node`…）逐节点手术；② 脚本用 `tools/driver.mjs` **直驱**（同协议：join/message + id 配对），regen/gen 全走这条，不经 MCP。

## 2. 首次安装（新机器/新环境）

1. 装 Bun（`curl -fsSL https://bun.sh/install | bash`）。
2. 拉仓库到本机：`git clone https://github.com/grab/cursor-talk-to-figma-mcp.git`（如放 `~/web/code/tools/`）→ `bun install`。
3. 启桥：`cd <repo> && bun run src/socket.ts`（常驻；建议 nohup/launchd 托管；探活 `curl -s http://127.0.0.1:3055/` 应 200）。
4. Figma 桌面端 → Community 搜 `cursor-talk-to-figma` → 插件页 Install（[社区页直达](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin)）→ 打开目标文件 → Plugins 运行 `cursor-talk-to-figma-mcp-plugin` → 面板出现 Channel ID。社区版装不了时用本地开发安装：Plugins → Development → New Plugin → Link existing plugin → 选仓库 `src/cursor_mcp_plugin/` 目录。
5. 频道写入约定位置：`echo -n <频道ID> > <skill>/tools/.channel`（或 `export FIGMA_CHANNEL=<频道ID>`）。
6. 体检：`node tools/bridge-status.mjs` 全绿即就绪。

## 3. 日常启动检查（每次动画布前）

```bash
node tools/bridge-status.mjs        # 桥→频道→插件→画布 四级体检，断在哪环一跑便知
```

断点对照：
- 桥未运行 → 先 `bun run src/socket.ts`（或重启托管的桥）。
- join 失败 → 插件没开/频道不对：Figma 运行插件，新频道回写 `.channel`。
- 插件无响应 → 插件面板离线：在 Figma 里重跑一次插件（重新握手）。

**频道会轮换过期**：插件重启/重连后频道可能变化；症状 = join 超时或命令无响应。用 MCP `join_channel <新频道>` 拿新频道回写 `.channel` 文件。多文件注意：插件绑**当前打开的文件**，切文件要重跑插件。

## 4. 写通道 vs 读通道（可选双通道）

| 通道 | 实现 | 能力 | 用途 |
|---|---|---|---|
| **figma-canvas（写）** | 本桥 + 社区插件 | 读+写画布节点 | 生成/修改设计（本 skill 主通道） |
| figma REST MCP（读，可选） | `figma-developer-mcp`（npx，stdio，`FIGMA_API_KEY` env） | 只读文件数据/图层树/导图 | 无桌面端时读线上文件；令牌 scope `file_content_read`，走密钥库注入不落代码 |

写通道为主；REST 读通道按需配置（zh_code 0074 的 launcher 模式：脚本解密 vault 注入 env 后 exec npx）。

## 5. 协议要点（driver.mjs 直驱，改工具时须懂）

- 握手：ws 连上后发 `{type:'join', channel, id}`；之后每条命令 `{type:'message', channel, message:{id, command, params}}`，响应按 `message.id` 配对回 Promise。
- 命令即 MCP 工具名（`create_frame`/`set_text_content`/`export_node_as_image`…），30s 超时。
- 插件高并发偶发空返回：`create_*` 失败/空结果时 sleep 400-500ms 重试一次（build-lib 已内置）。
- 图标走 `set_image_fill`（imageBase64）；**插件无法凭空生成新图标**——新元素复用现有资产或调布局。
