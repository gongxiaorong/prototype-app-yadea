#!/usr/bin/env node
/**
 * ════════ P3+P4 · build-merge — 组装单文件双 App 合并产物 index.html
 * ════════ 含「公共部分抽取」：luci / toast / 下拉刷新 / 页面栈 nav 抽到 SHARED CORE。
 *
 * 输入：.merge-tmp/{A,B}.{css,html,js} + layers.{base,user,merchant}.css
 * 输出：../index.html
 *
 * JS 变换（对 A.js / B.js 文本做精确锚点操作，全部带存在性断言）：
 *  1. luci：双端删自有定义一次（逐字相同），抽一份进 SHARED CORE。
 *  2. toast：双端删自有函数体，改为调用共享 toastPush；let tid → _tt 计数对象。
 *  3. initPullToRefresh：双端删实现，改 3 参 wrapper 调共享 ptrBind(root,...)。
 *  4. 页面栈 nav：双端删内联栈，改调共享 createNav（快照统一数组）。
 *  5. 双端包进 mountUser(root) / mountMerchant(root)，app.mount('#app')->mount(root)。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.merge-tmp');
const read = (p) => readFileSync(join(TMP, p), 'utf8');

// ── 工具 ──
function assert(cond, msg) { if (!cond) throw new Error('[share-core] ' + msg); }
/** 从 openIdx('{' 处)匹配到 depth0 的 '}'，返回其后的索引。 */
function blockEnd(src, openIdx) {
  let depth = 0, quote = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error('[share-core] 未配对大括号 @ ' + openIdx);
}
/** 删除【startMarker 起始】到【其 '{' 的平衡 '}' 结束】整块，返回删除后的字符串。 */
function cutBlock(src, startMarker) {
  const s = src.indexOf(startMarker);
  assert(s >= 0, '缺失 startMarker: ' + startMarker.slice(0, 24));
  const op = src.indexOf('{', s);
  const end = blockEnd(src, op);
  return src.slice(0, s) + src.slice(end);
}
/** 删除从 startMarker 到 endMarker(含) 的区间，用 insert 替换。 */
function cutRange(src, startMarker, endMarker, insert) {
  const s = src.indexOf(startMarker);
  assert(s >= 0, '缺失 startMarker: ' + startMarker.slice(0, 24));
  let e = src.indexOf(endMarker, s);
  assert(e >= 0, '缺失 endMarker: ' + endMarker.slice(0, 24));
  e += endMarker.length;
  return src.slice(0, s) + insert + src.slice(e);
}
function removeLine(src, marker) {
  const s = src.indexOf(marker);
  assert(s >= 0, '缺失行: ' + marker.slice(0, 24));
  const e = src.indexOf('\n', s);
  return src.slice(0, s) + (e >= 0 ? src.slice(e + 1) : '');
}
const split1 = (src, sep, to) => {
  assert(src.split(sep).length === 2, '「' + sep.slice(0, 20) + '」应恰好出现1次');
  return src.split(sep).join(to);
};

// ── Token 归一：CSS 中等价裸 hex → CSS 变量（保护 :root 定义处，避免自我引用） ──
const TOKEN_MAP = [
  ['#2B3F5F', 'var(--accent)'],
  ['#2F6FEB', 'var(--link)'],
  ['#17A34A', 'var(--success)'],
  ['#DC2626', 'var(--danger)'],
  ['#FF6A00', 'var(--accent-2)'],
];
function normTokens(css, hasRoot) {
  const MARK = '__ROOT_KEYS__';
  let rootStore = null;
  if (hasRoot) {
    const rs = css.indexOf(':root{');
    if (rs >= 0) {
      const op = css.indexOf('{', rs);
      const re = blockEnd(css, op);
      rootStore = css.slice(rs, re);
      css = css.slice(0, rs) + MARK + css.slice(re);
    }
  }
  for (const [h, v] of TOKEN_MAP) css = css.split(h).join(v);
  if (rootStore) css = css.split(MARK).join(rootStore);
  return css;
}

