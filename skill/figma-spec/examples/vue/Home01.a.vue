<!-- ⚠ 生成物：gen-vue.mjs 由 spec（ver=a）生成，改 spec 后重跑覆盖；要手工演化请先复制改名 -->
<template>
  <div class="page" data-page-id="home01" @click="handleClick">
    <div class="statusbar"><span>9:41</span><span class="sb-r">●●● ▮</span></div>
    <div class="navbar">
      <span class="nav-back"></span>
      <span class="nav-title">工作台</span>
    </div>
    <div class="hero">
      <h1>下午好</h1><p>今日待办 5 项 · 保持节奏</p>
    </div>
    <div class="card qgrid" data-ele-id="rd-quickGrid">
      <div class="grid4"><span class="g-item" data-ele-id="rd-quickGrid-item-0"><i class="ic" data-icon="star"></i><em>任务</em></span><span class="g-item" data-ele-id="rd-quickGrid-item-1"><i class="ic" data-icon="clock"></i><em>日程</em></span><span class="g-item" data-ele-id="rd-quickGrid-item-2"><i class="ic" data-icon="folder"></i><em>文档</em></span><span class="g-item" data-ele-id="rd-quickGrid-item-3"><i class="ic" data-icon="search"></i><em>检索</em></span></div>
    </div>
    <div class="card stats4">
      <div class="grid4 stats"><span class="stat"><b>5</b><em>进行中</em></span><span class="stat"><b>128</b><em>已完成</em></span><span class="stat"><b>8</b><em>协作成员</em></span></div>
    </div>
    <div class="card list" data-ele-id="rd-listCard">
      <div class="card-head"><h3>进行中的任务</h3><a class="more">全部任务</a></div>
      <div class="li-row" data-ele-id="rd-listCard-row-0">
        <div class="li-main"><span class="tag">今日</span><span class="li-title">整理季度目标复盘文档</span></div>
        <div class="li-meta">今天 18:00 截止</div>
      </div>
      <div class="li-row" data-ele-id="rd-listCard-row-1">
        <div class="li-main"><span class="li-title">评审新版首页设计稿</span></div>
        <div class="li-meta">明天 10:00 · 3 人参与</div>
      </div>
      <div class="li-row" data-ele-id="rd-listCard-row-2">
        <div class="li-main"><span class="li-title">整理月度经营分析报告</span></div>
        <div class="li-meta">周四 12:00 截止</div>
      </div>
    </div>
    <nav class="tabbar">
      <span class="tab on"><i class="ic" data-icon="home"></i><em>首页</em></span>
      <span class="tab"><i class="ic" data-icon="message"></i><em>消息</em></span>
      <span class="tab"><i class="ic" data-icon="mine"></i><em>我的</em></span>
    </nav>
  </div>
</template>

<script setup>
// 工作台（home01）
// 原型页：零依赖自包含；props.data 供接口数据回填（键名与 spec 字段对应），未接线时展示 spec 静态内容。
// 点击契约：可点元素带 data-ele-id（冻结码 9 个：rd-quickGrid、rd-quickGrid-item-0、rd-quickGrid-item-1、rd-quickGrid-item-2、rd-quickGrid-item-3、rd-listCard、rd-listCard-row-0、rd-listCard-row-1…），点击冒泡到根统一 emit。
defineProps({ data: { type: Object, default: () => ({}) } })
const emit = defineEmits(['eleClick'])
function handleClick(e) {
  const el = e.target.closest('[data-ele-id]')
  if (el) emit('eleClick', el.dataset.eleId, e)
}
</script>

<style scoped>
:root {
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
.help .hs-row { display: flex; gap: 10px; align-items: center; }
</style>
