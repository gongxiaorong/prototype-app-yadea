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
/** 从 openIdx(openCh 起)配平到 closeCh 深度 0，返回其后的索引；字符串/引号感知。 */
function balancedEnd(src, openIdx, openCh, closeCh) {
  let depth = 0, quote = null;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) { depth--; if (depth === 0) return i + 1; }
  }
  throw new Error('[share-core] 未配平 ' + openCh + '/' + closeCh + ' @ ' + openIdx);
}
/** 切出声明范式 "const NAME=ref(<literal>);"，不限单行/多行（literal 为数组/对象）。返回 {decl,rest}。 */
function cutRefVar(src, marker) {
  const s = src.indexOf(marker);
  assert(s >= 0, '缺失声明: ' + marker.slice(0, 24));
  let off = marker.length;
  while (off < src.length && /\s/.test(src[s + off])) off++;
  const openCh = src[s + off], closeCh = (openCh === '[' ? ']' : '}');
  if (openCh !== '[' && openCh !== '{') throw new Error('[share-core] 非 ref 字面量: ' + openCh);
  const end = balancedEnd(src, s + off, openCh, closeCh);
  let e = end;
  while (e < src.length && /\s/.test(src[e])) e++;
  if (src.slice(e, e + 2) === ');') e += 2;
  return { decl: src.slice(s, e), rest: src.slice(0, s) + src.slice(e) };
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
// 注：跨端用户端不再注入 mergedStats / 状态条，避免在原型上暴露演示调试信息。
const B_MOUNT = 'onMounted(()=>{brandLoading.value=true;';
assert(Bjs.includes(B_MOUNT), 'B 缺 onMounted 锚点');
const B_pub = 'function publishMerged(){try{MERGED.orderCount=(( (orders.value||orders)||[]).length)||0;MERGED.vehicleCount=(vehicles?(((vehicles.value||vehicles)||[]).length)||0:0);MERGED.batteryCount=(batteries?(((batteries.value||batteries)||[]).length)||0:0);MERGED.walletBalance=(uWallet&&uWallet.total)?uWallet.total:0;var _o=(((orders.value||orders)||[])[0])||null;MERGED.lastOrderId=_o?(_o.orderId||_o.id||"—"):"—";MERGED.updatedAt=Date.now();MERGED.myVehicles=(uVehicles&&uVehicles.value)||[];MERGED.myBatteries=(uBatteries&&uBatteries.value)||[];}catch(e){}}\n(function(){if(!(uVehicles&&uVehicles.value&&uVehicles.value.length)){uVehicles.value=vehicles.value.filter(function(v){return v.account==="user001"&&v.vin}).map(function(v){return{vin:v.vin,model:v.model,status:v.online?"在线":"离线",batteryMain:v.batteryMain,batterySub:v.batterySub}})}if(!(uBatteries&&uBatteries.value&&uBatteries.value.length)){uBatteries.value=batteries.value.filter(function(b){return b.account==="user001"&&b.battNo}).map(function(b){return{code:b.battNo,model:b.model,soc:b.level}})}})();\nwatch(function(){return[(((orders.value||orders)||[]).length)||0,(vehicles?(((vehicles.value||vehicles)||[]).length)||0:0),(batteries?(((batteries.value||batteries)||[]).length)||0:0),(uWallet&&uWallet.total)||0]},publishMerged,{immediate:true});\n';
Bjs = Bjs.replace(B_MOUNT, B_pub + B_MOUNT);
// user001 钱包种子：publishMerged 定义前插入独立 IIFE，单语句自配平（无括号风险）；交由后续 watch{immediate} 发布
const B_WALLETSEED = '(function(){if(!uWallet.value||(!uWallet.value.total&&!uWallet.value.rechargeBalance&&!uWallet.value.bonusBalance))uWallet.value=(typeof walletFor==="function")?walletFor("user001"):uWallet.value})();\n';
assert(Bjs.split('function publishMerged(){try{MERGED.orderCount=').length - 1 === 1, 'B 缺 publishMerged 起始锚点');
Bjs = Bjs.split('function publishMerged(){try{MERGED.orderCount=').join(B_WALLETSEED + 'function publishMerged(){try{MERGED.orderCount=');

// ── 6.3b 钱包/订单/门店 → 商户端权威发布（复用 walletFor / orders.account / stores） ──
// 契约：myWallet(当前用户钱包)、myOrders(归属 user001 的订单)、stores(门店名，仅发布不切主源)
const B_EXT = 'MERGED.myBatteries=(uBatteries&&uBatteries.value)||[];}catch(e){}}';
assert(Bjs.split(B_EXT).length - 1 === 1, 'B 缺 myBatteries 发布锚点');
const B_EXT_ADD = 'MERGED.myWallet=(function(){var _w=(uWallet&&uWallet.value)?uWallet.value:null;return (_w)?{totalBalance:_w.total,rechargeBalance:_w.rechargeBalance,bonusBalance:_w.bonusBalance,rechargeFrozen:_w.rechargeFrozen,bonusFrozen:_w.bonusFrozen,totalFrozen:(_w.rechargeFrozen||0)+(_w.bonusFrozen||0)}:null})();'
+ 'MERGED.myOrders=(function(){var _cols={created:"#2B3F5F",pickup:"#FF8C1B",progress:"#22D098","return":"#FF6A00",overdue:"#DC2626",breach:"#FF4343",complete:"#333333",cancelled:"#666666"};var _txt={created:"已创建",pickup:"待取用",progress:"进行中","return":"待归还",overdue:"已超期",breach:"已违约",complete:"已完成",cancelled:"已取消"};var _shop=(stores&&stores.value&&stores.value[0])?(stores.value[0].name||"测试门店"):"测试门店";return (((orders.value||orders)||[]).filter(function(o){return o.account==="user001"})||[]).map(function(o){return {id:o.id||o.orderId||"",status:o.status,statusText:_txt[o.status]||"已创建",statusColor:_cols[o.status]||"#2B3F5F",model:o.item||o.type||"",img:"#FF6A00",desc:"",store:_shop,plan:o.plan||"",created:o.created||"",payTime:o.payTime||"",pickupTime:o.rentStart||o.created||"",returnTime:"",amount:o.amount||0,frame:o.vin||"",vModel:o.item||o.type||""}})})();'
+ 'MERGED.stores=(stores&&stores.value)?stores.value.map(function(s){return s.name}):[];';
// B_pub 常量中 try 块在注入时已是 Bjs 一部分；在 myBatteries 发布后插入钱包/订单/门店发布
Bjs = Bjs.split(B_EXT).join('MERGED.myBatteries=(uBatteries&&uBatteries.value)||[];' + B_EXT_ADD + '}catch(e){}}');
// 我的车辆/电池：每次发布现算 user001（解绑后立即消失），保留手动绑定项（须在 §6.3b 之后执行）
const B_MINE='MERGED.myVehicles=(uVehicles&&uVehicles.value)||[];MERGED.myBatteries=(uBatteries&&uBatteries.value)||[];';
assert(Bjs.split(B_MINE).length-1===1,'B 缺 myVehicles/myBatteries 发布锚点');
const B_MINE_NEW='MERGED.myVehicles=(function(){var _fr=(((vehicles&&vehicles.value)||[]).filter(function(v){return v.account==="user001"&&v.vin}).map(function(v){return {vin:v.vin,model:v.model,status:v.status||(v.online?"在线":"离线"),online:v.online,batteryMain:v.batteryMain,batterySub:v.batterySub}}));if(uVehicles&&uVehicles.value)uVehicles.value.forEach(function(x){if(x&&x._manual&&_fr.findIndex(function(f){return f.vin===x.vin})<0)_fr.push(x)});return _fr})();MERGED.myBatteries=(function(){var _fb=(((batteries&&batteries.value)||[]).filter(function(b){return b.account==="user001"&&b.battNo}).map(function(b){return {code:b.battNo,model:b.model,soc:b.level,status:b.status||(b.online?"在线":"离线")}}));if(uBatteries&&uBatteries.value)uBatteries.value.forEach(function(x){if(x&&x._manual&&_fb.findIndex(function(f){return f.code===x.code})<0)_fb.push(x)});return _fb})();';
Bjs = Bjs.split(B_MINE).join(B_MINE_NEW);
// watch 增补车辆/电池 status 快照：解绑/绑定是改元素属性（长度不变），需状态变化也触发重发布
const B_WATCH_TAIL='(uWallet&&uWallet.total)||0]},publishMerged,{immediate:true});';
assert(Bjs.split(B_WATCH_TAIL).length-1===1,'B 缺 publishMerged watch 锚点');
Bjs = Bjs.split(B_WATCH_TAIL).join("(uWallet&&uWallet.total)||0,(vehicles?JSON.stringify((vehicles.value||[]).map(function(v){return v.status})):''),(batteries?JSON.stringify((batteries.value||[]).map(function(b){return b.status})):'')]},publishMerged,{immediate:true});");

// openUserDetail 末尾发布"我的车辆/电池"到 MERGED，供用户端消费（复用商户端过滤映射，丢弃 plate）
const B_UDETAIL_TAIL = "profileSub.value='userDetail';";
assert(Bjs.includes(B_UDETAIL_TAIL), 'B 缺 openUserDetail 尾部锚点');
Bjs = Bjs.split(B_UDETAIL_TAIL).join("profileSub.value='userDetail'; if(typeof publishMerged==='function')publishMerged();");

// ── 6.4 用户端车辆/电池数据源 → 商户端权威源（MERGED.myVehicles/myBatteries） ──
// 用户端不再持有自己的硬编码演示数据，改为直接消费商户端按账号过滤映射后的"我的车辆/电池"，
// 统一标识用 vin（车辆）/code(原battNo)（电池），彻底移除 MV+id+0086 兜底编号。
// 1) allVehicles 硬编码 → 空数组（数据从 MERGED 来）
Ajs = cutRange(Ajs, 'const allVehicles=[', 'const vehicleCount=ref(2);', '\nconst allVehicles=[];\nconst vehicleCount=ref(2);\nconst batteryCount=ref(2);');
// 2) vehicles computed → 读取商户端权威源（末尾仍保留 scanBoundVehicles 补充绑定的语义，合并去重）
const A_VEHCMP = "const vehicles=computed(()=>{\n  if(!loggedIn.value)return[];\n  if(vehicleCount.value===0)return[];\n  let res;\n  if(vehicleCount.value===1)res=[allVehicles[0]];\n  else res=[...allVehicles];\n  scanBoundVehicles.value.forEach(v=>{if(res.findIndex(x=>x.id===v.id)<0)res.push(v)});\n  return res;\n});";
assert(Ajs.includes(A_VEHCMP), 'A 缺 vehicles computed 锚点');
const A_VEHCMP_NEW = "const vehicles=computed(()=>{\n  if(!loggedIn.value)return[];\n  let res=(MERGED.myVehicles||[]).map(function(v){return Object.assign({},v,{name:vehicleNames[v.vin]||v.model||v.name||'未命名车辆'})});\n  scanBoundVehicles.value.forEach(v=>{if(res.findIndex(x=>(x.vin||'')===(v.vin||v.id))<0)res.push(Object.assign({},v,{name:v.name||v.model||'未命名车辆'}))});\n  if(vehicleCount.value===0)res=[];\n  else if(vehicleCount.value===1)res=res.slice(0,1);\n  return res;\n});";
Ajs = Ajs.split(A_VEHCMP).join(A_VEHCMP_NEW);
// 3) homeBatteries 硬编码 → 读取商户端权威源（按 batteryCount 原型控制 0/截断）
Ajs = cutRange(Ajs, 'const homeBatteries=ref([', 'function bSocColor(', '\nconst homeBatteries=computed(()=>{var b=(MERGED.myBatteries)||[];if(batteryCount.value===0)return[];if(batteryCount.value===1)return b.slice(0,1);return b});\nfunction bSocColor(');

// ── 6.5 用户端车辆/电池标识与字段 → 对齐商户端契约（vin / code，去 id 去 MV 兜底） ──
// Ahtml 模板
assert(/v\.vin \|\| \('MV'\+v\.id\+'0086'\)/.test(Ahtml), 'A 缺 MV 兜底锚点');
Ahtml = Ahtml.split("{{ v.vin || ('MV'+v.id+'0086') }}").join('{{ v.vin }}');
// 车辆详情/绑定页 vdDevice 同样去 MV 兜底
Ahtml = Ahtml.split("{{ vdDevice?(vdDevice.vin||('MV'+vdDevice.id+'0086')):'-' }}").join("{{ vdDevice?vdDevice.vin:'-' }}");
// 车辆列表 key/od-id：id → vin
Ahtml = Ahtml.split('v-for="v in vehicles" :key="v.id"').join('v-for="v in vehicles" :key="v.vin"');
Ahtml = Ahtml.split("'vehicle-item-'+v.id").join("'vehicle-item-'+v.vin");
Ahtml = Ahtml.split('v-for="v in vehicles" :key="v.id" @click="selectMyVehicle(v)"').join('v-for="v in vehicles" :key="v.vin" @click="selectMyVehicle(v)"');
Ahtml = Ahtml.split('currentVehicle.id===v.id').join('currentVehicle.vin===v.vin');
// 电池列表 key/od-id：id → code
Ahtml = Ahtml.split('v-for="b in homeBatteries" :key="b.id"').join('v-for="b in homeBatteries" :key="b.code"');
Ahtml = Ahtml.split("'home-battery-item-'+b.id").join("'home-battery-item-'+b.code");
// Ajs 逻辑
Ajs = Ajs.split('vehicleNames[v.id]').join('vehicleNames[v.vin]');
Ajs = Ajs.split('vehicleNames[currentVehicle.value.id]').join('vehicleNames[currentVehicle.value.vin]');
// 查找按 vin 匹配；source 对商户端数据无此字段，回退用 status 兜底
Ajs = Ajs.split("vehicles.value.findIndex(x=>x.id===v.id)").join("vehicles.value.findIndex(x=>(x.vin||'')===(v.vin||v.id))");
Ajs = Ajs.split("#0;const i=vehicles.value.findIndex(x=>x.id===v.id);").join("#0;const i=vehicles.value.findIndex(x=>(x.vin||'')===(v.vin||v.id));");
Ajs = Ajs.split('const v=vs[i];return Object.assign({},v,{displayName:vehicleNames[v.vin]||v.name})').join('const v=vs[i];return Object.assign({},v,{displayName:vehicleNames[v.vin]||v.model||v.name})');
// 电池逻辑：openBatteryDetail 查找 id→code
Ajs = Ajs.split('homeBatteries.value.findIndex(x=>x.id===b.id)').join('homeBatteries.value.findIndex(x=>x.code===b.code)');
// locSeed：currentVehicle/currentBattery 的 id 标识 → vin/code（对齐商户端契约）
Ajs = Ajs.split('(currentBattery.value?currentBattery.value.id:\'\')').join('(currentBattery.value?currentBattery.value.code:\'\')');
Ajs = Ajs.split('(currentVehicle.value?currentVehicle.value.id:\'\')').join('(currentVehicle.value?currentVehicle.value.vin:\'\')');

// 用户端解绑入口：source==='order' → status==='租用中'（订单绑定车不显示解绑）
const A_UNB = `<div v-if="!scanBindMode&&vdDevice&&vdDevice.source!=='order'" class="py-4 flex items-center justify-center" data-page-node-id="iRSwRf53A4wksMLIFGYDGu">`;
assert(Ahtml.includes(A_UNB), 'A 缺车辆解绑入口锚点');
Ahtml = Ahtml.split(A_UNB).join(A_UNB.replace("vdDevice.source!=='order'", "vdDevice.status!=='租用中'"));
const A_UNBB = `<div v-if="!scanBindMode&&bdDevice&&bdDevice.source!=='order'" class="py-4 flex items-center justify-center" data-page-node-id="BXGy2Jp3OWtQ9X3iBtSNT2">`;
assert(Ahtml.includes(A_UNBB), 'A 缺电池解绑入口锚点');
Ahtml = Ahtml.split(A_UNBB).join(A_UNBB.replace("bdDevice.source!=='order'", "bdDevice.status!=='租用中'"));

// 用户端 source(order/manual) 概念移除 → 全部改用运营状态 status 判断
// 映射：source==='order'(订单绑定) ⇔ status==='租用中'；source==='manual'(手动绑定) ⇔ status==='占用中'；source!=='order' ⇔ status!=='租用中'
// Ahtml 模板（currentVehicle 布局/卡片判断）
Ahtml = Ahtml.split("(currentVehicle && currentVehicle.source === 'order')").join("(currentVehicle && currentVehicle.status === '租用中')");
Ahtml = Ahtml.split("currentVehicle && currentVehicle.source !== 'order'").join("currentVehicle && currentVehicle.status !== '租用中'");
Ahtml = Ahtml.split("currentVehicle&& currentVehicle.source==='order'").join("currentVehicle&& currentVehicle.status==='租用中'");
Ahtml = Ahtml.split("currentVehicle&& currentVehicle.source!=='order'").join("currentVehicle&& currentVehicle.status!=='租用中'");
Ahtml = Ahtml.split("currentVehicle&& currentVehicle.source==='manual'").join("currentVehicle&& currentVehicle.status==='占用中'");
Ahtml = Ahtml.split("bdDevice&&bdDevice.source==='order'").join("bdDevice&&bdDevice.status==='租用中'");
Ahtml = Ahtml.split("vdDevice&& vdDevice.source!=='order'").join("vdDevice&& vdDevice.status!=='租用中'");
Ahtml = Ahtml.split('vdDevice&&vdDevice.source!==\'order\'').join('vdDevice&&vdDevice.status!==\'租用中\'');
// Ajs：selectMyVehicle / openMyVehicleFromHome 用 status 填充 vehicleSource（订单=租用中→order 布局，占用中→manual 布局）
Ajs = Ajs.split("vehicleSource.value=vehicles.value[i].source||'order'").join("vehicleSource.value=vehicles.value[i].status==='租用中'?'order':'manual'");

// ── 6.6 商户端绑定/解绑 → 运营状态 status 联动（订单绑定=租用中，非订单=占用中，解绑=空闲） ──
// 车辆/电池 status 统一判断：租用中(订单绑定)不可解绑，占用中/空闲可解绑。
// 1) 订单详情绑定 confirmOrderPick → 车辆/电池 status=租用中
const F_OFPICK = "if(o.type==='battery'&&sel.title)o.item=sel.title}ordersMod.value=null;orderPickSel.value=null;var t={assignVehicle:'车辆已绑定'";
assert(Bjs.includes(F_OFPICK), 'B 缺 confirmOrderPick 锚点');
Bjs = Bjs.split(F_OFPICK).join("if(o.type==='battery'&&sel.title)o.item=sel.title}if(o.vin){var _bv=vehicles.value.find(function(v){return v.vin===o.vin});if(_bv)_bv.status='租用中'}if(o.battNo){var _bb=batteries.value.find(function(b){return b.battNo===o.battNo});if(_bb)_bb.status='租用中'}ordersMod.value=null;orderPickSel.value=null;var t={assignVehicle:'车辆已绑定'");
// 2) 设备详情绑定 confirmUserPick 车辆分支 → status=占用中
const F_UPICKV = "if(dv.value){dv.value.account=u.account;dv.value.phone=u.phone;dv.value.email=u.email}var mv=vehicles.value.find(function(x){return x.vin===dv.value.vin});if(mv){mv.account=u.account;mv.phone=u.phone;mv.email=u.email}}else if(userPickActive.value==='battery')";
assert(Bjs.includes(F_UPICKV), 'B 缺 confirmUserPick 车辆锚点');
Bjs = Bjs.split(F_UPICKV).join(F_UPICKV
  .replace("dv.value.email=u.email}", "dv.value.email=u.email;dv.value.status='占用中'}")
  .replace("mv.email=u.email}}", "mv.email=u.email;mv.status='占用中'}}"));
// 3) 设备详情绑定 confirmUserPick 电池分支 → status=占用中
const F_UPICKB = "else if(userPickActive.value==='battery'){if(curBatt.value){curBatt.value.account=u.account;curBatt.value.phone=u.phone;curBatt.value.email=u.email}}";
assert(Bjs.includes(F_UPICKB), 'B 缺 confirmUserPick 电池锚点');
Bjs = Bjs.split(F_UPICKB).join("else if(userPickActive.value==='battery'){if(curBatt.value){curBatt.value.account=u.account;curBatt.value.phone=u.phone;curBatt.value.email=u.email;curBatt.value.status='占用中';var mb=batteries.value.find(function(b){return b.battNo===curBatt.value.battNo});if(mb){mb.account=u.account;mb.phone=u.phone;mb.email=u.email;mb.status='占用中'}}}");
// 4) 用户详情绑定 confirmUBind 电池 → status=占用中
const F_UBINDB = "uBatteries.value=[...uBatteries.value,{code:sel.no,model:sel.title,soc:parseFloat(sel.meta)||0,_manual:true}];";
assert(Bjs.includes(F_UBINDB), 'B 缺 confirmUBind 电池锚点');
Bjs = Bjs.split(F_UBINDB).join("uBatteries.value=[...uBatteries.value,{code:sel.no,model:sel.title,soc:parseFloat(sel.meta)||0,status:'占用中',_manual:true}];var _mb2=batteries.value.find(function(b){return b.battNo===sel.no});if(_mb2){_mb2.status='占用中'}");
// 5) 用户详情绑定 confirmUBind 车辆 → status=占用中
const F_UBINDV = "uVehicles.value=[...uVehicles.value,{vin:sel.no,model:sel.title,status:sel.online?'在线':'离线',batteryMain:parseFloat(pct[0])||0,batterySub:pct[1]!=null?(parseFloat(pct[1])||0):0,_manual:true}];";
assert(Bjs.includes(F_UBINDV), 'B 缺 confirmUBind 车辆锚点');
Bjs = Bjs.split(F_UBINDV).join("uVehicles.value=[...uVehicles.value,{vin:sel.no,model:sel.title,status:'占用中',batteryMain:parseFloat(pct[0])||0,batterySub:pct[1]!=null?(parseFloat(pct[1])||0):0,_manual:true}];var _mv2=vehicles.value.find(function(v){return v.vin===sel.no});if(_mv2){_mv2.status='占用中'}");
// 6) 设备详情解绑 vehConfirmMod unbind → dv 与主数组 status=空闲
const F_VEHUNB = "if(vehMod.value==='unbind'){if(dv.value){dv.value.account='';dv.value.phone='';dv.value.email='';var _mv=vehicles.value.find(function(v){return v.vin===dv.value.vin});if(_mv){_mv.account='';_mv.phone='';_mv.email=''}}toast('解绑成功','success')}";
assert(Bjs.includes(F_VEHUNB), 'B 缺 vehConfirmMod unbind 锚点');
Bjs = Bjs.split(F_VEHUNB).join("if(vehMod.value==='unbind'){if(dv.value&&dv.value.vin){var _mv=vehicles.value.find(function(v){return v.vin===dv.value.vin});if(_mv)_mv.status='空闲'}toast('解绑成功','success')}");
// 7) 设备详情解绑 battConfirmMod unbind → curBatt 与主数组 status=占用中
const F_BATTUNB = "if(battMod.value==='unbind'){b.account='';b.phone='';b.email='';toast('解绑成功','success')}else if(battMod.value==='lost')";
assert(Bjs.includes(F_BATTUNB), 'B 缺 battConfirmMod unbind 锚点');
Bjs = Bjs.split(F_BATTUNB).join("if(battMod.value==='unbind'){if(b&&b.battNo){var _mb=batteries.value.find(function(x){return x.battNo===b.battNo});if(_mb)_mb.status='空闲'}toast('解绑成功','success')}else if(battMod.value==='lost')");
// 8) 用户详情解绑 confirmUUnbind → 主数组对应设备 status=空闲
const F_UUNB = "if(t==='vehicle'){uVehicles.value=uVehicles.value.filter(function(v){return v.vin!==x.vin})}else{uBatteries.value=uBatteries.value.filter(function(b){return b.code!==x.code})}";
assert(Bjs.includes(F_UUNB), 'B 缺 confirmUUnbind 锚点');
Bjs = Bjs.split(F_UUNB).join("if(t==='vehicle'){uVehicles.value=uVehicles.value.filter(function(v){return v.vin!==x.vin});if(x&&x.vin){var _mv=vehicles.value.find(function(v){return v.vin===x.vin});if(_mv)_mv.status='空闲'}}else{uBatteries.value=uBatteries.value.filter(function(b){return b.code!==x.code});if(x&&x.code){var _mb=batteries.value.find(function(b){return b.battNo===x.code});if(_mb)_mb.status='空闲'}}");
// 9) openUserDetail uVehicles → 透传运营状态 status + online
const F_UDEVV = "{vin:v.vin,model:v.model,status:v.online?'在线':'离线',batteryMain:v.batteryMain,batterySub:v.batterySub}";
assert(Bjs.includes(F_UDEVV), 'B 缺 openUserDetail uVehicles 锚点');
Bjs = Bjs.split(F_UDEVV).join("{vin:v.vin,model:v.model,status:v.status,online:v.online,batteryMain:v.batteryMain,batterySub:v.batterySub}");
// 10) openUserDetail uBatteries + B_pub 种子 → 补 status（全局 2 处）
const F_UDEVB = "{code:b.battNo,model:b.model,soc:b.level}";
assert(Bjs.split(F_UDEVB).length - 1 === 2, 'B uBatteries 映射应恰好 2 处(openUserDetail+B_pub种子)');
Bjs = Bjs.split(F_UDEVB).join("{code:b.battNo,model:b.model,soc:b.level,status:b.status}");
// 11) B_pub 种子 uVehicles → 透传运营状态 status + online（双引号版）
const F_BSEEDV = 'status:v.online?"在线":"离线",batteryMain:v.batteryMain';
assert(Bjs.split(F_BSEEDV).length - 1 === 1, 'B B_pub 种子车辆双引号版应恰好 1 处');
Bjs = Bjs.split(F_BSEEDV).join('status:v.status,online:v.online,batteryMain:v.batteryMain');
// 12) 商户端车辆解绑入口 → 加 status!=='租用中'
const F_BVEHUNB = `<span v-if="dv.account&&can('vehicle.bind')" @click.stop="vehMod='unbind'" class="text-[14px] font-medium cursor-pointer select-none text-[#DC2626] active:opacity-70 shrink-0">解绑</span>`;
assert(Bhtml.includes(F_BVEHUNB), 'B 缺车辆解绑入口锚点');
Bhtml = Bhtml.split(F_BVEHUNB).join(F_BVEHUNB.replace("dv.account&&can('vehicle.bind')", "dv.account&&dv.status!=='租用中'&&can('vehicle.bind')"));
// 13) 商户端电池解绑入口 → 加 status!=='租用中'
const F_BBATTUNB = `<span v-if="curBatt.account&&can('battery.bind')" @click.stop="battMod='unbind'" class="text-[14px] font-medium cursor-pointer select-none text-[#DC2626] active:opacity-70 shrink-0">解绑</span>`;
assert(Bhtml.includes(F_BBATTUNB), 'B 缺电池解绑入口锚点');
Bhtml = Bhtml.split(F_BBATTUNB).join(F_BBATTUNB.replace("curBatt.account&&can('battery.bind')", "curBatt.account&&curBatt.status!=='租用中'&&can('battery.bind')"));

// ── 6.7 用户端订单/钱包 → 读商户端权威源（MERGED.myOrders / myWallet） ──
// 进行中订单：myCarActiveOrder 硬编码对象 → computed 读 MERGED.myOrders 中 status=progress 项
const A_ACT_START = 'const myCarActiveOrder={';
const A_ACT_END = "amount:'Rp 7,035'};";
assert(Ajs.includes(A_ACT_START), 'A 缺 myCarActiveOrder 起始锚点');
assert(Ajs.includes(A_ACT_END), 'A 缺 myCarActiveOrder 结束锚点');
const A_ACT_NEW = '\nconst myCarActiveOrder=computed(()=>{var a=(MERGED.myOrders||[]).find(function(o){return o.status==="progress"});return a||null});';
Ajs = cutRange(Ajs, A_ACT_START, A_ACT_END, A_ACT_NEW);
// 二级调用点：computed ref 需 .value
const A_CURORD = 'const currentOrder=computed(()=>{return currentVehicle.value?myCarActiveOrder:null});';
assert(Ajs.includes(A_CURORD), 'A 缺 currentOrder 锚点');
Ajs = Ajs.split(A_CURORD).join('const currentOrder=computed(()=>{return currentVehicle.value?myCarActiveOrder.value:null});');
assert(Ajs.includes('function openMyCarOrder(){openOrderDetailCore(myCarActiveOrder);'), 'A 缺 openMyCarOrder 锚点');
Ajs = Ajs.split('function openMyCarOrder(){openOrderDetailCore(myCarActiveOrder);').join('function openMyCarOrder(){openOrderDetailCore(myCarActiveOrder.value);');
// 钱包：walletActive 用 MERGED.myWallet(商户端 user001 钱包)覆盖同名字段
const A_WALLET = 'const walletActive=computed(()=>walletAccount.value.activeStoreId&&walletAccount.value.wallets[walletAccount.value.activeStoreId]||null);';
assert(Ajs.includes(A_WALLET), 'A 缺 walletActive 锚点');
const A_WALLET_NEW = 'const walletActive=computed(()=>{var _w=walletAccount.value.activeStoreId&&walletAccount.value.wallets[walletAccount.value.activeStoreId];if(!_w)return null;var _m=MERGED.myWallet||{};return Object.assign({},_w,{totalBalance:_m.totalBalance!=null?_m.totalBalance:_w.totalBalance,rechargeBalance:_m.rechargeBalance!=null?_m.rechargeBalance:_w.rechargeBalance,bonusBalance:_m.bonusBalance!=null?_m.bonusBalance:_w.bonusBalance,rechargeFrozen:_m.rechargeFrozen!=null?_m.rechargeFrozen:_w.rechargeFrozen,bonusFrozen:_m.bonusFrozen!=null?_m.bonusFrozen:_w.bonusFrozen})});';
Ajs = Ajs.split(A_WALLET).join(A_WALLET_NEW);

// ── 6.8 上提共享权威 ref + 双端操作重定向 + 配置驱动用户端 UI ──
// ① 8 个数组/对象 ref → cutRefVar 全量切出（含多行大字面量）
const REF_CUTS=['const vehicles=ref(','const batteries=ref(','const orders=ref(','const stores=ref(','const uWallet=ref(','const csList=ref(','const cfg=ref(','const rechargeList=ref('];
let sharedRefs='';
// 共享根作用域未解构 ref（只有 Vue 全局），上提的 ref 一律用 Vue.ref
const _uplift=function(decl){return decl.replace('=ref(','=Vue.ref(')};
for (const m of REF_CUTS){ assert(Bjs.split(m).length-1===1, '「'+m.slice(0,20)+'」声明应恰好1处'); const r=cutRefVar(Bjs,m); sharedRefs+='\n'+_uplift(r.decl); Bjs=r.rest; }
// ② 3 个布尔开关 ref → 单行正则切出
const BOOL_CUTS=[['rechargeEnabled','true'],['rechargeCustom','false'],['csReceptionEnabled','true']];
for (let bi=0;bi<BOOL_CUTS.length;bi++){ const name=BOOL_CUTS[bi][0],val=BOOL_CUTS[bi][1]; const re=new RegExp('(const '+name+'=ref\\('+val+'\\);)'); const m0=Bjs.match(re); assert(m0,'B 缺 bool ref '+name); Bjs=Bjs.replace(m0[1],''); sharedRefs+='\n'+_uplift(m0[1]); }
assert(Bjs.indexOf('const vehicles=ref(') < 0, 'B 应已移除 vehicles 声明');
assert(Bjs.indexOf('const orders=ref(') < 0, 'B 应已移除 orders 声明');
const UPLIFT_BLOCK='\n/* ══ 共享权威数据（商户端为准；双端局用同一引用，消费型投影仍在 MERGED） ══ */'+sharedRefs+'\n';

const SYS_HELPERS=`
/* ══ 共享操作助手：双端统一经此写共享 orders/uWallet（金额一律数字） ══ */
function _sysSId(){return 'YZ'+String(Date.now()).slice(-6)+(Math.floor(Math.random()*900)+100)}
function SYS_createOrder(p){
  var amt=(p&&typeof p.amount==='number'&&!isNaN(p.amount))?p.amount:0;
  var id=(p&&p.orderId)||_sysSId();
  if(orders.value.some(function(o){return (o.id||o.orderId)===id}))return;
  var o={id:id,account:'',status:'created',type:(p&&p.category==='电池租赁')?'battery':(p&&p.category==='车电套餐')?'package':'vehicle',item:(p&&p.model)||'',plan:(p&&p.plan)||'',amount:amt,payment:'2C2P',paySt:'pending',vin:(p&&p.frame)||'',created:(p&&p.createTime)||'',deposit:200.45,paymentSplit:null,paySplitAudits:[],email:'',store:(p&&p.store)||''};
  orders.value.push(o); if(typeof publishMerged==='function')publishMerged(); return o;
}
function SYS_cancelOrder(id){var i=(orders.value||[]).findIndex(function(o){return (o.id||o.orderId)===id});if(i<0)return;var o=orders.value[i];o.status='cancelled';if(o.paySt==='pending')o.paySt='fullRefund';if(typeof publishMerged==='function')publishMerged();}
function SYS_payOrder(id){if(!id)return;var o=(orders.value||[]).find(function(x){return (x.id||x.orderId)===id});if(!o)return;o.paySt='paid';if(o.status==='created')o.status='pickup';if(typeof publishMerged==='function')publishMerged();}
function SYS_topup(amount,bonus){var w=uWallet.value;if(!w)return null;w.rechargeBalance=(w.rechargeBalance||0)+((amount)||0);w.bonusBalance=(w.bonusBalance||0)+((bonus)||0);w.total=(w.rechargeBalance||0)+(w.bonusBalance||0);try{var _b=w.total;LEDGER.value.unshift({id:'WL'+String(Date.now()),type:'recharge',amount:Number(amount)||0,balanceAfter:_b,relatedOrder:null,operator:'充值',remark:'充值',storeId:'',createdAt:new Date().toISOString()});if((bonus)||0>0)LEDGER.value.unshift({id:'GN'+String(Date.now()),type:'gift',amount:Number(bonus)||0,balanceAfter:_b,relatedOrder:null,operator:'赠送',remark:'充值赠礼',storeId:'',createdAt:new Date().toISOString()})}catch(e){}if(typeof publishMerged==='function')publishMerged();return w;}
function SYS_deduct(amount){var w=uWallet.value;if(!w)return false;var need=(amount)||0;var useRe=Math.min((w.rechargeBalance||0),need);w.rechargeBalance=(w.rechargeBalance||0)-useRe;need-=useRe;if(need>0.0001){var useBo=Math.min((w.bonusBalance||0),need);w.bonusBalance=(w.bonusBalance||0)-useBo;need-=useBo;}w.total=(w.rechargeBalance||0)+(w.bonusBalance||0);try{LEDGER.value.unshift({id:'LX'+String(Date.now()),type:'orderConsume',amount:-(Number(amount)||0),balanceAfter:w.total,relatedOrder:null,operator:'消费',remark:'订单消费',storeId:'',createdAt:new Date().toISOString()})}catch(e){}if(typeof publishMerged==='function')publishMerged();return need<=0.0001;}
`;

// 用户端只读视图：我的订单 → 共享 orders（商户端取消/退款/改价即时可见）
const A_CUR='const currentOrderList=computed(()=>{if(demoListEmpty.value)return[];const list=orderDataByCategory[orderListCategory.value]||[];const sorted=[...list].sort((a,b)=>(orderStatusOrder[a.status]||99)-(orderStatusOrder[b.status]||99));return orderFilter.value===\'all\'?sorted:sorted.filter(o=>o.status===orderFilter.value)});';
assert(Ajs.split(A_CUR).length-1===1,'A 缺 currentOrderList 锚点');
const A_CUR_NEW="const currentOrderList=computed(()=>{if(demoListEmpty.value)return[];const CAT={vehicle:'车辆租赁',battery:'电池租赁',package:'车电套餐'};const TXT={created:'已创建',pickup:'待取用',progress:'进行中','return':'待归还',overdue:'已超期',breach:'已违约',complete:'已完成',cancelled:'已取消'};const COL={created:'#2B3F5F',pickup:'#FF8C1B',progress:'#22D098','return':'#FF6A00',overdue:'#DC2626',breach:'#FF4343',complete:'#333333',cancelled:'#666666'};const cat=orderListCategory.value||'';const rows=((orders.value||[]).filter(o=>o.account==='user001')).map(o=>{var _t=CAT[o.type]||'车辆租赁';return _t!==cat?null:{id:o.id||o.orderId||'',status:o.status,statusText:TXT[o.status]||'已创建',statusColor:COL[o.status]||'#2B3F5F',model:o.item||o.type||'',vModel:o.item||o.type||'',img:'#FF6A00',desc:'',store:o.store||(stores&&stores.value&&stores.value[0]?(stores.value[0].name):'测试门店'),plan:o.plan||'',created:o.created||'',payTime:o.payTime||'',pickupTime:o.pickupTime||o.rentStart||o.created||'',returnTime:'',amount:fmtRp(o.amount),frame:o.vin||''}}).filter(Boolean);const sorted=[...rows].sort((a,b)=>(orderStatusOrder[a.status]||99)-(orderStatusOrder[b.status]||99));return orderFilter.value==='all'?sorted:sorted.filter(o=>o.status===orderFilter.value)});";
Ajs=Ajs.split(A_CUR).join(A_CUR_NEW);

// 用户端写入口 → 共享助手
const A_CFO='startOrderTimer();showRentLoading.value=false},600)}';
assert(Ajs.split(A_CFO).length-1===1,'A 缺 confirmOrder 尾部锚点');
Ajs=Ajs.split(A_CFO).join("startOrderTimer();showRentLoading.value=false},600);if(!orders.value.some(function(o){return (o.id||o.orderId)===_oi.orderId}))SYS_createOrder({orderId:_oi.orderId,category:_oi.category,model:_oi.model,plan:_oi.plan,amount:Number(confTotal.value)||0,frame:selectedVehicle.value?(selectedVehicle.value.vin||''):'',payee:_oi.payee,createTime:_oi.createTime})}");
const A_CAN=`toast('订单已取消','info');`;
assert(Ajs.split(A_CAN).length-1===1,'A 缺 cancelOrder 锚点');
Ajs=Ajs.split(A_CAN).join(`toast('订单已取消','info');if(orderInfo.value&&orderInfo.value.orderId)SYS_cancelOrder(orderInfo.value.orderId)`);
const A_CTO=`toast('充值成功','success')},800)}`;
assert(Ajs.split(A_CTO).length-1===1,'A 缺 confirmTopup 尾部锚点');
Ajs=Ajs.split(A_CTO).join(`SYS_topup(amt,bonus);toast('充值成功','success')},800)}`);
const A_CTF='function confirmTopup(){';
assert(Ajs.split(A_CTF).length-1===1,'A 缺 confirmTopup 起始锚点');
Ajs=Ajs.split(A_CTF).join(`function confirmTopup(){if(rechargeEnabled.value&&!rechargeEnabled.value){}if(!rechargeEnabled.value){toast('充值功能未开放','warn');return}`);
const A_DED='function deductWallet(amt){const w=walletActive.value;if(!w)return;';
assert(Ajs.split(A_DED).length-1===1,'A 缺 deductWallet 锚点');
Ajs=Ajs.split(A_DED).join(`function deductWallet(amt){try{if(rechargeEnabled&&rechargeEnabled.value!==undefined&&!rechargeEnabled.value){}SYS_deduct(amt)}catch(e){}const w=walletActive.value;if(!w)return;`);
// payOrderDirect / confirmPayment：支付成功 → 共享订单置已付
const A_PD='payTime:formatNow()};toast(\'支付成功\',\'success\')},900)}';
assert(Ajs.split(A_PD).length-1===1,'A 缺 payOrderDirect 尾部锚点');
Ajs=Ajs.split(A_PD).join(`payTime:formatNow()};SYS_payOrder(orderInfo.value?orderInfo.value.orderId:null);toast('支付成功','success')},900)}`);
const A_CP='showPayment.value=false;toast(\'支付成功\',\'success\')},900)}';
assert(Ajs.split(A_CP).length-1===1,'A 缺 confirmPayment 尾部锚点');
Ajs=Ajs.split(A_CP).join(`SYS_payOrder(orderInfo.value?orderInfo.value.orderId:null);showPayment.value=false;toast('支付成功','success')},900)}`);

// 充值挡位硬编码 → 移除（A_CONFIG 里改 computed 读共享 rechargeList）
const A_TIER=',walletTopupAmounts=[50000,100000,200000,500000]';
assert(Ajs.split(A_TIER).length-1===1,'A 缺 walletTopupAmounts 锚点');
Ajs=Ajs.split(A_TIER).join('');
const A_BON='const walletTopupBonus={50000:0,100000:20000,200000:50000,500000:150000};';
assert(Ajs.split(A_BON).length-1===1,'A 缺 walletTopupBonus 锚点');
Ajs=Ajs.split(A_BON).join('');
const A_INC='walletTopupAmounts.includes(v)';
assert(Ajs.split(A_INC).length-1===1,'A 缺 onCustomAmountInput includes 锚点');
Ajs=Ajs.split(A_INC).join('walletTopupAmounts.value.includes(v)');
// walletTopupBonus 已改为 computed(ref)，JS 内必须 .value 取值，否则赠送恒 undefined → 配置不生效
const A_BONUS_JS='(walletTopupBonus[topupAmount.value]||0)';
assert(Ajs.split(A_BONUS_JS).length-1===1,'A 缺 confirmTopup bonus 锚点');
Ajs=Ajs.split(A_BONUS_JS).join('(walletTopupBonus.value[topupAmount.value]||0)');
// 必须上传实名信息：由商户订单配置 cfg.requireRealName 控制，取代原型"功能控制-上传实名信息"
const A_REALNAME='const uploadIdEnabled=ref(true);';
assert(Ajs.split(A_REALNAME).length-1===1,'A 缺 uploadIdEnabled 锚点');
Ajs=Ajs.split(A_REALNAME).join('const uploadIdEnabled=computed(()=>!!((cfg&&cfg.value)?cfg.value.requireRealName:false));');
// 用户端解绑 → 从共享商户库存移除（未过滤账号，须真正删设备才会两端消失）
const A_UNBATT='homeBatteries.value.splice(currentBatteryIdx.value,1);batteryUnbindLoading.value=false;';
assert(Ajs.split(A_UNBATT).length-1===1,'A 缺电池解绑锚点');
Ajs=Ajs.split(A_UNBATT).join('if(SYS_BATTERIES&&SYS_BATTERIES.value&&currentBattery.value&&currentBattery.value.code){var _ub=SYS_BATTERIES.value.find(function(x){return x.battNo===currentBattery.value.code});if(_ub)_ub.status=\'空闲\'}batteryUnbindLoading.value=false;');
const A_UNVEH='unbindLoading.value=false;showUnbindConfirm.value=false;navDrop(\'vehicleDetail\');';
assert(Ajs.split(A_UNVEH).length-1===1,'A 缺车辆解绑锚点');
Ajs=Ajs.split(A_UNVEH).join('if(SYS_VEHICLES&&SYS_VEHICLES.value&&currentVehicle.value&&currentVehicle.value.vin){var _uv=SYS_VEHICLES.value.find(function(x){return x.vin===currentVehicle.value.vin});if(_uv)_uv.status=\'空闲\'}unbindLoading.value=false;showUnbindConfirm.value=false;navDrop(\'vehicleDetail\');');
// #2 续租写共享 orders：用户确认续租 → 续租单入共享 orders，商户侧可见
const A_RENEW_PUSH='orderInfo.value={...orderInfo.value,renewOrders:[...(orderInfo.value.renewOrders||[]),r]};showRenewPlan.value=false;';
assert(Ajs.split(A_RENEW_PUSH).length-1===1,'A 缺 confirmRenew 锚点');
Ajs=Ajs.split(A_RENEW_PUSH).join('orders.value.push({id:r.renewNo,type:\'renew\',item:r.plan||\'\',plan:r.plan||\'\',amount:Number(r.renewRentFee)||0,status:\'pickup\',paySt:(r.payStatus===\'PAID\')?\'paid\':\'pending\',created:(r.createTime)||formatNow(),parent:r.parentOrderNo||\'\'});orderInfo.value={...orderInfo.value,renewOrders:[...(orderInfo.value.renewOrders||[]),r]};showRenewPlan.value=false;');

// 配置驱动用户端投影（A_CONFIG 注入 Ajs，createApp 前）
const A_CONFIG=`\n/*══ 配置驱动的用户端投影（读共享 cfg/rechargeList/rechargeEnabled/rechargeCustom/csReceptionEnabled） ══*/\nconst S2C={progress:'IN_USE',return:'TO_RETURN',overdue:'OVERDUE',breach:'BREACH'};\nconst T2C={'车辆租赁':'VEHICLE','电池租赁':'BATTERY','车电套餐':'PACKAGE'};\nconst _cfgHas=function(arr,val){return (arr==null)?false:(Array.isArray(arr)?arr.indexOf(val)>-1:false)};\nconst _curCat=function(){if(orderInfo.value&&orderInfo.value.category)return orderInfo.value.category;if(selectedVehicle.value)return '车辆租赁';return '车辆租赁'};\nconst _renewOK=function(st){return st==='progress'||st==='return'||st==='overdue'||st==='breach'};\nconst autoRenewEntryVisible=computed(()=>{var c=cfg.value||{};if(!c.renewEnabled||!c.renewAuto)return false;var ty=T2C[_curCat()];if(!ty)return false;return _cfgHas(c.renewTypes,ty)});\nconst renewEntryVisible=computed(()=>{var c=cfg.value||{};if(!c.renewEnabled||!c.renewManual)return false;var o=orderInfo.value;if(!o)return false;if(!_renewOK(o.status))return false;var ty=T2C[o.category];var st=S2C[o.status];if(ty&&!_cfgHas(c.renewTypes,ty))return false;return _cfgHas(c.renewStatuses,st)});\nconst rechargeTiers=computed(()=>{var out=[];((rechargeList.value)||[]).forEach(function(r){if(r&&r.status===1)out.push({amount:Number(r.amount)||0,bonus:Number(r.giftAmount)||0})});return out});\nconst walletTopupAmounts=computed(()=>rechargeTiers.value.map(function(t){return t.amount}));\nconst walletTopupBonus=computed(()=>{var m={};rechargeTiers.value.forEach(function(t){m[t.amount]=t.bonus});return m});\nconst rechargeEnabledFlag=computed(()=>!!(rechargeEnabled.value));\nconst rechargeCustomFlag=computed(()=>!!(rechargeCustom.value));\nconst csReceptionFlag=computed(()=>!!(csReceptionEnabled.value));\nconst csSheet=ref(false);\nconst csPhones=computed(()=>(csList&&csList.value)||[]);\n`;
// A_CONFIG 引用 setup 局部(orderInfo/selectedVehicle)与共享 ref(cfg/rechargeList/...)，必须注入 setup 内部起始处
const A_SETUP='setup(){';
assert(Ajs.split(A_SETUP).length-1===1,'A 缺 setup 锚点');
Ajs=Ajs.split(A_SETUP).join('setup(){'+A_CONFIG+'\n');
// 新增配置 computed 必须在 setup return 里暴露，模板才能访问（否则 v-if 拿 undefined → 恒隐藏）
const A_RET_TAIL='confirmCancelRecharge};';
assert(Ajs.split(A_RET_TAIL).length-1===1,'A 缺 setup return 尾部锚点');
Ajs=Ajs.split(A_RET_TAIL).join('confirmCancelRecharge,rechargeCustomFlag,rechargeEnabledFlag,csReceptionFlag,autoRenewEntryVisible,renewEntryVisible,rechargeTiers,csSheet,csPhones,batteryCount,setBatteryCount};');
// 电池数据原型切换函数（与 setVehicleCount 同构）
Ajs=Ajs.split('function setVehicleCount(n){vehicleCount.value=n}').join('function setVehicleCount(n){vehicleCount.value=n}\nfunction setBatteryCount(n){batteryCount.value=n}');

// ── 6.11 设备远程控制（锁车/鸣笛/启动/断电）+ 电量/定位联动 → 写回共享权威源 ──
// 1) 用户端 locked/engineOn 改为读共享 vehicle 状态；opPower 开关
const A_PWR1="const opLock=ref(true);\nconst opHorn=ref(true);";
assert(Ajs.split(A_PWR1).length-1===1,'A 缺 opLock/opHorn 锚点');
Ajs=Ajs.split(A_PWR1).join(A_PWR1+"\nconst opPower=ref(true);");
const A_LOCK_REF='const locked=ref(false),lockLoading=ref(false);const PRESS_DURATION=1500;';
assert(Ajs.split(A_LOCK_REF).length-1===1,'A 缺 locked ref 锚点');
Ajs=Ajs.split(A_LOCK_REF).join('const lockLoading=ref(false),engineLoading=ref(false);const PRESS_DURATION=1500;const locked=computed(()=>{var v=currentVehicle.value;return !!(v&&v.locked)});const engineOn=computed(()=>{var v=currentVehicle.value;return !!(v&&v.engineOn)});');
// 2) toggleLock 写回共享 SYS_VEHICLES（锁定态 + 电量微变），sendHorn 后追加 togglePower
const A_TOGLK='function toggleLock(){if(!currentVehicle.value)return;if(lockLoading.value)return;lockLoading.value=true;setTimeout(()=>{locked.value=!locked.value;lockLoading.value=false},800)}';
assert(Ajs.split(A_TOGLK).length-1===1,'A 缺 toggleLock 锚点');
Ajs=Ajs.split(A_TOGLK).join('function toggleLock(){var v=currentVehicle.value;if(!v)return;if(lockLoading.value)return;lockLoading.value=true;setTimeout(function(){var idx=SYS_VEHICLES.value.findIndex(function(x){return (x.vin||"")===(v.vin||"")});var t=idx>=0?SYS_VEHICLES.value[idx]:null;if(t){t.locked=!t.locked;t.batteryMain=Math.max(0,Math.min(100,(t.batteryMain||88)+(t.locked?-2:1)));t.online=true;t.time=new Date().toLocaleString("zh-CN",{hour12:false})}lockLoading.value=false;toast(t&&t.locked?"已关锁":"已开锁","success")},800)}');
const A_HORN='function sendHorn(){if(!currentVehicle.value)return;if(hornLoading.value)return;hornLoading.value=true;setTimeout(()=>{hornLoading.value=false},2500)}';
assert(Ajs.split(A_HORN).length-1===1,'A 缺 sendHorn 锚点');
Ajs=Ajs.split(A_HORN).join('function sendHorn(){if(!currentVehicle.value)return;if(hornLoading.value)return;hornLoading.value=true;setTimeout(function(){hornLoading.value=false;toast("鸣笛寻车指令已发送","info")},1200)}\nfunction togglePower(){var v=currentVehicle.value;if(!v||engineLoading.value)return;engineLoading.value=true;setTimeout(function(){var idx=SYS_VEHICLES.value.findIndex(function(x){return (x.vin||"")===(v.vin||"")});var t=idx>=0?SYS_VEHICLES.value[idx]:null;if(t){t.engineOn=!t.engineOn;t.batteryMain=Math.max(0,Math.min(100,(t.batteryMain||88)+(t.engineOn?1:-3)));t.online=t.engineOn?true:(Math.random()>.3);t.time=new Date().toLocaleString("zh-CN",{hour12:false})}engineLoading.value=false;toast(t&&t.engineOn?"已启动":"已断电","success")},900)}');
// 3) setup return 暴露远程控制
Ajs=Ajs.split(A_RET_TAIL).join('engineOn,engineLoading,opPower,togglePower};');
// 4) 用户端快捷功能区新增"启动/断电"按钮（锁车/鸣笛 之后）
const A_POW_CELL='<span class="text-[12px] font-medium text-[#333]" data-page-node-id="LkO8T9utUcCGZgnqLhfE6K">用车人</span>\n    </div>';
assert(Ahtml.split(A_POW_CELL).length-1===1,'A 缺快捷区用车人锚点');
Ahtml=Ahtml.split(A_POW_CELL).join('<span class="text-[12px] font-medium text-[#333]" data-page-node-id="LkO8T9utUcCGZgnqLhfE6K">用车人</span>\n    </div>\n    <div v-show="opPower" class="bg-white rounded-2xl flex flex-col items-center justify-center gap-2 min-h-[90px] cursor-pointer select-none active:bg-[#F6F7F9] transition-all" style="border:1px solid #E5E5E5;box-shadow:0 1px 3px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.06)" :class="engineLoading?\'opacity-70 pointer-events-none\':\'\'" @click="togglePower" data-od-id="mv-quick-power" data-page-node-id="MvPwr00a"><span v-html="luci(engineLoading?\'loader\':(engineOn?\'power\':\'zap\'),\'w-6 h-6 transition-all \'+(engineLoading?\'anim-spin\':\'\'))" :style="engineOn?{color:\'#22D098\'}:{color:\'#FF6A00\'}" data-page-node-id="MvPwr01a"></span><span class="text-[12px] font-medium">{{ engineLoading?\'指令下发中…\':(engineOn?\'断电\':\'启动\') }}</span></div>');
// 5) 共享 publishMerged watch 增加 locked/engineOn 快照 → 远程操作触发重发布
const A_WATCH_J="(vehicles?JSON.stringify((vehicles.value||[]).map(function(v){return v.status})):'')";
assert(Bjs.includes(A_WATCH_J), 'Bjs 缺 watch 状态快照锚点');
Bjs=Bjs.split(A_WATCH_J).join("(vehicles?JSON.stringify((vehicles.value||[]).map(function(v){return v.status+':'+(v.locked?'1':'0')+':'+(v.engineOn?'1':'0')})):'')");
// 6.13 所有订单/充值订单创建时间归一到近15天（在 watch 登记后执行一次）
assert(Bjs.includes('publishMerged,{immediate:true});'),'Bjs 缺 watch 登记收尾锚点');
Bjs=Bjs.split('publishMerged,{immediate:true});').join('publishMerged,{immediate:true});\nSYS_recent(15);publishMerged();');

// 6.14 商户端订单列表默认日期窗口放宽 → 不因时间过滤隐藏较早订单（配合 SYS_recent 保持"近15"）
assert(Bjs.includes('start.setDate(start.getDate()-29);'),'Bjs 缺订单默认日期窗口锚点');
Bjs=Bjs.split('start.setDate(start.getDate()-29);').join('start.setDate(start.getDate()-3650);');

// ── 6.12 充值订单历史统一 → 商户端权威源 CZ_ORDERS（双端列表同源，写回共享） ──
// 商户端 rechargeOrders → CZ_ORDERS
const B_CZ_END='refundGiftAmount:null}\n]);';
assert(Bjs.split(B_CZ_END).length-1===1,'Bjs 缺 rechargeOrders 末行锚点');
Bjs=cutRange(Bjs,'const rechargeOrders=ref([',B_CZ_END,'const rechargeOrders=CZ_ORDERS;');
// C端充值订单列表 → CZ_ORDERS
const A_CZ_END='refundAmount:0,refundGiftAmount:0}\n]);';
assert(Ajs.split(A_CZ_END).length-1===1,'Ajs 缺 rechargeOrderList 末行锚点');
Ajs=cutRange(Ajs,'const rechargeOrderList=ref([',A_CZ_END,'const rechargeOrderList=CZ_ORDERS;');
// C端充值成功 → CZ_ORDERS 新增已支付单
const A_TOPUP="SYS_topup(amt,bonus);toast('充值成功','success')";
assert(Ajs.split(A_TOPUP).length-1===1,'Ajs 缺 confirmTopup 收尾锚点');
Ajs=Ajs.split(A_TOPUP).join("CZ_ORDERS.value.unshift({orderNo:'CZ'+Date.now(),storeName:walletAccount.value.activeStoreId||'测试门店',createTime:new Date().toISOString(),payChannel:'2C2P',payStatus:'PAID',payTime:new Date().toISOString(),account:'user001',phone:'',email:'',amount:amt,giftAmount:bonus,refundAmount:0,refundGiftAmount:0});"+A_TOPUP);
// C端取消充值单 → 同步写回 CZ_ORDERS
const A_CZCANL="rechargeOrder.payStatus='CANCELLED';rechargeOrder.cancelTime=fmtDateTime(new Date());";
assert(Ajs.split(A_CZCANL).length-1===1,'Ajs 缺 confirmCancelRecharge 锚点');
Ajs=Ajs.split(A_CZCANL).join("rechargeOrder.payStatus='CANCELLED';rechargeOrder.cancelTime=fmtDateTime(new Date());CZ_ORDERS.value.forEach(function(c){if(c.orderNo===(rechargeOrder.orderNo||'')){c.payStatus='CANCELLED';c.cancelTime=rechargeOrder.cancelTime}});");

// 充值/客服/续租 模板显隐
const A_CUST='class="mt-3" data-page-node-id="ehSGm00RqEgnlH4G2aCL3K"';
assert(Ahtml.split(A_CUST).length-1===1,'A 缺自定义金额块锚点');
Ahtml=Ahtml.split(A_CUST).join(A_CUST+' v-if="rechargeCustomFlag"');
const A_RBTN='style="background:var(--accent)" data-page-node-id="HF6cAjqyz7nJppLVlJalwk"';
assert(Ahtml.split(A_RBTN).length-1===1,'A 缺充值页确认按钮锚点');
Ahtml=Ahtml.split(A_RBTN).join(A_RBTN+' v-if="rechargeEnabledFlag"');
// 钱包页"充值"入口按钮(openTopup)同样由充值功能开关控制显隐
const A_WALLET_RBTN='style="background:var(--accent)" data-page-node-id="UkXKPTACK6a6uyxZmhYXce"';
assert(Ahtml.split(A_WALLET_RBTN).length-1===1,'A 缺钱包页充值按钮锚点');
Ahtml=Ahtml.split(A_WALLET_RBTN).join(A_WALLET_RBTN+' v-if="rechargeEnabledFlag"');
const A_AUTORENEW='data-od-id="confirm-autorenew" data-page-node-id="l9Uxxwiq9etLGrpI2kB57R"';
assert(Ahtml.split(A_AUTORENEW).length-1===1,'A 缺自动续租区块锚点');
Ahtml=Ahtml.split(A_AUTORENEW).join(A_AUTORENEW+' v-if="autoRenewEntryVisible"');
const A_RENEW_VIF="v-if=\"!autoRenew&&(orderInfo.category==='车辆租赁'||orderInfo.category==='电池租赁'||orderInfo.category==='车电套餐')&&['progress','return','overdue','breach'].includes(orderInfo.status)\"";
assert(Ahtml.split(A_RENEW_VIF).length-1===1,'A 缺订单详情续租入口 v-if');
Ahtml=Ahtml.split(A_RENEW_VIF).join('v-if="!autoRenew&&renewEntryVisible"');
// 设备空状态文案：0辆→暂无车辆；电池空→暂无电池
const A_EMPTY_V='<template v-else-if="vehicles.length===0" data-page-node-id="rTnFKuCqeCnCIo7HoBPUPh"></template>';
assert(Ahtml.split(A_EMPTY_V).length-1===1,'A 缺车辆空状态锚点');
Ahtml=Ahtml.split(A_EMPTY_V).join('<template v-else-if="vehicles.length===0" data-page-node-id="rTnFKuCqeCnCIo7HoBPUPh"><div class="px-4 py-6 text-center text-[13px] text-[#999]">暂无车辆</div></template>');
{ const eb='暂无绑定电池，可单独租赁或随车绑定'; assert(Ahtml.split(eb).length-1===1,'A 缺电池空状态文案'); Ahtml=Ahtml.split(eb).join('暂无电池'); }
// 首页"电池数据"原型切换（与车辆数据同构：2 块/0 块）+ 空状态"暂无电池"
{ const ab='@click="setVehicleCount(0)" data-page-node-id="RjzUP4yYjcSqbDTcVPjDy2">0 辆</div>\n</div>\n</div>'; assert(Ahtml.split(ab).length-1===1,'A 缺首页车辆数据块锚点'); Ahtml=Ahtml.split(ab).join(ab+'\n<div class="demo-ops-section" data-page-node-id="BattDemoA"><div class="demo-ops-label" data-page-node-id="BattDemoB">电池数据</div><div class="demo-ops-chips" data-page-node-id="BattDemoC"><div class="demo-ops-chip" :class="batteryCount===2?\'is-on\':\'\'" @click="setBatteryCount(2)" data-page-node-id="BattDemo1">2 块</div><div class="demo-ops-chip" :class="batteryCount===1?\'is-on\':\'\'" @click="setBatteryCount(1)" data-page-node-id="BattDemo11">1 块</div><div class="demo-ops-chip" :class="batteryCount===0?\'is-on\':\'\'" @click="setBatteryCount(0)" data-page-node-id="BattDemo2">0 块</div>'); }
const A_CS1='style="border-color:var(--link)" data-page-node-id="ZGehNZ0m6HpaefAVMd3Ni7"';
assert(Ahtml.split(A_CS1).length-1===1,'A 缺联系门店1锚点');
Ahtml=Ahtml.split(A_CS1).join(A_CS1+' v-if="csReceptionFlag"');
const A_CS2='border border-[#E5E5E5]" data-page-node-id="AVjKWkmJlP3iJaEgfM0IXu"';
assert(Ahtml.split(A_CS2).length-1===1,'A 缺联系门店2锚点');
Ahtml=Ahtml.split(A_CS2).join(A_CS2+' v-if="csReceptionFlag"');
const A_CS3='style="color:var(--link)" data-page-node-id="TQZ1IPlP7qec5wCyduTVgI"';
assert(Ahtml.split(A_CS3).length-1===1,'A 缺取还电话图标锚点');
Ahtml=Ahtml.split(A_CS3).join(A_CS3+' v-if="csReceptionFlag"');
// #5 客服列表：取还信息电话图标点击弹 csList（共享客服电话）
const A_CSICON='<span class="flex items-center gap-1 text-[13px]" style="color:var(--link)" data-page-node-id="TQZ1IPlP7qec5wCyduTVgI" v-if="csReceptionFlag"><span v-html="luci(\'phone\',\'w-3.5 h-3.5\')" data-page-node-id="4vevjaZirAb7LsWSeTBRvh"></span></span>';
assert(Ahtml.split(A_CSICON).length-1===1,'A 缺电话图标整体锚点');
Ahtml=Ahtml.split(A_CSICON).join('<span class="flex items-center gap-1 text-[13px] cursor-pointer" style="color:var(--link)" data-page-node-id="TQZ1IPlP7qec5wCyduTVgI" v-if="csReceptionFlag" @click="csSheet=true"><span v-html="luci(\'phone\',\'w-3.5 h-3.5\')" data-page-node-id="4vevjaZirAb7LsWSeTBRvh"></span></span><transition name="fd"><div v-if="csSheet" class="fixed inset-0 z-[9999] flex items-center justify-center" style="background:rgba(0,0,0,.45)" @click.self="csSheet=false"><div class="bg-white rounded-2xl w-[82%] max-w-sm p-5" style="box-shadow:0 12px 40px rgba(0,0,0,.18)"><div class="text-[17px] font-bold text-center mb-1">客服电话</div><div class="text-xs text-[#999] text-center mb-3">官方客服与区域热线</div><div v-for="(c,i) in csPhones" :key="i" class="py-2 border-b last:border-0 flex items-center justify-between"><div><div class="text-sm font-medium">{{ c.remark||\'客服热线\' }}</div><div class="text-xs text-[#999]">{{ c.phone }}</div></div><span class="text-xs" style="color:var(--link)">{{ c.code }}</span></div><div class="mt-4"><button class="w-full h-10 rounded-xl text-white text-[14px] font-semibold" style="background:var(--accent)" @click="csSheet=false">关闭</button></div></div></div></transition>');
// 移除原型"功能控制-上传实名信息"演示控件（标签+开启/关闭 chips，已由商户 cfg.requireRealName 取代）
const A_DEMO_REAL='<div class="demo-ops-section" data-page-node-id="PQWwbBPBQi8RuMWlhsuzyh">\n<div class="demo-ops-label" data-page-node-id="uzFk9TbSLYSFqYEJfTCLOg">上传实名信息</div>\n<div class="demo-ops-chips" data-page-node-id="OlaTlxLXENWju2ADWk3Kq0">\n<div class="demo-ops-chip" :class="uploadIdEnabled?\'is-on\':\'\'" @click="uploadIdEnabled=true" data-page-node-id="mmoUHcpKWLEELVaFzY9gDh">开启</div>\n<div class="demo-ops-chip" :class="!uploadIdEnabled?\'is-on\':\'\'" @click="uploadIdEnabled=false" data-page-node-id="BfP4yF7H8Rsye1Hv6TGI55">关闭</div>\n</div>\n</div>';
assert(Ahtml.split(A_DEMO_REAL).length-1===1,'A 缺上传实名演示控件锚点');
Ahtml=Ahtml.split(A_DEMO_REAL).join('');

// ── 6.9 门店/车型/电池数据源以商户端为准 ──
// ① 用户门店列表 → 读共享 stores（商户 stores 已改用用户端成都命名，见如下 B 变换）
const A_STORE_ST='const storeList=[';
const A_STORE_END="天府软件园B区附近'}\n];";
assert(Ajs.split(A_STORE_ST).length-1===1,'A 缺 storeList 起始锚点');
{ const si=Ajs.indexOf(A_STORE_ST); let ei=Ajs.indexOf(A_STORE_END,si); assert(ei>=0,'A 缺 storeList 结束锚点'); ei+=A_STORE_END.length; Ajs=Ajs.slice(0,si)+"const storeList=computed(()=>(stores&&stores.value||[]).map(function(s){return {name:s.name,addr:s.addr||'',dist:''}}));"+Ajs.slice(ei); }
const A_SF='const storeFiltered=computed(()=>{if(demoListEmpty.value)return[];const q=storeQuery.value.trim().toLowerCase();if(!q)return storeList;return storeList.filter(s=>s.name.toLowerCase().includes(q)||s.addr.toLowerCase().includes(q))});';
assert(Ajs.split(A_SF).length-1===1,'A 缺 storeFiltered 锚点');
Ajs=Ajs.split(A_SF).join('const storeFiltered=computed(()=>{if(demoListEmpty.value)return[];const q=storeQuery.value.trim().toLowerCase();if(!q)return storeList.value;return storeList.value.filter(s=>s.name.toLowerCase().includes(q)||s.addr.toLowerCase().includes(q))});');
// confStoreDefault / confStore → stores[0]
const A_CSD="const confStoreDefault={name:'四川成都高新区应龙南一路11号雅迪门店',addr:'四川省成都市双流区应龙南一路11号雅迪都市花园1213号'};";
assert(Ajs.split(A_CSD).length-1===1,'A 缺 confStoreDefault 锚点');
Ajs=Ajs.split(A_CSD).join("const confStoreDefault=computed(()=>{var s=stores&&stores.value&&stores.value[0];return s?{name:s.name,addr:s.addr||''}:{name:'默认门店',addr:''}});");
const A_CS="const confStore=computed(()=>selectedStore.value||confStoreDefault);";
assert(Ajs.split(A_CS).length-1===1,'A 缺 confStore 锚点');
Ajs=Ajs.split(A_CS).join("const confStore=computed(()=>selectedStore.value||confStoreDefault.value);");
// ② 车型/电池目录 → 读商户 vehicles/batteries 的 distinct model + RENT_META 补齐
const A_VD_NEWCODE="const vehicleData=computed(()=>{if(demoListEmpty.value)return {};var R=RENT_META,P=RENT_PERIOD;var vm=[],bm=[],s1={},s2={};(SYS_VEHICLES&&SYS_VEHICLES.value||[]).forEach(function(v){if(v&&v.model&&!s1['v'+v.model]){s1['v'+v.model]=1;vm.push(v.model)}});(SYS_BATTERIES&&SYS_BATTERIES.value||[]).forEach(function(b){if(b&&b.model&&!s2['b'+b.model]){s2['b'+b.model]=1;bm.push(b.model)}});function card(m,pi){var M=R[m];return {name:m,desc:(M&&M.desc)||'',price:fmtRp((M&&M.prices&&M.prices[pi])||0),period:(P[pi]||''),img:(M&&M.img)||'#2B3F5F'}}var out={0:{},1:{},2:{}};[0,1,2,3].forEach(function(pi){out[0][pi]=vm.map(function(m){return card(m,pi)});out[1][pi]=bm.map(function(m){return card(m,pi)});var a=R[vm[0]],bb=R[bm[0]];out[2][pi]=(a&&bb)?[{name:vm[0]+' + '+bm[0],desc:(a.desc||'')+' / '+(bb.desc||''),price:fmtRp(((a.prices&&a.prices[pi])||0)+((bb.prices&&bb.prices[pi])||0)),period:(P[pi]||''),img:'#2B3F5F'}]:[]});return out});";
const A_VD_ST='const vehicleData={';
const A_VD_END="\n};";
assert(Ajs.split(A_VD_ST).length-1===1,'A 缺 vehicleData 起始锚点');
{ const si=Ajs.indexOf(A_VD_ST); let ei=Ajs.indexOf(A_VD_END,si); assert(ei>=0,'A 缺 vehicleData 结束锚点'); ei+=A_VD_END.length; Ajs=Ajs.slice(0,si)+A_VD_NEWCODE+Ajs.slice(ei); }
const A_VL='const t=vehicleData[rentDateIdx.value];';
assert(Ajs.split(A_VL).length-1===1,'A 缺 vehicleList 取数锚点');
Ajs=Ajs.split(A_VL).join('const t=vehicleData.value[rentDateIdx.value];');
// ③ 商户 stores 种子 → 改用用户端成都命名（数据源自商户、命名以用户端为准；与钱包/建单同名即通）
const B_STORES_REN=[
 ["{name:'测试门店',addr:''}","{name:'雅迪电动车(双流区雅和北路店)',addr:'四川省成都市双流区雅和北路博瑞都市花园西侧约90米处'}"],
 ["{name:'望京店',addr:'北京市朝阳区望京SOHO T1'}","{name:'雅迪电动车(锦江区春熙路店)',addr:'四川省成都市锦江区春熙路西段太升南路与北纱帽街交汇处'}"],
 ["{name:'陆家嘴店',addr:'上海市浦东新区陆家嘴环路166号'}","{name:'雅迪电动车(武侯区磨子桥店)',addr:'四川省成都市武侯区磨子桥科华北路与一环路南二段交汇'}"],
 ["{name:'天河店',addr:'广州市天河区天河路385号'}","{name:'雅迪电动车(高新区天府大道店)',addr:'四川省成都市高新区天府大道中段天府软件园B区附近'}"]
];
for (const [from,to] of B_STORES_REN){ assert(Bjs.split(from).length-1===1,'B stores 缺锚点: '+from.slice(0,24)); Bjs=Bjs.split(from).join(to); }
// 用户端登录身份 User71970（商户端无此用户）→ 改显商户权威 user001（Ahtml 用户端 + Bhtml 商户端兜底）
const A_USER_NAME_C='User71970</span>';
assert((Ahtml.split(A_USER_NAME_C).length-1)+(Bhtml.split(A_USER_NAME_C).length-1)>=1,'A/B 缺 User71970 显示锚点');
Ahtml=Ahtml.split(A_USER_NAME_C).join('User001</span>');
Bhtml=Bhtml.split(A_USER_NAME_C).join('User001</span>');

// ── 6.10 演示逻辑：不做 user001 账号过滤，双端同显全量（按用户过滤留给真实开发） ──
{ const p='(orders.value||[]).filter(o=>o.account===\'user001\')'; assert(Ajs.split(p).length-1>=1,'A 缺 currentOrderList 过滤点'); Ajs=Ajs.split(p).join('(orders.value||[])'); }
{ const r1='function(o){return o.account==="user001"}'; assert(Bjs.split(r1).length-1>=1,'B 缺 myOrders 过滤点'); Bjs=Bjs.split(r1).join('function(o){return true}');
  const r2='function(v){return v.account==="user001"&&v.vin}'; assert(Bjs.split(r2).length-1>=1,'B 缺 myVehicles 过滤点'); Bjs=Bjs.split(r2).join('function(v){return v.vin && v.status!==\'空闲\'}');
  const r3='function(b){return b.account==="user001"&&b.battNo}'; assert(Bjs.split(r3).length-1>=1,'B 缺 myBatteries 过滤点'); Bjs=Bjs.split(r3).join('function(b){return b.battNo && b.status!==\'空闲\'}');
}
// 用户端"我的设备·电池"编号显示用 b.id → 电池映射补 id (battNo)
{ const pb='code:b.battNo'; assert(Bjs.split(pb).length-1>=1,'B 缺电池 code 映射'); Bjs=Bjs.split(pb).join('code:b.battNo,id:b.battNo'); }
// #4 打通报失/放电：myBatteries 映射补 lost/discharge，用户端可反映
{ const pl='soc:b.level,status:b.status'; assert(Bjs.split(pl).length-1>=1,'B 缺电池状态映射'); Bjs=Bjs.split(pl).join('soc:b.level,status:b.status,lost:b.lost,discharge:b.discharge'); }
// #1 钱包流水：商户 uFlowList 并入共享 LEDGER（用户充值/扣款的两端可见）
{ const pu='return demoListEmpty.value?[]:uFlowAll.filter('; assert(Bjs.split(pu).length-1===1,'B 缺 uFlowList 锚点'); Bjs=Bjs.split(pu).join("return demoListEmpty.value?[]:uFlowAll.concat((LEDGER&&LEDGER.value||[]).map(function(r){var _t=r.type==='orderConsume'?'订单消费':r.type==='orderRefund'?'订单退款':r.type==='rechargeRefund'?'充值退款':r.type==='gift'?'赠送':r.type==='deduct'?'扣减':'充值';var _no=(r.type==='gift'||r.type==='deduct'?'G':'L')+(r.id||String(Date.now()));return {ledgerNo:_no,txnType:_t,amount:r.amount!=null?String(r.amount):'0',balanceAfter:r.balanceAfter,relatedOrder:r.relatedOrder||null,operator:r.operator||'',remark:r.remark||'',createTime:r.createdAt||''}})).filter("); }
// #3 消息通知：暂不跨端打通，保持用户端首页 3 条（续租提醒/扣款提醒/扣款失败）本地即可（不再推 NOTIFY）
// #6 用户资料：商户用户详情读取共享 PROFILE（用户端身份），资料跨端可见
{ const pu2='du.value={...u};'; assert(Bjs.split(pu2).length-1===1,'B 缺 openUserDetail du 锚点'); Bjs=Bjs.split(pu2).join('du.value={...u,phone:(PROFILE&&PROFILE.phone)||u.phone,email:(PROFILE&&PROFILE.email)||u.email};'); }

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
  var _rootSnap=_navSnapshot();
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
    navLog('push',name||'');
  }
  function navBack(){
    var now=Date.now();if(now-navLastBackAt<250)return;navLastBackAt=now;
    if(!navStack.length){
      if(JSON.stringify(_navSnapshot())!==JSON.stringify(_rootSnap)){_navRestore(_rootSnap);navLog('边界兜底·恢复首页');return}
      navLog('已到首页，边界兜底，禁止继续返回');return;
    }
    var e=navStack.pop();
    var sc=_navScreen(e.name);
    if(sc&&sc.close)sc.close();
    _navRestore(e.snap);
    navLog('back',e.name||'');
  }
  function navDrop(name){
    var i=navStack.length-1;
    if(i<0)return;
    if(name&&navStack[i].name!==name)return;
    var e=navStack.pop();
    var sc=_navScreen(e.name);
    if(sc&&sc.close)sc.close();
    navLog('drop',e.name||'');
  }
  function navSwap(name){
    var s=_navScreen(name);if(!s)return;
    var top=navStack.length?navStack.pop():null;
    if(top){var sc=_navScreen(top.name);if(sc&&sc.close)sc.close()}
    s.open();
    navStack.push({name:name||'',snap:top?top.snap:_navSnapshot()});
    navLog('replace',name);
  }
  function navReset(){
    var n=navStack.length;
    while(navStack.length){var e=navStack.pop();var sc=_navScreen(e.name);if(sc&&sc.close)sc.close()}
    navLog('reset','清空'+n+'层');
  }
  return {navOpen,navBack,navDrop,navSwap,navReset,navLog};
}