// ── 1. 读取分段与 CSS 层 ──
let Ahtml = read('A.html').trim();
let Bhtml = read('B.html').trim();
const cssBase = normTokens(read('layers.base.css'), true);
const cssUser = normTokens(read('layers.user.css'), false);
const cssMerchant = normTokens(read('layers.merchant.css'), false);
let Ajs = read('A.js');
let Bjs = read('B.js');

// ── 1.1 模板金额收口：Rp {{ X.toLocaleString('id-ID'{opts}) }} → {{ fmtRp(X{,dec}) }}，随货币联动 ──
function rewriteRpAmounts(html, side) {
  const EXACT = [
    ["Rp {{ (walletActive?walletActive.totalBalance.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'—') }}", "{{ (walletActive?fmtRp(walletActive.totalBalance,2):'—') }}"],
    ["Rp {{ walletActive?walletActive.totalBalance.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'—' }}", "{{ walletActive?fmtRp(walletActive.totalBalance,2):'—' }}"],
    ["Rp {{ walletBalanceVisible?(walletActive?walletActive.totalBalance.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'):'•••••••' }}", "{{ walletBalanceVisible?(walletActive?fmtRp(walletActive.totalBalance,2):'—'):'•••••••' }}"],
    ["Rp {{ walletBalanceVisible?(walletActive?walletActive.rechargeBalance.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'):'•••••••' }}", "{{ walletBalanceVisible?(walletActive?fmtRp(walletActive.rechargeBalance,2):'—'):'•••••••' }}"],
    ["Rp {{ walletBalanceVisible?(walletActive?walletActive.bonusBalance.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'):'•••••••' }}", "{{ walletBalanceVisible?(walletActive?fmtRp(walletActive.bonusBalance,2):'—'):'•••••••' }}"],
    ["Rp {{ (payTarget?payTarget.amount:0).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}) }}", "{{ fmtRp((payTarget?payTarget.amount:0),2) }}"],
    ["Rp {{ r.balanceAfter!=null?r.balanceAfter.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}):'—' }}", "{{ r.balanceAfter!=null?fmtRp(r.balanceAfter,2):'—' }}"],
    ["Rp {{ confGrandTotal.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}", "{{ fmtRp(confGrandTotal,2) }}"],
    ["Rp {{ Math.abs(r.amount).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}) }}", "{{ fmtRp(Math.abs(r.amount),2) }}"],
    ["Rp {{ Number(uFlowAmt(r).val).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}) }}", "{{ fmtRp(Number(uFlowAmt(r).val),2) }}"],
    ["Rp {{ Number(r.balanceAfter).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2}) }}", "{{ fmtRp(Number(r.balanceAfter),2) }}"],
    ["Rp 200.45", "{{ fmtRp(confDeposit,2) }}"],
  ];
  for (const [f, t] of EXACT) {
    const n0 = html.split(f).length - 1;
    html = html.split(f).join(t);
    if (n0 > 0) console.log('  [rewrite] ' + side + ' 精确替换 ×' + n0 + ': ' + f.slice(6, 40) + '…');
  }
  html = html.replace(/Rp \{\{ ([\w$.\[\]]+)\.toLocaleString\('id-ID',\{minimumFractionDigits:(\d+),maximumFractionDigits:\d+\}\) \}\}/g, (m, e, d) => '{{ fmtRp(' + e + ',' + d + ') }}');
  html = html.replace(/Rp \{\{ ([\w$.\[\]]+)\.toLocaleString\('id-ID'\) \}\}/g, (m, e) => '{{ fmtRp(' + e + ') }}');
  return html;
}
Ahtml = rewriteRpAmounts(Ahtml, 'A');
Bhtml = rewriteRpAmounts(Bhtml, 'B');

// ── 2. 抽 luci（取 A 那份，双端删） ──
const luciStart = Ajs.indexOf('function luci(');
assert(luciStart >= 0, 'A 无 luci');
const luciFn = Ajs.slice(luciStart, Ajs.indexOf('\n', luciStart));
assert(Bjs.includes('function luci('), 'B 无 luci');
assert(Ajs.includes('function luci(') && Bjs.includes('function luci('), 'A/B luci 前缀一致');
Ajs = removeLine(Ajs, 'function luci(');
Bjs = removeLine(Bjs, 'function luci(');

