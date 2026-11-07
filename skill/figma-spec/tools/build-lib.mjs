// 矢量渲染库（build-lib）：spec → Figma 原生可编辑节点（经 3055 桥直驱，产出矢量画布非贴图）。
// 提取自 zh_code 0075/0018 管线（Z07 基线为 0018 版：links {t,id} 对象容错、videoCard 渲染块）。
// 单页直出：node regen.mjs <pageId>（内部调 buildPage）；本文件是块渲染器的唯一实现，风格令牌见头部 C。
// spec 结构：{ pageId, title, size:[w,h], at:[x,y], ver?, blocks:[{type, ...props}] }（含 ver/@ro/@rw 标识须先过 resolve-ver）
// 换肤/改版式：改下方 C 令牌与各块渲染函数；新增块类型 = blocks 表加一个渲染器（与 schema / gen-vue 同步，四处同步纪律）。
import { connect, cmd as rawCmd } from './driver.mjs';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// 插件高并发时会偶发返回空结果：create_* 空返回时重试一次
const cmd = async (c, p) => {
  let r;
  try { r = await rawCmd(c, p); } catch (e) {
    if (!c.startsWith('create_')) throw e;
    await sleep(500);
    r = await rawCmd(c, p);
    return r;
  }
  if (c.startsWith('create_') && !(r && (typeof r === 'string' || r.id))) {
    await sleep(400);
    r = await rawCmd(c, p);
  }
  return r;
};
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICON_DIR = join(HERE, '..', 'assets', 'icons') + '/';

// ---------- 设计令牌（主色恢复 #003399 深蓝＝Page1 评审版口径，2026-10-19 用户拍板改回；#00B3FF 仅作历史记录） ----------
const C = {
  primary: '#003399', bg: '#F6F6FA', card: '#FFFFFF', inputBg: '#F5F6FA', segBg: '#F0F2F7',
  text: '#1A1A1A', text2: '#444653', text3: '#8A8F99', text4: '#A6ABB8',
  line: '#EEF0F5', line2: '#E3E8F2', danger: '#E54545',
  soft: '#E9EFFB', softText: '#003399', uploadBg: '#FAFBFE', uploadLine: '#B9C3D8',
  white: '#FFFFFF', gold: '#B07A00', goldBg: '#FBF3DD', gray7: '#747684', nodeOff: '#EEF0F5',
};
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }; };
const A = (h, a) => ({ ...hex2rgb(h), a });

// 文本宽度估算（em）：CJK 1.0 / 大写 .66 / 数字小写 .56 / 空格 .3 / 其他 .42
function estW(str, size, weight = 400) {
  let em = 0;
  for (const ch of String(str)) {
    if (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF《》·—？]/.test(ch)) em += 1;
    else if (/[A-Z]/.test(ch)) em += 0.66;
    else if (/[0-9a-z]/.test(ch)) em += 0.56;
    else if (ch === ' ') em += 0.3;
    else em += 0.42;
  }
  return em * size * (weight >= 600 ? 1.04 : 1);
}

// ---------- 原语（坐标相对页面 frame） ----------
// 长文案适配：先缩字号（至 minSize），仍超宽则截断加 …
function fit(str, size, weight, maxW, minSize = 10) {
  let s = String(str), sz = size;
  while (sz > minSize && estW(s, sz, weight) > maxW) sz -= 0.5;
  while (estW(s, sz, weight) > maxW && s.length > 2) s = s.slice(0, -2) + '…';
  return { text: s, size: sz };
}
const rid = (res) => (typeof res === 'string' ? res : res.id); // create_* 返回对象取 .id
const mk = {
  async rect(name, x, y, w, h, o = {}) {
    const id = rid(await cmd('create_rectangle', { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h), name, parentId: o.parent }));
    await cmd('set_fill_color', { nodeId: id, color: { ...(o.fill ? hex2rgb(o.fill) : { r: 0, g: 0, b: 0 }), a: o.fill ? (o.opacity ?? 1) : 0 } });
    if (o.radius) await cmd('set_corner_radius', { nodeId: id, radius: o.radius });
    if (o.stroke) await cmd('set_stroke_color', { nodeId: id, color: { ...hex2rgb(o.stroke), a: o.strokeA ?? 1 }, weight: o.strokeW ?? 1 });
    return id;
  },
  async txt(name, x, y, str, o = {}) {
    const size = o.size ?? 14, weight = o.weight ?? 400;
    // 默认字体 Noto Sans SC（2026-10-19 定）：普惠体本机 CoreText 不注册（fontd/用户域 API 均无效，系统层问题），
    // 插件兜底链落 Noto（云端字体，四档 400/500/600/700 全有，直传）。普惠体待 Font Book 手动安装+重启 Figma 后切回：
    // 恢复 fontFamily 'Alibaba PuHuiTi 3.0' 与 500→400/700→800 映射（见 STYLE.md §3）。
    return rid(await cmd('create_text', { x: Math.round(x), y: Math.round(y), text: String(str), fontSize: size, fontWeight: weight, fontFamily: o.fontFamily ?? 'Noto Sans SC', fontColor: A(o.color ?? C.text, o.opacity ?? 1), name, parentId: o.parent }));
  },
  async txtC(name, cx, y, str, o = {}) {
    const w = estW(str, o.size ?? 14, o.weight ?? 400);
    return mk.txt(name, cx - w / 2, y, str, o);
  },
  async icon(name, x, y, size, file, o = {}) {
    // 节点名带 [图标文件] 标签：hotfix-icons.mjs 据此秒级定位换图，不必整页重建
    const id = rid(await cmd('create_rectangle', { x: Math.round(x), y: Math.round(y), width: Math.round(size), height: Math.round(size), name: `${name}[${file}]`, parentId: o.parent }));
    // PNG 资产缺失（Z07 通用包不带图标二进制）→ 浅蓝底圆角占位块，不中断整页生成
    if (!existsSync(ICON_DIR + file + '.png')) {
      await cmd('set_fill_color', { nodeId: id, color: { ...hex2rgb(C.soft), a: 1 } });
      await cmd('set_corner_radius', { nodeId: id, radius: Math.round(size * 0.24) });
      return id;
    }
    await cmd('set_fill_color', { nodeId: id, color: { r: 0, g: 0, b: 0, a: 0 } });
    const b64 = readFileSync(ICON_DIR + file + '.png').toString('base64');
    await cmd('set_image_fill', { nodeId: id, imageBase64: b64, scaleMode: 'FILL' });
    return id;
  },
};

// 矢量小图标（无 PNG 资产时用矩形拼装）：x,y 左上角 / s 基准边长 / color 前景色
// stamp=印章 lock=闭锁 unlock=开锁 qr=二维码示意（内层反色块固定深底色） torch=手电筒 cert=证书 building=楼宇
async function vIcon(name, x, y, s, color, P) {
  const w = async (dx, dy, dw, dh, o = {}) => mk.rect(`vi-${name}-${dx}-${dy}`, x + dx * s, y + dy * s, dw * s, dh * s, { fill: o.c ?? color, radius: (o.r ?? 0) * s, opacity: o.o, parent: P });
  if (name === 'play') { // 右指播放三角：4 根渐高条拼装（无 PNG 资产的矢量兜底）
    await w(0.30, 0.40, 0.09, 0.20);
    await w(0.41, 0.32, 0.09, 0.36);
    await w(0.52, 0.24, 0.09, 0.52);
    await w(0.63, 0.16, 0.09, 0.68);
    return;
  }
  if (name === 'stamp') {
    await w(0.33, 0.04, 0.34, 0.26, { r: 0.08 });
    await w(0.12, 0.38, 0.76, 0.30, { r: 0.06 });
    await w(0.18, 0.82, 0.64, 0.07, { o: 0.5 });
  } else if (name === 'lock') {
    await w(0.28, 0.02, 0.44, 0.14, { r: 0.07 });
    await w(0.28, 0.02, 0.12, 0.30);
    await w(0.60, 0.02, 0.12, 0.30);
    await w(0.12, 0.32, 0.76, 0.62, { r: 0.10 });
  } else if (name === 'unlock') {
    await w(0.02, 0.02, 0.12, 0.34);
    await w(0.02, 0.02, 0.40, 0.12, { r: 0.06 });
    await w(0.30, 0.24, 0.12, 0.22);
    await w(0.18, 0.42, 0.70, 0.54, { r: 0.10 });
  } else if (name === 'qr') {
    for (const [ox, oy] of [[0, 0], [0.70, 0], [0, 0.70]]) {
      await w(ox, oy, 0.30, 0.30, { r: 0.04 });
      await w(ox + 0.07, oy + 0.07, 0.16, 0.16, { c: '#14151A' });
      await w(ox + 0.11, oy + 0.11, 0.08, 0.08);
    }
    for (const [dx, dy, dw, dh] of [[0.42, 0.04, 0.10, 0.10], [0.58, 0.16, 0.10, 0.10], [0.38, 0.30, 0.10, 0.10], [0.54, 0.40, 0.14, 0.10], [0.06, 0.42, 0.10, 0.10], [0.20, 0.54, 0.10, 0.10], [0.42, 0.56, 0.10, 0.14], [0.60, 0.62, 0.10, 0.10], [0.74, 0.44, 0.10, 0.10], [0.86, 0.56, 0.10, 0.10], [0.40, 0.78, 0.14, 0.10], [0.62, 0.80, 0.10, 0.10], [0.80, 0.74, 0.10, 0.14], [0.06, 0.60, 0.10, 0.10]]) {
      await w(dx, dy, dw, dh);
    }
  } else if (name === 'torch') {
    await w(0.28, 0.00, 0.44, 0.20, { r: 0.06 });
    await w(0.38, 0.20, 0.24, 0.48, { r: 0.05 });
    await w(0.34, 0.76, 0.32, 0.08, { o: 0.7 });
  } else if (name === 'cert') { // 证书：卡身 + 两行文 + 圆徽 + 双缎带
    await w(0.06, 0.10, 0.88, 0.60, { r: 0.08 });
    await w(0.22, 0.24, 0.34, 0.07);
    await w(0.22, 0.40, 0.24, 0.07);
    await w(0.60, 0.26, 0.24, 0.24, { r: 0.12 });
    await w(0.34, 0.70, 0.11, 0.24, { r: 0.03 });
    await w(0.55, 0.70, 0.11, 0.24, { r: 0.03 });
  } else if (name === 'building') { // 楼宇：天线 + 双塔剪影 + 基座
    await w(0.22, 0.02, 0.05, 0.16);
    await w(0.10, 0.16, 0.28, 0.70, { r: 0.04 });
    await w(0.44, 0.36, 0.46, 0.50, { r: 0.04 });
    await w(0.04, 0.88, 0.92, 0.07, { r: 0.02 });
  }
}