/* 货币状态：reactive，双端金额经 fmtRp 联动切换（默认印尼盾；rate 为对 1 IDR 的折算，演示用近似值） */
var MONEY=Vue.reactive({cur:'IDR',rates:{IDR:1,CNY:0.000357,HKD:0.00192},symbols:{IDR:'Rp ',CNY:'¥',HKD:'HK$ '}});
/* 共享金额 formatter：随 MONEY.cur 切换货币（dec 可选，用于小数位） */
function fmtRp(n,dec){var v=Number(n);if(v==null||isNaN(v))v=0;var c=MONEY.cur,a=v*(MONEY.rates[c]||1);var loc=(c==='IDR'?'id-ID':'en-US');var s=dec==null?a.toLocaleString(loc):a.toLocaleString(loc,{minimumFractionDigits:dec,maximumFractionDigits:dec});return (MONEY.symbols[c]||'Rp ')+s}

/* 跨端数据桥：商户端为准 → 用户端实时同步。字段名为两端统一契约（命名对齐）。
   契约字段：orderCount/vehicleCount/batteryCount/walletBalance/lastOrderId/updatedAt
   myVehicles/myBatteries：商户端按账号过滤并映射后的"我的车辆/电池"（用户端直接消费）。 */
${UPLIFT_BLOCK}
/* 共享库存别名：用户端局部 vehicles/batteries（我的车辆/电池）会遮蔽共享库存，目录统一走此别名 */
var SYS_VEHICLES=vehicles; var SYS_BATTERIES=batteries;
${SYS_HELPERS}
/* ══ 租赁目录元数据（商户补齐：车型/电池的 desc 与分期限价格，用户端与商户共用） ══ */
var RENT_META={
 '雅迪 E-Bike Pro':{desc:'都市通勤电摩·续航90km·智能防盗',prices:[82000,320000,1900000,6200000],img:'#2B3F5F'},
 '雅迪 City Cruiser':{desc:'城市代步电动自行车·续航70km',prices:[50000,200000,1200000,3800000],img:'#2B3F5F'},
 '雅迪 Mountain X':{desc:'山地越野电摩·双电池·强劲动力',prices:[150000,580000,3400000,10800000],img:'#FF6A00'},
 '天能锂电 72V20Ah':{desc:'石墨烯锂电池·续航100km·可单独租赁',prices:[56000,220000,1380000,3800000],img:'#17A34A'},
 '超威黑金 72V32Ah':{desc:'大容量锂电池·续航130km·快充2小时·智能BMS',prices:[130000,520000,3100000,9000000],img:'#2B3F5F'},
 '天能锂电 48V20Ah':{desc:'标准锂电池·续航90km',prices:[40000,160000,980000,2800000],img:'#17A34A'}
};
var RENT_PERIOD=['时租','日租','周租','月租'];
var MERGED=Vue.reactive({orderCount:0,vehicleCount:0,batteryCount:0,walletBalance:0,lastOrderId:'—',updatedAt:0,myVehicles:[],myBatteries:[],myOrders:[],myWallet:null,stores:[]});
/* 共享扩展：钱包流水 / 用户资料 / 充值订单（双端同源，充值订单以商户端种子为权威） */
var LEDGER=Vue.ref([]);
var PROFILE=Vue.reactive({name:'User001',phone:'+86 13800001111',email:'user001@yadea.id',account:'user001'});
var CZ_ORDERS=Vue.ref([{orderNo:'CZ202609010001',storeName:'测试门店',createTime:'2026-09-01 10:00:00',payChannel:'2C2P',payStatus:'UNPAID',payTime:'',account:'han.min',phone:'+86 13800001234',email:'han.min@example.com',amount:100,giftAmount:10,refundAmount:null,refundGiftAmount:null},{orderNo:'CZ202609010002',storeName:'测试门店',createTime:'2026-09-01 15:20:00',payChannel:'2C2P',payStatus:'PAYING',payTime:'',account:'chen.yi',phone:'',email:'chen.yi@example.com',amount:200,giftAmount:20,refundAmount:null,refundGiftAmount:null},{orderNo:'CZ202608200003',storeName:'雅迪朝阳店',createTime:'2026-08-20 11:00:00',payChannel:'2C2P',payStatus:'PAID',payTime:'2026-08-20 13:30:00',account:'li.er',phone:'',email:'',amount:300,giftAmount:50,refundAmount:null,refundGiftAmount:null},{orderNo:'CZ202608150004',storeName:'雅迪朝阳店',createTime:'2026-08-15 09:00:00',payChannel:'2C2P',payStatus:'REFUNDING',payTime:'2026-08-15 11:00:00',account:'',phone:'+86 13800003333',email:'',amount:150,giftAmount:30,refundAmount:null,refundGiftAmount:null},{orderNo:'CZ202608100005',storeName:'雅迪海淀店',createTime:'2026-08-10 08:00:00',payChannel:'2C2P',payStatus:'PARTIAL_REFUND',payTime:'2026-08-10 09:12:00',account:'li.si',phone:'',email:'li.si@example.com',amount:500,giftAmount:80,refundAmount:200,refundGiftAmount:30},{orderNo:'CZ202609030006',storeName:'雅迪海淀店',createTime:'2026-09-03 10:00:00',payChannel:'2C2P',payStatus:'FULL_REFUND',payTime:'2026-09-03 10:30:00',account:'wang.wu',phone:'',email:'',amount:300,giftAmount:50,refundAmount:300,refundGiftAmount:50},{orderNo:'CZ202608300007',storeName:'雅迪海淀店',createTime:'2026-08-30 09:00:00',payChannel:'2C2P',payStatus:'CANCELLED',payTime:'',cancelTime:'2026-08-30 09:12:45',account:'zhao.liu',phone:'',email:'',amount:200,giftAmount:20,refundAmount:null,refundGiftAmount:null}]);
/* 订单/充值订单时间归一：保持创建时间位于近 N 天内（相对当前时间动态重写） */
function SYS_recent(n){try{var N=Date.now(),D=(n||15)*24*3600*1000;var f=function(off){var d=new Date(N-off*D);var p=function(x){return (x<10?'0':'')+x};return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())};var o=(typeof orders!=='undefined'&&orders&&orders.value)?orders.value:[];var cz=(typeof CZ_ORDERS!=='undefined'&&CZ_ORDERS&&CZ_ORDERS.value)?CZ_ORDERS.value:[];o.forEach(function(x,i){var off=((i%14)/14)+0.06;if(x.created)x.created=f(off);if(x.payTime)x.payTime=f(off-0.03);if(x.rentStart)x.rentStart=f(off-0.06);if(x.pickupTime)x.pickupTime=f(off-0.04)});cz.forEach(function(x,i){var off=((i%14)/14)+0.06;if(x.createTime)x.createTime=f(off);if(x.payTime)x.payTime=f(off-0.03);if(x.cancelTime&&x.cancelTime!=='-')x.cancelTime=f(off+0.4)})}catch(e){}}
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
  var bn = e.target.closest && e.target.closest('button[data-navhost]');
  if (bn) location.href = bn.getAttribute('data-navhost');
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
#root-user [data-cp]{cursor:pointer}
#root-user [data-cp] *{cursor:pointer}
#root-merchant [data-cp]{cursor:pointer}
#root-merchant [data-cp] *{cursor:pointer}
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
  // 所有 @click 元素加 data-cp 标记 → CSS 统一 cursor:pointer
  .replace('<!--AHTML-->', Ahtml.replace(/@click(?=[=".])/g, 'data-cp @click'))
  .replace('<!--BHTML-->', Bhtml.replace(/@click(?=[=".])/g, 'data-cp @click'));

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
checks.push(`共享 ref orders 声明(Vue.ref): ${(out.match(/const orders=Vue\.ref\(/g) || []).length} (预期 1，已上提)`);
checks.push(`共享 ref vehicles 声明(Vue.ref): ${(out.match(/const vehicles=Vue\.ref\(/g) || []).length} (预期 1)`);
checks.push(`共享 ref rechargeEnabled 声明(Vue.ref): ${(out.match(/const rechargeEnabled=Vue\.ref\(/g) || []).length} (预期 1)`);
checks.push(`残留裸 ref( 声明(共享层): ${(out.match(/const (orders|vehicles|batteries|stores|uWallet|csList|cfg|rechargeList|rechargeEnabled|rechargeCustom|csReceptionEnabled)=ref\(/g) || []).length} (预期 0)`);
checks.push(`SYS_createOrder 定义: ${(out.match(/function SYS_createOrder\(/g) || []).length} (预期 1)`);
checks.push(`registerSharedComponents 出现: ${(out.match(/registerSharedComponents/g) || []).length} (预期 0，已回退)`);
checks.push(`残留 <yd-switch>/<yd-stepper>: ${(out.match(/yd-switch|yd-stepper/g) || []).length} (预期 0，已回退)`);
checks.push(`layer 块: ${(out.match(/<style id="layer-/g) || []).length} (预期 4)`);
console.log('构建完成 → ' + join(ROOT, 'index.html'));
console.log(checks.join('\n'));