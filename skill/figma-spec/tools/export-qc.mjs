#!/usr/bin/env node
// export-qc.mjs — QC 截图导出：当前页所有 Section 下的页面 frame（无 Section 时取顶层 frame）导出 PNG。
// 提取自 zh_code 0075 管线（Z07 泛化：输出目录参数化、平铺 <pageId>.png、过期截图自动清理）。
// 用法：node export-qc.mjs [pageId ...] [--out=qc]    # 不传 pageId = 当前页全量
// 验收用法：导出后把 PNG 交给 AI 视觉走查（字段齐全/对齐/无重叠/无残留）。
import { connect, cmd } from './driver.mjs';
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const outDir = resolve(argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'qc');
const want = argv.filter((a) => !a.startsWith('-'));

await connect();
const doc = await cmd('get_document_info', {});
console.log(`截图目标：${doc.name} / ${doc.currentPage?.name} → ${outDir}`);
mkdirSync(outDir, { recursive: true });

// 收集 frame：Section 下的页面 frame 优先；当前页无 Section 时取顶层 FRAME
const pageInfo = await cmd('get_node_info', { nodeId: doc.currentPage.id });
const secs = (pageInfo.children ?? []).filter((c) => c.type === 'SECTION');
const frames = [];
if (secs.length) {
  for (const sec of secs) {
    const si = await cmd('get_node_info', { nodeId: sec.id });
    for (const c of si.children ?? []) {
      if (String(c.name) && !String(c.name).startsWith('cap-')) frames.push({ id: c.id, pid: String(c.name).split(' ')[0] });
    }
  }
} else {
  for (const c of pageInfo.children ?? []) {
    if (c.type === 'FRAME' && !String(c.name).startsWith('cap-')) frames.push({ id: c.id, pid: String(c.name).split(' ')[0] });
  }
}
if (!frames.length) { console.error('✗ 当前页面没有可导出的页面 frame（确认插件绑定文件）'); process.exit(1); }

// 清理过期截图（不在画布 live 集合的 pageId.png）
const live = new Set(frames.map((f) => f.pid + '.png'));
let removed = 0;
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.png') && !live.has(f)) { unlinkSync(join(outDir, f)); removed++; }
}
if (removed) console.log(`清理过期截图 ${removed} 张`);

const targets = want.length ? frames.filter((f) => want.includes(f.pid)) : frames;
let ok = 0;
for (const f of targets) {
  try {
    const r = await cmd('export_node_as_image', { nodeId: f.id, format: 'PNG', scale: 1 });
    if (!r.imageData) throw new Error('无 imageData');
    writeFileSync(join(outDir, `${f.pid}.png`), Buffer.from(r.imageData, 'base64'));
    ok++;
  } catch (e) { console.error(`✗ ${f.pid}: ${e.message}`); }
}
console.log(`✓ 导出 ${ok}/${targets.length} 张（画布共 ${frames.length} 页）→ ${outDir}`);
process.exit(ok === targets.length ? 0 : 2);
