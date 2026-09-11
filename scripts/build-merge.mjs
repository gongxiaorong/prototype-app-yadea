#!/usr/bin/env node
/**
 * ════════ P3+P4 · build-merge — 组装单文件双 App 合并产物 index.html
 * ════════
 * 输入：.merge-tmp/{A,B}.{css,html,js} + layers.{base,user,merchant}.css
 * 输出：../index.html
 *
 * 关键变换（基于对源码结构的核实）：
 *  1. A/B 整段 JS 分别包进 function mountUser(root)/mountMerchant(root)，
 *     消除顶部 `const app` 冲突；app.mount('#app') → app.mount(root)。
 *  2. 两端 initPullToRefresh 由 document.getElementById 改为 root.querySelector，
 *     解决 sc-home/ptr-home 之类跨端重复 id 错位（仅该函数两个 getElementById 被改）。
 *  3. 其余（luci / directives / history / window error）各端自含，互不冲突，原样保留：
 *     - B 的 luci、ptr 本就在 setup 内，天然隔离；
 *     - directive 是 per-app 注册，同名双注册无害；
 *     - 仅 A 用 history/popstate，B 不用，无双端争抢，无需降级。
 *  4. 模板逐字搬入 <div class="od-stage" id="mount-user|mount-merchant">，保留手指布局。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.merge-tmp');
const read = (p) => readFileSync(join(TMP, p), 'utf8');

// ── 1. 读取分段与 CSS 层 ──
const Ahtml = read('A.html').trim();
const Bhtml = read('B.html').trim();
let Ajs = read('A.js');
let Bjs = read('B.js');
const cssBase = read('layers.base.css');
const cssUser = read('layers.user.css');
const cssMerchant = read('layers.merchant.css');

// ── 2. JS 变换：ptr 作用域化 ──
const ptrA = 'var c=document.getElementById(containerId),i=document.getElementById(indicatorId);';
const ptrR = "var c=root.querySelector('#'+containerId),i=root.querySelector('#'+indicatorId);";
if (!Ajs.includes(ptrA)) throw new Error('A.js 未命中 ptr 锚点');
if (!Bjs.includes(ptrA)) throw new Error('B.js 未命中 ptr 锚点');
Ajs = Ajs.split(ptrA).join(ptrR);
Bjs = Bjs.split(ptrA).join(ptrR);

// ── 3. JS 变换：mount 目标 ──
if (!Ajs.includes("app.mount('#app');")) throw new Error('A.js 未命中 mount');
if (!Bjs.includes("app.mount('#app');")) throw new Error('B.js 未命中 mount');
Ajs = Ajs.split("app.mount('#app');").join('app.mount(root);');
Bjs = Bjs.split("app.mount('#app');").join('app.mount(root);');

// ── 4. 组装 JS 块 ──
const jsBlock = `/* ══════ SHARED CORE ══════ */
window.addEventListener('error', function (e) {
  var st = e.error && e.error.stack ? e.error.stack : '';
  console.log('[MERGED-GLOBALERR]', e.message);
  if (st) console.log(st);
});

/* ---------- 用户端 mountUser ---------- */
function mountUser(root) {
${Ajs.trimEnd()}
}

/* ---------- 商户端 mountMerchant ---------- */
function mountMerchant(root) {
${Bjs.trimEnd()}
}

/* ---------- 宿主：模式切换 ---------- */
function hostSetMode(mode) {
  var body = document.body;
  body.className = 'host-' + mode;
  document.querySelectorAll('#host-bar .modes button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
}
document.getElementById('host-bar').addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('button[data-mode]');
  if (b) hostSetMode(b.getAttribute('data-mode'));
});

