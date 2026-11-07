#!/usr/bin/env node
// gen-vue.mjs — spec → Vue 3 SFC 页面（每页一个自包含 .vue：模板 + 点击契约 + scoped 样式，零运行时依赖）。
// Z07 参考实现（对应 zh_code「薄壳 + 稳定层」模式的轻量版）：
//   · 版本标识 ver/@ro/@rw 先解析（--ver=rw|ro，默认 rw），冻结码 id 保留为 data-ele-id（点击契约）
//   · 33 内容块 + 4 chrome 块全部支持渲染；未收录类型落 Generic 卡（标题 + 字段清单），不中断
//   · 产物是「可运行原型页」：适合快速落地与评审对照；成熟项目可切换为类型组件 + 薄壳模式（见 skill references/spec-vue.md）
// 产物纪律：生成物勿手改——改 spec 重跑；要手工演化先复制改名（文件头有生成标记）。
//
// 用法：
//   node gen-vue.mjs home01 --specs=./specs --out=src/pages     # 单页（无变体 spec 或缺省变体）
//   node gen-vue.mjs --specs=./specs --out=src/pages --all      # 全量
//   node gen-vue.mjs home01 --ver=b --specs=./specs             # 指定 A/B 变体形态
import fs from 'node:fs';
import path from 'node:path';
import { resolveVer, validateMarkers, validateVariantsDecl, defaultVariantOf } from './resolve-ver-lib.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const files = argv.filter((a) => !a.startsWith('-'));
const outDir = path.resolve(flag('out') ?? './src/pages');
const verArg = flag('ver');
const specsDir = flag('specs') ? path.resolve(flag('specs')) : null;

const wantAll = argv.includes('--all');

let inputs = [];
if (wantAll && specsDir) inputs = fs.readdirSync(specsDir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(specsDir, f));
else {
  if (specsDir && files.length) inputs = files.map((f) => (fs.existsSync(f) ? f : path.join(specsDir, f.endsWith('.json') ? f : `${f}.json`)));
  else inputs = files.filter((f) => fs.existsSync(f));
}
if (!inputs.length) {
  console.error('用法：node gen-vue.mjs <spec.json|pageId>... [--specs=<dir>] [--all] [--out=<dir>] [--ver=<变体>]');
  console.error('示例：node gen-vue.mjs home01 --specs=./specs --out=src/pages');
  process.exit(1);
}