// ── 3. toast 去重 → 共享 toastPush ──
const toastFn = "function toast(msg,type='info'){const id=++tid;toasts.value.push({id,msg,type});setTimeout(()=>{const i=toasts.value.findIndex(t=>t.id===id);if(i>=0)toasts.value.splice(i,1)},2000)}";
const toastWrap = "function toast(msg,type='info'){toastPush(toasts.value,_tt,msg,type)}";
assert(Ajs.includes(toastFn), 'A 无 toastFn');
assert(Bjs.includes(toastFn), 'B 无 toastFn');
Ajs = Ajs.split(toastFn).join(toastWrap);
Bjs = Bjs.split(toastFn).join(toastWrap);
Ajs = Ajs.split('let tid=0;').join('const _tt={n:0};');
Bjs = Bjs.split('let tid=0;').join('const _tt={n:0};');

// ── 4. 下拉刷新：删实现，改 wrapper 调 ptrBind ──
Ajs = cutBlock(Ajs, 'function initPullToRefresh(containerId,indicatorId,onRefresh){');
Bjs = cutBlock(Bjs, 'function initPullToRefresh(containerId,indicatorId,onRefresh){');
const PTR_HOOK = 'const app=createApp({';
const PTR_WRAP = '\nfunction initPullToRefresh(cid,iid,cb){return ptrBind(root,cid,iid,cb)}\nconst app=createApp({';
if (Ajs.indexOf(PTR_HOOK) < 0) throw new Error('A 缺 createApp 钩子');
if (Bjs.indexOf(PTR_HOOK) < 0) throw new Error('B 缺 createApp 钩子');
Ajs = Ajs.split(PTR_HOOK).join(PTR_WRAP);
Bjs = Bjs.split(PTR_HOOK).join(PTR_WRAP);

// ── 5. 页面栈 nav：删内联，改调共享 createNav（两端调用逐字一致，纯导航） ──
const NAV_ENDMARK = "try{history.replaceState({nav:''},'')}catch(e){}";
const NAV_INSERT = '\nconst {navOpen,navBack,navDrop,navSwap,navReset,navLog}=createNav({screens:NAV_SCREENS,pageRefList:pageRefList});\n';
Ajs = cutRange(Ajs, 'function _navSnapshot(', NAV_ENDMARK, NAV_INSERT);
Bjs = cutRange(Bjs, 'function _navSnapshot(', NAV_ENDMARK, NAV_INSERT);
// B 的 setTab 曾引用原 nav 私有变量 _pagePushed → 导航已纯化，改为无条件 navReset()
assert(Bjs.includes('if(!_pagePushed)navReset();'), 'B 缺 _pagePushed 引用锚点');
Bjs = Bjs.split('if(!_pagePushed)navReset();').join('navReset();');

// ── 6. mount 目标 ──
Ajs = split1(Ajs, "app.mount('#app');", 'app.mount(root);');
Bjs = split1(Bjs, "app.mount('#app');", 'app.mount(root);');

// ── 6.1 金额 formatter 统一 → 共享 fmtRp（id-ID） ──
assert(Ajs.includes('function fmtRp('), 'A 缺 fmtRp');
assert(Bjs.includes('function fmtRp('), 'B 缺 fmtRp');
Ajs = removeLine(Ajs, 'function fmtRp(');
Bjs = removeLine(Bjs, 'function fmtRp(');

// ── 6.2 商户首页经营看板静态金额 → 走共享 fmtRp ──
const BIZ_STAT = [
  ["{label:'今日收款',value:'Rp 3,240',trend:null}", "{label:'今日收款',value:fmtRp(3240),trend:null}"],
  ["{label:'本月收款',value:'Rp 28,500',trend:null}", "{label:'本月收款',value:fmtRp(28500),trend:null}"],
];
for (const [from, to] of BIZ_STAT) {
  const n = Bjs.split(from).length - 1;
  if (n !== 1) throw new Error('[migrate] bizStats 命中异常: ' + from + ' ×' + n);
  Bjs = Bjs.split(from).join(to);
}

