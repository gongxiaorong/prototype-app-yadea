// 提取 index.html 最后一个 <script> 块并做语法校验（不执行，仅 node --check 语义）
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const s = readFileSync(join(ROOT, 'index.html'), 'utf8');
const i = s.indexOf('\n<script>');
const j = s.lastIndexOf('</script>');
if (i < 0 || j < 0) { console.error('未找到 <script>'); process.exit(2); }
const body = s.slice(i + 9, j);
writeFileSync(join(ROOT, '.merge-tmp', '_merged-script.js'), body, 'utf8');
console.log('已导出 script 块 -> .merge-tmp/_merged-script.js (' + body.length + ' chars)');