#!/usr/bin/env node
/**
 * ════════ i18n 校验 — 按 locales/{rent,swap} 两目录分组检查五语一致性
 * ════════ 用法：node scripts/i18n_check.mjs
 *
 * 口径对齐 AGENTS.md §5：
 *  - 目录代替项目前缀命名空间：rent/（user./merchant./demo.）、swap/
 *  - zh-CN.json 为唯一权威源，en/id/th/zh-HK 单向派生
 *  - 某目录无 zh-CN.json 或内容为空时跳过该目录
 *
 * 硬错误（计入退出码，exit 1）：
 *  - MISSING     某语言缺键
 *  - ORPHAN      某语言多出 zh-CN 没有的键
 *  - PLACEHOLDER 占位符 {name}/%s 集合与源不一致（运行时渲染必错）
 *  - SUFFIX      数字后缀残留键：末段去掉末尾数字后「同名键也存在」才算
 *                （menu.home0 vs menu.home 并存）；days7 / billingRules.3 / tianneng72V20 属合法业务名，不报
 *  - COMMON      common 段跨目录（rent vs swap）缺键或同键不同值
 *
 * 人工复核项（不计入退出码）：
 *  - NUMBER      数字集合与源不一致。中文常以汉字表示（百公里 / 两位 / 一张），
 *                译文写阿拉伯数字（100 km / 2 / 1）；日期本地化（7月 → Jul）同理。需人眼扫一遍
 *  - STATUS      与中文逐字相同。rent/ 实测来源：demo.* 演示假数据、品牌专名（2C2P）、
 *                繁简同形词（押金 / 退款 / 重置），通常无需处理
 *  - TERM        跨目录同义中文（zh-CN 值逐字相同）译法不一致，见 AGENTS.md §5
 *                「跨目录术语一致性（rent ↔ swap）」。demo.* 已排除；短标签缩写
 *                （CNY/IDR 对 Chinese Yuan/Indonesian Rupiah）、单位、品牌专名属声明例外。
 *                逐条明细见 i18n-cross-drift.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['rent', 'swap'];
const LANGS = ['zh-CN', 'en', 'id', 'th', 'zh-HK'];
const SRC = 'zh-CN';

/** 嵌套 JSON → 点路径扁平表（对象与数组均展开） */
function flat(obj, prefix = '', out = {}) {
  for (const k in obj) {
    const v = obj[k];
    const n = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object') flat(v, n, out);
    else out[n] = v == null ? '' : String(v);
  }
  return out;
}

/** 读取某目录某语言；文件不存在、解析失败或内容为空对象 → null */
function load(dir, lang) {
  const p = path.join(ROOT, 'locales', dir, lang + '.json');
  if (!fs.existsSync(p)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.log('  [' + lang + '] JSON 解析失败：' + e.message);
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const f = flat(raw);
  return Object.keys(f).length ? f : null;
}

const ph = (s) => ((String(s).match(/\{[^}]+\}|%[sd]/g)) || []).sort().join('|');
const nums = (s) => ((String(s).match(/\d+/g)) || []).sort().join(',');
const short = (s) => String(s).replace(/\s+/g, ' ').slice(0, 32);
/** 数字后缀残留：末段末尾数字可剥离，且剥离后同名键确实存在（排除纯数字段＝数值键对象） */
function isSuffixKey(k, all) {
  const seg = k.split('.').pop() || '';
  if (/^\d+$/.test(seg)) return false;
  const m = /^(.*?)(\d+)$/.exec(seg);
  if (!m || !m[1]) return false;
  return all.has(k.slice(0, k.length - seg.length) + m[1]);
}

let failures = 0;
const dirData = {};
const dirFull = {}; /* { dir: { lang: flatMap } } —— 供跨目录同义中文比对复用 */

for (const dir of DIRS) {
  const src = load(dir, SRC);
  if (!src) {
    console.log('== ' + dir + '/ == 跳过（无 zh-CN.json 或内容为空）\n');
    dirData[dir] = null;
    continue;
  }
  dirData[dir] = src;
  dirFull[dir] = { [SRC]: src };
  const keys = Object.keys(src).sort();
  console.log('== ' + dir + '/ == 源（zh-CN）' + keys.length + ' 键');

  for (const lang of LANGS) {
    if (lang === SRC) continue;
    const f = load(dir, lang);
    if (!f) {
      console.log('  ' + lang + ': 缺失整个语言文件');
      failures++;
      continue;
    }
    dirFull[dir][lang] = f;
    const all = new Set(keys.concat(Object.keys(f)));
    const miss = keys.filter((k) => !(k in f));
    const orphan = Object.keys(f).filter((k) => !(k in src)).sort();
    const phBad = keys.filter((k) => k in f && ph(f[k]) !== ph(src[k]));
    const numBad = keys.filter((k) => k in f && nums(f[k]) !== nums(src[k]));
    /* demo.* 为演示假数据（zs 张三 / zs10 郑十 这类同前缀不同语义），不适用数字后缀禁令 */
    const suffix = Object.keys(f).filter((k) => k.indexOf('demo.') !== 0 && isSuffixKey(k, all));
    const same = keys.filter((k) => k in f && f[k] === src[k]);

    const hard = miss.length + orphan.length + phBad.length + suffix.length;
    failures += hard;
    console.log('  ' + lang + ': MISSING=' + miss.length + ' ORPHAN=' + orphan.length +
      ' PLACEHOLDER=' + phBad.length + ' SUFFIX=' + suffix.length +
      ' | 复核 NUMBER=' + numBad.length + ' STATUS=' + same.length);
    if (miss.length) console.log('      缺: ' + miss.slice(0, 8).join(', ') + (miss.length > 8 ? ' …' : ''));
    if (orphan.length) console.log('      多: ' + orphan.slice(0, 8).join(', ') + (orphan.length > 8 ? ' …' : ''));
    if (phBad.length) phBad.slice(0, 6).forEach((k) => console.log('      占位符 ' + k + '：' + short(src[k]) + ' → ' + short(f[k])));
    if (suffix.length) console.log('      数字后缀: ' + suffix.slice(0, 8).join(', '));
    if (numBad.length) numBad.slice(0, 6).forEach((k) => console.log('      数字 ' + k + '：' + short(src[k]) + ' → ' + short(f[k])));
    const sameReal = same.filter((k) => k.indexOf('demo.') !== 0);
    if (sameReal.length) console.log('      同源(非 demo.*): ' + sameReal.slice(0, 6).join(', ') + (sameReal.length > 6 ? ' …' : ''));
  }
  console.log('');
}