// ── 6.3 跨端数据桥 MERGED：商户发布 + 用户消费 + 首页状态条（契约字段名对齐） ──
const A_NAV_LINE = 'const {navOpen,navBack,navDrop,navSwap,navReset,navLog}=createNav({screens:NAV_SCREENS,pageRefList:pageRefList});';
assert(Ajs.includes(A_NAV_LINE), 'A 缺 nav 行锚点');
const A_mergedConst = '\nconst mergedStats=computed(function(){return{orderCount:MERGED.orderCount,vehicleCount:MERGED.vehicleCount,batteryCount:MERGED.batteryCount,walletBalance:MERGED.walletBalance,lastOrderId:MERGED.lastOrderId,updatedAt:MERGED.updatedAt}});';
Ajs = Ajs.replace(A_NAV_LINE, A_mergedConst + '\n' + A_NAV_LINE);
const A_RET_TAIL = 'requestCancelRecharge,confirmCancelRecharge}';
assert(Ajs.includes(A_RET_TAIL), 'A 缺 return 尾部锚点');
Ajs = Ajs.replace(A_RET_TAIL, 'requestCancelRecharge,confirmCancelRecharge,mergedStats}');
const B_MOUNT = 'onMounted(()=>{brandLoading.value=true;';
assert(Bjs.includes(B_MOUNT), 'B 缺 onMounted 锚点');
const B_pub = 'function publishMerged(){try{MERGED.orderCount=(( (orders.value||orders)||[]).length)||0;MERGED.vehicleCount=(vehicles?(((vehicles.value||vehicles)||[]).length)||0:0);MERGED.batteryCount=(batteries?(((batteries.value||batteries)||[]).length)||0:0);MERGED.walletBalance=(uWallet&&uWallet.total)?uWallet.total:0;var _o=(((orders.value||orders)||[])[0])||null;MERGED.lastOrderId=_o?(_o.orderId||_o.id||"—"):"—";MERGED.updatedAt=Date.now();}catch(e){}}\nwatch(function(){return[(((orders.value||orders)||[]).length)||0,(vehicles?(((vehicles.value||vehicles)||[]).length)||0:0),(batteries?(((batteries.value||batteries)||[]).length)||0:0),(uWallet&&uWallet.total)||0]},publishMerged,{immediate:true});\n';
Bjs = Bjs.replace(B_MOUNT, B_pub + B_MOUNT);
const STRIP = '\n<div class="merged-strip" style="margin:0 16px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-radius:10px;background:#fff;border:1px solid #E5E5E5;font-size:12px;color:#444">商户端同步 ▶ 订单 <b>{{mergedStats.orderCount}}</b> · 车辆 <b>{{mergedStats.vehicleCount}}</b> · 电池 <b>{{mergedStats.batteryCount}}</b> · 钱包 <b>{{ fmtRp(mergedStats.walletBalance) }}</b> <span style="color:#999">(#{{mergedStats.lastOrderId}}@{{mergedStats.updatedAt}})</span></div>';
assert(/id="sc-home"[^>]*>/.test(Ahtml), 'Ahtml 缺 #sc-home 锚点');
Ahtml = Ahtml.replace(/id="sc-home"[^>]*>/, (m) => m + STRIP);

