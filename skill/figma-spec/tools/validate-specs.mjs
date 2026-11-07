#!/usr/bin/env node
// validate-specs.mjs — spec 契约校验：specs/*.json 对照 schema/spec.schema.json（ajv 精校）。
// 提取自 zh_code_v2 任务 0020 的校验器（Z07 泛化：目录/ schema 路径参数化 + 无 ajv 时降级精简校验）。
// schema 之外恒做三条脚本级校验：JSON 可解析、pageId == 文件名（去 .json）、A/B 变体标识合法（variants/ver/@<变体>）。
// 注意：可点编码唯一性/重复检测不在本脚本（生成器 gen-vue / regen 生成时把关），两者互补。
//
// 用法：
//   node validate-specs.mjs                          # 校验 ./specs 下全部 *.json（schema 取 ../schema/spec.schema.json）
//   node validate-specs.mjs --specs=<dir> --schema=<file>
// 依赖：ajv（可选）。有 ajv = 逐块类型字段形制精校（未知字段/枚举/pattern 全拦）；
//       无 ajv 自动降级为结构精简校验（顶层字段/块类型白名单/id 正则/ver 标识），并提示安装 ajv 获得全量校验。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMarkers, validateVariantsDecl } from './resolve-ver-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');
const specsDir = path.resolve(flag('specs') ?? './specs');
const schemaPath = path.resolve(flag('schema') ?? path.join(__dirname, '..', 'schema', 'spec.schema.json'));

// ---------- 载入 schema ----------
let schema = null;
if (fs.existsSync(schemaPath)) schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
else console.warn(`⚠ 未找到 schema（${schemaPath}），只做脚本级校验`);

// ---------- ajv 可用则精校，不可用则降级 ----------
let ajvMode = false;
let rootValidate = null;
const branchCache = new Map();
if (schema) {
  try {
    const { default: Ajv } = await import('ajv');
    const ajv = new Ajv({ allErrors: true, strict: false });
    rootValidate = ajv.compile({ ...schema, properties: { ...schema.properties, blocks: { type: 'array', items: true } } });
    const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    globalThis.__branchOf = (type) => {
      if (branchCache.has(type)) return branchCache.get(type);
      const def = `blk${capitalize(type)}`;
      let fn = null;
      if (schema.definitions?.[def]) fn = ajv.compile({ definitions: schema.definitions, $ref: `#/definitions/${def}` });
      branchCache.set(type, fn);
      return fn;
    };
    ajvMode = true;
  } catch {
    console.warn('⚠ 未安装 ajv，降级为结构精简校验（npm i -D ajv 可开启逐字段精校）');
  }
}

const fmtError = (err) => {
  const at = err.instancePath === '' ? '' : `${err.instancePath.replace(/\//g, '.')} `;
  if (err.params?.additionalProperty !== undefined) return `${at}未知字段 "${err.params.additionalProperty}"（字段名手误 / 未声明变体的后缀 / 未同步 schema 的新字段）`;
  if (err.params?.allowedValues !== undefined) return `${at}取值须为 [${err.params.allowedValues.join(' | ')}]`;
  return `${at}${err.message ?? '校验失败'}`;
};

// 降级模式用：从 schema anyOf 提取全部已知块类型
const knownTypes = schema
  ? [...new Set((schema.definitions?.block?.anyOf ?? [])
      .map((r) => (r?.$ref ?? '').replace('#/definitions/', ''))
      .map((d) => d.replace(/^blk/, '').replace(/^./, (c) => c.toLowerCase()))
      .filter(Boolean))]
  : [];

// ---------- 逐文件校验 ----------
const files = fs.existsSync(specsDir) ? fs.readdirSync(specsDir).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) { console.error(`✗ spec 目录为空或不存在 ${specsDir}`); process.exit(1); }
console.log(`校验 ${files.length} 份 spec（${specsDir}）${ajvMode ? ' · ajv 精校' : ' · 精简校验'}`);

let bad = 0;
for (const f of files) {
  const problems = [];
  let spec;
  try {
    spec = JSON.parse(fs.readFileSync(path.join(specsDir, f), 'utf8'));
  } catch (e) {
    console.error(`✗ ${f}：JSON 解析失败 — ${e.message}`);
    bad++;
    continue;
  }

  if (spec.pageId !== f.replace(/\.json$/, '')) problems.push(`pageId "${spec.pageId}" ≠ 文件名 "${f.replace(/\.json$/, '')}"`);
  problems.push(...validateVariantsDecl(spec, spec.pageId ?? f).map((e) => `${f} ${e}`));
  problems.push(...validateMarkers(spec, spec.pageId ?? f).map((e) => `${f} ${e}`));

  if (ajvMode && rootValidate) {
    if (!rootValidate(spec)) problems.push(...(rootValidate.errors ?? []).map(fmtError));
    for (let i = 0; i < (spec.blocks ?? []).length; i++) {
      const b = spec.blocks[i];
      const fn = globalThis.__branchOf?.(b?.type);
      if (fn && !fn(b)) problems.push(...(fn.errors ?? []).map((e) => `blocks[${i}](${b.type}) ${fmtError(e)}`));
    }
  } else {
    // 精简校验：顶层形制 + 块类型白名单 + id 正则
    for (const k of ['pageId', 'title', 'size', 'blocks']) if (!(k in spec)) problems.push(`缺顶层字段 "${k}"`);
    if (spec.variants !== undefined && (!Array.isArray(spec.variants) || !spec.variants.length)) problems.push('页级 variants 须为非空字符串数组');
    for (const [i, b] of (spec.blocks ?? []).entries()) {
      if (!b?.type) { problems.push(`blocks[${i}] 缺 type`); continue; }
      if (knownTypes.length && !knownTypes.includes(b.type)) problems.push(`blocks[${i}] 未知块类型 "${b.type}"（schema 未收录，新增类型须同步 schema）`);
      if (b.id !== undefined && !/^rd-[A-Za-z0-9][A-Za-z0-9-]*$/.test(b.id)) problems.push(`blocks[${i}].id "${b.id}" 不符冻结码形制 ^rd-[A-Za-z0-9][A-Za-z0-9-]*$`);
    }
  }

  if (problems.length) { console.error(`✗ ${f}：\n  ${problems.join('\n  ')}`); bad++; }
  else console.log(`✓ ${f}`);
}

console.log(bad ? `\n✗ ${bad}/${files.length} 份未通过` : `\n✓ ${files.length}/${files.length} 全部通过`);
process.exit(bad ? 1 : 0);