// ── common 段跨目录一致性（AGENTS.md §5：共享术语须在 rent/ 与 swap/ 两目录内保持一致）──
if (dirData.rent && dirData.swap) {
  const rk = Object.keys(dirData.rent).filter((k) => k.startsWith('common.'));
  const sk = new Set(Object.keys(dirData.swap).filter((k) => k.startsWith('common.')));
  const missing = rk.filter((k) => !sk.has(k));
  const diff = rk.filter((k) => sk.has(k) && dirData.swap[k] !== dirData.rent[k]);
  console.log('== common 段跨目录（rent vs swap）==');
  console.log('  rent 有 swap 无: ' + missing.length + (missing.length ? ' → ' + missing.slice(0, 8).join(', ') : ''));
  diff.slice(0, 6).forEach((k) => console.log('      值不同 ' + k + '：' + short(dirData.rent[k]) + ' → ' + short(dirData.swap[k])));
  console.log('  两侧同键不同值: ' + diff.length);
  failures += missing.length + diff.length;
} else {
  console.log('== common 段跨目录 == 跳过（某一目录为空占位）');
}

// ── 跨目录同义中文译法一致性（AGENTS.md §5：同一句中文两端译法必须一致）──
// 口径：按 zh-CN 值分组，同一组中文在 rent 与 swap 的译文集合必须相同。
// 人工复核项（不计入退出码）：demo.* 整体排除；短标签缩写（CNY / IDR 对 Chinese Yuan /
// Indonesian Rupiah）、单位（block 对 battery(ies)）、品牌专名属声明例外，需人眼判定。
if (dirFull.rent && dirFull.swap) {
  const others = LANGS.filter((l) => l !== SRC);
  const group = (dir) => {
    const m = new Map();
    for (const k of Object.keys(dirFull[dir][SRC])) {
      if (k.startsWith('demo.')) continue;
      const zh = dirFull[dir][SRC][k].trim();
      if (!m.has(zh)) m.set(zh, []);
      m.get(zh).push(k);
    }
    return m;
  };
  const rm = group('rent');
  const sm = group('swap');
  const sharedZh = [...rm.keys()].filter((zh) => sm.has(zh));
  const perLang = {};
  const rows = [];
  for (const zh of sharedZh) {
    const hit = [];
    for (const lang of others) {
      const rv = [...new Set(rm.get(zh).map((k) => dirFull.rent[lang][k] ?? '<缺>'))].sort();
      const sv = [...new Set(sm.get(zh).map((k) => dirFull.swap[lang][k] ?? '<缺>'))].sort();
      if (rv.join('\u0000') !== sv.join('\u0000')) {
        perLang[lang] = (perLang[lang] || 0) + 1;
        hit.push(lang + ' rent「' + rv.join(' / ') + '」swap「' + sv.join(' / ') + '」');
      }
    }
    if (hit.length) rows.push({ zh, rk: rm.get(zh), sk: sm.get(zh), hit });
  }
  console.log('== 跨目录同义中文译法（rent vs swap）==');
  console.log('  共有同中文 ' + sharedZh.length + ' 条，译法不一致 ' + rows.length +
    ' 条（人工复核，不计退出码）：' + others.map((l) => l + '=' + (perLang[l] || 0)).join(' '));
  rows.slice(0, 12).forEach((r) => {
    console.log('    · ' + short(r.zh) + '  [' + r.rk[0] + ' ↔ ' + r.sk[0] + ']');
    r.hit.forEach((h) => console.log('        ' + h));
  });
  if (rows.length > 12) console.log('    …其余 ' + (rows.length - 12) + ' 条明细见 i18n-cross-drift.md');
} else {
  console.log('== 跨目录同义中文译法 == 跳过（某一目录为空占位）');
}

console.log('\n结果：' + (failures
  ? '失败 ' + failures + ' 项（MISSING/ORPHAN/PLACEHOLDER/SUFFIX/COMMON）'
  : '通过：无硬错误') + '；NUMBER / STATUS 为人工复核项，不影响退出码');
process.exit(failures ? 1 : 0);