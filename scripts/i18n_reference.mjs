#!/usr/bin/env node
/**
 * i18n 翻译对照表生成器（零依赖）
 *
 * 扫描 locales/<目录>/ → 为每个目录产出 <目录名>-translation-reference.html（写到仓库根目录）。
 * 模板与运行时分别来自同目录下的 i18n_reference_page.html / i18n_reference_app.js，本脚本只做占位符注入。
 *
 * 设计口径：
 * - 词条不内联：页面运行时 fetch `locales/<目录>/<语言>.json`，故需 http(s) 访问，file:// 会给出提示。
 * - 只读产物：不动 locales/*.json、index.html、swap.html。
 * - 表格用 TDesign t-table：语言列开关交给内置 columnController，缺失/同源/关键词高亮走 columns[].cell 渲染函数；
 *   刻意不传 scroll 属性，避免虚拟滚动让浏览器 Ctrl+F 查不到未渲染行。
 * - 模板放在 <script type="text/x-template">，避开 HTML 解析器把 camelCase 属性小写化。
 *
 * 用法：node scripts/i18n_reference.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_DIR = join(ROOT, 'scripts');
const LOCALES = join(ROOT, 'locales');

/** 语言清单：顺序即列顺序；zh-CN 为唯一权威源，固定第一列且不可隐藏 */
const LANGS = [
  { code: 'zh-CN', label: '简体中文（源）', source: true },
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'th', label: 'ไทย' },
  { code: 'zh-HK', label: '繁體中文（香港）' },
];
const SRC = 'zh-CN';

const pageTpl = readFileSync(join(SCRIPT_DIR, 'i18n_reference_page.html'), 'utf8');
const appJs = readFileSync(join(SCRIPT_DIR, 'i18n_reference_app.js'), 'utf8');

const fill = (tpl, from, to) => tpl.split(from).join(to);

function buildPage(dir) {
  const cfg = {
    dir,
    src: SRC,
    langs: LANGS.map((l) => ({ code: l.code, label: l.label, source: !!l.source })),
    hideable: LANGS.filter((l) => !l.source).map((l) => l.code),
  };
  const srcLabel = LANGS.find((l) => l.source).label;
  let html = pageTpl;
  html = fill(html, '{{DIR}}', dir);
  html = fill(html, '{{SRC_LABEL}}', srcLabel);
  html = fill(html, '{{CONFIG}}', JSON.stringify(cfg));
  html = fill(html, '{{APP_JS}}', appJs.trimEnd());
  return html;
}

/** §6 自检 1：注入的 <script> 必须能编译 */
function checkScripts(html, dir) {
  const bad = [];
  const re = /<script(?![^>]*type="text\/x-template")[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    const code = m[1];
    if (!code.trim()) continue;
    try {
      new Function(code);
    } catch (e) {
      bad.push(dir + ': ' + e.message);
    }
  }
  return bad;
}

/** §6 自检 2：标签配平（仅常见容器/组件标签，栈式） */
function checkTags(html, dir) {
  const voidTags = new Set(['link', 'meta', 'br', 'hr', 'img', 'input', 'col', 'source']);
  const stack = [];
  const re = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[1] === '/';
    const tag = m[2].toLowerCase();
    const selfClose = m[4] === '/';
    if (voidTags.has(tag) || selfClose) continue;
    if (closing) {
      const top = stack.pop();
      if (top !== tag) return [dir + ': 标签不配平，遇到 </' + tag + '> 但栈顶是 ' + (top || '空')];
    } else {
      stack.push(tag);
    }
  }
  if (stack.length) return [dir + ': 未闭合标签 ' + stack.join(',')];
  return [];
}

function flatKeys(json) {
  const out = new Set();
  (function walk(o, p) {
    for (const k of Object.keys(o)) {
      const v = o[k];
      const n = p ? p + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, n);
      else out.add(n);
    }
  })(json, '');
  return out;
}

function summarize(dir) {
  const srcPath = join(LOCALES, dir, SRC + '.json');
  if (!existsSync(srcPath)) return { total: 0, lines: ['缺 ' + SRC + '.json（跳过统计）'] };
  const src = JSON.parse(readFileSync(srcPath, 'utf8'));
  const keys = flatKeys(src);
  const lines = [];
  for (const l of LANGS) {
    if (l.source) continue;
    const p = join(LOCALES, dir, l.code + '.json');
    if (!existsSync(p)) { lines.push(l.code + ' 文件缺失'); continue; }
    const other = JSON.parse(readFileSync(p, 'utf8'));
    const ok = flatKeys(other);
    let miss = 0;
    let same = 0;
    for (const k of keys) {
      if (!ok.has(k)) miss++;
    }
    lines.push(l.code + ' 缺失=' + miss);
  }
  return { total: keys.size, lines };
}

/* ────────────────────────── 主流程 ────────────────────────── */

const dirs = readdirSync(LOCALES, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
if (!dirs.length) {
  console.error('locales/ 下没有目录，未生成任何文件');
  process.exit(1);
}

const problems = [];
for (const dir of dirs) {
  const html = buildPage(dir);
  const out = join(ROOT, dir + '-translation-reference.html');
  writeFileSync(out, html, 'utf8');
  problems.push(...checkScripts(html, dir), ...checkTags(html, dir));
  const info = summarize(dir);
  console.log('[生成] ' + dir + '-translation-reference.html  源词条 ' + info.total + ' 条');
  info.lines.forEach((l) => console.log('        ' + l));
}

if (problems.length) {
  console.error('\n自检未通过：');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('\n自检通过：脚本可编译、标签配平。产物共 ' + dirs.length + ' 个，运行时 fetch locales/<目录>/*.json（需 http 访问）。');