// ── 7. SHARED CORE ──
const SHARED_CORE = `/* ══════ SHARED CORE ══════ */
${luciFn}

/* toast 共享：list=toasts.value 数组，cnt 计数对象(_tt)，按 2s 自动移除 */
function toastPush(list,cnt,msg,type){var id=++cnt.n;list.push({id:id,msg:msg,type:type});setTimeout(function(){for(var i=0;i<list.length;i++){if(list[i].id===id){list.splice(i,1);return}}},2000)}

/* 下拉刷新（root 作用域，避免双端重复 id 错位）
   以 C 端实现为准：touch + 兼容鼠标(document 级监听拖动) */
function ptrBind(root,containerId,indicatorId,onRefresh){
  var c=root.querySelector('#'+containerId),i=root.querySelector('#'+indicatorId);
  if(!c||!i)return;
  var sy=0,pull=false,active=false;
  function startY(e){return e.touches&&e.touches[0]?e.touches[0].clientY:e.clientY}
  function curY(e){return e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientY:e.clientY}
  function onStart(e){if(c.scrollTop<=0){sy=startY(e);pull=true;active=true}else{pull=false}}
  function onMove(e){if(!active||!pull)return;if(c.scrollTop>0){pull=false;return}e.preventDefault();var dy=curY(e)-sy;var off=Math.min(dy*0.4,60);if(off<0)off=0;i.style.height=off+'px';i.innerHTML='<span class="ptr-spinner"></span>'+(off>40?'释放刷新':'下拉刷新')}
  function onEnd(e){if(!active)return;active=false;if(!pull)return;pull=false;var dy=curY(e)-sy;if(dy>60){i.style.height='40px';i.innerHTML='<span class="ptr-spinner"></span>刷新中…';if(onRefresh){onRefresh()}setTimeout(function(){i.style.height='0';i.innerHTML='<span class="ptr-text">下拉刷新</span>'},1200)}else{i.style.height='0'}}
  c.addEventListener('touchstart',onStart,{passive:true});
  c.addEventListener('touchmove',onMove,{passive:false});
  c.addEventListener('touchend',onEnd,{passive:true});
  c.addEventListener('mousedown',function(e){onStart(e);var mm=function(ev){if(active){onMove(ev)}};var mu=function(ev){onEnd(ev);document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu)};document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu)});
}

/* 页面栈导航（快照式）统一实现：纯导航，不触碰任何 app 状态。
   两端调用一致：createNav({screens, pageRefList})，无 app 差异参数。
   opts: { screens, pageRefList } */
function createNav(o){
  var screens=o.screens||{}, pageRefList=o.pageRefList||[];
  var navStack=[];
  var _pagePushed=false,navSuppress=0,navLastBackAt=0;
  function _navClone(v){return (v&&typeof v==='object')?JSON.parse(JSON.stringify(v)):v}
  function _navSnapshot(){return pageRefList.map(function(r){return _navClone(r.get())})}
  function _navRestore(s){pageRefList.forEach(function(r,i){r.set(_navClone(s[i]))})}
  function _navScreen(name){return screens[name]||null}
  function navLog(a,n){console.log('[页面栈]',a+(n?' '+n:''),'→',navStack.map(function(e){return e.name||'(未命名)'}).join(' <- ')||'(首页)','| history.length='+history.length)}
  function navOpen(name){
    if(_pagePushed)return;_pagePushed=true;
    setTimeout(function(){_pagePushed=false},0);
    if(name&&navStack.some(function(e){return e.name===name})){navLog('重复入栈已忽略',name);return}
    var snap=_navSnapshot();
    if(!name&&navStack.length&&JSON.stringify(snap)===JSON.stringify(navStack[navStack.length-1].snap)){navLog('重复入栈已忽略',name||'');return}
    var sc=_navScreen(name);
    navStack.push({name:name||'',snap:snap});
    if(sc&&sc.open)sc.open();
    try{history.pushState({nav:name||''},'')}catch(e){}
    navLog('push',name||'');
  }
  function navBack(){
    var now=Date.now();if(now-navLastBackAt<250)return;navLastBackAt=now;
    if(!navStack.length){navLog('已到首页，边界兜底，禁止继续返回');return}
    var e=navStack.pop();
    var sc=_navScreen(e.name);
    if(sc&&sc.close)sc.close();
    _navRestore(e.snap);
    navSuppress++;try{history.back()}catch(_){}
    navLog('back',e.name||'');
  }
  function navDrop(name){
    var i=navStack.length-1;
    if(i<0)return;
    if(name&&navStack[i].name!==name)return;
    var e=navStack.pop();
    var sc=_navScreen(e.name);
    if(sc&&sc.close)sc.close();
    navSuppress++;try{history.go(-1)}catch(_){}
    navLog('drop',e.name||'');
  }
  function navSwap(name){
    var s=_navScreen(name);if(!s)return;
    var top=navStack.length?navStack.pop():null;
    if(top){var sc=_navScreen(top.name);if(sc&&sc.close)sc.close()}
    s.open();try{history.replaceState({nav:name||''},'')}catch(_){}
    navStack.push({name:name||'',snap:top?top.snap:_navSnapshot()});
    navLog('replace',name);
  }
  function navReset(){
    var n=navStack.length;
    while(navStack.length){var e=navStack.pop();var sc=_navScreen(e.name);if(sc&&sc.close)sc.close()}
    if(n>0){navSuppress++;try{history.go(-n)}catch(_){}}
    navLog('reset','清空'+n+'层');
  }
  window.addEventListener('popstate',function(){
    if(navSuppress>0){navSuppress--;return}
    if(!navStack.length)return;
    var e=navStack.pop();
    var sc=_navScreen(e.name);
    if(sc&&sc.close)sc.close();
    _navRestore(e.snap);
    navLog('popstate(物理返回)',e.name||'');
  });
  try{history.replaceState({nav:''},'')}catch(e){}
  return {navOpen,navBack,navDrop,navSwap,navReset,navLog};
}

/* 货币状态：reactive，双端金额经 fmtRp 联动切换（默认印尼盾；rate 为对 1 IDR 的折算，演示用近似值） */
var MONEY=Vue.reactive({cur:'IDR',rates:{IDR:1,CNY:0.000357,HKD:0.00192},symbols:{IDR:'Rp ',CNY:'¥',HKD:'HK$ '}});
/* 共享金额 formatter：随 MONEY.cur 切换货币（dec 可选，用于小数位） */
function fmtRp(n,dec){var v=Number(n);if(v==null||isNaN(v))v=0;var c=MONEY.cur,a=v*(MONEY.rates[c]||1);var loc=(c==='IDR'?'id-ID':'en-US');var s=dec==null?a.toLocaleString(loc):a.toLocaleString(loc,{minimumFractionDigits:dec,maximumFractionDigits:dec});return (MONEY.symbols[c]||'Rp ')+s}

/* 跨端数据桥：商户端为准 → 用户端实时同步。字段名为两端统一契约（命名对齐）。
   契约字段：orderCount/vehicleCount/batteryCount/walletBalance/lastOrderId/updatedAt */
var MERGED=Vue.reactive({orderCount:0,vehicleCount:0,batteryCount:0,walletBalance:0,lastOrderId:'—',updatedAt:0});
`;

