#!/usr/bin/env node
// figma-diff.mjs — 反向同步：人工修改过的 Figma 画布 ↔ spec 差异提取（+ 可选回写）。
// 场景：设计师/人工直接在 Figma 上改了生成稿（现实常发），spec 必须收回单源地位——
//   本工具把「画布当前形态」与「spec 解析形态」做文本级 diff，报告差异；
//   ✏️ 文案修改可用 --write 回写 spec；结构增删只报告不回写（反向工程不安全，人工决策）。
//
// 机制：
//   画布侧：递归 get_node_info 收集目标 frame 下全部 TEXT 节点（absoluteBoundingBox 绝对坐标，按 y,x 排 = 阅读序）
//   spec 侧：按目标变体过滤后的「原始路径」文本叶（blocks.2.sub@a 这类带变体后缀的路径 = 回写落点）
//   对齐：LCS（等文为锚，R: 前缀归一）→ 锚点间隙两侧按序配对：等长=文案修改；画布多=新增；spec 多=缺失
//   等价合并：一条 spec 叶被渲染器拆成多段画布文本（如混合链接行）→ 拼接相等判等价，不算差异
//   噪音过滤：状态栏时间/符号、返回箭头、渲染器常量（下载 等）不参与比对
//   结构信号：frame 高 < spec size[1] 才报（扩高=渲染器自动延伸属正常）
//
// 用法：
//   node figma-diff.mjs home01 --specs=./specs                # 对比（缺省变体 = variants[0]）
//   node figma-diff.mjs home01 --ver=b --specs=./specs        # 指定变体
//   node figma-diff.mjs home01 --specs=./specs --write        # 报告并把文案修改回写 spec
// 退出码：0 = 无差异/已全部回写；1 = 有差异待人工处理；2 = 错误（桥/找不到 frame 等）
import { connect, cmd } from './driver.mjs';
import { validateMarkers, validateVariantsDecl, defaultVariantOf } from './resolve-ver-lib.mjs';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const pages = argv.filter((a) => !a.startsWith('-'));
const specsDir = resolve(flag('specs') ?? './specs');
const verArg = flag('ver');
const WRITE = argv.includes('--write');
if (!pages.length) {
  console.error('用法：node figma-diff.mjs <pageId>... [--specs=<dir>] [--ver=<变体>] [--write]');
  process.exit(2);
}

// ---------- spec 侧：变体过滤后的原始路径文本叶 ----------
const SKIP_KEYS = new Set(['type', 'icon', 'vicon', 'key', 'pageId', 'size', 'at', 'id', 'variants', 'ver']);
// 网格族（值上标下、同一 y 行分组渲染）：叶序须「先全部值（列序）再全部标」对齐画布阅读序
// 值列位置按块约定：stats4/heroStats 的 items 为 [label,value]（值=1）；brandHero 的 trust 为 [值,标]（值=0）
const GRIDS = { stats4: ['items', 1], heroStats: ['items', 1], brandHero: ['trust', 0] };
function specTextLeaves(spec, variant) {
  const leaves = []; // {path, text}（path 为原始 spec 路径，@变体 后缀键保留——回写落点）
  const walk = (v, path) => {
    if (typeof v === 'string') { if (v.trim()) leaves.push({ path, text: v }); return; }
    if (Array.isArray(v)) {
      // 二维数组（infoCard rows[[k,v]] 等行内左右排布）：按行内序逐格收录（画布同 y 按 x 排，序一致）
      if (v.length && v.every((x) => Array.isArray(x))) {
        v.forEach((row, ri) => row.forEach((cell, ci) => { if (typeof cell === 'string' && cell.trim()) leaves.push({ path: `${path}.${ri}.${ci}`, text: cell }); }));
        return;
      }
      v.forEach((it, i) => walk(it, `${path}.${i}`)); // tabs[]/rows[{}] 等逐项下钻
      return;
    }
    if (!v || typeof v !== 'object') return;
    if (typeof v.ver === 'string' && v.ver !== 'all' && v.ver !== variant) return; // 项级 ver：非目标变体整项跳过
    const keys = Object.keys(v);
    const grid = GRIDS[v.type]; // 网格族（值上标下、同 y 行分组）：在自然键序位按「先全部值再全部标」发射
    for (const [k, val] of Object.entries(v)) {
      if (k === 'ver' || SKIP_KEYS.has(k)) continue;
      const m = k.match(/^(.*)@([a-z][a-z0-9_]*)$/);
      if (k === grid?.[0] && Array.isArray(val)) {
        const vi = grid[1], li = 1 - vi;
        for (let ri = 0; ri < val.length; ri++) if (typeof val[ri]?.[vi] === 'string' && val[ri][vi].trim()) leaves.push({ path: `${path}.${k}.${ri}.${vi}`, text: val[ri][vi] }); // 值行（y 小）
        for (let ri = 0; ri < val.length; ri++) if (typeof val[ri]?.[li] === 'string' && val[ri][li].trim()) leaves.push({ path: `${path}.${k}.${ri}.${li}`, text: val[ri][li] }); // 标行（y 大）
        continue;
      }
      if (m) { if (m[2] === variant) walk(val, `${path}.${k}`); } // 只走目标变体后缀键（原始路径）
      else if (keys.includes(`${k}@${variant}`)) continue; // 裸键被目标变体后缀键覆盖 → 不收（画布呈现覆盖值）
      else walk(val, `${path}.${k}`);
    }
  };
  walk(spec.blocks ?? [], 'blocks');
  return leaves;
}

