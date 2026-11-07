#!/usr/bin/env bash
# install.sh — 把 figma-spec skill 包安装到目标项目（或用户级）。
# 用法：./install.sh /path/to/project     # 项目级（<project>/.zcode/skills/figma-spec）
#       ./install.sh --user               # 用户级（~/.zcode/skills/figma-spec）
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/skill/figma-spec"
if [ ! -f "$SRC/SKILL.md" ]; then echo "✗ 找不到 skill 包 $SRC" >&2; exit 1; fi

DEST=""
if [ "${1:-}" = "--user" ]; then
  DEST="$HOME/.zcode/skills/figma-spec"
else
  [ $# -ge 1 ] || { echo "用法：$0 /path/to/project | --user" >&2; exit 1; }
  [ -d "$1" ] || { echo "✗ 目标目录不存在：$1" >&2; exit 1; }
  DEST="$1/.zcode/skills/figma-spec"
fi

mkdir -p "$(dirname "$DEST")"

# 已存在则备份（保留 .channel / assets/icons 自备资产）
if [ -d "$DEST" ]; then
  BAK="$DEST.bak.$(date +%Y%m%d%H%M%S)"
  cp -R "$DEST" "$BAK"
  echo "已备份旧版 → $BAK"
  if [ -f "$DEST/tools/.channel" ]; then cp "$DEST/tools/.channel" /tmp/figma-spec.channel.$$; KEEP_CH=1; fi
  if [ -d "$DEST/assets/icons" ] && [ -n "$(ls -A "$DEST/assets/icons" 2>/dev/null)" ]; then
    cp -R "$DEST/assets/icons" /tmp/figma-spec.icons.$$; KEEP_IC=1
  fi
fi

rm -rf "$DEST"          # 先清空再拷（cp -R 到已存在目录会嵌套拷入子目录）
cp -R "$SRC" "$DEST"
rm -rf "$DEST/node_modules" "$DEST/bun.lock" "$DEST/bun.lockb" "$DEST/tools/.channel"   # 依赖目标项目重装；.channel 频道是本机会话态不分发
[ -n "${KEEP_CH:-}" ] && cp /tmp/figma-spec.channel.$$ "$DEST/tools/.channel" && rm -f /tmp/figma-spec.channel.$$
[ -n "${KEEP_IC:-}" ] && rm -rf "$DEST/assets/icons" && cp -R /tmp/figma-spec.icons.$$ "$DEST/assets/icons" && rm -rf /tmp/figma-spec.icons.$$

echo "✓ 已安装 → $DEST"
echo "  验证：node $DEST/tools/validate-specs.mjs --specs=$DEST/examples/specs"
echo "  画布前置：桥安装/启动见 docs/figma-setup.md；体检 node $DEST/tools/bridge-status.mjs"
