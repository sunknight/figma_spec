// resolve-ver-lib.mjs — A/B 变体标识解析库（供 resolve-ver / regen / gen-vue / validate-specs / figma-diff 共用）。
//
// 变体模型（一个 spec 支持任意多个 abtest 变体）：
//   页级   "variants": ["a", "b"]            ← 声明本页的变体空间（用变体标记前必须声明；不用可整个省略）
//   块/项级 "ver": "a" | "b" | "all"          ← 该块/对象数组项只在对应变体输出（缺省 all = 所有变体共有）
//   字段级  "k@a": 值 / "k@b": 值             ← 值仅作用于对应变体并覆盖同名裸键；裸键 = 各变体共有值
//   解析    resolveVer(spec, "b")             → 变体 b 的纯形态（剥 ver/@x 标识与冻结码 id）
//
// 变体键约束：^[a-z][a-z0-9_]{0,15}$（如 a / b / lite / pro / cn / global）；
// 标记只能引用页内声明过的变体（validateMarkers 强校验），"all" 为保留字不可作变体名。
const VAR_RE = /^[a-z][a-z0-9_]{0,15}$/;

/** 校验变体声明本身（页级 variants 数组）：返回错误清单。 */
export function validateVariantsDecl(spec, where = 'spec') {
  const errs = [];
  const v = spec?.variants;
  if (v === undefined) return errs;
  if (!Array.isArray(v) || v.length === 0) {
    errs.push(`${where}.variants 须为非空字符串数组（声明本页支持的变体）`);
    return errs;
  }
  if (new Set(v).size !== v.length) errs.push(`${where}.variants 有重复项`);
  for (const x of v) {
    if (typeof x !== 'string' || !VAR_RE.test(x)) errs.push(`${where}.variants 项 "${x}" 不符变体名形制 ^[a-z][a-z0-9_]{0,15}$`);
    if (x === 'all') errs.push(`${where}.variants 不能用保留字 "all" 作变体名`);
  }
  return errs;
}

/** 全量巡检变体标识合法性：返回错误清单（空 = 通过）。只查不改。
 *  declared = 页级声明的变体名集合；标记引用未声明的变体 → 报错。 */
export function validateMarkers(node, where = 'spec', errs = [], declared = null) {
  if (declared === null) {
    // 根调用：从页级取声明（variants 缺省 = 空集 → 出现任何标记都报"未声明"）
    declared = new Set(Array.isArray(node?.variants) ? node.variants.filter((x) => typeof x === 'string') : []);
  }
  if (Array.isArray(node)) {
    node.forEach((it, i) => validateMarkers(it, `${where}[${i}]`, errs, declared));
    return errs;
  }
  if (node && typeof node === 'object') {
    if (node.ver !== undefined) {
      if (node.ver === 'all' || declared.has(node.ver)) { /* 合法 */ }
      else if (declared.size === 0) errs.push(`${where} 用了 ver:"${node.ver}" 但页级未声明 variants`);
      else errs.push(`${where} ver:"${node.ver}" 未在页级 variants [${[...declared].join(', ')}] 中声明`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'ver') continue;
      const at = k.lastIndexOf('@');
      if (at !== -1) {
        const tok = k.slice(at + 1);
        if (!VAR_RE.test(tok)) errs.push(`${where}.${k} 非法变体后缀 "@${tok}"（形制 ^[a-z][a-z0-9_]{0,15}$）`);
        else if (tok === 'all') errs.push(`${where}.${k} 后缀不能用保留字 @all`);
        else if (!declared.has(tok)) errs.push(`${where}.${k} 变体 "${tok}" 未在页级 variants 中声明`);
      }
      validateMarkers(v, `${where}.${k}`, errs, declared);
    }
  }
  return errs;
}

/** 解析出目标变体的纯 spec：剥 ver/@x 标识与 id（可保留），返回新对象不改原。
 *  variant = 目标变体名（须是 spec 声明过的）；无变体声明的 spec 原样克隆（仅按 opts 剥 id/strip）。 */
export function resolveVer(node, variant, opts = {}) {
  const { keepId = false, strip = [] } = opts;
  const walk = (n) => {
    if (Array.isArray(n)) return n.map(walk).filter((x) => x !== null);
    if (!n || typeof n !== 'object') return n;
    if (typeof n?.ver === 'string' && n.ver !== 'all') {
      if (n.ver !== variant) return null; // 该块/项不属于目标变体
    }
    const out = {};
    for (const [k, v] of Object.entries(n)) {
      if (k === 'ver') continue;
      if (!keepId && k === 'id') continue; // 冻结码：画布/纯形态不需要
      if (strip.includes(k)) continue; // 追加剥除（项目专用键）
      const m = k.match(/^(.*)@([a-z][a-z0-9_]*)$/);
      if (m) {
        if (m[2] !== variant) continue; // 非目标变体专属字段丢弃
        out[m[1]] = walk(v); // 覆盖裸键
      } else {
        out[k] = walk(v);
      }
    }
    return out;
  };
  return walk(node);
}

/** 目标变体缺省值：已声明的第一个变体；未声明返回 null（无变体空间）。 */
export function defaultVariantOf(spec) {
  return Array.isArray(spec?.variants) && spec.variants.length ? spec.variants[0] : null;
}