// ---------- 基础工具 ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ele = (o) => (o?.id ? ` data-ele-id="${esc(o.id)}"` : '');
const pascal = (s) => String(s).replace(/(^|[-_ ])([a-z0-9])/g, (_, __, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());
const ic = (name) => `<i class="ic" data-icon="${esc(name ?? '')}"></i>`;

// ---------- 块渲染器（返回 HTML 字符串；未收录类型 → 通用卡兜底） ----------
const T = {};
const generic = (b) => {
  const scal = Object.entries(b).filter(([k, v]) => k !== 'type' && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'));
  const rows = scal.length ? `\n      <div class="kv">${scal.map(([k, v]) => `<div class="kv-row"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`).join('')}</div>` : '';
  return `<div class="card generic"${ele(b)}>\n      <div class="generic-tag">${esc(b.type)}（未收录类型 · 通用兜底）</div>${rows}\n    </div>`;
};
const R = (b) => (T[b.type] ?? generic)(b);

// --- chrome ---
T.statusbar = (b) => `<div class="statusbar${b.dark ? ' dark' : ''}"><span>9:41</span><span class="sb-r">●●● ▮</span></div>`;
T.navbar = (b) => `<div class="navbar"${ele(b)}>\n      ${b.back !== false ? '<button class="nav-back" type="button">‹</button>' : '<span class="nav-back"></span>'}\n      <span class="nav-title">${typeof b.brand === 'string' && b.brand ? esc(b.brand) : b.brand ? '' : esc(b.title ?? '')}</span>\n    </div>`;
T.tabbar = (b) => `<nav class="tabbar">\n      ${(b.tabs ?? []).map((t, i) => `<span class="tab${i === (b.active ?? 0) ? ' on' : ''}"${ele(t)}>${ic(t.key)}<em>${esc(t.label)}</em>${t.badge ? '<b class="dot"></b>' : ''}</span>`).join('\n      ')}\n    </nav>`;
T.spacer = (b) => `<div class="spacer" style="height:${Number(b.h ?? 0) > 0 ? `${b.h}px` : '0'};${Number(b.h ?? 0) < 0 ? `margin-top:${b.h}px` : ''}"></div>`;

// --- 横幅族 ---
const heroDiv = (cls, b, inner, extraStyle = '') => `<div class="${cls}"${ele(b)}${extraStyle}>\n      ${inner}\n    </div>`;
T.hero = (b) => heroDiv('hero', b,
  `${b.title ? `<h1>${esc(b.title)}</h1>` : ''}${b.sub ? `<p>${esc(b.sub)}</p>` : ''}` +
  (b.ca?.length ? `\n      <div class="ca-row">${b.ca.map((c) => `<span class="ca"${ele(c)}><i class="ic soft">${esc((c.vicon ?? '·')[0])}</i>${esc(c.label)}</span>`).join('')}</div>` : ''));
T.heroStats = (b) => heroDiv('hero hero-stats', b,
  `${b.title ? `<h1>${esc(b.title)}</h1>` : ''}${b.sub ? `<p>${esc(b.sub)}</p>` : ''}\n      <div class="hs-grid">${(b.items ?? []).map((it) => `<div class="hs-item"><b>${esc(it[1])}</b><span>${esc(it[0])}</span></div>`).join('')}</div>`);
T.brandHero = (b) => heroDiv('hero brand', b,
  `<h1>${esc(b.title)}</h1>\n      <p>${esc(b.sub)}</p>\n      <div class="trust">${(b.trust ?? []).map((t) => `<div class="trust-item"><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('')}</div>`);
T.findpwHero = (b) => heroDiv('hero findpw', b,
  `<i class="ic big">🔒</i>\n      <h1>${esc(b.title)}</h1>\n      <p>${esc(b.sub)}</p>`);
T.intro = (b) => `<div class="intro"${ele(b)}>\n      <h2>${esc(b.title)}</h2>\n      ${b.sub ? `<p>${esc(b.sub)}</p>` : ''}\n    </div>`;

// --- 卡片内容 ---
const card = (cls, b, inner) => `<div class="card ${cls}"${ele(b)}>\n      ${inner}\n    </div>`;
T.infoCard = (b) => card('info', b, `${b.title ? `<h3>${esc(b.title)}</h3>` : ''}
      <div class="kv">${(b.rows ?? []).map((r) => `<div class="kv-row"><span class="kv-k">${esc(r[0])}</span><span class="kv-v">${esc(r[1])}</span></div>`).join('\n      ')}</div>`);
T.listCard = T.annList = (b) => card('list', b, `${b.title ? `<div class="card-head"><h3>${esc(b.title)}</h3>${b.more ? `<a class="more">${esc(b.more)}</a>` : ''}</div>` : ''}
      ${(b.rows ?? []).map((r) => `<div class="li-row"${ele(r)}>\n        <div class="li-main">${r.tag ? `<span class="tag${r.tagWin ? ' win' : ''}">${esc(r.tag)}</span>` : ''}<span class="li-title">${esc(r.title)}</span></div>\n        ${r.meta ? `<div class="li-meta">${esc(r.meta)}</div>` : ''}${r.right ? `<div class="li-right${r.rightDanger ? ' danger' : ''}">${esc(r.right)}</div>` : ''}\n      </div>`).join('\n      ')}`);
T.msgList = (b) => `<div class="card msg"${ele(b)}>\n      ${(b.items ?? []).map((m) => `<div class="msg-row"${ele(m)}>${ic(m.icon ?? 'mail')}<div class="msg-main"><div class="li-title">${esc(m.title)}${m.unread ? '<b class="dot"></b>' : ''}</div>${m.preview ? `<div class="li-meta">${esc(m.preview)}</div>` : ''}</div><span class="msg-time">${esc(m.time ?? '')}</span></div>`).join('\n      ')}\n    </div>`;
T.attachRows = (b) => card('attach', b, (b.rows ?? []).map((r) => `<div class="li-row"${ele(r)}><i class="ic">📄</i><div class="li-main"><span class="li-title">${esc(r.name)}</span>${r.meta ? `<div class="li-meta">${esc(r.meta)}</div>` : ''}</div><a class="dl">下载</a></div>`).join('\n      '));
T.timeline = (b) => card('timeline', b, (b.steps ?? []).map((s) => `<div class="tl-step ${s.state ?? 'todo'}"><i class="tl-dot"></i><div><div class="li-title">${esc(s.title)}</div>${s.meta ? `<div class="li-meta">${esc(s.meta)}</div>` : ''}</div></div>`).join('\n      '));
T.typeCards = (b) => `${(b.items ?? []).map((it) => card('typecard', it, `<div class="tc-head">${ic(it.icon ?? it.vicon)}<b>${esc(it.title)}</b></div>\n      <p>${esc(it.desc ?? '')}</p>`)).join('\n    ')}${b.tip ? `<p class="tip">${esc(b.tip)}${b.tipLink ? ` <a>${esc(b.tipLink)}</a>` : ''}</p>` : ''}`;
T.profileCard = (b) => card('profile', b, `<div class="pf-avatar">${esc((b.name ?? '用')[0])}</div>\n      <div><div class="pf-name">${esc(b.name)}</div>${b.sub ? `<div class="li-meta">${esc(b.sub)}</div>` : ''}${b.tags?.length ? `<div class="tags">${b.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}</div>`);
T.certBadge = (b) => card('cert', b, `<div class="cert-head">${ic('cert')}<b>${esc(b.title ?? '数字证书')}</b></div>\n      <div class="kv">${(b.rows ?? []).map((r) => `<div class="kv-row"><span class="kv-k">${esc(r[0])}</span><span class="kv-v">${esc(r[1])}</span></div>`).join('')}</div>`);
T.scanView = (b) => card('scan', b, `<div class="scan-frame">${ic('qr')}<p>${esc(b.title ?? '将二维码放入框内')}</p></div>`);
T.emptyHint = (b) => `<div class="empty"${ele(b)}><i>📭</i><p>${esc(b.title)}</p>${b.sub ? `<span>${esc(b.sub)}</span>` : ''}</div>`;
T.vipStrip = (b) => `<div class="vip"${ele(b)}><span class="vip-badge">${esc(b.badge)}</span><div><b>${esc(b.title)}</b><p>${esc(b.sub)}</p></div><a class="more">${esc(b.more ?? '')}</a></div>`;
T.cardGroup = (b) => card('cgroup', b, `${b.name ? `<h3>${esc(b.name)}</h3>` : ''}
      ${(b.items ?? []).map((it) => it.type === 'radio'
  ? `<div class="li-row radio"${ele(it)}><i class="radio-on"></i><div class="li-main"><span class="li-title">${it.req ? '<b class="req">*</b> ' : ''}${esc(it.label)}</span>${it.note ? `<div class="li-meta">${esc(it.note)}</div>` : ''}</div></div>`
  : it.type === 'upload'
    ? `<div class="li-row"${ele(it)}><i class="ic">📤</i><div class="li-main"><span class="li-title">${esc(it.label)}</span>${it.hint ? `<div class="li-meta">${esc(it.hint)}</div>` : ''}</div></div>`
    : fieldHtml(it)).join('\n      ')}`);

// --- 表单族 ---
function fieldHtml(f) {
  return `<label class="field"${ele(f)}>${f.icon ? ic(f.icon) : ''}<span class="f-label">${f.req ? '<b class="req">*</b> ' : ''}${esc(f.label)}</span><span class="f-input">${esc(f.value ?? f.placeholder ?? '')}${f.picker ? ' ▾' : ''}${f.codeBtn ? '<a class="code-btn">获取验证码</a>' : ''}</span>${f.eye ? '<i class="eye">👁</i>' : ''}${f.hint ? `<span class="f-hint">${esc(f.hint)}</span>` : ''}</label>`;
}
T.formCard = (b) => card('form', b, `${b.sub ? `<p class="form-sub">${esc(b.sub)}</p>` : ''}${b.seg?.length ? `<div class="seg-mini">${b.seg.map((s, i) => `<span class="${i === 0 ? 'on' : ''}">${esc(s)}</span>`).join('')}</div>` : ''}
      ${b.stepper ? `<div class="stepper">${(b.stepper.steps ?? []).map((s, i) => `<span class="${i <= (b.stepper.active ?? 0) ? 'on' : ''}">${esc(s)}</span>`).join('<i>→</i>')}</div>` : ''}
      ${(b.fields ?? []).map(fieldHtml).join('\n      ')}
      ${b.button ? `<button class="btn primary block">${esc(b.button)}</button>` : ''}${linksHtml(b.links)}${b.tip ? `<p class="tip">${esc(b.tip)}</p>` : ''}${b.switchTip ? `<p class="switch-tip">${esc(b.switchTip)}</p>` : ''}`);
T.loginCard = (b) => card('form login', b, `${b.heading ? `<h3>${esc(b.heading)}</h3>` : ''}${b.tabs?.length ? `<div class="seg-underline">${b.tabs.map((t, i) => `<span class="${i === 0 ? 'on' : ''}">${esc(t)}</span>`).join('')}</div>` : ''}
      ${(b.fields ?? []).map(fieldHtml).join('\n      ')}
      ${b.button ? `<button class="btn primary block">${esc(b.button)}</button>` : ''}${linksHtml(b.links)}`);
function linksHtml(links) {
  if (!links?.length) return '';
  return `\n      <div class="links">${links.map((l) => {
    const [txt, right] = typeof l === 'string' ? [l, l.startsWith('R:')] : [l.t, String(l.t ?? '').startsWith('R:')];
    const shown = txt.replace(/^R:/, '');
    return `<a class="${right ? 'r' : ''}"${ele(l)}>${esc(shown)}</a>`;
  }).join('')}</div>`;
}
T.agreeRow = (b) => `<div class="agree"${ele(b)}><i class="checkbox on"></i>${(b.segs ?? []).map((s) => `<span>${esc(s.t)}${s.link ? `<a>${esc(s.link)}</a>` : ''}</span>`).join('')}</div>`;
T.btnRow = (b) => `<div class="btn-row"${ele(b)}>\n      ${(b.buttons ?? []).map((bt) => `<button class="btn${bt.primary ? ' primary' : ''}${bt.disabled ? ' disabled' : ''}"${ele(bt)}>${esc(bt.text)}</button>`).join('\n      ')}\n    </div>`;
T.submitBtn = (b) => `<div class="submit-wrap"${ele(b)}><button class="btn primary block">${esc(b.text)}</button></div>`;
T.flowSteps = (b) => `<div class="flow"${ele(b)}>${(b.steps ?? []).map((s, i) => `<span class="${i === 0 ? 'on' : ''}">${i + 1}. ${esc(s)}</span>`).join('<i>›</i>')}</div>`;

// --- 搜索/筛选/tab ---
T.searchBar = (b) => `<div class="search"${ele(b)}><input placeholder="${esc(b.placeholder ?? '搜索')}" readonly></div>`;
T.filterChips = (b) => `<div class="chips"${ele(b)}>${(b.chips ?? []).map((c, i) => `<span class="chip${i === (b.active ?? 0) ? ' on' : ''}">${esc(c)}</span>`).join('')}</div>`;
T.segTabs = (b) => `<div class="seg-underline"${ele(b)}>${(b.tabs ?? []).map((t, i) => `<span class="${i === (b.active ?? 0) ? 'on' : ''}">${esc(t)}</span>`).join('')}</div>`;

// --- 宫格/统计 ---
T.quickGrid = (b) => card('qgrid', b, `<div class="grid4">${(b.items ?? []).map((it) => `<span class="g-item"${ele(it)}>${ic(it.icon ?? it.vicon)}<em>${esc(it.label)}</em></span>`).join('')}</div>`);
T.serviceGrid = (b) => card('sgrid', b, `${b.title ? `<h3>${esc(b.title)}</h3>` : ''}
      <div class="grid5">${(b.items ?? []).map((it) => `<span class="g-item"${ele(it)}>${it.badge ? `<b class="badge ${esc(it.badge)}">${{ new: '新', hot: '热', wait: '待' }[it.badge] ?? '·'}</b>` : ''}${ic(it.icon ?? it.vicon)}<em>${esc(it.label)}</em></span>`).join('')}</div>`);
T.stats4 = (b) => card('stats4', b, `<div class="grid4 stats">${(b.items ?? []).map((it) => `<span class="stat"><b>${esc(it[1])}</b>${it[2] === 'dot' ? '<b class="dot"></b>' : ''}<em>${esc(it[0])}</em></span>`).join('')}</div>`);
T.statPanels = (b) => `<div class="panels"${ele(b)}>\n      ${(b.panels ?? []).map((p) => card('panel', p, `<h3>${esc(p.title)}</h3>\n      <div class="kv">${(p.items ?? []).map((r) => `<div class="kv-row"><span class="kv-k">${esc(r[0])}</span><span class="kv-v">${esc(r[1])}</span></div>`).join('')}</div>`)).join('\n      ')}\n    </div>`;
T.annFlow = (b) => `<div class="annflow"${ele(b)}>\n      <div class="card list af-main">${b.title ? `<div class="card-head"><h3>${esc(b.title)}</h3></div>` : ''}${(b.rows ?? []).map((r) => `<div class="li-row"${ele(r)}><div class="li-main">${r.tag ? `<span class="tag${r.win ? ' win' : ''}">${esc(r.tag)}</span>` : ''}<span class="li-title">${esc(r.title)}</span></div>${r.meta ? `<div class="li-meta">${esc(r.meta)}</div>` : ''}</div>`).join('')}</div>\n      <div class="af-side">${(b.side ?? []).map((s) => card('side', s, `${ic(s.icon)}<b>${esc(s.label)}</b><span>${esc(s.sub ?? '')}</span>`)).join('')}</div>\n    </div>`;
T.videoCard = (b) => card('video', b, `<div class="v-cover">▶</div><div class="li-title">${esc(b.title ?? '')}</div>${b.meta ? `<div class="li-meta">${esc(b.meta)}</div>` : ''}`);
T.footer = (b) => `<footer class="page-footer"${ele(b)}>${esc(b.text)}</footer>`;
T.bottomTip = (b) => `<p class="bottom-tip"${ele(b)}>${esc(b.text)}</p>`;
// helpStrip 库保留未启用（zh_code 口径），收录为横幅渲染
T.helpStrip = (b) => card('help', b, `<div class="hs-row">${ic(b.icon ?? 'service')}<div><b>${esc(b.title)}</b><p>${esc(b.sub ?? '')}</p></div><a class="more">${esc(b.more ?? '')}</a></div>`);

// ---------- 样式（风格令牌与 style-tokens.md 对应） ----------
const CSS = `:root {
  --c-primary: #003399; --c-bg: #f6f6fa; --c-card: #fff; --c-input: #f5f6fa;
  --c-text: #1a1a1a; --c-text2: #444653; --c-text3: #8a8f99; --c-text4: #a6abb8;
  --c-line: #eef0f5; --c-soft: #e9effb; --c-danger: #e54545; --c-gold: #b07a00; --c-gold-bg: #fbf3dd;
  --radius: 12px; --pad: 18px; --gap: 12px; --page-pad: 16px;
}
.page { max-width: 375px; margin: 0 auto; min-height: 100vh; background: var(--c-bg); color: var(--c-text);
  font-family: -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif; font-size: 14px; padding-bottom: 24px; }
.card { background: var(--c-card); border-radius: var(--radius); margin: var(--gap) var(--page-pad); padding: var(--pad); }
h3 { font-size: 15px; margin: 0 0 10px; }
.card-head { display: flex; justify-content: space-between; align-items: center; }
.more { color: var(--c-primary); text-decoration: none; font-size: 12px; }
.statusbar { display: flex; justify-content: space-between; padding: 6px 20px 2px; font-size: 12px; color: var(--c-text); }
.statusbar.dark { color: #fff; background: var(--c-primary); }
.navbar { position: sticky; top: 0; z-index: 9; display: flex; align-items: center; height: 44px;
  background: var(--c-card); padding: 0 12px; border-bottom: 1px solid var(--c-line); }
.nav-back { width: 32px; font-size: 22px; color: var(--c-text); background: none; border: 0; }
.nav-title { flex: 1; text-align: center; font-size: 16px; font-weight: 600; }
.hero { background: var(--c-primary); color: #fff; padding: 20px var(--page-pad) 18px; }
.hero h1 { margin: 0; font-size: 20px; } .hero p { margin: 6px 0 0; opacity: .78; font-size: 12.5px; }
.hero.brand { text-align: center; padding: 48px 24px 20px; }
.trust { display: flex; justify-content: space-around; margin-top: 22px; }
.trust-item b { display: block; font-size: 17px; } .trust-item span { font-size: 11px; opacity: .7; }
.hero.findpw { text-align: center; padding: 40px 24px 26px; } .ic.big { font-size: 30px; font-style: normal; }
.hs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
.hs-item { background: rgb(255 255 255 / 12%); border-radius: 8px; padding: 8px 10px; }
.hs-item b { display: block; font-size: 16px; } .hs-item span { font-size: 11px; opacity: .75; }
.ca-row { display: flex; gap: 10px; margin-top: 14px; }
.ca { display: flex; align-items: center; gap: 6px; background: rgb(255 255 255 / 14%); border-radius: 8px; padding: 7px 10px; font-size: 12px; }
.intro { padding: 14px var(--page-pad) 2px; } .intro h2 { margin: 0; font-size: 17px; }
.intro p { margin: 6px 0 0; color: var(--c-text3); font-size: 12.5px; }
.kv-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--c-line); }
.kv-row:last-child { border-bottom: 0; }
.kv-k { color: var(--c-text3); flex-shrink: 0; } .kv-v { text-align: right; word-break: break-all; }
.li-row { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--c-line); }
.li-row:last-child { border-bottom: 0; }
.li-main { flex: 1; min-width: 0; } .li-title { font-size: 14px; }
.li-meta { color: var(--c-text3); font-size: 12px; margin-top: 3px; }
.li-right { color: var(--c-text3); font-size: 12px; } .li-right.danger { color: var(--c-danger); }
.tag { background: var(--c-soft); color: var(--c-primary); border-radius: 4px; padding: 1px 6px; font-size: 11px; margin-right: 6px; }
.tag.win { background: var(--c-gold-bg); color: var(--c-gold); }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--c-danger); }
.msg-row { display: flex; gap: 10px; padding: 11px 0; border-bottom: 1px solid var(--c-line); align-items: center; }
.msg-row:last-child { border-bottom: 0; } .msg-time { color: var(--c-text4); font-size: 11px; }
.dl { color: var(--c-primary); font-size: 12px; }
.tl-step { display: flex; gap: 12px; padding: 8px 0; }
.tl-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--c-line); margin-top: 4px; flex-shrink: 0; }
.tl-step.done .tl-dot { background: var(--c-primary); }
.tl-step.active .tl-dot { box-shadow: 0 0 0 3px var(--c-soft); background: var(--c-primary); }
.ic { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
  border-radius: 7px; background: var(--c-soft); color: var(--c-primary); font-size: 13px; font-style: normal; flex-shrink: 0; }
.ic.soft { background: rgb(255 255 255 / 25%); color: #fff; }
.grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 4px; }
.grid5 { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px 4px; }
.g-item { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
.g-item em { font-style: normal; font-size: 11.5px; color: var(--c-text2); }
.stat b { font-size: 17px; color: var(--c-primary); margin-right: 4px; }
.stat em { font-style: normal; font-size: 11.5px; color: var(--c-text3); }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; }
.panels { display: grid; grid-template-columns: 1fr 1fr; gap: var(--gap); margin: var(--gap) var(--page-pad); }
.annflow { display: grid; grid-template-columns: 1fr 96px; gap: 10px; margin: var(--gap) var(--page-pad); }
.af-main { margin: 0; } .af-side { display: grid; gap: 10px; }
.af-side .card { margin: 0; padding: 12px 10px; text-align: center; display: grid; gap: 6px; font-size: 12px; }
.badge { position: absolute; top: -4px; right: 6px; font-size: 9px; border-radius: 6px 6px 6px 0; padding: 1px 4px; color: #fff; }
.badge.new { background: #e54545; } .badge.hot { background: #ff7d00; } .badge.wait { background: #9aa0ac; }
.search { margin: var(--gap) var(--page-pad); }
.search input { width: 100%; box-sizing: border-box; border: 0; background: var(--c-input); border-radius: 18px; padding: 9px 16px; font-size: 13px; }
.chips { display: flex; gap: 8px; margin: var(--gap) var(--page-pad); flex-wrap: wrap; }
.chip { border-radius: 14px; padding: 5px 13px; background: var(--c-card); font-size: 12.5px; color: var(--c-text2); }
.chip.on { background: var(--c-primary); color: #fff; }
.seg-underline { display: flex; gap: 22px; padding: 4px 2px 0; border-bottom: 1px solid var(--c-line); margin-bottom: 8px; }
.seg-underline span { padding: 8px 0; font-size: 14px; color: var(--c-text3); border-bottom: 2px solid transparent; }
.seg-underline span.on { color: var(--c-primary); font-weight: 600; border-bottom-color: var(--c-primary); }
.seg-mini { display: flex; gap: 16px; margin-bottom: 6px; }
.seg-mini span { padding: 4px 0; font-size: 13px; color: var(--c-text3); border-bottom: 2px solid transparent; }
.seg-mini span.on { color: var(--c-primary); border-bottom-color: var(--c-primary); }
.field { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--c-line); }
.f-label { flex-shrink: 0; color: var(--c-text2); }
.f-input { flex: 1; text-align: right; color: var(--c-text3); background: none; }
.f-hint { flex-basis: 100%; font-size: 11px; color: var(--c-text4); }
.req { color: var(--c-danger); font-weight: 400; }
.code-btn { color: var(--c-primary); font-size: 12px; margin-left: 8px; }
.form-sub { color: var(--c-text3); font-size: 12.5px; margin: 0 0 6px; }
.stepper { display: flex; gap: 8px; align-items: center; color: var(--c-text4); font-size: 12px; padding: 6px 0; }
.stepper span.on { color: var(--c-primary); }
.links { display: flex; justify-content: space-between; margin-top: 12px; font-size: 12.5px; }
.links a { color: var(--c-primary); text-decoration: none; }
.tip { color: var(--c-text4); font-size: 11.5px; margin: 10px 0 0; }
.switch-tip { text-align: center; color: var(--c-primary); font-size: 13px; margin: 14px 0 0; }
.agree { display: flex; align-items: center; gap: 8px; margin: var(--gap) var(--page-pad); font-size: 12px; color: var(--c-text3); }
.checkbox { width: 16px; height: 16px; border-radius: 50%; border: 1px solid var(--c-text4); display: inline-block; }
.checkbox.on { background: var(--c-primary); border-color: var(--c-primary); }
.btn-row { display: flex; gap: 12px; margin: var(--gap) var(--page-pad); }
.btn { flex: 1; border-radius: 22px; border: 1px solid var(--c-primary); background: var(--c-card);
  color: var(--c-primary); padding: 11px 0; font-size: 15px; }
.btn.primary { background: var(--c-primary); color: #fff; }
.btn.disabled { background: #e3e6ee; border-color: #e3e6ee; color: #9aa0ac; }
.btn.block { display: block; width: 100%; margin-top: 14px; }
.submit-wrap { margin: 40px var(--page-pad) 0; }
.flow { display: flex; gap: 6px; align-items: center; color: var(--c-text4); font-size: 12.5px; margin: var(--gap) var(--page-pad); }
.flow span.on { color: var(--c-primary); font-weight: 600; }
.vip { display: flex; align-items: center; gap: 10px; margin: var(--gap) var(--page-pad);
  background: var(--c-gold-bg); border-radius: var(--radius); padding: 12px 14px; }
.vip-badge { background: var(--c-gold); color: #fff; border-radius: 6px; font-size: 11px; padding: 2px 6px; flex-shrink: 0; }
.vip p { margin: 2px 0 0; font-size: 11.5px; color: var(--c-gold); }
.empty { text-align: center; padding: 48px 0; color: var(--c-text3); }
.empty i { font-size: 34px; font-style: normal; }
.pf-avatar { width: 52px; height: 52px; border-radius: 50%; background: var(--c-soft); color: var(--c-primary);
  display: flex; align-items: center; justify-content: center; font-size: 20px; }
.profile { display: flex; gap: 14px; align-items: center; }
.pf-name { font-size: 16px; font-weight: 600; } .tags { display: flex; gap: 6px; margin-top: 6px; }
.typecard p { color: var(--c-text3); font-size: 12.5px; margin: 8px 0 0; }
.tc-head { display: flex; align-items: center; gap: 10px; font-size: 15px; }
.scan-frame { display: grid; place-items: center; gap: 10px; padding: 30px 0; color: var(--c-text3); }
.scan-frame .ic { width: 120px; height: 120px; border-radius: 12px; background: var(--c-input); font-size: 40px; }
.v-cover { display: grid; place-items: center; height: 160px; border-radius: 8px; background: #1a1a1a; color: #fff; font-size: 30px; margin-bottom: 10px; }
.page-footer { text-align: center; color: var(--c-text4); font-size: 11.5px; margin: 34px 0 0; }
.bottom-tip { text-align: center; color: var(--c-text4); font-size: 11px; margin: 10px 0 0; }
.tabbar { position: sticky; bottom: 0; display: flex; background: var(--c-card); border-top: 1px solid var(--c-line); padding: 6px 0 max(6px, env(safe-area-inset-bottom)); }
.tab { flex: 1; display: grid; place-items: center; gap: 2px; position: relative; color: var(--c-text3); }
.tab.on { color: var(--c-primary); }
.tab em { font-style: normal; font-size: 10.5px; }
.tab .dot { position: absolute; top: 0; right: 24%; }
.generic-tag { color: var(--c-text4); font-size: 12px; margin-bottom: 6px; }
.help .hs-row { display: flex; gap: 10px; align-items: center; }`;

// ---------- SFC 组装 ----------
function sfcOf(spec, ver) {
  const blocks = spec.blocks ?? [];
  const body = blocks.map((b) => `    ${R(b)}`).join('\n');
  const ids = [];
  const collectIds = (n) => {
    if (Array.isArray(n)) return n.forEach(collectIds);
    if (n && typeof n === 'object') {
      if (n.id && typeof n.id === 'string' && n.id.startsWith('rd-')) ids.push(n.id);
      Object.values(n).forEach(collectIds);
    }
  };
  collectIds(blocks);
  return `<!-- ⚠ 生成物：gen-vue.mjs 由 spec（ver=${ver}）生成，改 spec 后重跑覆盖；要手工演化请先复制改名 -->
<template>
  <div class="page" data-page-id="${esc(spec.pageId)}" @click="handleClick">
${body}
  </div>
</template>

<script setup>
// ${esc(spec.title ?? spec.pageId)}（${spec.pageId}）
// 原型页：零依赖自包含；props.data 供接口数据回填（键名与 spec 字段对应），未接线时展示 spec 静态内容。
// 点击契约：可点元素带 data-ele-id（冻结码 ${ids.length ? `${ids.length} 个：${ids.slice(0, 8).join('、')}${ids.length > 8 ? '…' : ''}` : '本页无'}），点击冒泡到根统一 emit。
defineProps({ data: { type: Object, default: () => ({}) } })
const emit = defineEmits(['eleClick'])
function handleClick(e) {
  const el = e.target.closest('[data-ele-id]')
  if (el) emit('eleClick', el.dataset.eleId, e)
}
</script>

<style scoped>
${CSS}
</style>
`;
}

// ---------- 主流程 ----------
fs.mkdirSync(outDir, { recursive: true });
let ok = 0; const failed = [];
for (const f of inputs) {
  try {
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    const errs = [...validateVariantsDecl(raw, raw.pageId ?? f), ...validateMarkers(raw, raw.pageId ?? f)];
    if (errs.length) throw new Error(`变体标识非法 ${errs.length} 处：${errs[0]}`);
    const variant = verArg ?? defaultVariantOf(raw);
    if (variant !== null && !(raw.variants ?? []).includes(variant)) throw new Error(`变体 "${variant}" 未在 variants [${(raw.variants ?? []).join(', ')}] 中声明`);
    const spec = resolveVer(raw, variant, { keepId: true });
    let out = path.join(outDir, `${pascal(spec.pageId)}.vue`);
    if (variant !== null && (raw.variants ?? []).length > 1) out = out.replace('.vue', `.${variant}.vue`); // 多变体页按变体分文件
    fs.writeFileSync(out, sfcOf(spec, variant));
    console.log(`✓ ${path.basename(f)} → ${out}（${spec.blocks.length} 块）`);
    ok++;
  } catch (e) { console.error(`✗ ${f}: ${e.message}`); failed.push(f); }
}
console.log(`gen-vue 完成 ${ok}/${inputs.length}（变体=${verArg ?? '缺省'} → ${outDir}）`);
process.exit(failed.length ? 2 : 0);
