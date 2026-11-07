# 安装到其他项目

> skill 包自包含（SKILL.md + runbooks + tools + schema + examples），拷一个目录即获得全部能力。

## 前置：Figma 插件安装（画布读写能力，一次性）

spec 校验与 Vue 生成零前置；要**读写 Figma 画布**（regen/export-qc/figma-diff）须先装插件桥：

| 项 | 值 |
|---|---|
| 插件名称 | **cursor-talk-to-figma-mcp-plugin**（Figma 社区，免费） |
| 官方社区页 | https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin |
| 开源仓库 | https://github.com/grab/cursor-talk-to-figma-mcp |
| 桥地址 | `ws://127.0.0.1:3055` |

```bash
# 1) 装 Bun（已有跳过）
curl -fsSL https://bun.sh/install | bash

# 2) 拉仓库并启动 WebSocket 桥（常驻；建议 nohup/launchd 托管）
mkdir -p ~/web/code/tools && cd ~/web/code/tools
git clone https://github.com/grab/cursor-talk-to-figma-mcp.git
cd cursor-talk-to-figma-mcp && bun install
nohup bun run src/socket.ts >> ~/.zcode/logs/figma-socket.log 2>&1 &
curl -s -m 2 http://127.0.0.1:3055/ && echo "桥已起"     # 探活（HTTP 200）

# 3) Figma 桌面端装社区插件并运行（拿到频道）
#    Community 搜 "cursor-talk-to-figma" → 插件页 Install
#    （社区页直达：https://www.figma.com/community/plugin/1485687494525374295/cursor-talk-to-figma-mcp-plugin）
#    打开目标设计文件 → Plugins → 运行 cursor-talk-to-figma-mcp-plugin → 面板显示 "Channel: xxx"

# 4) 频道写入约定位置 + 体检
echo -n <频道ID> > <目标项目>/.zcode/skills/figma-spec/tools/.channel
node <目标项目>/.zcode/skills/figma-spec/tools/bridge-status.mjs   # 全绿 = 就绪
```

> 插件绑定**当前打开的文件**；切换文件后需在目标文件重跑一次插件。频道会轮换过期（join 失败/无响应时重取新频道回写 `.channel`）。
> 完整排障手册：`docs/figma-setup.md`。

## 方式一：装到项目（推荐，随项目走）

```bash
# 在目标项目根执行（路径按实际调整）
mkdir -p .zcode/skills
cp -R /Users/sunknight/web/code/sk_ideas/figma_spec/skill/figma-spec .zcode/skills/
```

装完后：
- 新会话说「写 spec / 改 Figma 页面 / 生成 vue 页面」等即触发（skill description 已覆盖触发语）。
- 项目内命令统一走 `.zcode/skills/figma-spec/tools/…`。
- （推荐）`.vscode/settings.json` 加 schema 映射（spec 编辑补全/报错）：

```json
"json.schemas": [{ "fileMatch": ["design/specs/*.json"], "url": "./.zcode/skills/figma-spec/schema/spec.schema.json" }]
```

- （可选）`npm i -D ajv` 开启校验精校模式。
- Figma 画布操作前置：桥安装与启动见 `docs/figma-setup.md`（一次性，跨项目共用）。

## 方式二：装到用户级（所有项目可用）

```bash
mkdir -p ~/.zcode/skills
cp -R /Users/sunknight/web/code/sk_ideas/figma_spec/skill/figma-spec ~/.zcode/skills/
```

注意：项目级与用户级同名时项目级优先；本机已有用户级 `figma-spec` 的话先确认要覆盖的版本。

## 方式三：一键脚本

```bash
./install.sh /path/to/target/project          # 项目级安装
./install.sh --user                            # 用户级安装
```

## 升级与同步

- 本仓库 `skill/figma-spec/` 是唯一事实源；改工具/文档在这里改，目标项目重新 `cp -R` 覆盖即可（`.channel` 频道文件与 `assets/icons/` 自备资产建议安装后单独维护，脚本覆盖时自动跳过）。
- zh_code 项目本身不换装本包（它有自己的深耦合管线）；本包面向新项目与模式复用。

## 验证安装

```bash
cd <目标项目>
node .zcode/skills/figma-spec/tools/validate-specs.mjs --specs=.zcode/skills/figma-spec/examples/specs   # 应全绿
node .zcode/skills/figma-spec/tools/bridge-status.mjs                                                    # 桥体检
```
