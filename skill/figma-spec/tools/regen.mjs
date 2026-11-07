#!/usr/bin/env node
// regen.mjs — spec → Figma 整页矢量重建（删旧 frame → build-lib 重建 → 挂 Section → QC 截图）。
// specs 目录 / Section 挂载表 / 文件守卫全部参数化，无配置也能跑。
//
// 前提：Figma 桌面端打开目标文件 + 插件运行中 + 桥在线（先跑 bridge-status.mjs 体检）。
// 用法：
//   node regen.mjs home01                      # 重建 specs/home01.json（默认 ./specs；无变体的 spec 直接重建）
//   node regen.mjs home01 --ver=b --specs=./design/specs   # 重建声明过 variants 的 spec 的指定变体形态
//   node regen.mjs home01 --no-qc --expect=主文件   # --expect=<正则>：插件绑定文件名不含则拒绝（防画错文件）
// Section 挂载（可选）：specs 目录或 --sections=<file> 放 sections.json：
//   { "sections": { "组名": "SectionNodeId" }, "pageGroups": { "bd30": "组名" } }
//   有映射 → 重建后 set_parent 挂回对应 Section；无映射 → frame 落在 spec.at 坐标（当前页顶层）。
import { connect, cmd } from './driver.mjs';
import { buildPage } from './build-lib.mjs';
import { resolveVer, validateMarkers, validateVariantsDecl, defaultVariantOf } from './resolve-ver-lib.mjs';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const pages = argv.filter((a) => !a.startsWith('-'));
const specsDir = resolve(flag('specs') ?? './specs');
const verArg = flag('ver'); // 目标变体；缺省 = spec.variants[0]（无变体声明的 spec 无需传）
if (!pages.length) {
  console.error('用法：node regen.mjs <pageId>... [--specs=<dir>] [--ver=<变体>] [--sections=<file>] [--expect=<文件名正则>] [--no-qc] [--dry]');
  process.exit(1);
}
const DRY = argv.includes('--dry');

// Section 挂载表（可选）
let sections = null, pageGroups = {};
const secFile = flag('sections') ? resolve(flag('sections')) : join(specsDir, 'sections.json');
if (existsSync(secFile)) {
  const cfg = JSON.parse(readFileSync(secFile, 'utf8'));
  sections = cfg.sections ?? null;
  pageGroups = cfg.pageGroups ?? {};
  console.log(`Section 挂载表：${secFile}（${Object.keys(sections ?? {}).length} 组）`);
} else {
  console.log(`（未找到 ${secFile}：frame 将落在 spec.at 坐标，不挂 Section）`);
}

if (DRY) {
  for (const pid of pages) {
    const f = join(specsDir, `${pid}.json`);
    if (!existsSync(f)) { console.error(`✗ 缺 ${f}`); continue; }
    const spec = JSON.parse(readFileSync(f, 'utf8'));
    const errs = [...validateVariantsDecl(spec, pid), ...validateMarkers(spec, pid)];
    console.log(`[dry] ${pid}：${spec.blocks.length} 块，变体=[${(spec.variants ?? []).join(',') || '无'}]${errs.length ? `，⚠ 标识错误 ${errs.length} 处：${errs[0]}` : ''}`);
  }
  process.exit(0);
}

await connect();

// 文件守卫（防画错文件）：--expect=<正则> 匹配插件当前绑定文件名+当前页名，不匹配则拒绝
const doc = await cmd('get_document_info', {});
console.log(`目标文件：${doc.name} / ${doc.currentPage?.name}`);
const expect = flag('expect');
if (expect && !new RegExp(expect).test(`${doc.name} ${doc.currentPage?.name ?? ''}`)) {
  console.error(`✗ 当前绑定「${doc.name} / ${doc.currentPage?.name}」不匹配 --expect=/${expect}/。切到正确文件运行插件，或去掉 --expect。`);
  process.exit(1);
}

// 1) 收集并删除旧 frame（当前页所有 Section 内 + 顶层，frame 名以 <pageId> 开头）
const toDelete = [];
const collect = (children) => {
  for (const c of children ?? []) {
    if (pages.some((p) => String(c.name).startsWith(p))) toDelete.push(c.id);
  }
};
const pageInfo = await cmd('get_node_info', { nodeId: doc.currentPage.id });
collect(pageInfo.children);
for (const c of pageInfo.children ?? []) {
  if (c.type === 'SECTION') {
    const si = await cmd('get_node_info', { nodeId: c.id });
    collect(si.children);
  }
}
if (toDelete.length) { await cmd('delete_multiple_nodes', { nodeIds: toDelete }); console.log(`已删旧 frame:`, toDelete.join(' ')); }

// 2) 重建（ver/@ro/@rw → 目标版本纯 spec）+ 挂节
const out = [], failed = [];
for (const pid of pages) {
  try {
    const f = join(specsDir, `${pid}.json`);
    if (!existsSync(f)) throw new Error(`缺 ${f}`);
    const raw = JSON.parse(readFileSync(f, 'utf8'));
    const errs = [...validateVariantsDecl(raw, pid), ...validateMarkers(raw, pid)];
    if (errs.length) throw new Error(`变体标识非法：${errs[0]}（共 ${errs.length} 处）`);
    const variant = verArg ?? defaultVariantOf(raw);
    if (variant !== null && !(raw.variants ?? []).includes(variant)) throw new Error(`变体 "${variant}" 未在 variants [${(raw.variants ?? []).join(', ')}] 中声明`);
    const spec = resolveVer(raw, variant);
    const id = await buildPage(spec);
    const group = pageGroups[pid];
    const sid = group && sections?.[group];
    if (sid) await cmd('set_parent', { nodeId: id, parentId: sid });
    out.push(`${pid}:${id}`);
  } catch (e) { console.error(`✗ ${pid}: ${e.message}`); failed.push(pid); }
}
console.log(out.join(' '));
console.log(`regen 完成 ${out.length}/${pages.length}（变体=${verArg ?? '缺省'}）`, failed.length ? `失败: ${failed.join(' ')}` : '');

// 3) 同步 QC 截图（--no-qc 跳过）
if (out.length && !argv.includes('--no-qc')) {
  const done = out.map((s) => s.split(':')[0]);
  spawnSync(process.execPath, [join(HERE, 'export-qc.mjs'), ...done], { stdio: 'inherit' });
}
process.exit(failed.length ? 2 : 0);