// ---------- 字段 ----------
// 一个字段槽：label 顶在 yTop，输入框 yTop+28 高 46，hint +24；返回输入区底部 y
function fieldBottom(yTop, f) { return yTop + 28 + 46 + (f.hint ? 24 : 0); }

async function drawField(ctx, f, yTop) {
  const P = ctx.pid;
  let lx = 34;
  if (f.req) { await mk.txt('f-req', 34, yTop + 1, '*', { size: 14, color: C.danger, parent: P }); lx = 44; }
  await mk.txt(`lb-${f.key}`, lx, yTop, f.label, { size: 14, weight: 500, parent: P });
  const iy = yTop + 28;
  const iw = f.captcha ? 201 : 307;
  await mk.rect(`in-${f.key}`, 34, iy, iw, 46, { fill: C.inputBg, radius: 8, parent: P });
  let tx = 48;
  if (f.icon) { await mk.icon(`ic-${f.key}`, 48, iy + 15, 16, f.icon, { parent: P }); tx = 73; }
  if (f.value) await mk.txt(`val-${f.key}`, tx, iy + 15.5, f.value, { size: 14, color: C.text, parent: P });
  else if (f.placeholder) await mk.txt(`ph-${f.key}`, tx, iy + 15.5, f.placeholder, { size: 14, color: C.text3, parent: P });
  if (f.picker) await mk.icon(`ar-${f.key}`, 319, iy + 16.5, 13, 'chevright', { parent: P });
  if (f.eye) await mk.icon(`eye-${f.key}`, 311, iy + 15, 16, 'eye', { parent: P });
  if (f.codeBtn) {
    const t = f.codeBtn;
    await mk.txt(`cb-${f.key}`, 341 - estW(t, 13, 500), iy + 15.5, t, { size: 13, weight: 500, color: C.primary, parent: P });
  }
  if (f.captcha) {
    const cx0 = 245;
    await mk.rect(`cap-${f.key}`, cx0, iy, 96, 46, { fill: '#EDF1F9', stroke: C.line2, radius: 8, parent: P });
    const chars = ['7', '3', '5', '1'];
    const offs = [[0, 2, 0], [1, -2, 6], [2, 2, -8], [3, 1, 4]];
    for (let i = 0; i < 4; i++) {
      await mk.txt(`cap${i}-${f.key}`, cx0 + 26 + i * 14 + offs[i][2] * 0.6, iy + 12 + offs[i][1], chars[i], { size: 19, weight: 700, color: i % 2 ? C.primary : '#43507A', parent: P });
    }
  }
  if (f.hint) { const hf = fit(f.hint, 12, 400, 307); await mk.txt(`hint-${f.key}`, 34, iy + 52, hf.text, { size: hf.size, color: C.text4, parent: P }); }
  return fieldBottom(yTop, f);
}

async function drawButton(ctx, text, y, disabled = false, inset = false) {
  const P = ctx.pid;
  const key = (disabled ? 'ro-' : '') + text.replace(/\s/g, '');
  const bx = inset ? 34 : 16, bw = inset ? 307 : 343; // inset=卡内按钮与输入框对齐（34/307）
  await mk.rect(`btn-${key}`, bx, y, bw, 48, { fill: disabled ? '#E3E6EE' : C.primary, radius: 8, parent: P });
  await mk.txtC(`bt-${key}`, bx + bw / 2, y + 15, text, { size: 16, weight: 600, color: disabled ? '#9AA0AC' : C.white, parent: P });
}

async function drawLinks(ctx, rawLinks, y) {
  const links = (rawLinks ?? []).map((l) => (typeof l === 'string' ? l : l.t)); // v2 单源 links {t,id} → 字符串
  const P = ctx.pid;
  let lx = 34;
  for (let i = 0; i < links.length; i++) {
    const l = links[i];
    const isLink = i < links.length - 1 || !l.endsWith('注册'); // 末尾的混合行整体右置
    if (l.startsWith('R:')) { // 右侧混合行 R:还没有账号？立即注册 —— 灰前缀 + 蓝动作后缀
      const raw = l.slice(2);
      const m = raw.match(/^(.+?)([^？?，,！!。…\.\s]{2,8})$/); // 后缀=末段 2-8 个非标点字（立即注册/免费注册/马上登录…通用）
      if (m) {
        const w2 = estW(m[2], 13, 500);
        await mk.txt('lk-mix', 345 - estW(raw, 13), y, m[1], { size: 13, color: C.gray7, parent: P });
        await mk.txt('lk-reg', 345 - w2, y, m[2], { size: 13, weight: 500, color: C.primary, parent: P });
      }
    } else {
      await mk.txt(`lk${i}`, lx, y, l, { size: 13, weight: 500, color: C.primary, parent: P });
      lx += estW(l, 13, 500) + 14;
    }
  }
}