// ── 8. 组装 JS 块 ──
const jsBlock = `${SHARED_CORE}
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

/* ---------- 宿主：模式切换 + 货币切换 ---------- */
function hostSetMode(mode) {
  var body = document.body;
  body.className = 'host-' + mode;
  document.querySelectorAll('#host-bar .modes button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-mode') === mode);
  });
}
function hostSetCurrency(c) {
  MONEY.cur = c;
  document.querySelectorAll('#host-bar .cur button').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-currency') === c);
  });
}
document.getElementById('host-bar').addEventListener('click', function (e) {
  var bm = e.target.closest && e.target.closest('button[data-mode]');
  if (bm) { hostSetMode(bm.getAttribute('data-mode')); return; }
  var bc = e.target.closest && e.target.closest('button[data-currency]');
  if (bc) hostSetCurrency(bc.getAttribute('data-currency'));
});

/* ---------- 双实例常驻挂载 ---------- */
mountUser(document.getElementById('mount-user'));
mountMerchant(document.getElementById('mount-merchant'));
hostSetMode('split');
hostSetCurrency(MONEY.cur);
`;

// ── 宿主 CSS ──
const hostCss = `/* ===== HOST: 宿主外壳 ===== */
body{margin:0;background:#E8EAED;color:#111;-webkit-font-smoothing:antialiased}
#host-bar{position:sticky;top:0;z-index:9000;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px 18px;padding:10px 16px;background:rgba(255,255,255,.9);backdrop-filter:blur(6px);box-sizing:border-box;border-bottom:1px solid #E2E4E8}
#host-bar .modes{display:flex;gap:6px}
#host-bar .modes button,#host-bar .cur button{border:1px solid #D3D6DB;background:#fff;color:#555;padding:5px 14px;border-radius:8px;font-size:12px;cursor:pointer;transition:all .15s}
#host-bar .modes button.active,#host-bar .cur button.active{background:#2B3F5F;border-color:#2B3F5F;color:#fff;font-weight:600}
#host-bar .cur{display:flex;align-items:center;gap:6px}
#host-bar .cur .cur-lbl{font-size:12px;color:#8B8B95;margin-right:2px}
#host-bar .cur button{padding:3px 12px}
#host-main{display:flex;align-items:stretch;overflow-x:auto;padding:24px;box-sizing:border-box;min-height:calc(100vh - 60px)}
.host-stage{display:flex;align-items:stretch;gap:16px;margin-inline:auto;max-width:100%}
#root-user,#root-merchant{flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box}
body.host-single-u #root-merchant{display:none}
body.host-single-m #root-user{display:none}
`;

