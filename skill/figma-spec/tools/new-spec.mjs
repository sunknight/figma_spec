#!/usr/bin/env node
// new-spec.mjs — 生成 spec 骨架（新手起步 / 新页开写）。产物过 validate-specs 校验。
// 用法：
//   node new-spec.mjs bd40 招标计划 --at 120,2495            # 二级页骨架（statusbar+navbar+infoCard+btnRow+footer）
//   node new-spec.mjs s001 登录 --at 80,110 --kind=login     # 登录类骨架（brandHero+loginCard）
//   node new-spec.mjs bd01 工作台 --at 80,560 --kind=home    # 首页类骨架（navbar+hero+quickGrid+listCard+tabbar）
//   可选：--dir=specs（输出目录，默认 ./specs）；--id（骨架即带冻结码 id）；--variants=a,b（声明 A/B 变体空间）
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const positional = argv.filter((a) => !a.startsWith('-'));
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const [pageId, title] = positional;
if (!pageId || !title) {
  console.error('用法：node new-spec.mjs <pageId> <标题> [--at x,y] [--kind=page|login|home] [--dir=specs] [--id]');
  process.exit(1);
}

const kind = flag('kind') ?? 'page';
const dir = flag('dir') ?? './specs';
const useId = argv.includes('--id');
const variants = flag('variants')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
const at = (flag('at') ?? '0,0').split(',').map(Number);
const ID = (s) => (useId ? { id: `rd-${s}` } : {});

const KINDS = {
  // 标准内容页：状态栏 + 导航 + 信息卡 + 按钮排 + 页脚
  page: [
    { type: 'statusbar' },
    { type: 'navbar', title },
    { type: 'intro', title: `${title}介绍`, sub: '一句话说明本页用途' },
    {
      type: 'infoCard', title: '基本信息', ...ID('infoCard'),
      rows: [['字段一', '示例值'], ['字段二', '示例值'], ['字段三', '示例值']],
    },
    {
      type: 'btnRow', ...ID('btnRow'),
      buttons: [{ text: '主操作', primary: true, ...ID('btnRow-btn-0') }, { text: '次操作', ...ID('btnRow-btn-1') }],
    },
    { type: 'footer', text: '— 提供优质服务 —' },
  ],
  // 登录类：品牌横幅 + 登录卡（表单字段/按钮/links 都带可点形态示范）
  login: [
    { type: 'brandHero', title, sub: '一句话品牌副标题', trust: [['1,200+', '累计用户'], ['99.9%', '可用性'], ['7×24', '服务']] },
    {
      type: 'loginCard', ...ID('loginCard'),
      fields: [
        { key: 'acc', label: '账号', icon: 'user', placeholder: '请输入账号' },
        { key: 'pwd', label: '密码', icon: 'lock', eye: true, placeholder: '请输入密码' },
      ],
      button: '登 录',
      links: [
        { t: '忘记密码？', ...ID('loginCard-link-0') },
        { t: '还没有账号？立即注册', ...ID('loginCard-link-1') },
      ],
    },
    { type: 'footer', text: '登录即代表同意用户协议与隐私政策' },
  ],
  // 首页/工作台：导航 + 深蓝横幅 + 宫格 + 列表 + 底部 tab
  home: [
    { type: 'statusbar' },
    { type: 'navbar', title, back: false },
    { type: 'hero', title, sub: '欢迎回来', h: 96 },
    {
      type: 'quickGrid', ...ID('quickGrid'),
      items: [
        { icon: 'search', label: '检索', ...ID('quickGrid-item-0') },
        { icon: 'star', label: '收藏', ...ID('quickGrid-item-1') },
        { icon: 'mail', label: '消息', ...ID('quickGrid-item-2') },
        { icon: 'service', label: '客服', ...ID('quickGrid-item-3') },
      ],
    },
    {
      type: 'listCard', title: '最新动态', more: '查看全部', ...ID('listCard'),
      rows: [{ title: '示例条目标题', meta: '2026-01-01 · 来源', ...ID('listCard-row-0') }],
    },
    {
      type: 'tabbar', active: 0,
      tabs: [{ key: 'home', label: '首页' }, { key: 'mine', label: '我的' }],
    },
  ],
};
if (!KINDS[kind]) { console.error(`✗ 未知 --kind "${kind}"（page|login|home）`); process.exit(1); }

const spec = { pageId, title, size: [375, 812], blocks: KINDS[kind], at };
if (variants) spec.variants = variants; // 声明后才能用 ver/@<变体> 标记（规范见 references/spec-format.md §2）
const file = path.join(dir, `${pageId}.json`);
if (fs.existsSync(file)) { console.error(`✗ 已存在 ${file}（不覆盖）`); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, JSON.stringify(spec, null, 1)); // 1 空格缩进、无末尾换行（spec 落盘形制）
console.log(`✓ 已生成 ${file}（kind=${kind}，${KINDS[kind].length} 块）`);
console.log('  下一步：编辑 spec 内容 → 校验 → 上画布 / 生成 Vue：');
console.log(`  node tools/validate-specs.mjs --specs=${dir}`);
console.log(`  node tools/regen.mjs ${pageId} --specs=${dir}    # 上 Figma 画布（需桥在线）`);
console.log(`  node tools/gen-vue.mjs ${file} --out=src/pages     # 生成 Vue 页面`);
