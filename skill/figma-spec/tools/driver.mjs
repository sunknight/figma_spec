// figma-canvas 桥直驱客户端：ws://127.0.0.1:3055，与 MCP 同协议（join/message + id 配对）。
// 提取自 zh_code 0075 管线（Z07 泛化）：绕过 MCP，脚本直接驱动 Figma 插件读写画布。
// 频道优先级：FIGMA_CHANNEL 环境变量 > 本目录 .channel 文件 > 'default'。
// 频道获取：Figma 里打开「cursor-talk-to-figma-mcp-plugin」插件，面板上显示的 Channel ID 即频道；
//           写回 .channel 文件（echo -n <频道> > .channel）或 export FIGMA_CHANNEL=<频道>。
const BRIDGE = process.env.FIGMA_BRIDGE || 'ws://127.0.0.1:3055';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
const channelFile = fileURLToPath(new URL('./.channel', import.meta.url));
export const CHANNEL = process.env.FIGMA_CHANNEL || (existsSync(channelFile) ? readFileSync(channelFile, 'utf8').trim() : 'default');

let ws = null;
const pending = new Map();

export function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(BRIDGE);
    const to = setTimeout(() => reject(new Error('bridge connect timeout')), 8000);
    ws.onopen = async () => {
      try {
        await cmd('join', { channel: CHANNEL });
        clearTimeout(to);
        resolve();
      } catch (e) { clearTimeout(to); reject(e); }
    };
    ws.onerror = () => { clearTimeout(to); reject(new Error('bridge ws error')); };
    ws.onmessage = (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      const msg = data.message;
      if (!msg || typeof msg !== 'object' || !msg.id) return;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      clearTimeout(p.to);
      if (msg.error) p.reject(new Error(`${p.command}: ${typeof msg.error === 'string' ? msg.error : JSON.stringify(msg.error)}`));
      else p.resolve(msg.result);
    };
  });
}

export function cmd(command, params = {}) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const to = setTimeout(() => { pending.delete(id); reject(new Error(`${command} timeout`)); }, 30000);
    pending.set(id, { resolve, reject, to, command });
    ws.send(JSON.stringify({
      id,
      type: command === 'join' ? 'join' : 'message',
      channel: CHANNEL,
      message: { id, command, params: { ...params, commandId: id } },
    }));
  });
}