/* ---------- 双实例常驻挂载 ---------- */
mountUser(document.getElementById('mount-user'));
mountMerchant(document.getElementById('mount-merchant'));
hostSetMode('split');
`;

// ── 5. 宿主 CSS ──
const hostCss = `/* ===== HOST: 宿主外壳 ===== */
body{margin:0;background:#E8EAED;color:#111;-webkit-font-smoothing:antialiased}
#host-bar{position:sticky;top:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:10px 16px;background:rgba(255,255,255,.9);backdrop-filter:blur(6px);box-sizing:border-box;border-bottom:1px solid #E2E4E8}
#host-bar .modes{display:flex;gap:6px}
#host-bar .modes button{border:1px solid #D3D6DB;background:#fff;color:#555;padding:5px 14px;border-radius:8px;font-size:12px;cursor:pointer;transition:all .15s}
#host-bar .modes button.active{background:#2B3F5F;border-color:#2B3F5F;color:#fff;font-weight:600}
#host-main{display:flex;align-items:stretch;overflow-x:auto;padding:24px;box-sizing:border-box;min-height:calc(100vh - 60px)}
.host-stage{display:flex;align-items:stretch;gap:16px;margin-inline:auto;max-width:100%}
#root-user,#root-merchant{flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box}
body.host-single-u #root-merchant{display:none}
body.host-single-m #root-user{display:none}
`;

// ── 6. 组装完整 HTML ──
const html = `<!DOCTYPE html>
<!--
═══════════════════════════════════════════════════════════════════
  雅迪租车 · 用户端 + 商户端 单文件双 App（合并产物）
═══════════════════════════════════════════════════════════════════
  产物由 scripts/build-merge.mjs 从 user.html + merchant.html 组装，
  P1 切分、P2 CSS 分层、P3 宿主、P4 双实例隔离均已脚本化完成。

  区块与同步开发约定（新增功能按区修改）：
  · 通用样式  → 编辑 <style id="layer-base">
  · 用户端专属 → <style id="layer-user">（选择器带 #root-user 前缀）
  · 商户端专属 → <style id="layer-merchant">（选择器带 #root-merchant 前缀）
  · 宿主外壳   → <style id="layer-host">（工具栏 / 并排布局 / 模式切换 / 居中）
  · 用户端逻辑 → function mountUser(root){ ... } 闭包内
  · 商户端逻辑 → function mountMerchant(root){ ... } 闭包内
  · 双实例常驻 mount；下拉刷新走 root 作用域，勿改回全局 getElementById
  （否则 sc-home / ptr-home 等两端重复 id 会错位）
  源快照：user.html（用户端） / merchant.html（商户端），只读参照。
═══════════════════════════════════════════════════════════════════
-->
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>雅迪租车 · 用户端 + 商户端（双 App 合档）</title>
<script src="https://cdn.jsdelivr.net/npm/@unocss/runtime"></script>
<script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js"
        onerror="this.onerror=null;this.src='https://unpkg.com/vue@3/dist/vue.global.prod.js'"></script>
<script src="https://unpkg.com/lucide@0.344.0/dist/umd/lucide.js"></script>
<style id="layer-base"><!--BASE--></style>
<style id="layer-user"><!--USER--></style>
<style id="layer-merchant"><!--MERCHANT--></style>
<style id="layer-host"><!--HOST--></style>
</head>
<body>
<header id="host-bar">
  <div class="modes">
    <button data-mode="split" class="active">双端并排</button>
    <button data-mode="single-u">只看用户端</button>
    <button data-mode="single-m">只看商户端</button>
  </div>
</header>
<main id="host-main">
  <div class="host-stage">
    <section id="root-user"><div class="od-stage" id="mount-user"><!--AHTML--></div></section>
    <section id="root-merchant"><div class="od-stage" id="mount-merchant"><!--BHTML--></div></section>
  </div>
</main>
<script>
${jsBlock}
</script>
</body>
</html>
`;

const out = html
  .replace('<!--BASE-->', cssBase)
  .replace('<!--USER-->', cssUser)
  .replace('<!--MERCHANT-->', cssMerchant)
  .replace('<!--HOST-->', hostCss)
  .replace('<!--AHTML-->', Ahtml)
  .replace('<!--BHTML-->', Bhtml);

writeFileSync(join(ROOT, 'index.html'), out, 'utf8');

// ── 7. 自检 ──
const checks = [];
checks.push(`index.html 大小: ${(out.length / 1024).toFixed(1)} KB`);
checks.push(`<script src 数量: ${(out.match(/<script src=/g) || []).length} (预期 3)`);
checks.push(`app.mount(root) 出现: ${(out.match(/app\.mount\(root\);/g) || []).length} (预期 2)`);
checks.push(`function mountUser/mountMerchant: ${(out.match(/function mountUser|function mountMerchant/g) || []).length} (预期 2)`);
checks.push(`剩余 document.getElementById(containerId): ${(out.match(/document\.getElementById\(containerId\)/g) || []).length} (预期 0)`);
checks.push(`root.querySelector 出现: ${(out.match(/root\.querySelector\('#\+containerId'\)/g) || []).length} (预期 2)`);
checks.push(`golden 重复 id sc-home: ${(out.match(/id="sc-home"/g) || []).length} (2 处, 靠 root 作用域隔离)`);
checks.push(`layer 块数量(base/user/merchant/host): ${(out.match(/<style id="layer-/g) || []).length} (预期 4)`);
console.log('构建完成 → ' + join(ROOT, 'index.html'));
console.log(checks.join('\n'));