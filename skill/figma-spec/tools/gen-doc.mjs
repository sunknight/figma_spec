#!/usr/bin/env node
// gen-doc.mjs — spec → 评审 Word 文档（.docx）：每页一章，含总览表、变体差异、QC 截图、块清单、可点码清单。
// 评审场景：发甲方/团队确认设计、归档设计说明书。建议先 `export-qc` 导出最新截图再生成（文档自动嵌入 qc/<pageId>.png）。
// 产物纪律：生成物勿手改——改 spec/截图后重跑；要定制版式改本脚本的文档模板段。
//
// 用法：
//   node gen-doc.mjs --specs=./specs --out=评审文档.docx                  # 全量页
//   node gen-doc.mjs --specs=./specs --pages=home01,detail01 --out=d.docx  # 指定页
//   node gen-doc.mjs --specs=./specs --qc=./qc --title=页面设计评审        # 自定义截图目录与文档标题
// 依赖：docx（skill 目录 `bun install` / `npm i` 安装；缺失时有提示）。
import fs from 'node:fs';
import path from 'node:path';
import { validateMarkers, validateVariantsDecl } from './resolve-ver-lib.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const specsDir = path.resolve(flag('specs') ?? './specs');
const outPath = path.resolve(flag('out') ?? 'design-review.docx');
const qcDir = flag('qc') ? path.resolve(flag('qc')) : path.resolve('./qc');
const docTitle = flag('title') ?? '页面设计评审文档';
const wantPages = (flag('pages') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

let docx;
try {
  docx = await import('docx');
} catch {
  console.error('✗ 缺少依赖 docx：在 skill 目录执行 `bun install`（或 `npm i`）后重试');
  process.exit(2);
}
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, AlignmentType, PageBreak, BorderStyle } = docx;

// ---------- spec 载入 ----------
const files = fs.existsSync(specsDir) ? fs.readdirSync(specsDir).filter((f) => f.endsWith('.json')).sort() : [];
let specs = files.map((f) => JSON.parse(fs.readFileSync(path.join(specsDir, f), 'utf8')));
if (wantPages.length) specs = specs.filter((s) => wantPages.includes(s.pageId));
if (!specs.length) { console.error(`✗ ${specsDir} 下没有可用 spec${wantPages.length ? `（过滤：${wantPages.join(',')}）` : ''}`); process.exit(1); }
for (const s of specs) {
  const errs = [...validateVariantsDecl(s, s.pageId), ...validateMarkers(s, s.pageId)];
  if (errs.length) { console.error(`✗ ${s.pageId} 标识非法：${errs[0]}`); process.exit(2); }
}

// ---------- 提取器 ----------
const SKIP = new Set(['type', 'ver']);
function blockSummary(b) { // 块一句话摘要
  const parts = [];
  for (const k of ['title', 'sub', 'text', 'placeholder', 'name', 'badge']) {
    const v = b[k] ?? b[`${k}@${s_var(b)}`];
    if (typeof v === 'string' && v.trim()) parts.push(v);
  }
  for (const k of ['items', 'rows', 'fields', 'buttons', 'tabs', 'links', 'steps', 'chips', 'panels']) {
    if (Array.isArray(b[k]) && b[k].length) parts.push(`${b[k].length} 项`);
  }
  const s = parts.slice(0, 2).join(' · ');
  return s.length > 42 ? s.slice(0, 41) + '…' : s;
}
function s_var() { return null; } // 占位（摘要只取裸键即可，变体专属值在差异节呈现）
function collectClickables(node, out = [], ctx = '') {
  if (Array.isArray(node)) { node.forEach((n) => collectClickables(n, out, ctx)); return out; }
  if (!node || typeof node !== 'object') return out;
  const label = node.t ?? node.text ?? node.title ?? node.label ?? node.name ?? ctx;
  if (typeof node.id === 'string' && node.id.startsWith('rd-')) out.push({ code: node.id, label: String(label).slice(0, 40), owner: ctx });
  for (const [k, v] of Object.entries(node)) {
    if (k === 'id') continue;
    collectClickables(v, out, typeof label === 'string' && label ? String(label) : ctx);
  }
  return out;
}
function collectVariantNotes(node, where, out = []) {
  if (Array.isArray(node)) { node.forEach((n, i) => collectVariantNotes(n, `${where}[${i}]`, out)); return out; }
  if (!node || typeof node !== 'object') return out;
  if (typeof node.ver === 'string' && node.ver !== 'all') out.push(`${where}：整块仅 ${node.ver} 变体（${node.type ?? '项'}${node.t ?? node.text ?? node.title ? '「' + (node.t ?? node.text ?? node.title) + '」' : ''}）`);
  for (const [k, v] of Object.entries(node)) {
    const m = k.match(/^(.*)@([a-z][a-z0-9_]*)$/);
    if (m) out.push(`${where}.${m[1]}：${m[2]} 变体专属 = ${JSON.stringify(v).slice(0, 40)}`);
    else if (k !== 'ver') collectVariantNotes(v, `${where}.${k}`, out);
  }
  return out;
}