// ---------- 画布侧：TEXT 节点收集 ----------
const NOISE_RE = /^(‹|\d{1,2}:\d{2}|[●▮\s]+)$/; // 状态栏时间/信号符号、返回箭头等生成器常量
const RENDERER_CONSTS = new Set(['下载']); // build-lib 固定渲染常量（attachRows 下载链接）
async function canvasTexts(frameId) {
  const out = [];
  const walkNode = async (id, depth) => {
    if (depth > 10 || out.length > 3000) return;
    const info = await cmd('get_node_info', { nodeId: id });
    for (const c of info.children ?? []) {
      const box = c.absoluteBoundingBox ?? {};
      if (c.type === 'TEXT') {
        const t = String(c.characters ?? '').trim();
        if (t && !NOISE_RE.test(t) && !RENDERER_CONSTS.has(t)) out.push({ id: c.id, text: t, x: Math.round(box.x ?? 0), y: Math.round(box.y ?? 0) });
      } else {
        await walkNode(c.id, depth + 1);
      }
    }
  };
  await walkNode(frameId, 0);
  out.sort((a, b) => (a.y - b.y) || (a.x - b.x)); // 阅读序
  return out;
}
async function frameHeight(frameId) {
  const info = await cmd('get_node_info', { nodeId: frameId });
  return info.absoluteBoundingBox?.height ?? null;
}

// ---------- LCS diff（等文为锚；锚点间隙两侧按序配对，账目完备） ----------
const normText = (t) => String(t).replace(/^R:/, ''); // links 的 R: 前缀（右对齐标记）渲染时剥离
function diffSeq(cvs, spc) {
  const n = cvs.length, m = spc.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = normText(cvs[i].text) === normText(spc[j].text) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (normText(cvs[i].text) === normText(spc[j].text)) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const edits = [], added = [], removed = [];
  const gap = (ci, cj) => { // 锚点间隙：等长按序配为文案修改，余量归新增/缺失
    const t = Math.min(ci.length, cj.length);
    for (let k = 0; k < t; k++) edits.push({ canvas: ci[k], spec: cj[k] });
    for (let k = t; k < ci.length; k++) added.push(ci[k]);
    for (let k = t; k < cj.length; k++) removed.push(cj[k]);
  };
  let pi = 0, pj = 0;
  for (const [mi, mj] of pairs) { gap(cvs.slice(pi, mi), spc.slice(pj, mj)); pi = mi + 1; pj = mj + 1; }
  gap(cvs.slice(pi), spc.slice(pj));
  return { edits, added, removed };
}

// 等价消除（两轮）：
//  ① edit + 后续 added 拼接 == spec 原文（如 R: 混合行：灰段被配成"文案修改"、蓝段成"新增"）→ 撤销该 edit
//  ② removed + added 连续段拼接 == spec 原文（一条 spec 文本被渲染器拆成多段画布节点）→ 双双消除
function absorbEquivalents(edits, added, removed, log) {
  const stillA = [...added], stillE = [], stillR = [];
  // ① edit 吸收：edit.canvas.text 开头匹配 spec 文本，从 stillA 头部补齐剩余
  for (const e of edits) {
    const target = normText(e.spec.text);
    if (!target.startsWith(e.canvas.text) || e.canvas.text === target) { stillE.push(e); continue; }
    let acc = e.canvas.text, k = 0;
    while (k < stillA.length && acc.length < target.length) { acc += stillA[k].text; k++; }
    if (acc === target) {
      log.push(`↔ 渲染等价：${e.spec.path} "${e.spec.text}" = 画布拆分（"${e.canvas.text}" + ${stillA.slice(0, k).map((x) => `"${x.text}"`).join(' + ')}）`);
      stillA.splice(0, k);
    } else stillE.push(e);
  }
  // ② removed 吸收：连续段直拼 == spec 原文
  for (const r of removed) {
    const target = normText(r.text);
    let acc = '', k = 0;
    while (k < stillA.length && acc.length < target.length) { acc += stillA[k].text; k++; }
    if (acc === target && k >= 1) {
      if (k > 1) log.push(`↔ 渲染等价：${r.path} "${r.text}" = 画布 ${k} 段拆分（${stillA.slice(0, k).map((x) => `"${x.text}"`).join(' + ')}）`);
      stillA.splice(0, k); // 拼接相等即等价消除（k==1 同文 = 纯 reorder，如 tag/标题 y 微差换序——静默）
    } else stillR.push(r);
  }
  return { stillE, stillA, stillR };
}

// ---------- 回写：path 寻址 set ----------
function setByPath(obj, path, value) {
  const segs = path.split('.');
  let cur = obj;
  for (let k = 0; k < segs.length - 1; k++) cur = cur[segs[k]];
  cur[segs[segs.length - 1]] = value;
}