// ── 组装完整 HTML ──
const html = `<!DOCTYPE html>
<!--
═══════════════════════════════════════════════════════════════════
  雅迪租车 · 用户端 + 商户端 单文件双 App（合并产物）
═══════════════════════════════════════════════════════════════════
  产物由 scripts/build-merge.mjs 从 user.html + merchant.html 组装。
  JS 公共内核（SHARED CORE）已抽取共享：luci / toastPush / ptrBind / createNav，
  双端 mountUser/mountMerchant 复用同一份实现；下拉刷新走 root 作用域。

  区块与同步开发约定（新增功能按区修改）：
  · 通用样式   → <style id="layer-base">
  · 公共 JS    → <script> 内 /* SHARED CORE */
  · 用户端专属 → <style id="layer-user"> + function mountUser(root){...}
  · 商户端专属 → <style id="layer-merchant"> + function mountMerchant(root){...}
  · 宿主外壳   → <style id="layer-host">
  源快照：user.html（用户端）/ merchant.html（商户端），只读参照。
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
    <button data-mode="single-u">用户端</button>
    <button data-mode="single-m">商户端</button>
  </div>
  <div class="cur">
    <span class="cur-lbl">货币</span>
    <button data-currency="CNY">人民币</button>
    <button data-currency="IDR" class="active">印尼盾</button>
    <button data-currency="HKD">港币</button>
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

// ── 自检 ──
const checks = [];
checks.push(`index.html 大小: ${(out.length / 1024).toFixed(1)} KB`);
checks.push(`function luci( 出现: ${(out.match(/function luci\(/g) || []).length} (预期 1)`);
checks.push(`function toast( 出现: ${(out.match(/function toast\(/g) || []).length} (预期 0，均改 wrapper)`);
checks.push(`toastPush 出现: ${(out.match(/toastPush\(/g) || []).length} (含定义+两端调用)`);
checks.push(`ptrBind 定义: ${(out.match(/function ptrBind\(/g) || []).length} (预期 1)`);
checks.push(`createNav 定义: ${(out.match(/function createNav\(/g) || []).length} (预期 1)`);
checks.push(`createNav 调用: ${(out.match(/createNav\(\{/g) || []).length} (预期 2)`);
checks.push(`app.mount(root): ${(out.match(/app\.mount\(root\);/g) || []).length} (预期 2)`);
checks.push(`剩余 let tid=0;: ${(out.match(/let tid=0;/g) || []).length} (预期 0)`);
checks.push(`function fmtRp( 定义: ${(out.match(/function fmtRp\(/g) || []).length} (预期 1)`);
checks.push(`registerSharedComponents 出现: ${(out.match(/registerSharedComponents/g) || []).length} (预期 0，已回退)`);
checks.push(`残留 <yd-switch>/<yd-stepper>: ${(out.match(/yd-switch|yd-stepper/g) || []).length} (预期 0，已回退)`);
checks.push(`layer 块: ${(out.match(/<style id="layer-/g) || []).length} (预期 4)`);
console.log('构建完成 → ' + join(ROOT, 'index.html'));
console.log(checks.join('\n'));