// ---------- docx 组装 ----------
const FONT = { eastAsia: 'Noto Sans SC', ascii: 'Helvetica' };
const P = (text, o = {}) => new Paragraph({ children: [new TextRun({ text, bold: o.bold, size: o.size, color: o.color, font: FONT })], heading: o.heading, alignment: o.align, spacing: o.spacing, pageBreakBefore: o.break });
const cell = (text, o = {}) => new TableCell({
  children: [new Paragraph({ children: [new TextRun({ text: String(text ?? ''), bold: o.bold, size: o.size ?? 18, font: FONT })] })],
  width: o.w ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
  shading: o.head ? { fill: 'EEF1F7' } : undefined,
});
const table = (rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: rows.map((r, ri) => new TableRow({ children: r.map((c) => cell(c, { head: ri === 0, bold: ri === 0 })) })),
});
const hr = () => new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9D2E3' } }, spacing: { after: 120 } });

const children = [];
// 封面 + 总览
children.push(P(docTitle, { heading: HeadingLevel.TITLE, size: 40, bold: true }));
children.push(P(`生成时间：${new Date().toLocaleString('zh-CN')}　·　页面 ${specs.length} 页　·　来源：design/specs（唯一事实源）`, { size: 18, color: '666666' }));
children.push(P('说明：本文档由 spec 自动生成，改 spec 或截图后重跑 `gen-doc` 刷新；不要手改。', { size: 18, color: '999999' }));
children.push(hr());
children.push(P('页面总览', { heading: HeadingLevel.HEADING_1 }));
children.push(table([
  ['页面', '标题', '变体', '块数', '可点码', '截图'],
  ...specs.map((s) => [
    s.pageId, s.title ?? '', (s.variants ?? []).join(' / ') || '—', String((s.blocks ?? []).length),
    String(collectClickables(s.blocks ?? []).length),
    fs.existsSync(path.join(qcDir, `${s.pageId}.png`)) ? '有' : '无',
  ]),
]));

// 每页一章
for (const s of specs) {
  const blocks = s.blocks ?? [];
  const clicks = collectClickables(blocks);
  const vNotes = collectVariantNotes(blocks, 'blocks', []);
  const png = path.join(qcDir, `${s.pageId}.png`);

  children.push(P(`${s.pageId} · ${s.title ?? ''}`, { heading: HeadingLevel.HEADING_1, break: true }));
  children.push(P(`尺寸 ${s.size?.[0] ?? 375}×${s.size?.[1] ?? 812}　·　画布坐标 ${s.at ? s.at.join(', ') : '—'}　·　变体空间 ${s.variants ? s.variants.join(' / ') : '无（单形态）'}`, { size: 18, color: '666666' }));

  if (fs.existsSync(png)) {
    const buf = fs.readFileSync(png);
    const w = 340, h = Math.round((w * (s.size?.[1] ?? 812)) / (s.size?.[0] ?? 375));
    children.push(new Paragraph({ children: [new ImageRun({ type: 'png', data: buf, transformation: { width: w, height: h } })], spacing: { after: 120 } }));
    children.push(P('（评审截图：与 qc/ 目录同步；以 Figma 画布为准）', { size: 16, color: '999999' }));
  } else {
    children.push(P('（无截图：先跑 `export-qc --out=' + qcDir + '` 导出后再生成本文档可自动嵌入）', { size: 16, color: 'C0504D' }));
  }

  if (vNotes.length) {
    children.push(P('A/B 变体差异', { heading: HeadingLevel.HEADING_2 }));
    children.push(table([['#', '位置与差异'], ...vNotes.map((n, i) => [String(i + 1), n])]));
  }

  children.push(P('区块清单', { heading: HeadingLevel.HEADING_2 }));
  children.push(table([
    ['#', '类型', '摘要', '冻结码', '变体'],
    ...blocks.map((b, i) => [String(i + 1), b.type, blockSummary(b) || '—', b.id ?? '', typeof b.ver === 'string' && b.ver !== 'all' ? b.ver : '']),
  ]));

  children.push(P('可点编码清单（冻结码）', { heading: HeadingLevel.HEADING_2 }));
  if (clicks.length) {
    children.push(table([
      ['编码', '文案/载体'],
      ...clicks.map((c) => [c.code, c.label || c.owner || '—']),
    ]));
    children.push(P('注：编码一经下游引用（埋点/绑定）不可改值；换码 = 新增新码 + 人工迁移。', { size: 16, color: '999999' }));
  } else {
    children.push(P('本页无可点编码。', { size: 18, color: '999999' }));
  }
}

const doc = new Document({ sections: [{ properties: {}, children }] });
const buf = await Packer.toBuffer(doc);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buf);
console.log(`✓ ${outPath}（${specs.length} 页 · ${specs.reduce((n, s) => n + collectClickables(s.blocks ?? []).length, 0)} 个可点码 · 截图 ${specs.filter((s) => fs.existsSync(path.join(qcDir, `${s.pageId}.png`))).length}/${specs.length} 张）`);
