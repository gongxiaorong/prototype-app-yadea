import fs from "fs";
const L = ["zh-CN", "en", "id", "th", "zh-HK"];
const load = l => JSON.parse(fs.readFileSync("locales/" + l + ".json", "utf8"));
const flat = o => { const r = {}; (function w(o, p) { for (const k in o) { const v = o[k]; const n = p ? p + "." + k : k; if (v && typeof v === "object") { w(v, n); } else { r[n] = v; } } })(o, ""); return r; };
const F = {}; L.forEach(l => F[l] = flat(load(l)));
const allKeys = Object.keys(F["zh-CN"]).sort();
const ph = s => ((String(s).match(/\{[^}]+\}|%[sd]/g)) || []).sort().join("|");
const nums = s => ((String(s).match(/\d+/g)) || []).sort().join(",");
const groups = {
  "index (common/user/merchant/demo)": allKeys.filter(k => !k.startsWith("swap.")),
  "swap": allKeys.filter(k => k.startsWith("swap."))
};
console.log("全局键数=" + allKeys.length + "\n");
for (const [g, keys] of Object.entries(groups)) {
  console.log("== " + g + " (" + keys.length + " 键) ==");
  for (const l of L) {
    if (l === "zh-CN") { continue; }
    const miss = keys.filter(k => !(k in F[l]));
    const phBad = keys.filter(k => ph(F[l][k]) !== ph(F["zh-CN"][k]));
    const numBad = keys.filter(k => nums(F[l][k]) !== nums(F["zh-CN"][k]));
    let line = "  " + l + ": 缺失=" + miss.length + " 占位符=" + phBad.length + " 数字=" + numBad.length;
    if (miss.length) { line += " 缺:" + miss.slice(0, 6).join(","); }
    console.log(line);
  }
}
console.log("== 全局孤立键 (目标语言有、zh-CN 无) ==");
for (const l of L) {
  if (l === "zh-CN") { continue; }
  const orphan = Object.keys(F[l]).filter(k => !(k in F["zh-CN"]));
  console.log("  " + l + ": 孤立=" + (orphan.length ? orphan.join(",") : 0));
}
