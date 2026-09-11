#!/usr/bin/env node
/**
 * ════════ P1 · merge-extract — 从单文件 demo 中按「内容锚点」切出 css / html(模板) / js 三段
 * ════════
 * 原则：全程用字符串锚点 + 标签配对定位，绝不依赖行号（源码存在混合换行导致行号偏移）。
 *
 * 对每个源文件提取：
 *   css  —— <head> 内首块 <style>...</style> 的内容（不含包裹标签）
 *   html —— #app 容器的 innerHTML（即原 Vue 实例渲染用的整段模板，不含 #app 自身标签）
 *   js   —— 最后一个内联 <script>...</script> 的主体（不含包裹标签）
 *
 * 输出：.merge-tmp/{A,B}.{css,html,js}
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.merge-tmp');

const SOURCES = [
  { key: 'A', file: join(ROOT, 'user.html') },
  { key: 'B', file: join(ROOT, 'merchant.html') },
];

/** 从 `start` 起找到对应闭合标签的结束位置；depth<0 视为闭合过度。 */
function findTagBoundary(text, openTag, closeTag, start, selfCloseTest = null) {
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const o = text.indexOf(openTag, i);
    if (o === -1) return -1;
    const c = text.indexOf(closeTag, i);
    if (c !== -1 && c < o) {
      depth--;
      i = c + closeTag.length;
      if (depth < 0) return i;
    } else {
      // 碰到 open；判断是否自闭合（如 <style> 不会自闭合，但防御性处理）
      if (selfCloseTest && selfCloseTest(text, o)) {
        i = o + openTag.length;
      } else {
        depth++;
        i = o + openTag.length;
      }
    }
  }
  return -1;
}

function extract(text) {
  // ── css：首个 <style> 到对应 </style> ──
  const styleOpen = text.indexOf('<style');
  if (styleOpen === -1) throw new Error('未找到 <style>');
  const styleOpenEnd = text.indexOf('>', styleOpen) + 1;
  const styleClose = text.indexOf('</style>', styleOpenEnd);
  const css = text.slice(styleOpenEnd, styleClose);

  // ── 内联主 <script>：取最后一个 <script（即非 CDN 的那个）──
  const inlineOpen = text.lastIndexOf('<script');
  if (inlineOpen === -1) throw new Error('未找到内联 <script>');
  const inlineOpenEnd = text.indexOf('>', inlineOpen) + 1;
  const inlineClose = text.indexOf('</script>', inlineOpenEnd);
  if (inlineClose === -1) throw new Error('未找到 </script>');
  const js = text.slice(inlineOpenEnd, inlineClose);

  // ── html 模板：#app 开标签的 `>` 之后，到内联 script 前，剥掉最外层收尾 </div> ──
  const appOpen = text.indexOf('<div id="app"');
  if (appOpen === -1) throw new Error('未找到 <div id="app"');
  const appTagEnd = text.indexOf('>', appOpen) + 1;
  const seg = text.slice(appTagEnd, inlineOpen);
  const lastClose = seg.lastIndexOf('</div>');
  let html = seg.slice(0, lastClose).replace(/\s+$/, '');

  return { css, html, js };
}

// ── 配对自检：统计 html 内 div 是否平衡、是否残留其他待配标签 ──
function selfCheck(tag, label, key) {
  const nOpen = (tag.match(/<div[\s>]/g) || []).length;
  const nClose = (tag.match(/<\/div>/g) || []).length;
  const nTplOpen = (tag.match(/<template[\s>]/g) || []).length;
  const nTplClose = (tag.match(/<\/template>/g) || []).length;
  const nStyleOpen = (tag.match(/<style[\s>]/g) || []).length;
  const nStyleClose = (tag.match(/<\/style>/g) || []).length;
  const nScreen = tag.match(/class="od-stage/g)?.length ?? 0;
  return `[${key}] ${label} | div: ${nOpen}/${nClose} | template: ${nTplOpen}/${nTplClose} | style: ${nStyleOpen}/${nStyleClose} | od-stage: ${nScreen}`;
}

mkdirSync(TMP, { recursive: true });
const report = [];
for (const { key, file } of SOURCES) {
  const raw = readFileSync(file, 'utf8');
  const { css, html, js } = extract(raw);

  writeFileSync(join(TMP, `${key}.css`), css, 'utf8');
  writeFileSync(join(TMP, `${key}.html`), html, 'utf8');
  writeFileSync(join(TMP, `${key}.js`), js, 'utf8');

  const lc = (s) => s.split('\n').length;
  const srcLines = raw.split('\n').length;
  const sumLines = lc(css) + lc(html) + lc(js);
  report.push(`== ${key} <= ${basename(file)}`);
  report.push(`   原文件行数 ${srcLines} | css ${lc(css)} + html ${lc(html)} + js ${lc(js)} = ${sumLines} (差值 ${sumLines - srcLines})`);
  report.push(`   chars: css ${css.length} / html ${html.length} / js ${js.length}`);
  report.push('   ' + selfCheck(html, 'html模板', key));
  report.push('   ' + selfCheck(css, 'css', key));
}

console.log(report.join('\n'));
console.log('\n输出目录：' + TMP);