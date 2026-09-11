#!/usr/bin/env node
/**
 * ════════ P2 · merge-css — 对 A/B 两端 CSS 做选择器级三分类合并
 * ════════
 * 切块：顶层大括号配对（忽略引号内的 { } 与注释），可正确处理
 *       多选择器同块、多规则同行、@keyframes。
 * 分类：
 *   base      —— 两端同名同值，只留一份（不前缀）
 *   user      —— 仅 A 独有 / 与 B 同名但不同值（A 一侧），一律加 #root-user 前缀
 *   merchant  —— 仅 B 独有 / 与 A 同名但不同值（B 一侧），一律加 #root-merchant 前缀
 *   body      —— 特殊：两端 stage 归宿主接管，从两层剔除（宿主外壳单独提供）
 * 同名不同值为「无损双前缀」：不强行二选一为规范值，避免改变任一端视觉。
 *
 * 输出：.merge-tmp/layers.{base,user,merchant}.css + 差异报告 .merge-tmp/css-conflicts.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TMP = join(dirname(fileURLToPath(import.meta.url)), '..', '.merge-tmp');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function splitBlocks(css) {
  const blocks = [];
  let i = 0, n = css.length, segStart = 0, depth = 0, braceStart = -1, quote = null;
  while (i < n) {
    const ch = css[i];
    if (quote) { if (ch === quote) quote = null; i++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
    if (ch === '{') { if (depth === 0) braceStart = i; depth++; i++; continue; }
    if (ch === '}') {
      depth--;
      if (depth === 0 && braceStart >= 0) {
        blocks.push({
          prelude: css.slice(segStart, braceStart).trim(),
          body: css.slice(braceStart + 1, i).trim(),
        });
        segStart = i + 1; braceStart = -1;
      }
      i++; continue;
    }
    i++;
  }
  return blocks;
}

function normPrelude(p) {
  return p.replace(/\s+/g, ' ').trim();
}

const src = {
  A: stripComments(readFileSync(join(TMP, 'A.css'), 'utf8')),
  B: stripComments(readFileSync(join(TMP, 'B.css'), 'utf8')),
};

const blocks = { A: splitBlocks(src.A), B: splitBlocks(src.B) };
const keyOf = (b) => normPrelude(b.prelude);

// 建索引
const idx = { A: new Map(), B: new Map() };
for (const side of ['A', 'B']) for (const b of blocks[side]) idx[side].set(keyOf(b), b);

const base = [], user = [], merchant = [];
const conflicts = []; // {sel, aBody, bBody}

// 以 A 的块序遍历，决定归属
for (const b of blocks.A) {
  const key = keyOf(b);
  if (key === 'body') continue; // 宿主接管
  const bOther = idx.B.get(key);
  if (!bOther) { user.push({ key, body: b.body, single: 'user' }); continue; }
  if (b.body === bOther.body) { base.push({ key, body: b.body }); }
  else {
    conflicts.push({ sel: key, aBody: b.body, bBody: bOther.body });
    user.push({ key, body: b.body });         // #root-user 前缀
    merchant.push({ key: key, body: bOther.body }); // #root-merchant 前缀
  }
}
// B 独有（未在 A 中出现）→ merchant
for (const b of blocks.B) {
  const key = keyOf(b);
  if (key === 'body') continue;
  if (!idx.A.has(key)) merchant.push({ key, body: b.body });
}

const fmt = (sel, body) => (sel + '{' + body + '}');
writeFileSync(join(TMP, 'layers.base.css'), base.map((r) => fmt(r.key, r.body)).join('\n') + '\n', 'utf8');
writeFileSync(join(TMP, 'layers.user.css'), user.map((r) => fmt(`#root-user ${r.key}`, r.body)).join('\n') + '\n', 'utf8');
writeFileSync(join(TMP, 'layers.merchant.css'), merchant.map((r) => fmt(`#root-merchant ${r.key}`, r.body)).join('\n') + '\n', 'utf8');

// 差异报告
const rep = [];
rep.push(`# CSS 分层报告`);
rep.push(`- base 规则：${base.length}`);
rep.push(`- user(#root-user 前缀)：${user.length}`);
rep.push(`- merchant(#root-merchant 前缀)：${merchant.length}`);
rep.push(`- 同名不同值（双前缀保留原值）：${conflicts.length}`);
rep.push('');
if (conflicts.length) {
  rep.push(`## 同名不同值清单`);
  for (const c of conflicts) {
    rep.push(`### ${c.sel}`);
    rep.push(`- A: ${c.aBody}`);
    rep.push(`- B: ${c.bBody}`);
  }
} else {
  rep.push('无同名不同值规则。');
}
writeFileSync(join(TMP, 'css-conflicts.md'), rep.join('\n') + '\n', 'utf8');

console.log(rep.join('\n'));
console.log('\n输出：layers.{base,user,merchant}.css / css-conflicts.md @ ' + TMP);