#!/usr/bin/env node
// bridge-status.mjs — Figma 桥体检：桥进程 → 频道配对 → 插件绑定文件 → 画布概览，一跑定位断在哪环。
// 用法：node bridge-status.mjs [--channel <频道>]
//   断点诊断对照：
//   ✗ 桥未运行        → 先启动 WebSocket 桥（bun run src/socket.ts，见 docs/figma-setup.md）
//   ✗ join 超时/报错   → 插件没开或频道不对：Figma 里运行插件，把面板 Channel ID 传给 --channel
//   ✗ get_document_info 超时 → 插件面板显示 offline/重连中：重启插件（重跑一次即重新握手）
//   ✓ 全绿             → 桥就绪，regen/build/export-qc 可用
import { connect, cmd, CHANNEL } from './driver.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--channel')) process.env.FIGMA_CHANNEL = argv[argv.indexOf('--channel') + 1];

console.log(`桥地址：${process.env.FIGMA_BRIDGE || 'ws://127.0.0.1:3055'}　频道：${CHANNEL}`);

try {
  await connect();
  console.log('✓ 桥连接成功，频道已配对');
} catch (e) {
  console.error(`✗ 桥/频道不可用：${e.message}`);
  process.exit(1);
}

let doc;
try {
  doc = await cmd('get_document_info', {});
} catch (e) {
  console.error(`✗ 插件无响应（${e.message}）——在 Figma 里重新运行一次插件再试`);
  process.exit(2);
}

console.log(`✓ 插件在线`);
console.log(`  文件：${doc.name ?? '?'}`);
console.log(`  当前页：${doc.currentPage?.name ?? '?'}（${doc.currentPage?.id ?? '?'}）`);
const sel = Array.isArray(doc.selection) ? doc.selection : [];
if (sel.length) console.log(`  选中：${sel.map((s) => `${s.name}(${s.id})`).join('、')}`);

// 当前页结构概览：Section 与其下页面 frame 数
try {
  const page = await cmd('get_node_info', { nodeId: doc.currentPage.id });
  const secs = (page.children ?? []).filter((c) => c.type === 'SECTION');
  const frames = (page.children ?? []).filter((c) => c.type === 'FRAME');
  if (secs.length) {
    console.log(`  Sections（${secs.length}）：`);
    for (const s of secs.slice(0, 12)) {
      const si = await cmd('get_node_info', { nodeId: s.id });
      console.log(`    ${s.name}（${s.id}）→ ${ (si.children ?? []).length } 个子节点`);
    }
    if (secs.length > 12) console.log(`    …共 ${secs.length} 个`);
  } else if (frames.length) {
    console.log(`  顶层 frame ${frames.length} 个（无 Section）`);
  } else {
    console.log('  当前页为空');
  }
} catch { /* 概览失败不影响体检结论 */ }

console.log('\n结论：桥就绪 ✓（regen / build / export-qc 可直接跑）');
process.exit(0); // open 状态的 ws 会吊住事件循环，成功路径必须显式退出