// ---------- 区块渲染器 ----------
const blocks = {
  async statusbar(ctx, b) {
    const col = b.dark ? C.white : C.text;
    const y0 = ctx.y;
    await mk.txt('sb-time', 24, y0 + 13.5, '12:36', { size: 14, weight: 600, color: col, parent: ctx.pid });
    const bars = [4, 6, 8.5, 11];
    let bx = 375 - 18 - 25 - 6 - 16.5;
    for (const h of bars) { await mk.rect('sb-bar', bx, y0 + 27 - h, 3, h, { fill: col, radius: 1, parent: ctx.pid }); bx += 4.5; }
    const wx = bx + 2;
    await mk.rect('sb-wifi1', wx + 3.5, y0 + 23, 3, 3, { fill: col, radius: 1.5, parent: ctx.pid });
    await mk.rect('sb-wifi2', wx + 1.7, y0 + 19, 6.6, 3, { fill: col, radius: 1.5, parent: ctx.pid });
    await mk.rect('sb-wifi3', wx - 0.5, y0 + 15, 10, 3, { fill: col, radius: 1.5, parent: ctx.pid });
    const btx = 375 - 18 - 25;
    await mk.rect('sb-batt', btx, y0 + 16.5, 21, 11, { fill: b.dark ? (b.tint ?? C.primary) : C.bg, stroke: col, strokeA: 0.5, radius: 3, parent: ctx.pid });
    await mk.rect('sb-batt-in', btx + 1.5, y0 + 18, 15, 8, { fill: col, radius: 1.6, parent: ctx.pid });
    await mk.rect('sb-batt-nub', btx + 22.2, y0 + 19.8, 1.8, 4.8, { fill: col, opacity: 0.5, radius: 1, parent: ctx.pid });
    ctx.y += 44;
  },

  async navbar(ctx, b) {
    const y0 = ctx.y;
    await mk.rect('navbar', 0, y0, 375, 44, { fill: b.dark ? '#14151A' : C.card, parent: ctx.pid });
    if (b.brand) {
      // 品牌页头（ZctHeader 'brand' 形态）：左 logo + 中航招采
      // 2026-11-06 评审 M02：去掉「小飞机」logo 图形，暂用文字「中航招采」（正式 logo 1210 前定）
      if (typeof b.brand === 'string' && b.brand) await mk.txt('nav-brand', 16, y0 + 11.5, b.brand, { size: 17, weight: 700, parent: ctx.pid });
      ctx.y += 44;
      return;
    }
    if (b.back !== false) await mk.txt('nav-back', 10, y0 + 3, '‹', { size: 30, weight: 600, color: b.dark ? C.white : C.primary, parent: ctx.pid });
    if (b.title) await mk.txtC('nav-title', 187.5, y0 + 12.5, b.title, { size: 17, weight: 600, color: b.dark ? C.white : C.text, parent: ctx.pid });
    ctx.y += 44;
  },

  async hero(ctx, b) {
    const embed = ctx.sbEmbed; ctx.sbEmbed = false;
    const caH = b.ca ? 96 : 0; // ca=hero 下沿内嵌 CA 流程排（磨砂白块 + 白色 vIcon + 白字）
    const h = (b.h ?? 108) + caH;
    await mk.rect('hero', 0, ctx.y, 375, h + (embed ? 44 : 0), { fill: C.primary, parent: ctx.pid });
    if (embed) await blocks.statusbar(ctx, { dark: true });
    const y0 = ctx.y;
    await mk.rect('hero-deco1', 245, y0 - 104, 200, 200, { fill: C.white, opacity: 0.055, radius: 100, parent: ctx.pid });
    await mk.rect('hero-deco2', 185, y0 + h - 55, 130, 130, { fill: C.white, opacity: 0.04, radius: 65, parent: ctx.pid });
    let ty = y0 + (b.padTop ?? 26);
    if (b.title) { await mk.txt('hero-title', 20, ty, b.title, { size: 20, weight: 700, color: C.white, parent: ctx.pid }); ty += 35; }
    const sub_hero = b.sub ? fit(b.sub, 12.5, 400, 335) : null;
    if (sub_hero) { await mk.txt('hero-sub', 20, ty, sub_hero.text, { size: sub_hero.size, color: C.white, opacity: 0.72, parent: ctx.pid }); }
    if (b.ca) {
      const base = h - caH;
      for (let i = 0; i < b.ca.length; i++) {
        const cx = 16 + (343 / b.ca.length) * (i + 0.5);
        const yq = y0 + base + 16;
        await mk.rect(`ca-bg${i}`, cx - 23, yq, 46, 46, { fill: C.white, opacity: 0.14, stroke: C.white, strokeA: 0.25, radius: 12, parent: ctx.pid });
        await vIcon(b.ca[i].vicon, cx - 11, yq + 12, 22, C.white, ctx.pid);
        await mk.txtC(`ca-l${i}`, cx, yq + 53, b.ca[i].label, { size: 11, color: C.white, parent: ctx.pid });
      }
    }
    ctx.y = y0 + h;
  },

  async brandHero(ctx, b) {
    const embed = ctx.sbEmbed; ctx.sbEmbed = false;
    const H = Math.max(b.h ?? 300, 286); // 内容 246 + 底垫 40（登录卡 -30 叠卡后仍留 10px）
    await mk.rect('brand-hero', 0, ctx.y, 375, H + (embed ? 44 : 0), { fill: C.primary, parent: ctx.pid });
    if (embed) await blocks.statusbar(ctx, { dark: true });
    const y0 = ctx.y;
    await mk.rect('brand-deco1', 225, y0 - 66, 220, 220, { fill: C.white, opacity: 0.055, radius: 110, parent: ctx.pid });
    await mk.rect('brand-deco2', 255, y0 + H - 90, 140, 140, { fill: C.white, opacity: 0.04, radius: 70, parent: ctx.pid });
    let y = y0 + 54;
    // 品牌名 spec 驱动（b.brand 缺省不渲染——通用包不放业务名）
    if (b.brand) await mk.txt('brand-name', 24, y + 5, b.brand, { size: 19, weight: 700, color: C.white, parent: ctx.pid });
    y += 56;
    await mk.txt('brand-h1', 24, y, b.title, { size: 23, weight: 700, color: C.white, parent: ctx.pid });
    y += 40;
    const bs = fit(b.sub, 13, 400, 327);
    await mk.txt('brand-sub', 24, y, bs.text, { size: bs.size, color: C.white, opacity: 0.72, parent: ctx.pid });
    y += 42;
    const py = y, ph = 54;
    await mk.rect('brand-trust', 24, py, 327, ph, { fill: C.white, opacity: 0.07, stroke: C.white, strokeA: 0.14, radius: 10, parent: ctx.pid });
    for (let i = 0; i < b.trust.length; i++) {
      const cx = 24 + (327 / b.trust.length) * (i + 0.5);
      await mk.txtC('trust-v', cx, py + 9, b.trust[i][0], { size: 16, weight: 700, color: C.white, parent: ctx.pid });
      await mk.txtC('trust-l', cx, py + 31, b.trust[i][1], { size: 11, color: C.white, opacity: 0.66, parent: ctx.pid });
      if (i > 0) await mk.rect('trust-div', 24 + (327 / b.trust.length) * i, py + 10, 1, ph - 20, { fill: C.white, opacity: 0.16, parent: ctx.pid });
    }
    ctx.y = y0 + H;
  },

  async loginCard(ctx, b) {
    const P = ctx.pid, y0 = ctx.y;
    const tabs = b.tabs ?? []; // 缺省无 tab 行（通用包不放业务缺省）
    // 高度：20 + 头32 + tabs40 + 每字段(28+46)+16间隔 + 22+48+16 + links18 + 22
    let H = 20 + 32 + 40;
    for (const f of b.fields) H += 74 + (f.hint ? 24 : 0) + 16;
    H += 22 + 48 + 16 + 18 + 22;
    await mk.rect('login-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    let y = y0 + 20;
    if (b.heading) await mk.txt('lc-head', 34, y, b.heading, { size: 18, weight: 700, parent: P });
    if (b.modeText) await mk.txt('lc-mode', 345 - estW(b.modeText, 12), y + 4, b.modeText, { size: 12, color: C.text4, parent: P });
    y += 32;
    const tabX = tabs.length ? [34, 34 + estW(tabs[0], 15, 600) + 26] : [];
    for (let i = 0; i < tabs.length; i++) {
      const on = i === (b.activeTab ?? 0);
      await mk.txt(`lc-tab${i}`, tabX[i], y + 8, tabs[i], { size: 15, weight: on ? 600 : 400, color: on ? C.primary : C.text3, parent: P });
      if (on) await mk.rect('lc-tab-line', tabX[i], y + 31, estW(tabs[i], 15, 600), 3, { fill: C.primary, radius: 2, parent: P });
    }
    await mk.rect('lc-tabs-line', 34, y + 32, 307, 1, { fill: C.line, parent: P });
    y += 40;
    for (const f of b.fields) { y = (await drawField(ctx, f, y)) + 16; }
    y += 22;
    await drawButton(ctx, b.button ?? '登 录', y, !!b.buttonDisabled, true);
    y += 48 + 16;
    await drawLinks(ctx, b.links, y);
    ctx.y = y0 + H;
  },

  async formCard(ctx, b) {
    const P = ctx.pid, y0 = ctx.y + 12;
    let H = 18;
    if (b.sub) H += 28;
    if (b.seg) H += 54;
    if (b.stepper) H += 62 + 22;
    for (const f of b.fields) H += 74 + (f.hint ? 24 : 0) + 16;
    H += 22 + 48 + 16 + 18 + 18 + (b.tip ? 18 : 0) + (b.switchTip ? 20 : 0);
    await mk.rect(b.name ?? 'form-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    let y = y0 + 18;
    if (b.sub) { await mk.txt('fc-sub', 34, y, b.sub, { size: 12.5, color: C.text3, parent: P }); y += 28; }
    if (b.seg) {
      await mk.rect('fc-seg', 34, y, 307, 40, { fill: C.segBg, radius: 9, parent: P });
      const segW = 307 / b.seg.length;
      for (let i = 0; i < b.seg.length; i++) {
        if (i === 0) await mk.rect('fc-seg-on', 37, y + 3, segW - 6, 34, { fill: C.card, radius: 7, parent: P });
        await mk.txtC(`fc-seg-t${i}`, 34 + segW * (i + 0.5), y + 12, b.seg[i], { size: 13.5, weight: i === 0 ? 600 : 400, color: i === 0 ? C.primary : C.gray7, parent: P });
      }
      y += 54;
    }
    if (b.stepper) { await blocks.stepper({ ...ctx, y }, b.stepper); y += 62 + 22; }
    for (const f of b.fields) { y = (await drawField(ctx, f, y)) + 16; }
    y += 22;
    await drawButton(ctx, b.button, y, !!b.buttonDisabled, true);
    y += 48 + 16;
    await drawLinks(ctx, b.links, y);
    y += 18 + 18;
    if (b.tip) { await mk.txtC('fc-tip', 187.5, y, b.tip, { size: 11.5, color: C.text4, parent: P }); y += 18; }
    if (b.switchTip) { await mk.txtC('fc-switch', 187.5, y, b.switchTip, { size: 13, color: C.gray7, parent: P }); y += 20; }
    ctx.y = y0 + H;
  },

  async stepper(ctx, b) {
    const P = ctx.pid, y0 = ctx.y;
    const n = b.steps.length, cellW = 307 / n;
    for (let i = 0; i < n; i++) {
      const cx = 34 + cellW * (i + 0.5);
      const on = i === (b.active ?? 0);
      if (i > 0) await mk.rect('st-line', 34 + cellW * i, y0 + 12, cellW, 2, { fill: on ? '#A6DFFF' : C.nodeOff, parent: P });
      await mk.rect(`st-node${i}`, cx - 13, y0, 26, 26, { fill: on ? C.primary : C.nodeOff, radius: 13, parent: P });
      await mk.txtC(`st-n${i}`, cx, y0 + 6.5, String(i + 1), { size: 13, weight: 600, color: on ? C.white : '#9AA0AC', parent: P });
      await mk.txtC(`st-l${i}`, cx, y0 + 34, b.steps[i], { size: 11, weight: on ? 600 : 400, color: on ? C.primary : '#9AA0AC', parent: P });
    }
    ctx.y = y0 + 62;
  },

  async findpwHero(ctx, b) {
    const y0 = ctx.y;
    const H = 44 + (b.h ?? 195);
    await mk.rect('fp-hero', 0, y0, 375, H, { fill: C.primary, parent: ctx.pid });
    await mk.rect('fp-deco1', 235, y0 - 90, 200, 200, { fill: C.white, opacity: 0.055, radius: 100, parent: ctx.pid });
    await mk.rect('fp-deco2', 291, y0 + H - 80, 130, 130, { fill: C.white, opacity: 0.04, radius: 65, parent: ctx.pid });
    await blocks.statusbar(ctx, { dark: true });
    const y = ctx.y;
    await mk.txt('fp-back', 14, y + 6, '‹', { size: 30, weight: 600, color: C.white, parent: ctx.pid });
    await mk.rect('fp-lockbadge', 161.5, y + 12, 52, 52, { fill: C.white, opacity: 0.14, stroke: C.white, strokeA: 0.22, radius: 16, parent: ctx.pid });
    await mk.icon('fp-lock', 175.5, y + 26, 24, 'lockfill', { parent: ctx.pid });
    await mk.txtC('fp-title', 187.5, y + 78, b.title, { size: 20, weight: 700, color: C.white, parent: ctx.pid });
    const sub_findpwHero = fit(b.sub, 12.5, 400, 335);
    await mk.txtC('fp-sub', 187.5, y + 113, sub_findpwHero.text, { size: sub_findpwHero.size, color: C.white, opacity: 0.7, parent: ctx.pid });
    ctx.y = y0 + H;
  },

  async intro(ctx, b) {
    await mk.txt('intro-h1', 24, ctx.y + 12, b.title, { size: 22, weight: 700, parent: ctx.pid });
    ctx.y += 40 + 12;
    const isf = fit(b.sub, 13, 400, 327);
    await mk.txt('intro-sub', 24, ctx.y, isf.text, { size: isf.size, color: C.text3, parent: ctx.pid });
    ctx.y += 24;
  },

  async typeCards(ctx, b) {
    const P = ctx.pid;
    let y = ctx.y + 12;
    for (const t of b.items) {
      await mk.rect(`type-${t.key}`, 16, y, 343, 82, { fill: C.card, radius: 12, parent: P });
      await mk.rect(`type-icbg-${t.key}`, 32, y + 18, 46, 46, { fill: C.soft, radius: 12, parent: P });
      if (t.vicon) await vIcon(t.vicon, 43, y + 29, 22, C.primary, P);
      else await mk.icon(`type-ic-${t.key}`, 43, y + 29, 22, t.icon, { parent: P });
      await mk.txt(`type-t-${t.key}`, 92, y + 17, t.title, { size: 16, weight: 600, parent: P });
      const df = fit(t.desc, 12.5, 400, 213);
      await mk.txt(`type-d-${t.key}`, 92, y + 44, df.text, { size: df.size, color: C.text3, parent: P });
      await mk.icon(`type-go-${t.key}`, 337, y + 35, 13, 'chevright', { parent: P });
      y += 94;
    }
    ctx.y = y - 12 + (b.tip ? 26 : 0);
    if (b.tip) {
      const tipW = estW(b.tip, 13);
      const linkW = b.tipLink ? estW(b.tipLink, 13, 500) : 0;
      const startX = 187.5 - (tipW + linkW) / 2;
      await mk.txt('type-tip', startX, ctx.y, b.tip, { size: 13, color: C.gray7, parent: P });
      if (b.tipLink) await mk.txt('type-tip-link', startX + tipW, ctx.y, b.tipLink, { size: 13, weight: 500, color: C.primary, parent: P });
      ctx.y += 20;
    }
  },

  async flowSteps(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    let x = 16;
    for (let i = 0; i < b.steps.length; i++) {
      const on = i === 0;
      await mk.rect(`fs-n${i}`, x, y, 16, 16, { fill: on ? C.primary : '#E3E6EE', radius: 8, parent: P });
      await mk.txtC(`fs-nt${i}`, x + 8, y + 2.5, String(i + 1), { size: 10, weight: 600, color: on ? C.white : '#8A8F99', parent: P });
      await mk.txt(`fs-t${i}`, x + 22, y + 1, b.steps[i], { size: 11, weight: on ? 600 : 400, color: on ? C.primary : '#A6ABB8', parent: P });
      x += 22 + estW(b.steps[i], 11, on ? 600 : 400) + 8;
      if (i < b.steps.length - 1) { await mk.rect('fs-line', x, y + 7.5, 14, 2, { fill: '#E3E6EE', parent: P }); x += 22; }
    }
    ctx.y = y + 16;
  },

  async uploadBox(ctx, b) {
    const P = ctx.pid, y = ctx.y, lk = !!b.locked;
    await mk.rect('up-box', 34, y, 307, 92, { fill: lk ? '#F2F3F7' : C.uploadBg, stroke: C.uploadLine, strokeW: 1.2, radius: 10, parent: P });
    await mk.rect('up-plus', 174.5, y + 16, 26, 26, { fill: lk ? '#E3E6EE' : '#DFF2FF', radius: 13, parent: P });
    await mk.txtC('up-plus-t', 187.5, y + 22, lk ? '🔒' : '+', { size: lk ? 13 : 18, weight: 600, color: lk ? '#9AA0AC' : C.primary, parent: P });
    await mk.txtC('up-label', 187.5, y + 50, lk ? '上传功能建设中，暂未开放' : b.label, { size: 12, color: C.text3, parent: P });
    ctx.y = y + 92 + (b.hint ? 26 : 0);
    if (b.hint) { const uh = fit(b.hint, 12, 400, 307); await mk.txt('up-hint', 34, y + 98, uh.text, { size: uh.size, color: C.text4, parent: P }); }
  },

  async radioRow(ctx, b) {
    const P = ctx.pid, y = ctx.y;
    let rx = 34;
    if (b.req) { await mk.txt('radio-req', 34, y + 1, '*', { size: 14, color: C.danger, parent: P }); rx = 44; }
    await mk.rect('radio-on', rx, y + 2, 18, 18, { fill: C.primary, radius: 9, parent: P });
    await mk.rect('radio-in', rx + 4.5, y + 6.5, 9, 9, { fill: C.card, radius: 4.5, parent: P });
    await mk.txt('radio-t', rx + 26, y + 3, b.label, { size: 14, parent: P });
    if (b.note) await mk.txt('radio-note', 341 - estW(b.note, 11.5), y + 5, b.note, { size: 11.5, color: C.text4, parent: P });
    ctx.y = y + 24;
  },

  async cardGroup(ctx, b) {
    // 通用白卡容器：先渲染内部字段等，再画底卡（底卡先建会盖住？Figma 后建在上层——所以底卡必须先建）
    const P = ctx.pid, y0 = ctx.y + 12;
    let H = 16;
    for (const it of b.items) {
      if (it.type === 'field') H += 74 + (it.hint ? 24 : 0) + 16;
      else if (it.type === 'radio') H += 24 + 16;
      else if (it.type === 'upload') H += 92 + (it.hint ? 26 : 0) + 16;
      else H += 40;
    }
    H += 4;
    await mk.rect(b.name ?? 'grp-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    let y = y0 + 16;
    for (const it of b.items) {
      if (it.type === 'field') y = (await drawField(ctx, it, y)) + 16;
      else if (it.type === 'radio') { await blocks.radioRow({ ...ctx, y }, it); y += 24 + 16; }
      else if (it.type === 'upload') { await blocks.uploadBox({ ...ctx, y }, it); y += 92 + (it.hint ? 26 : 0) + 16; }
    }
    ctx.y = y0 + H;
  },

  async agreeRow(ctx, b) {
    const P = ctx.pid, y = ctx.y + 18;
    await mk.rect('agree-box', 16, y + 1, 17, 17, { fill: C.card, stroke: '#C3C8D4', strokeW: 1.6, radius: 4.5, parent: P });
    let x = 41;
    for (const seg of b.segs) {
      await mk.txt('agree-t', x, y, seg.t, { size: 12.5, weight: seg.link ? 500 : 400, color: seg.link ? C.primary : C.gray7, parent: P });
      x += estW(seg.t, 12.5, seg.link ? 500 : 400);
    }
    ctx.y = y + 20;
  },

  async submitBtn(ctx, b) {
    await drawButton(ctx, b.text, ctx.y + 12, !!b.disabled);
    ctx.y += 12 + 48 + 40;
  },

  async stats4(ctx, b) {
    const P = ctx.pid, y0 = ctx.y + (b.gap ?? 12); // gap:0 供 hero 叠卡（负 spacer）场景
    const items = b.items, gap = 10, W = (343 - gap * (items.length - 1)) / items.length;
    for (let i = 0; i < items.length; i++) {
      const x = 16 + i * (W + gap);
      await mk.rect(`stat${i}`, x, y0, W, 76, { fill: C.card, radius: 12, parent: P });
      const cx = x + W / 2;
      const nf = fit(String(items[i][1]), 22, 700, W - 14);
      const num = nf.text;
      await mk.txtC(`stat-n${i}`, cx, y0 + 13, num, { size: nf.size, weight: 700, color: C.primary, parent: P });
      if (items[i][2] === 'dot') await mk.rect(`stat-dot${i}`, cx + estW(num, 22, 700) / 2 + 3, y0 + 15, 7, 7, { fill: C.danger, radius: 3.5, parent: P });
      await mk.txtC(`stat-l${i}`, cx, y0 + 48, items[i][0], { size: 11.5, color: C.text3, parent: P });
    }
    ctx.y = y0 + 76;
  },

  async quickGrid(ctx, b) {
    const P = ctx.pid, y0 = ctx.y + 12;
    const rows = Math.ceil(b.items.length / 4);
    const H = 16 + rows * 79 - 14 + 8;
    await mk.rect('quick-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    for (let i = 0; i < b.items.length; i++) {
      const r = Math.floor(i / 4), c = i % 4;
      const cx = 16 + (343 / 4) * (c + 0.5);
      const y = y0 + 16 + r * 79;
      await mk.rect(`q-icbg${i}`, cx - 21, y, 42, 42, { fill: C.soft, radius: 12, parent: P });
      await mk.icon(`q-ic${i}`, cx - 10.5, y + 10.5, 21, b.items[i].icon, { parent: P });
      await mk.txtC(`q-l${i}`, cx, y + 49, b.items[i].label, { size: 11.5, color: C.text2, parent: P });
    }
    ctx.y = y0 + H;
  },

  // ---------- 0078 界面调整方案新增区块 ----------
  async serviceGrid(ctx, b) { // 会员服务宫格（5 列 × N 行 + new/hot/待 角标），对标参考 App 绿圈宫格
    const P = ctx.pid, y0 = ctx.y + (b.gap ?? 12);
    const items = b.items, cols = 5, rows = Math.ceil(items.length / cols);
    const H = 18 + 26 + 6 + rows * 74 + 6;
    await mk.rect('svc-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    await mk.rect('svc-bar', 32, y0 + 19, 4, 16, { fill: C.primary, radius: 2, parent: P });
    await mk.txt('svc-title', 44, y0 + 18, b.title, { size: 15, weight: 600, parent: P });
    const BADGE = { new: C.danger, hot: '#FF7D00', wait: '#9AA0AC' };
    const BTXT = { new: 'new', hot: 'hot', wait: '待' };
    for (let i = 0; i < items.length; i++) {
      const r = Math.floor(i / cols), c = i % cols;
      const cx = 16 + (343 / cols) * (c + 0.5);
      const iy = y0 + 18 + 26 + 6 + r * 74;
      await mk.rect(`svc-icbg${i}`, cx - 20, iy, 40, 40, { fill: C.soft, radius: 12, parent: P });
      if (items[i].vicon) await vIcon(items[i].vicon, cx - 10, iy + 10, 20, C.primary, P);
      else await mk.icon(`svc-ic${i}`, cx - 10, iy + 10, 20, items[i].icon, { parent: P });
      const lf = fit(items[i].label, 11, 400, 66);
      await mk.txtC(`svc-l${i}`, cx, iy + 46, lf.text, { size: lf.size, color: C.text2, parent: P });
      const bd = items[i].badge;
      if (bd) {
        const bw = Math.max(estW(BTXT[bd], 8.5, 600) + 10, 16);
        await mk.rect(`svc-bdg${i}`, cx + 8, iy - 5, bw, 14, { fill: BADGE[bd], radius: 7, parent: P });
        await mk.txtC(`svc-bdt${i}`, cx + 8 + bw / 2, iy - 2.5, BTXT[bd], { size: 8.5, weight: 600, color: C.white, parent: P });
      }
    }
    ctx.y = y0 + H;
  },

  async annFlow(ctx, b) { // 精选公告流 + 右侧两张竖向入口卡（对标参考 App「我的商机/标讯查询」）
    const P = ctx.pid, y0 = ctx.y + 12;
    const headH = 14 + 26 + 4, bodyH = b.rows.length * 62 + 8;
    const H = headH + bodyH;
    await mk.rect('flow-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    await mk.rect('flow-bar', 32, y0 + 17, 4, 16, { fill: C.primary, radius: 2, parent: P });
    await mk.txt('flow-title', 44, y0 + 16, b.title, { size: 15, weight: 600, parent: P });
    const flowMore = b.more ?? '查看更多';
    await mk.txt('flow-more', 326 - estW(flowMore, 12) - 10, y0 + 19, flowMore, { size: 12, color: C.text3, parent: P });
    await mk.icon('flow-more-ic', 330, y0 + 19, 8, 'chevright', { parent: P });
    let y = y0 + headH; // 左列：公告条目（x 32..246）
    for (let i = 0; i < b.rows.length; i++) {
      const r = b.rows[i];
      const tagW = estW(r.tag, 10.5) + 14;
      await mk.rect(`fl-tag${i}`, 32, y + 6, tagW, 18, { fill: r.win ? C.goldBg : C.soft, radius: 4, parent: P });
      await mk.txtC(`fl-tg${i}`, 32 + tagW / 2, y + 10.5, r.tag, { size: 10.5, color: r.win ? C.gold : C.softText, parent: P });
      const tf = fit(r.title, 13, 500, 214 - tagW - 8);
      await mk.txt(`fl-t${i}`, 32 + tagW + 8, y + 6.5, tf.text, { size: tf.size, weight: 500, parent: P });
      const mf = fit(r.meta, 11, 400, 214);
      await mk.txt(`fl-m${i}`, 32, y + 30, mf.text, { size: mf.size, color: C.text4, parent: P });
      if (i < b.rows.length - 1) await mk.rect(`fl-div${i}`, 32, y + 51, 214, 1, { fill: '#F2F4F8', parent: P });
      y += 62;
    }
    const sx = 254, sw = 91, sh = (bodyH - 10) / 2; // 右列：两张竖卡
    for (let i = 0; i < b.side.length; i++) {
      const s = b.side[i], sy = y0 + headH + i * (sh + 10);
      await mk.rect(`fs-card${i}`, sx, sy, sw, sh, { fill: C.soft, radius: 10, parent: P });
      await mk.rect(`fs-icbg${i}`, sx + sw / 2 - 17, sy + 12, 34, 34, { fill: C.card, radius: 17, parent: P });
      await mk.icon(`fs-ic${i}`, sx + sw / 2 - 8.5, sy + 21.5, 17, s.icon, { parent: P });
      await mk.txtC(`fs-l${i}`, sx + sw / 2, sy + 54, s.label, { size: 12, weight: 600, parent: P });
      const sf = fit(s.sub, 10, 400, sw - 10);
      await mk.txtC(`fs-s${i}`, sx + sw / 2, sy + 71, sf.text, { size: sf.size, color: C.text3, parent: P });
    }
    ctx.y = y0 + H;
  },

  async helpStrip(ctx, b) { // 帮助中心悬浮横幅（白条压 hero 下沿：前置 spacer -24），对标「标证通帮助中心」
    const P = ctx.pid, y = ctx.y; // 叠卡场景不吃 12px 节奏
    await mk.rect('help-strip', 16, y, 343, 64, { fill: C.card, opacity: 0.96, radius: 12, parent: P });
    await mk.rect('help-icbg', 32, y + 12, 40, 40, { fill: C.soft, radius: 12, parent: P });
    await mk.icon('help-ic', 42, y + 22, 20, b.icon ?? 'service', { parent: P });
    await mk.txt('help-t', 84, y + 13, b.title, { size: 15, weight: 600, parent: P });
    await mk.txt('help-s', 84, y + 37, b.sub, { size: 11.5, color: C.text3, parent: P });
    const bw = estW(b.more, 12) + 22;
    await mk.rect('help-more', 329 - bw, y + 18, bw, 28, { fill: C.soft, radius: 8, parent: P });
    await mk.txtC('help-more-t', 329 - bw / 2, y + 24.5, b.more, { size: 12, weight: 500, color: C.softText, parent: P });
    ctx.y = y + 64;
  },

  async vipStrip(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    await mk.rect('vip', 16, y, 343, 66, { fill: C.primary, radius: 12, parent: P });
    await mk.rect('vip-deco', 283, y - 24, 110, 110, { fill: C.white, opacity: 0.07, radius: 55, parent: P });
    const bw = estW(b.badge, 10.5) + 18;
    await mk.rect('vip-badge', 32, y + 23, bw, 20, { fill: C.primary, stroke: C.white, strokeA: 0.5, radius: 10, parent: P });
    await mk.txt('vip-badge-t', 41, y + 27.5, b.badge, { size: 10.5, color: C.white, parent: P });
    await mk.txt('vip-t', 32 + bw + 12, y + 14, b.title, { size: 14, weight: 600, color: C.white, parent: P });
    await mk.txt('vip-s', 32 + bw + 12, y + 37, b.sub, { size: 11, color: C.white, opacity: 0.72, parent: P });
    const mw = estW(b.more, 12) + 24;
    await mk.rect('vip-more', 345 - mw, y + 19, mw, 28, { fill: C.white, opacity: 0.16, radius: 8, parent: P });
    await mk.txtC('vip-more-t', 345 - mw / 2, y + 25.5, b.more, { size: 12, color: C.white, parent: P });
    ctx.y = y + 66;
  },

  async annList(ctx, b) {
    const P = ctx.pid, y0 = ctx.y + 12;
    const H = 14 + 24 + 4 + b.rows.length * 52 + 6;
    await mk.rect('ann-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    await mk.rect('ann-bar', 32, y0 + 17, 4, 16, { fill: C.primary, radius: 2, parent: P });
    await mk.txt('ann-title', 44, y0 + 16, b.title, { size: 15, weight: 600, parent: P });
    const annMore = b.more ?? '查看更多';
    await mk.txt('ann-more', 326 - estW(annMore, 12) - 10, y0 + 19, annMore, { size: 12, color: C.text3, parent: P });
    await mk.icon('ann-more-ic', 330, y0 + 19, 8, 'chevright', { parent: P });
    let y = y0 + 42;
    for (let i = 0; i < b.rows.length; i++) {
      const r = b.rows[i];
      const tagW = estW(r.tag, 10.5) + 14;
      await mk.rect(`ann-tag${i}`, 32, y + 8, tagW, 18, { fill: r.win ? C.goldBg : C.soft, radius: 4, parent: P });
      await mk.txtC(`ann-tg${i}`, 32 + tagW / 2, y + 12.5, r.tag, { size: 10.5, color: r.win ? C.gold : C.softText, parent: P });
      await mk.txt(`ann-t${i}`, 32 + tagW + 10, y + 8.5, r.title, { size: 13.5, weight: 500, parent: P });
      await mk.txt(`ann-m${i}`, 32 + tagW + 10, y + 31, r.meta, { size: 11, color: C.text4, parent: P });
      if (i < b.rows.length - 1) await mk.rect(`ann-div${i}`, 32, y + 51, 311, 1, { fill: '#F2F4F8', parent: P });
      y += 52;
    }
    ctx.y = y0 + H;
  },

  async tabbar(ctx, b) {
    const P = ctx.pid, y0 = Math.max(ctx.y, (ctx.frameH ?? 812) - 77); // 贴页面底部
    await mk.rect('tabbar-zone', 0, y0, 375, 77, { fill: C.card, parent: P });
    await mk.rect('tabbar-line', 0, y0, 375, 1, { fill: C.line, parent: P });
    const n = b.tabs.length;
    for (let i = 0; i < n; i++) {
      const t = b.tabs[i], cx = (375 / n) * (i + 0.5), on = i === b.active;
      if (on) {
        await mk.rect('tab-pill', cx - 29, y0 + 4, 58, 48, { fill: C.primary, radius: 15, parent: P });
        await mk.icon('tab-ic', cx - 9.5, y0 + 10, 19, `${t.key}-active`, { parent: P });
        await mk.txtC('tab-l', cx, y0 + 34, t.label, { size: 10, color: C.white, parent: P });
      } else {
        await mk.icon('tab-ic', cx - 9.5, y0 + 10, 19, `${t.key}-default`, { parent: P });
        await mk.txtC('tab-l', cx, y0 + 34, t.label, { size: 10, color: C.text3, parent: P });
      }
      if (t.badge) await mk.rect('tab-dot', cx + 6, y0 + 9, 7, 7, { fill: C.danger, radius: 3.5, parent: P });
    }
    await mk.rect('home-ind', 120.5, y0 + 61, 134, 5, { fill: C.text, opacity: 0.88, radius: 2.5, parent: P });
    ctx.y = y0 + 77;
  },

  async footer(ctx, b) {
    const y = ctx.y + 34;
    const f = fit(b.text, 11.5, 400, 327);
    await mk.txtC('footer', 187.5, y, f.text, { size: f.size, color: C.text4, parent: ctx.pid });
    ctx.y = y + 30;
  },

  async bottomTip(ctx, b) {
    const f = fit(b.text, 11.5, 400, 327);
    await mk.txtC('btm-tip', 187.5, ctx.y + 6, f.text, { size: f.size, color: C.text3, parent: ctx.pid });
    ctx.y += 24;
  },

  async spacer(ctx, b) { ctx.y += b.h ?? 12; },

  async roNotice(ctx, b) {
    const P = ctx.pid, y = ctx.y + (b.gap ?? 8);
    await mk.rect('ro-notice', 16, y, 343, 38, { fill: C.goldBg, radius: 8, parent: P });
    await mk.rect('ro-bar', 16, y, 4, 38, { fill: C.gold, radius: 2, parent: P });
    const nf = fit(b.text ?? '只读模式：写操作接口建设中，本页暂不可提交', 12, 500, 300);
    await mk.txt('ro-t', 32, y + 11.5, nf.text, { size: nf.size, weight: 500, color: C.gold, parent: P });
    ctx.y = y + 38 + 6;
  },

  // ---------- 通用扩展区块（全量铺开用） ----------
  async segTabs(ctx, b) {
    const P = ctx.pid, y0 = ctx.y;
    await mk.rect('segtabs-bg', 0, y0, 375, 44, { fill: C.card, parent: P });
    const tabs = b.tabs, pad = 16, gap = 24;
    let x = pad;
    for (let i = 0; i < tabs.length; i++) {
      const on = i === (b.active ?? 0);
      const w = estW(tabs[i], 14, on ? 600 : 400);
      await mk.txt(`segtab${i}`, x, y0 + 13, tabs[i], { size: 14, weight: on ? 600 : 400, color: on ? C.primary : C.text3, parent: P });
      if (on) await mk.rect('segtab-line', x, y0 + 41, w, 3, { fill: C.primary, radius: 2, parent: P });
      x += w + gap;
    }
    await mk.rect('segtabs-line', 0, y0 + 44, 375, 1, { fill: C.line, parent: P });
    ctx.y = y0 + 45;
  },

  async searchBar(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    await mk.rect('searchbar', 16, y, 343, 40, { fill: C.inputBg, radius: 20, parent: P });
    await mk.icon('search-ic', 32, y + 11, 18, 'search', { parent: P });
    await mk.txt('search-ph', 60, y + 12, b.placeholder ?? '搜索', { size: 13, color: C.text3, parent: P });
    ctx.y = y + 40;
  },

  async filterChips(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    let x = 16;
    for (let i = 0; i < b.chips.length; i++) {
      const on = i === (b.active ?? 0);
      const t = b.chips[i];
      const w = estW(t, 12.5) + 26;
      await mk.rect(`chip${i}`, x, y, w, 30, { fill: on ? C.primary : C.card, stroke: on ? C.primary : '#E3E6EE', radius: 15, parent: P });
      await mk.txtC(`chipt${i}`, x + w / 2, y + 8, t, { size: 12.5, weight: on ? 500 : 400, color: on ? C.white : C.text2, parent: P });
      x += w + 10;
    }
    ctx.y = y + 30;
  },

  async listCard(ctx, b) {
    const P = ctx.pid, y0 = ctx.y + 12;
    const head = b.title ? 14 + 26 + 4 : 12;
    const H = head + b.rows.length * 54 + 8;
    await mk.rect(b.name ?? 'list-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    let y = y0 + 12;
    if (b.title) {
      await mk.rect('lc-bar', 32, y + 3, 4, 16, { fill: C.primary, radius: 2, parent: P });
      await mk.txt('lc-title', 44, y + 2, b.title, { size: 15, weight: 600, parent: P });
      if (b.more) {
        await mk.txt('lc-more', 326 - estW(b.more, 12) - 10, y + 5, b.more, { size: 12, color: C.text3, parent: P });
        await mk.icon('lc-more-ic', 330, y + 5, 8, 'chevright', { parent: P });
      }
      y += 26 + 4;
    }
    for (let i = 0; i < b.rows.length; i++) {
      const r = b.rows[i];
      let tx = 32;
      if (r.tag) {
        const tagW = estW(r.tag, 10.5) + 14;
        await mk.rect(`row-tag${i}`, tx, y + 9, tagW, 18, { fill: r.tagWin ? C.goldBg : C.soft, radius: 4, parent: P });
        await mk.txtC(`row-tg${i}`, tx + tagW / 2, y + 13.5, r.tag, { size: 10.5, color: r.tagWin ? C.gold : C.softText, parent: P });
        tx += tagW + 10;
      }
      const rt = fit(r.title, 13.5, 500, 345 - (r.right ? estW(r.right, 11.5, 500) + 12 : 0) - tx);
      await mk.txt(`row-t${i}`, tx, y + 9.5, rt.text, { size: rt.size, weight: 500, parent: P });
      await mk.txt(`row-m${i}`, tx, y + 31, r.meta ?? '', { size: 11, color: C.text4, parent: P });
      if (r.right) await mk.txt(`row-r${i}`, 345 - estW(r.right, 11.5, 500), y + 9.5, r.right, { size: 11.5, weight: 500, color: r.rightDanger ? C.danger : C.primary, parent: P });
      if (i < b.rows.length - 1) await mk.rect(`row-div${i}`, 32, y + 53, 311, 1, { fill: '#F2F4F8', parent: P });
      y += 54;
    }
    ctx.y = y0 + H;
  },

  async infoCard(ctx, b) {
    const P = ctx.pid, y0 = ctx.y + 12;
    const H = 14 + (b.title ? 26 : 0) + b.rows.length * 40 + 10;
    await mk.rect(b.name ?? 'info-card', 16, y0, 343, H, { fill: C.card, radius: 12, parent: P });
    let y = y0 + 14;
    if (b.title) {
      await mk.rect('ic-bar', 32, y + 3, 4, 16, { fill: C.primary, radius: 2, parent: P });
      await mk.txt('ic-title', 44, y + 2, b.title, { size: 15, weight: 600, parent: P });
      y += 26;
    }
    for (let i = 0; i < b.rows.length; i++) {
      const [k, v] = b.rows[i];
      await mk.txt(`kv-k${i}`, 32, y + 1, k, { size: 13, color: C.text3, parent: P });
      await mk.txt(`kv-v${i}`, 150, y + 1, String(v), { size: 13, weight: 500, parent: P });
      y += 40;
    }
    ctx.y = y0 + H;
  },

  async msgList(ctx, b) {
    const P = ctx.pid;
    let y = ctx.y + 12;
    for (let i = 0; i < b.items.length; i++) {
      const m = b.items[i];
      await mk.rect(`msg${i}`, 16, y, 343, 74, { fill: C.card, radius: 12, parent: P });
      await mk.rect(`msg-icbg${i}`, 30, y + 16, 42, 42, { fill: C.soft, radius: 21, parent: P });
      await mk.icon(`msg-ic${i}`, 40, y + 26, 22, m.icon ?? 'chat', { parent: P });
      if (m.unread) await mk.rect(`msg-dot${i}`, 62, y + 14, 8, 8, { fill: C.danger, radius: 4, parent: P });
      await mk.txt(`msg-t${i}`, 84, y + 14, m.title, { size: 14.5, weight: 600, parent: P });
      await mk.txt(`msg-p${i}`, 84, y + 38, m.preview, { size: 12, color: C.text3, parent: P });
      await mk.txt(`msg-time${i}`, 345 - estW(m.time, 10.5), y + 16, m.time, { size: 10.5, color: C.text4, parent: P });
      y += 74 + 10;
    }
    ctx.y = y - 10;
  },

  async statPanels(ctx, b) {
    const P = ctx.pid;
    let y = ctx.y + 12;
    for (let p = 0; p < b.panels.length; p++) {
      const pan = b.panels[p];
      const cols = 2, rows = Math.ceil(pan.items.length / cols);
      const H = 14 + 24 + 10 + rows * 62 + 10;
      await mk.rect(`sp${p}`, 16, y, 343, H, { fill: C.card, radius: 12, parent: P });
      await mk.rect(`sp-bar${p}`, 32, y + 17, 4, 16, { fill: C.primary, radius: 2, parent: P });
      await mk.txt(`sp-title${p}`, 44, y + 16, pan.title, { size: 15, weight: 600, parent: P });
      for (let i = 0; i < pan.items.length; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const cx = 16 + (343 / cols) * (c + 0.5);
        const iy = y + 14 + 24 + 10 + r * 62;
        await mk.txtC(`sp-n${p}_${i}`, cx, iy, String(pan.items[i][1]), { size: 20, weight: 700, color: C.primary, parent: P });
        await mk.txtC(`sp-l${p}_${i}`, cx, iy + 30, pan.items[i][0], { size: 11.5, color: C.text3, parent: P });
      }
      y += H + 12;
    }
    ctx.y = y - 12;
  },

  async videoCard(ctx, b) { // 监控视频卡：16:9 深色画面 + 实时/回放角标 + 播放钮 + label/sub（纯展示）
    const live = b.mode ? b.mode === 'live' : b.live === true;
    const SW = 343, SH = Math.round(SW * 9 / 16);
    const cid = rid(await cmd('create_frame', { x: 16, y: Math.round(ctx.y), width: SW, height: SH + 54, name: 'video-card', parentId: ctx.pid, fillColor: hex2rgb(C.card) }));
    await cmd('set_corner_radius', { nodeId: cid, radius: 12 });
    await mk.rect('vc-screen', 0, 0, SW, SH, { fill: '#12161F', parent: cid });
    await mk.rect('vc-glow', 60, -30, 220, 120, { fill: C.white, opacity: 0.06, radius: 60, parent: cid });
    // 角标：实时(红点)/回放
    await mk.rect('vc-badge', 10, 10, live ? 52 : 44, 18, { fill: '#000000', opacity: 0.45, radius: 9, parent: cid });
    if (live) {
      await mk.rect('vc-dot', 17, 16, 6, 6, { fill: '#FF5252', radius: 3, parent: cid });
      await mk.txt('vc-badge-t', 26, 12.5, '实时', { size: 10.5, color: C.white, parent: cid });
    } else {
      await mk.txt('vc-badge-t', 17, 12.5, '回放', { size: 10.5, color: C.white, parent: cid });
    }
    // 中央播放钮（白圈 + play 三角；实时态红圈）
    const px = SW / 2 - 23, py = SH / 2 - 23;
    await mk.rect('vc-play', px, py, 46, 46, { fill: C.white, opacity: 0.12, radius: 23, stroke: live ? '#FF5252' : C.white, strokeA: 0.85, strokeW: 1.5, parent: cid });
    await vIcon('play', SW / 2 - 10, SH / 2 - 9, 18, C.white, cid);
    // 底部扫描纹
    for (let i = 0; i < 6; i++) await mk.rect(`vc-scan${i}`, SW - 56 + i * 8, SH - 11, 6, 3, { fill: C.white, opacity: i % 2 ? 0.08 : 0.35, radius: 2, parent: cid });
    // 文案区
    if (b.label) await mk.txt('vc-label', 12, SH + 10, b.label, { size: 14, weight: 600, color: C.text2, parent: cid });
    if (b.sub) await mk.txt('vc-sub', 12, SH + 33, fit(b.sub, 12, 400, 319).text, { size: 12, color: C.text3, parent: cid });
    ctx.y += SH + 54 + 12;
  },
  async attachRows(ctx, b) {
    const P = ctx.pid;
    let y = ctx.y + 12;
    for (let i = 0; i < b.rows.length; i++) {
      const r = b.rows[i];
      await mk.rect(`att${i}`, 16, y, 343, 64, { fill: C.card, radius: 12, parent: P });
      await mk.rect(`att-icbg${i}`, 30, y + 14, 36, 36, { fill: C.soft, radius: 10, parent: P });
      await mk.icon(`att-ic${i}`, 39, y + 23, 18, 'invoice', { parent: P });
      await mk.txt(`att-n${i}`, 78, y + 13, r.name, { size: 13.5, weight: 500, parent: P });
      await mk.txt(`att-m${i}`, 78, y + 36, r.meta ?? '', { size: 11, color: C.text4, parent: P });
      await mk.txt(`att-dl${i}`, 345 - estW('下载', 12.5, 500), y + 25, '下载', { size: 12.5, weight: 500, color: C.primary, parent: P });
      y += 64 + 10;
    }
    ctx.y = y - 10;
  },

  async timeline(ctx, b) {
    const P = ctx.pid;
    let y = ctx.y + 12;
    for (let i = 0; i < b.steps.length; i++) {
      const s = b.steps[i];
      const done = s.state === 'done', act = s.state === 'active';
      await mk.rect(`tl-dot${i}`, 24, y, 14, 14, { fill: done || act ? C.primary : C.nodeOff, radius: 7, parent: P });
      if (i < b.steps.length - 1) await mk.rect(`tl-line${i}`, 30, y + 16, 2, 38, { fill: done ? C.primary : '#E3E6EE', parent: P });
      await mk.txt(`tl-t${i}`, 50, y - 1, s.title, { size: 13.5, weight: act ? 600 : 500, color: act ? C.primary : C.text, parent: P });
      if (s.meta) await mk.txt(`tl-m${i}`, 50, y + 21, s.meta, { size: 11.5, color: C.text3, parent: P });
      y += 54;
    }
    ctx.y = y - 6;
  },

  async profileCard(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    await mk.rect('profile-card', 16, y, 343, 96, { fill: C.card, radius: 12, parent: P });
    await mk.rect('profile-avatar', 32, y + 20, 56, 56, { fill: C.soft, radius: 28, parent: P });
    await mk.txtC('profile-av-t', 60, y + 38, b.name.slice(0, 1), { size: 22, weight: 700, color: C.primary, parent: P });
    await mk.txt('profile-name', 102, y + 22, b.name, { size: 16, weight: 600, parent: P });
    if (b.sub) await mk.txt('profile-sub', 102, y + 48, b.sub, { size: 12, color: C.text3, parent: P });
    let tx = 102;
    if (b.tags) for (let i = 0; i < b.tags.length; i++) {
      const w = estW(b.tags[i], 10.5) + 16;
      await mk.rect(`profile-tag${i}`, tx, y + 68, w, 18, { fill: C.soft, radius: 9, parent: P });
      await mk.txtC(`profile-tagt${i}`, tx + w / 2, y + 72.5, b.tags[i], { size: 10.5, color: C.softText, parent: P });
      tx += w + 8;
    }
    ctx.y = y + 96;
  },

  async emptyHint(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    await mk.icon('empty-ic', 187.5 - 22, y, 44, 'folder', { parent: P });
    await mk.txtC('empty-t', 187.5, y + 56, b.title, { size: 14, weight: 600, color: C.text2, parent: P });
    if (b.sub) await mk.txtC('empty-s', 187.5, y + 80, b.sub, { size: 12, color: C.text4, parent: P });
    ctx.y = y + (b.sub ? 104 : 80);
  },

  async btnRow(ctx, b) {
    const P = ctx.pid, y = ctx.y + 12;
    const n = b.buttons.length, gap = 12, W = (343 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) {
      const bt = b.buttons[i], x = 16 + i * (W + gap);
      const dis = !!bt.disabled;
      await mk.rect(`btr${i}`, x, y, W, 44, { fill: dis ? '#E3E6EE' : bt.primary ? C.primary : C.card, stroke: dis ? undefined : bt.primary ? undefined : C.primary, strokeA: dis ? undefined : 0.4, radius: 8, parent: P });
      await mk.txtC(`btr-t${i}`, x + W / 2, y + 14, bt.text, { size: 13.5, weight: 500, color: dis ? '#9AA0AC' : bt.primary ? C.white : C.primary, parent: P });
    }
    ctx.y = y + 44;
  },

  async certBadge(ctx, b) { // CA 证书徽章（居中圆形 + 矢量图标 + 标签），td91-93 证书授权页共用
    const P = ctx.pid, y0 = ctx.y + 12;
    await mk.rect('cb-badge', 187.5 - 38, y0, 76, 76, { fill: C.primary, radius: 38, parent: P });
    await vIcon(b.vicon, 187.5 - 16, y0 + 22, 32, C.white, P);
    await mk.txtC('cb-label', 187.5, y0 + 92, b.label ?? 'CA 移动证书', { size: 16, weight: 600, parent: P });
    if (b.sub) await mk.txtC('cb-sub', 187.5, y0 + 118, b.sub, { size: 12, color: C.text3, parent: P });
    ctx.y = y0 + 76 + 16 + (b.sub ? 28 : 8);
  },

  async scanView(ctx, b) { // 扫一扫取景页（唯一深色页特例 #14151A）：自带深色状态栏+顶栏（spec 单块使用），深底从 y=0 铺到页底
    const P = ctx.pid, top = ctx.y;
    const bottom = Math.max(ctx.frameH ?? 812, top + 580);
    await mk.rect('scan-bg', 0, top, 375, bottom - top, { fill: '#14151A', parent: P });
    await blocks.statusbar(ctx, { dark: true, tint: '#14151A' });
    await blocks.navbar(ctx, { dark: true, title: b.title ?? '扫一扫' });
    const fv = 216, fx = (375 - fv) / 2, fy = top + 92;
    await mk.rect('scan-win', fx, fy, fv, fv, { fill: C.white, opacity: 0.07, radius: 12, parent: P });
    const corner = async (x, y, dw, dh) => mk.rect('scan-c', x, y, dw, dh, { fill: C.white, opacity: 0.85, radius: 1.5, parent: P });
    await corner(fx - 2, fy - 2, 24, 3); await corner(fx - 2, fy - 2, 3, 24);
    await corner(fx + fv - 22, fy - 2, 24, 3); await corner(fx + fv - 1, fy - 2, 3, 24);
    await corner(fx - 2, fy + fv - 1, 24, 3); await corner(fx - 2, fy + fv - 22, 3, 24);
    await corner(fx + fv - 22, fy + fv - 1, 24, 3); await corner(fx + fv - 1, fy + fv - 22, 3, 24);
    await vIcon('qr', 187.5 - 54, fy + 54, 108, C.white, P);
    await mk.rect('scan-line', fx + 14, fy + fv / 2 - 1, fv - 28, 2, { fill: C.white, opacity: 0.9, parent: P });
    await mk.txtC('scan-tip', 187.5, fy + fv + 24, b.tip ?? '将二维码放入框内，即可自动扫描', { size: 13, color: C.white, opacity: 0.78, parent: P });
    const by = fy + fv + 104;
    await mk.rect('torch-btn', 187.5 - 28, by, 56, 56, { fill: C.white, opacity: 0.12, stroke: C.white, strokeA: 0.32, radius: 28, parent: P });
    await vIcon('torch', 187.5 - 11, by + 17, 22, C.white, P);
    await mk.txtC('torch-t', 187.5, by + 72, b.torch ?? '打开闪光灯', { size: 11.5, color: C.white, opacity: 0.66, parent: P });
    // 深底上自绘白色 home indicator（buildPage 的黑底自动版不可见）
    await mk.rect('scan-ind', 120.5, bottom - 21, 134, 5, { fill: C.white, opacity: 0.8, radius: 2.5, parent: P });
    ctx.noAutoInd = true;
    ctx.y = bottom - 26;
  },

  async heroStats(ctx, b) { // 深蓝 hero 内含 2×2 指标（统计概况页头）
    const embed = ctx.sbEmbed; ctx.sbEmbed = false;
    const H = b.h ?? 210;
    await mk.rect('hs-hero', 0, ctx.y, 375, H + (embed ? 44 : 0), { fill: C.primary, parent: ctx.pid });
    if (embed) await blocks.statusbar(ctx, { dark: true });
    const y0 = ctx.y;
    await mk.rect('hs-deco1', 245, y0 - 60, 200, 200, { fill: C.white, opacity: 0.055, radius: 100, parent: ctx.pid });
    let ty = y0 + 24;
    await mk.txt('hs-title', 20, ty, b.title, { size: 19, weight: 700, color: C.white, parent: ctx.pid });
    ty += 34;
    if (b.sub) { const hss = fit(b.sub, 12, 400, 335); await mk.txt('hs-sub', 20, ty, hss.text, { size: hss.size, color: C.white, opacity: 0.72, parent: ctx.pid }); ty += 22; }
    for (let i = 0; i < b.items.length; i++) {
      const r = Math.floor(i / 2), c = i % 2;
      const cx = 20 + (335 / 2) * (c + 0.5), iy = ty + 6 + r * 58;
      await mk.txtC(`hs-n${i}`, cx, iy, String(b.items[i][1]), { size: 21, weight: 700, color: C.white, parent: ctx.pid });
      await mk.txtC(`hs-l${i}`, cx, iy + 30, b.items[i][0], { size: 11.5, color: C.white, opacity: 0.72, parent: ctx.pid });
    }
    ctx.y = y0 + H;
  },
};

// ---------- 页面组装 ----------
async function buildPage(spec) {
  const [w, h] = spec.size ?? [375, 812];
  const [x, y] = spec.at ?? [0, 0];
  const id = rid(await cmd('create_frame', { x, y, width: w, height: h, name: `${spec.pageId} ${spec.title}`, fillColor: hex2rgb(C.bg) }));
  const ctx = { pid: id, y: 0, frameH: h, sbEmbed: false };
  let blks = spec.blocks ?? [];
  if (blks[0]?.type === 'statusbar' && blks[0].dark && ['hero', 'brandHero', 'heroStats'].includes(blks[1]?.type)) {
    blks = blks.slice(1); // 状态栏由 hero 族内嵌：先铺蓝底再画状态栏，避免被盖
    ctx.sbEmbed = true;
  }
  for (const b of blks) {
    const fn = blocks[b.type];
    if (!fn) throw new Error(`unknown block type: ${b.type}`);
    await fn(ctx, b);
  }
  const fh = Math.max(h, Math.ceil(ctx.y) + 26); // 页脚文字与 home indicator 留安全距
  if (!blks.some(b => b.type === 'tabbar') && !ctx.noAutoInd) {
    await mk.rect('home-ind', 120.5, fh - 21, 134, 5, { fill: C.text, opacity: 0.88, radius: 2.5, parent: id });
  }
  if (fh > h) await cmd('resize_node', { nodeId: id, width: w, height: fh });
  console.log(`✓ ${spec.pageId} ${spec.title} → ${id}（内容高 ${Math.ceil(ctx.y)}）`);
  return id;
}


export { buildPage, blocks, mk, C, estW };
