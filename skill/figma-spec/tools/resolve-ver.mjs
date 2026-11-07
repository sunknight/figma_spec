#!/usr/bin/env node
// resolve-ver.mjs — 单源 spec → 目标变体纯 spec（剥 ver/@<变体> 标识与冻结码 id）。
// A/B 变体模型：页级 variants 声明变体空间；块/项级 "ver":"<变体>" 控制归属；字段级 "k@<变体>" 覆盖裸键。
// 渲染器/下游工具不识别变体标识时先过这一步。
//
// 用法：
//   node resolve-ver.mjs specs/home01.json                  # 缺省变体 = variants[0]（通常 "a"）
//   node resolve-ver.mjs specs/home01.json --ver=b          # 指定变体
//   node resolve-ver.mjs specs/home01.json --ver=b -o home01.b.json
import fs from 'node:fs';
import { resolveVer, validateMarkers, validateVariantsDecl, defaultVariantOf } from './resolve-ver-lib.mjs';

const argv = process.argv.slice(2);
const files = argv.filter((a) => !a.startsWith('-'));
const verArg = argv.find((a) => a.startsWith('--ver='));
const outIdx = argv.indexOf('-o');
const outPath = outIdx !== -1 ? argv[outIdx + 1] : null;
const strip = (argv.find((a) => a.startsWith('--strip=')) ?? '').split('=')[1]?.split(',').filter(Boolean) ?? [];
const keepId = argv.includes('--keep-id');

if (!files.length) {
  console.error('用法：node resolve-ver.mjs <spec.json>... [--ver=<变体>] [-o out.json] [--strip=k1,k2] [--keep-id]');
  process.exit(1);
}

for (const f of files) {
  const spec = JSON.parse(fs.readFileSync(f, 'utf8'));
  const errs = [...validateVariantsDecl(spec, spec.pageId ?? f), ...validateMarkers(spec, spec.pageId ?? f)];
  if (errs.length) { console.error(`✗ ${f} 变体标识非法：\n  ${errs.join('\n  ')}`); process.exit(2); }
  const variant = verArg ? verArg.split('=')[1] : defaultVariantOf(spec);
  if (variant !== null && !Array.isArray(spec.variants)) { console.error(`✗ ${f} 未声明 variants，不能 --ver=${variant}`); process.exit(1); }
  if (variant !== null && !spec.variants.includes(variant)) { console.error(`✗ ${f} 变体 "${variant}" 未在 variants [${spec.variants.join(', ')}] 中声明`); process.exit(1); }
  const pure = resolveVer(spec, variant, { keepId, strip });
  const json = JSON.stringify(pure, null, 1); // 与 spec 落盘形制一致：1 空格缩进、无末尾换行
  if (outPath) { fs.writeFileSync(outPath, json); console.log(`✓ ${f} → ${outPath}（变体=${variant ?? '无'}）`); }
  else console.log(json);
}