// ---------- 主流程 ----------
await connect();
const doc = await cmd('get_document_info', {});
console.log(`画布文件：${doc.name} / ${doc.currentPage?.name}`);

// frame 定位：当前页 Section 内 + 顶层，frame 名以 <pageId> 开头
const pageFrames = new Map();
const pageInfo = await cmd('get_node_info', { nodeId: doc.currentPage.id });
const tops = [...(pageInfo.children ?? [])];
for (const sec of tops.filter((c) => c.type === 'SECTION')) {
  const si = await cmd('get_node_info', { nodeId: sec.id });
  tops.push(...(si.children ?? []));
}
for (const c of tops) {
  const pid = String(c.name).split(' ')[0];
  if (!pageFrames.has(pid)) pageFrames.set(pid, c);
}

let pendingDiff = 0; // 待人工处理（不含「--write 已回写的纯文案差异」）
for (const pid of pages) {
  const specPath = resolve(specsDir, `${pid}.json`);
  if (!existsSync(specPath)) { console.error(`✗ 缺 spec ${specPath}`); process.exit(2); }
  const raw = JSON.parse(readFileSync(specPath, 'utf8'));
  const errs = [...validateVariantsDecl(raw, pid), ...validateMarkers(raw, pid)];
  if (errs.length) { console.error(`✗ ${pid} 变体标识非法：${errs[0]}`); process.exit(2); }
  const variant = verArg ?? defaultVariantOf(raw);
  if (variant !== null && !(raw.variants ?? []).includes(variant)) { console.error(`✗ ${pid} 变体 "${variant}" 未声明`); process.exit(2); }

  const frame = pageFrames.get(pid);
  if (!frame) { console.error(`✗ ${pid}：当前页找不到同名 frame（先 regen 生成，或确认插件绑定文件）`); pendingDiff++; continue; }

  const [cvs, spc, fh] = [await canvasTexts(frame.id), specTextLeaves(raw, variant), await frameHeight(frame.id)];
  if (argv.includes('--debug')) {
    console.log('  [canvas]', cvs.map((c) => `${c.y}/${c.x}:"${c.text}"`).join(' '));
    console.log('  [spec  ]', spc.map((l) => `${l.path}:"${l.text}"`).join(' '));
  }
  const { edits, added, removed } = diffSeq(cvs, spc);
  const eqLog = [];
  const { stillE: edits2, stillA, stillR } = absorbEquivalents(edits, added, removed, eqLog);
  const shrink = fh === null ? 0 : Math.min(0, Math.round(fh) - (raw.size?.[1] ?? 0)); // 只报收缩（扩高=自动延伸正常）

  console.log(`\n== ${pid}（变体=${variant ?? '无'}）：画布 ${cvs.length} 条文本 vs spec ${spc.length} 条叶 ==`);
  if (shrink) console.log(`⚠ 结构信号：frame 高 ${Math.round(fh)} < spec size[1] ${raw.size[1]}（Δ${shrink}，疑内容被删）`);
  for (const l of eqLog) console.log(l);

  if (edits2.length) {
    console.log(`✏️ 文案修改 ${edits2.length} 处${WRITE ? '（回写 spec）' : '（--write 可回写）'}：`);
    for (const e of edits2) console.log(`   ${e.spec.path}: "${e.spec.text}" → "${e.canvas.text}"（画布 y=${e.canvas.y}）`);
    if (WRITE) {
      for (const e of edits2) setByPath(raw, e.spec.path, e.spec.text.startsWith('R:') ? `R:${e.canvas.text}` : e.canvas.text); // R: 右对齐标记保留
      writeFileSync(specPath, JSON.stringify(raw, null, 1)); // 落盘形制：1 空格缩进、无末尾换行
    }
  }
  if (stillA.length) {
    console.log(`➕ 画布独有 ${stillA.length} 条（人工新增文本，请人工判断并入 spec）：`);
    for (const a of stillA.slice(0, 12)) console.log(`   + "${a.text}"（y=${a.y}, x=${a.x}）`);
    if (stillA.length > 12) console.log(`   … 共 ${stillA.length} 条`);
  }
  if (stillR.length) {
    console.log(`➖ spec 有而画布无 ${stillR.length} 条（人工删除，请人工判断删 spec）：`);
    for (const r of stillR.slice(0, 12)) console.log(`   - ${r.path}: "${r.text}"`);
    if (stillR.length > 12) console.log(`   … 共 ${stillR.length} 条`);
  }
  const structural = stillA.length || stillR.length || shrink;
  if (!edits2.length && !structural) console.log('✓ 无差异（画布与 spec 一致）');
  if (structural || (edits2.length && !WRITE)) pendingDiff++; // 结构差异必人工；纯文案差异未回写也算待处理
}

console.log(pendingDiff ? `\n结论：有待处理差异（exit 1）——文案类用 --write 回写，结构类人工决策后改 spec 再 regen` : `\n结论：一致或已全部回写（exit 0）`);
process.exit(pendingDiff ? 1 : 0);
