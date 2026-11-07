# Figma 插件桥安装与启动手册（figma-setup）

> figma-spec 的画布读写全靠本桥。一次性安装，日常只需体检。
> 本机（sunknight 的 Mac）已装好：桥仓库在 `~/web/code/tools/cursor-talk-to-figma-mcp`，ZCode 已配 `figma-canvas` MCP（launcher：`~/.zcode/scripts/figma-canvas-launcher.sh`，自动拉起桥再启 MCP）。

## 组件清单

| 组件 | 位置/来源 | 说明 |
|---|---|---|
| WebSocket 桥 | [grab/cursor-talk-to-figma-mcp](https://github.com/grab/cursor-talk-to-figma-mcp) `src/socket.ts`（Bun） | `ws://127.0.0.1:3055`，常驻进程，频道广播 |
| Figma 插件 | Figma 社区：**cursor-talk-to-figma-mcp-plugin**（[社区页直达](https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin)） | 桌面端运行，面板显示频道 ID + 在线状态 |
| MCP figma-canvas（可选） | 同仓库 `src/talk_to_figma_mcp/server.ts` | agent 逐节点手术用；脚本直驱不需要 |
| 直驱客户端 | `<skill>/tools/driver.mjs` | regen/gen-vue 等脚本用，同协议不经 MCP |

## 首次安装（新机器）

```bash
# 1) Bun
curl -fsSL https://bun.sh/install | bash

# 2) 桥仓库
mkdir -p ~/web/code/tools && cd ~/web/code/tools
git clone https://github.com/grab/cursor-talk-to-figma-mcp.git
cd cursor-talk-to-figma-mcp && bun install

# 3) 启桥（常驻；可用 nohup / launchd / pm2 托管）
nohup bun run src/socket.ts >> ~/.zcode/logs/figma-socket.log 2>&1 &
curl -s -m 2 http://127.0.0.1:3055/ && echo "桥已起"    # 探活（HTTP 200）

# 4) Figma 桌面端安装社区插件并运行（拿频道）
#    Community 搜 "cursor-talk-to-figma" → 插件页 Install
#    社区页直达：https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin
#    打开目标设计文件 → Plugins → 运行 cursor-talk-to-figma-mcp-plugin
#    插件面板出现 "Channel: xxxxxxxx" 即就绪

# 5) 频道写入约定位置（tools/.channel 与 driver 同目录）
echo -n <频道ID> > <skill>/tools/.channel

# 6) 体检
node <skill>/tools/bridge-status.mjs
```

> **社区插件装不了时的本地开发安装**（等价）：Figma 桌面端 → Plugins → Development → New Plugin → Link existing plugin → 选桥仓库的 `src/cursor_mcp_plugin/` 目录（开发版插件与本机桥同源，社区版即其发布产物）。

## ZCode MCP 注册（可选，agent 手术通道）

`~/.zcode/cli/config.json` → `mcp.servers`：

```json
"figma-canvas": {
  "type": "stdio",
  "command": "/Users/<you>/.zcode/scripts/figma-canvas-launcher.sh"
}
```

launcher 职责：探活桥（未跑则 nohup 拉起）→ `exec bun run <repo>/src/talk_to_figma_mcp/server.ts`。注册后**新会话**生效；MCP 里 `join_channel <频道>` 配对。

## 日常使用

- 每次动画布前：`node tools/bridge-status.mjs`（四级体检：桥→频道→插件→画布）。
- **桥退出不影响插件**（插件自动等重连）；插件重启后频道可能轮换 → join 失败时用 MCP `join_channel` 拿新频道回写 `.channel`。
- 多人/多项目：频道是配对键不是密钥，各项目各用各的频道即可。

## 故障排查

| 症状 | 原因 | 处置 |
|---|---|---|
| bridge-status「桥/频道不可用：connect timeout」 | 桥没跑 | `bun run src/socket.ts` 拉起 |
| join 报错/超时 | 插件未运行或频道不对 | Figma 里运行插件；新频道回写 `.channel` |
| get_document_info 超时 | 插件面板 offline | 重跑一次插件（重新握手） |
| 命令偶发空返回 | 插件高并发抖动 | 已内置 create_* 重试；持续则重启插件 |
| 画错文件 | 插件绑错当前文件 | 切到目标文件重跑插件；regen 加 `--expect=<关键词>` 守卫 |
| export 图 1210 解析错误 | URL 直传视觉模型不稳 | 先导出本地 PNG 再走查（export-qc 默认落盘） |
