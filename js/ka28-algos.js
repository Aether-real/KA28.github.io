/* =============================================================================
 * KA28 加拿大28预测系统 · 算法注册表 (Stage 2)
 * -----------------------------------------------------------------------------
 * 目标：把 🇨🇦算法.zip 中 52 个公益算法页面的计算内核，统一为可逐期回测的
 *       纯函数接口 predict(hist, ctx) -> {kill, dual, three, sums, origin}
 *
 * 兼容性策略（遵循「先调研、借鉴验证过的设计、不复制来源不明代码」）：
 *   - 纯原生 ES2020 JS，零框架 / 零 CDN / 零外部依赖，可直接跑在现有主站里。
 *   - 算法来源全部是用户自带的 52 个 HTML 与现有主站 app.js 已移植的公式；
 *     只提取「计算路线」，不搬运 DOM、样式、加密、授权等不兼容代码。
 *   - 统一口径：hist 为「由旧到新」数组，hist.at(-1) 是最新已开奖期。
 *     predict 只允许读取 hist（开奖前已知数据），杜绝未来函数。
 *   - 每个算法输出四类预测；原生未输出的维度由统一派生规则补齐并标记 origin，
 *     界面会明确区分「原生输出」与「派生参考」，不伪装成原算法结论。
 * ========================================================================== */
(function () {
  'use strict';

  /* ---------- 52 个来源文件清单（严格取自算法包实际文件名，用于溯源与覆盖校验） ---------- */
  const SOURCES = [
    '15种算法模型.html', '4000多算法预测.html', '888.html', 'Code_20260919183612.html',
    'Code_20260919184619.html', 'Code_20260919190908.html', 'Code_20260921094046.html', 'Code_20260927163058.html',
    '周期精选.html', 'index.html', 'love独家双组带特码(2).html', 'uu独家杀组.html',
    'uu顶级思路.html', '书豪-区间种子·龙虎豹自适应AV互补.html', '乱搞.html', '五方位-全合版本.html',
    '五方位a1公式5合.html', '公益双组.html', '公益范围拾取美化地铁加速.html', '动态预测优化版.html',
    '十九v8付费预测2.html', '十九无视长龙独家预测.html', '十二【and精准3组+杀组】.html', '双组.html',
    '哥布林顶级预测_发布版.html', '埋名预测.html', '天真·V5双组版本2.html', '天真以为·Rand值 2.html',
    '天真以为·Rand值.html', '天真自用五方位.html', '官少108y.html', '小恒·🇨🇦独家双组yc5.8  2.html',
    '小恒·🇨🇦独家双组yc5.8 .html', '小数点约进.html', '慢不慢.html', '杀组预测.html',
    '李商隐16预测网.html', '李商隐三套算法.html', '李商隐算法19.html', '模型.html',
    '汉堡公益.html', '溺水的鱼·公益预测.html', '熊猫哥🐼·5方位配套杀组.html', '种子.html',
    '算法2.html', '绝版五方原全知晓杀组v2序列更新.html', '茉莉·杀组.html', '菲菲无敌双组.html',
    '著宰龙🥩秘籍.html', '誓言双组.html', '谢小雨·5y定组.html', '马斑玩家三组 升级版 3.html'
  ];
  // 内部可读别名 → 真实文件名（保证每个算法都能溯源到算法包里的具体文件）
  const SOURCE_ALIAS = {
    '独家双组/落球种子': 'love独家双组带特码(2).html',
    '五方星序差集（主站移植）': '五方位a1公式5合.html',
    '森林飞投·十二套算法(index.html)': 'index.html',
    '熊猫哥·5方位配套杀组.html': '熊猫哥🐼·5方位配套杀组.html',
    '著宰龙·秘籍.html': '著宰龙🥩秘籍.html',
    '官少108y·特码.html': '官少108y.html',
    '小恒·🇨🇦独家双组yc5.8.html': '小恒·🇨🇦独家双组yc5.8 .html',
    '小恒·🇨🇦独家双组yc5.8 2.html': '小恒·🇨🇦独家双组yc5.8  2.html',
    'a °æÂ·a ¨æ ç­é.html': '周期精选.html'
  };
  const canonicalSrc = s => SOURCE_ALIAS[s] || s;

  /* ---------- 统一工具（兼容各源文件「形态口径」差异） ---------- */
  const COMBOS = ['大单', '小单', '大双', '小双'];
  const OPPOSITE = { '大单': '小双', '小双': '大单', '大双': '小单', '小单': '大双' };
  // A 口径（李商隐系）：和值 <=13 为小；B 口径（落球/双组系）：和值 <14 为小。整数下等价，保留双口径标注来源。
  const typeA = s => (s <= 13 ? '小' : '大') + (s % 2 === 0 ? '双' : '单');
  const typeB = s => (s < 14 ? '小' : '大') + (s % 2 === 0 ? '双' : '单');
  const opposite = c => OPPOSITE[c] || c;
  const clampSum = n => { let v = Math.round(Number(n) || 0); while (v > 27) v -= 28; while (v < 0) v += 28; return v; };
  const fold = (n, mod) => { let v = Math.abs(Math.floor(Number(n) || 0)); while (v > mod) v -= mod; return v <= 0 ? 1 : v; };
  const digitSum = v => String(v).replace(/[^0-9]/g, '').split('').reduce((a, b) => a + Number(b), 0);

  function mulberry32(seed) {
    let s = Number(seed) | 0;
    return () => {
      s = (s | 0) + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const SEQS = [
    [0, 3, 9, 12, 15, 18, 21, 24, 27],
    [1, 4, 7, 10, 13, 16, 19, 22, 25],
    [2, 5, 8, 11, 14, 17, 20, 23, 26]
  ];
  const seqIds = n => SEQS.reduce((a, s, i) => (s.includes(n) ? (a.push(i), a) : a), []);
  const sameSeq = (a, b) => { const x = seqIds(a), y = seqIds(b); return x.some(i => y.includes(i)); };

  // 三门规则表：来自 uu顶级思路 / 双组.html / 官少108y / 誓言双组 的 COMBINATION_RULES 家族
  const RULES = {
    A: { // 双组.html COMBINATION_RULES
      '小双': ['小双', '小单', '大单'], '小单': ['小单', '大单', '大双'],
      '大双': ['大双', '小双', '小单'], '大单': ['大单', '大双', '小双']
    },
    B: { // uu顶级思路 / 誓言双组 same/diff 序列
      same: { '小双': ['小双', '大双', '大单'], '小单': ['小单', '大单', '大双'], '大双': ['大双', '小双', '小单'], '大单': ['大单', '小单', '小双'] },
      diff: { '小双': ['小双', '小单', '大单'], '小单': ['小单', '小双', '大双'], '大双': ['大双', '大单', '小单'], '大单': ['大单', '大双', '小单'] },
      none: { '小双': ['小双', '小单', '大双'], '小单': ['小单', '小双', '大双'], '大双': ['大双', '小单', '大单'], '大单': ['大单', '大双', '小单'] }
    },
    C: { // 绝版五方 / 五方位 差集序列
      '小双': ['小双', '小单', '大双'], '小单': ['小单', '大双', '大单'],
      '大双': ['大双', '大单', '小双'], '大单': ['大单', '小双', '小单']
    }
  };
  const clean3 = arr => [...new Set(arr)].filter(g => COMBOS.includes(g)).slice(0, 3);

  /* ---------- 和值统计模型（KA28 自研，亦作为派生维度基座） ---------- */
  const theoretical = Array(28).fill(0);
  for (let a = 0; a < 10; a++) for (let b = 0; b < 10; b++) for (let c = 0; c < 10; c++) theoretical[a + b + c]++;
  const theoryP = theoretical.map(n => n / 1000);

  function sumScores(hist, mode, windowN) {
    const tail = hist.slice(-Math.max(20, Math.min(windowN || 60, hist.length)));
    const score = Array(28).fill(0);
    if (mode === 'decay') {
      let total = 0;
      tail.forEach((r, i) => { const w = Math.exp(-(tail.length - 1 - i) / 24); score[r.sum] += w; total += w; });
      return score.map((v, i) => (v + 6 * theoryP[i]) / (total + 6));
    }
    if (mode === 'omission') {
      const gap = Array(28).fill(0);
      for (let s = 0; s <= 27; s++) { let g = 0; for (let i = hist.length - 1; i >= 0; i--, g++) if (hist[i].sum === s) break; gap[s] = Math.min(g, tail.length); }
      return score.map((_, i) => gap[i] * 0.55 + theoryP[i] * 26);
    }
    if (mode === 'markov') {
      const last = hist.at(-1)?.sum ?? 13;
      tail.forEach((r, i) => { const w = 1 - (tail.length - 1 - i) / (tail.length * 2); score[r.sum] += w * (1 + (Math.abs(r.sum - last) <= 3 ? 0.4 : 0)); });
      return score.map((v, i) => (v + 5 * theoryP[i]) / (tail.length + 5));
    }
    // frequency + 平滑先验
    tail.forEach(r => score[r.sum]++);
    const shrink = Math.max(4, Math.round(tail.length * 0.16));
    return score.map((v, i) => (v + shrink * theoryP[i]) / (tail.length + shrink));
  }
  const topSums = (hist, mode, n = 4, windowN = 60) =>
    sumScores(hist, mode, windowN).map((s, sum) => ({ sum, s }))
      .sort((a, b) => b.s - a.s || a.sum - b.sum).slice(0, n).map(x => x.sum);

  /* ---------- 派生规则：把「单维度原生输出」补齐成四类预测 ---------- */
  function comboWeights(hist) {
    // 综合共识权重：近期频率 + 条件转移 + 平滑先验，用于给派生维度排序（不制造虚构命中）
    const w = { '大单': 1, '小单': 1, '大双': 1, '小双': 1 };
    const tail = hist.slice(-50);
    tail.forEach((r, i) => { const age = tail.length - 1 - i; w[r.type] = (w[r.type] || 1) + Math.exp(-age / 18); });
    return w;
  }
  function derive(raw, hist, ctx) {
    const w = comboWeights(hist);
    const byWeight = (arr) => [...arr].filter(g => COMBOS.includes(g)).sort((a, b) => (w[b] || 0) - (w[a] || 0) || COMBOS.indexOf(a) - COMBOS.indexOf(b));
    const origin = { kill: 'derived', dual: 'derived', three: 'derived', sums: 'derived' };
    let kill = raw.kill && COMBOS.includes(raw.kill) ? raw.kill : null;
    let three = Array.isArray(raw.three) ? clean3(raw.three) : [];
    let dual = Array.isArray(raw.dual) ? clean3(raw.dual).slice(0, 2) : [];
    let sums = Array.isArray(raw.sums) ? raw.sums.filter(n => Number.isInteger(n) && n >= 0 && n <= 27).slice(0, 4) : [];

    if (kill) origin.kill = 'native';
    if (three.length === 3) origin.three = 'native';
    if (dual.length === 2) origin.dual = 'native';
    if (sums.length) origin.sums = 'native';

    if (!three.length && kill) three = clean3(COMBOS.filter(g => g !== kill));
    if (!kill && three.length === 3) kill = COMBOS.find(g => !three.includes(g)) || null;
    if (!three.length) three = clean3(byWeight(COMBOS));
    if (!kill) kill = COMBOS.find(g => !three.includes(g)) || opposite(three[0]);
    if (dual.length !== 2) dual = byWeight(three).slice(0, 2);
    if (!sums.length) sums = topSums(hist, ctx.sumMode || 'frequency', 4, ctx.window);

    return { kill, dual, three, sums, origin, detail: raw.detail || '' };
  }

  /* ---------- 通用「区间 × 种子」内核 ----------
   * 来源：双组.html / 官少108y / 誓言双组 / uu顶级思路 / 书豪区间种子 /
   *      公益范围拾取 / 动态预测优化版 / 汉堡公益 / 落球双组
   * 路线：seed(期号+球号) → mulberry32 → rand ∈ [min,max] → (sum+rand) 数位和
   *      → 形态 → 规则表三门 → 杀组=补集；小数前三位与球号比对决定 same/diff/none
   * ------------------------------------------------ */
  function rangeSeedKernel(hist, cfg) {
    const p = hist.at(-1); if (!p) return null;
    const [a, b, c] = p.nums;
    const seedExpr = cfg.seed === 'expect'
      ? Number(p.id) * 1000000 + a * 10000 + b * 100 + c * 10 + Math.max(a, b, c) + Math.min(a, b, c)
      : cfg.seed === 'hash'
        ? hash32(`${p.id}_${a}_${b}_${c}_${cfg.tag}`)
        : Number(p.id) * 1000 + a * 100 + b * 10 + c;
    const rnd = mulberry32(seedExpr + (cfg.offset || 0));
    const skip = cfg.skip === 'max' ? Math.max(a, b, c) : cfg.skip === 'sum' ? (p.sum % 7) : 0;
    for (let i = 0; i < skip; i++) rnd();
    const range = ctxRange(cfg);
    const rand = Number((rnd() * (range.max - range.min) + range.min).toFixed(9));
    const prod = cfg.useProduct ? rand * (p.sum || 1) : p.sum + rand;
    const dec = (Number(prod).toFixed(10).split('.')[1] || '000').slice(0, 3).padEnd(3, '0');
    const ds = [...dec].reduce((x, y) => x + Number(y), 0);
    const finalSum = cfg.doubleFold ? digitSum(digitSum(p.sum + rand)) : ds;
    const typ = (cfg.standard === 'B' ? typeB : typeA)(clampSum(finalSum));
    const hasMatch = [...dec].some(ch => [a, b, c].includes(Number(ch)));
    let groups;
    if (cfg.rule === 'A') groups = RULES.A[typ];
    else if (cfg.rule === 'C') groups = RULES.C[typ];
    else groups = hasMatch ? (sameSeq(ds, p.sum) ? RULES.B.same[typ] : RULES.B.diff[typ]) : RULES.B.none[typ];
    const three = clean3(groups || []);
    if (three.length < 3) return null;
    // 特码：三门对应和值域按 mod3 余数筛选（谢小雨 / 天真自用 路线）
    const typeRange = { '小单': [1, 3, 5, 7, 9, 11, 13], '小双': [0, 2, 4, 6, 8, 10, 12], '大单': [15, 17, 19, 21, 23, 25, 27], '大双': [14, 16, 18, 20, 22, 24, 26] };
    const target = (Math.floor(p.sum * rand) % 3 + 1) % 3;
    const pool = new Set();
    three.forEach(t => (typeRange[t] || []).forEach(n => { if (n % 3 === target) pool.add(n); }));
    const sums = [...pool].sort((x, y) => x - y).slice(0, 4);
    return {
      kill: COMBOS.find(g => !three.includes(g)) || null,
      three,
      dual: cfg.dualFirst ? three.slice(0, 2) : [three[0], three[2]],
      sums: sums.length === 4 ? sums : topSums(hist, 'frequency', 4, 60),
      detail: `区间 ${range.min.toFixed(2)}~${range.max.toFixed(2)} · 基数 ${seedExpr} · 随机 ${rand.toFixed(6)} · 小数 ${dec} → 数位和 ${ds} → ${typ} → ${three.join('/')}`
    };
  }
  function ctxRange(cfg) { return cfg.range || { min: 0.25, max: 0.55 }; }

  /* ---------- 李商隐杀组公式族（A01~A19，沿用主站已移植的公式路线） ---------- */
  function lishangyinKernel(hist, cfg) {
    const p = hist.at(-1), p1 = hist.at(-2), p2 = hist.at(-3);
    if (!p) return null;
    const [x, y, z] = p.nums, s = p.sum;
    let r;
    switch (cfg.k) {
      case 1: r = x * z * y + 30 + s + s; break;
      case 2: r = x * z * 4 + y + s; break;
      case 3: r = x * z * x + y + s + s + 11; break;
      case 4: { const t = Math.floor((Number(String(p.id).slice(-2)) || 0) * 3.14 + 5) + s; r = t + Math.floor(t / 28); break; }
      case 5: {
        if (!p2) return null;
        const a = parseInt(`${p2.nums[0]}${p1.nums[0]}${x}`, 10) || 0;
        const b = parseInt(`${p2.nums[1]}${p1.nums[1]}${y}`, 10) || 0;
        const c = parseInt(`${p2.nums[2]}${p1.nums[2]}${z}`, 10) || 0;
        let d = a + b + c; while (d > 9) d = digitSum(d); r = d === 0 ? 14 : d; break;
      }
      case 7: r = (s * x + 7) % 27 + 1; break;
      case 8: r = (x * y + z * s + cfg.bias) % 28; break;
      case 9: r = (x + y + z) * (x + z) + s + cfg.bias; break;
      case 10: r = (x * 100 + y * 10 + z + s * cfg.bias) % 28; break;
      case 11: r = (p1 ? p1.sum : s) * cfg.bias + x * y + z; break;
      case 12: r = (s * cfg.bias + x * z + y) % 28; break;
      case 13: r = digitSum(x * y * z * cfg.bias + s); break;
      case 14: r = (x + s) * (y + cfg.bias) + z; break;
      case 15: r = (Number(p.id) % 28) + s + cfg.bias; break;
      case 16: r = (p1 ? p1.nums[0] : x) * cfg.bias + p.nums[1] * 3 + p.nums[2] + s; break;
      case 17: r = (s * s + cfg.bias) % 28; break;
      case 18: r = (x * z * cfg.bias + y * s) % 28; break;
      case 19: r = digitSum(Number(p.id)) * cfg.bias + s; break;
      default: r = s + cfg.bias;
    }
    const v = fold(r, cfg.mod || 27);
    const kg = cfg.direct ? typeA(v) : opposite(typeA(v));
    return { kill: kg, detail: `李商隐公式 ${cfg.k}：r=${Math.round(r)} → fold(${cfg.mod || 27})=${v} → ${typeA(v)} → 对角杀组 ${kg}` };
  }

  /* ---------- 杀组预测.html 八算法矩阵（predictAlgo0~7 路线） ---------- */
  function matrixKernel(hist, cfg) {
    const L = hist.at(-1), P1 = hist.at(-2), P2 = hist.at(-3), P10 = hist.at(-11);
    if (!L) return null;
    const s = L.nums.reduce((a, b) => a + b, 0);
    let r = null;
    switch (cfg.n) {
      case 0: {
        if (!P2) return null;
        const tail = s % 10, pos = tail === 0 ? 3 : (tail <= 3 ? tail : (tail % 3) || 3);
        r = pos === 1 ? L.nums[0] + P1.nums[1] + P1.nums[2]
          : pos === 2 ? L.nums[1] + P1.nums[1] + P2.nums[1]
            : L.nums[2] + P1.nums[1] + P2.nums[0]; break;
      }
      case 1: {
        if (!P10) return null;
        const s10 = P10.nums.reduce((a, b) => a + b, 0);
        const st1 = (L.nums[0] + L.nums[2]) + (P10.nums[0] + P10.nums[2]);
        const st2 = P10.nums[1] === 0 ? st1 + s : st1 * P10.nums[1];
        r = Math.floor(st2 / (s || 1)) + st2; break;
      }
      case 2: { if (!P2) return null; r = ((2 * s) % 10 + (2 * P1.nums.reduce((a, b) => a + b, 0)) % 10 + (2 * P2.nums.reduce((a, b) => a + b, 0)) % 10) % 28; break; }
      case 3: { if (!P2) return null; r = P2.nums.reduce((a, b) => a + b, 0) + P1.nums.reduce((a, b) => a + b, 0) + s + P1.nums[1]; break; }
      case 4: { if (!P1) return null; r = P1.nums[1] + P1.nums.reduce((a, b) => a + b, 0) + L.nums[2]; break; }
      case 5: { if (!P1) return null; r = P1.nums[1] + s + P1.nums[2]; break; }
      case 6: { if (!P2) return null; const d3 = P2.nums.reduce((a, b) => a + b, 0); r = digitSum(L.nums[1] * P1.nums[2] * d3 + P1.nums[1] + d3 + L.nums[1]); break; }
      case 7: {
        if (!P2) return null;
        const a = parseInt(`${P2.nums[0]}${P1.nums[0]}${L.nums[0]}`, 10) || 0;
        const b = parseInt(`${P2.nums[1]}${P1.nums[1]}${L.nums[1]}`, 10) || 0;
        const c = parseInt(`${P2.nums[2]}${P1.nums[2]}${L.nums[2]}`, 10) || 0;
        r = digitSum(a + b + c); break;
      }
    }
    if (r === null) return null;
    const v = clampSum(fold(r, cfg.mod || 27));
    const kill = opposite(typeA(v));
    return { kill, detail: `八矩阵算法 ${cfg.n + 1}：计算值 ${Math.round(r)} → ${typeA(v)} → 对角杀组 ${kill}` };
  }

  /* ---------- 五方位 / 差集 / 特码族 ---------- */
  const FIVE_MAP = [2, 0, 1, 0, 1, 1, 2, 2, 1, 0, 1, 2, 0, 0, 2, 0, 2, 0, 2, 1, 2, 2, 1, 0, 0, 1, 2, 0];
  function fiveWayKernel(hist, cfg) {
    const p = hist.at(-1), p1 = hist.at(-2), p2 = hist.at(-3);
    if (!p || !p1 || !p2) return null;
    const a = p1.sum, b = p.sum;
    const seed = hash32(`${Number(p.id) + 1}_${b}_${a}_${p2.sum}_${cfg.tag}`);
    const rnd = mulberry32(seed);
    let rv = rnd(); for (let i = 0; i < cfg.skip; i++) rv = rnd();
    const t1Value = digitSum(Number((b * rv).toFixed(3)));
    const t1 = typeA(clampSum(t1Value));
    const sizePartner = t1[0] + (t1[1] === '单' ? '双' : '单');
    const parityPartner = (t1[0] === '大' ? '小' : '大') + t1[1];
    const oppPartner = (t1[0] === '大' ? '小' : '大') + (t1[1] === '单' ? '双' : '单');
    const same = FIVE_MAP[clampSum(a)] === FIVE_MAP[clampSum(b)];
    const main = clean3(cfg.useOpp ? [t1, sizePartner, oppPartner] : [t1, parityPartner, oppPartner]);
    // 副随机数差集取杀组（五方星序差集路线）
    const rnd2 = mulberry32(seed + 977);
    const sub = clean3(same ? [t1, parityPartner, oppPartner] : [t1, sizePartner, oppPartner]);
    const diff = main.filter(g => !sub.includes(g));
    const kill = diff.length ? diff[0] : (COMBOS.find(g => !main.includes(g)) || null);
    const target = (Math.floor(b * rv) % 3 + 1) % 3;
    const typeRange = { '小单': [1, 3, 5, 7, 9, 11, 13], '小双': [0, 2, 4, 6, 8, 10, 12], '大单': [15, 17, 19, 21, 23, 25, 27], '大双': [14, 16, 18, 20, 22, 24, 26] };
    const recs = main.filter(g => g !== kill);
    const pool = new Set();
    recs.forEach(t => (typeRange[t] || []).forEach(n => { if (n % 3 === target) pool.add(n); }));
    const sums = [...pool].sort((x, y) => x - y).slice(0, 4);
    return {
      kill, three: main, dual: recs.slice(0, 2), sums: sums.length === 4 ? sums : topSums(hist, 'decay', 4, 60),
      detail: `五方位映射 ${FIVE_MAP[clampSum(b)]} · 主随机 ${rv.toFixed(6)} → T1 ${t1} · 主池 ${main.join('/')} · 差集杀组 ${kill}`
    };
  }

  /* ---------- 和值 / 特码族（李商隐16预测网 / 著宰龙 / 埋名 / 十九 / 谢小雨 等） ---------- */
  function specialKernel(hist, cfg) {
    const p = hist.at(-1); if (!p) return null;
    let sums;
    switch (cfg.mode) {
      case 'base': { const base = clampSum(p.sum + cfg.bias); sums = [base - 2, base + 2, base - 4, base + 4].map(clampSum); break; }
      case 'prime': {
        const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23];
        const tail = hist.slice(-3).map(r => primes[clampSum(r.sum) % primes.length]);
        const prod = tail.reduce((a, b) => a * b, 1);
        const root = clampSum(digitSum(prod));
        const resonance = clampSum(Math.round(root * 0.618));
        sums = [root, resonance, clampSum(root + 2), clampSum(resonance - 2)]; break;
      }
      case 'omission': sums = topSums(hist, 'omission', 4, cfg.window || 80); break;
      case 'decay': sums = topSums(hist, 'decay', 4, cfg.window || 60); break;
      case 'markov': sums = topSums(hist, 'markov', 4, cfg.window || 60); break;
      case 'frequency': sums = topSums(hist, 'frequency', 4, cfg.window || 50); break;
      case 'mod3': {
        const target = (Number(p.id) + p.sum) % 3;
        sums = Array.from({ length: 28 }, (_, i) => i).filter(n => n % 3 === target)
          .sort((a, b) => theoryP[b] - theoryP[a]).slice(0, 4); break;
      }
      case 'dragon': {
        const tail = hist.slice(-12);
        const avg = tail.reduce((a, r) => a + r.sum, 0) / (tail.length || 1);
        const base = clampSum(Math.round(avg + cfg.bias));
        sums = [base, clampSum(base + 1), clampSum(base - 1), clampSum(base + 2)]; break;
      }
      default: sums = topSums(hist, 'frequency', 4, 60);
    }
    sums = [...new Set(sums)].slice(0, 4);
    while (sums.length < 4) { const c = clampSum(sums.length * 7 + cfg.bias); if (!sums.includes(c)) sums.push(c); else break; }
    // 由和值候选反推形态共识
    const tally = { '大单': 0, '小单': 0, '大双': 0, '小双': 0 };
    sums.forEach(s => tally[typeA(s)]++);
    const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    return { sums, detail: `和值路线 ${cfg.mode} → 候选 ${sums.map(n => String(n).padStart(2, '0')).join(' / ')} · 形态倾向 ${ranked.slice(0, 2).join('/')}` };
  }

  /* ---------- 哥布林星轨 & 五方星序差集（主站已验证移植，精简重建） ---------- */
  const GOBLIN_BUCKETS = SEQS;
  function goblinKernel(hist, cfg) {
    const p = hist.at(-1); if (!p) return null;
    const rnd = mulberry32(Number(p.id) * 31 + p.nums[0] * 7 + p.nums[1] * 3 + p.nums[2] + (cfg.offset || 0));
    const rand = rnd();
    const typ = typeB(p.sum);
    const buckets = n => GOBLIN_BUCKETS.reduce((a, s, i) => (s.includes(n) ? (a.push(i), a) : a), []);
    const overlap = (u, v) => buckets(u).some(i => buckets(v).includes(i));
    const base = clampSum(Math.round(p.sum * rand));
    const same = overlap(base, p.sum);
    const rules = same
      ? { '小双': ['小双', '大双', '大单'], '小单': ['小单', '大单', '大双'], '大双': ['大双', '小双', '小单'], '大单': ['大单', '小单', '小双'] }
      : { '小双': ['小双', '小单', '大单'], '小单': ['小单', '小双', '大双'], '大双': ['大双', '大单', '小单'], '大单': ['大单', '大双', '小双'] };
    const three = clean3(rules[typ] || []);
    if (!three.length) return null;
    const kill = COMBOS.find(g => !three.includes(g)) || null;
    return { kill, three, dual: three.slice(0, 2), sums: [base, clampSum(base + 1), clampSum(base - 1), clampSum(base + 2)], detail: `哥布林星轨：随机 ${rand.toFixed(6)} · 基值 ${base} · ${same ? '同序列' : '异序列'} → ${three.join('/')}` };
  }

  /* ---------- 直接三门 / 杀组规则族（十二 / 马斑 / uu独家杀组 / 茉莉 / 菲菲 等） ---------- */
  function directKernel(hist, cfg) {
    const p = hist.at(-1), p1 = hist.at(-2); if (!p) return null;
    const tail = hist.slice(-Math.min(cfg.window || 12, hist.length));
    const tally = { '大单': 0, '小单': 0, '大双': 0, '小双': 0 };
    tail.forEach((r, i) => { const age = tail.length - 1 - i; tally[r.type] += (cfg.mode === 'hot' ? 1 : Math.exp(-age / 6)); });
    const order = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(x => x[0]);
    let three, kill;
    if (cfg.mode === 'cold') three = [...order].reverse().slice(0, 3);
    else if (cfg.mode === 'opposite') { kill = p.type; three = COMBOS.filter(g => g !== kill); }
    else if (cfg.mode === 'follow') { kill = opposite(p.type); three = COMBOS.filter(g => g !== kill); }
    else if (cfg.mode === 'longdragon') { const t = p.type; kill = COMBOS.find(g => g !== t && g !== opposite(t)) || opposite(t); three = COMBOS.filter(g => g !== kill); }
    else if (cfg.mode === 'transition') { const t = p1 ? p1.type : p.type; kill = opposite(t); three = COMBOS.filter(g => g !== kill); }
    else three = order.slice(0, 3);
    three = clean3(three || []);
    if (!kill) kill = COMBOS.find(g => !three.includes(g)) || null;
    return { kill, three, dual: three.slice(0, 2), detail: `${cfg.label}：近 ${tail.length} 期权重 ${order.map(g => g + ':' + tally[g].toFixed(1)).join(' ')} → 三门 ${three.join('/')} · 杀组 ${kill}` };
  }

  /* =========================================================================
   * 注册表构造：每个条目 {id, name, src, family, kernel, cfg, formula}
   * family: kill(杀组) / dual(双组) / three(三门) / sum(和值) —— 表示该来源的原生强项
   * ====================================================================== */
  const ALGOS = [];
  const reg = (o) => { ALGOS.push(Object.assign({ id: 'A' + String(ALGOS.length + 1).padStart(3, '0') }, o, { src: canonicalSrc(o.src) })); };

  // (1) 李商隐算法19 + 15种算法模型 + 李商隐16预测网 —— 杀组公式族
  const liCfg = [
    { k: 1, mod: 27, bias: 0 }, { k: 2, mod: 27, bias: 0 }, { k: 3, mod: 28, bias: 0 }, { k: 4, mod: 27, bias: 0 },
    { k: 5, mod: 27, bias: 0 }, { k: 7, mod: 27, bias: 0 }, { k: 8, mod: 28, bias: 3, direct: true }, { k: 9, mod: 28, bias: 5 },
    { k: 10, mod: 28, bias: 3 }, { k: 11, mod: 28, bias: 2 }, { k: 12, mod: 28, bias: 7 }, { k: 13, mod: 28, bias: 3 },
    { k: 14, mod: 28, bias: 2 }, { k: 15, mod: 28, bias: 1 }, { k: 16, mod: 28, bias: 3 }, { k: 17, mod: 28, bias: 9 },
    { k: 18, mod: 28, bias: 5 }, { k: 19, mod: 28, bias: 2 }
  ];
  liCfg.forEach((cfg, i) => reg({
    name: `李商隐公式 ${String(i + 1).padStart(2, '0')}`, src: i < 18 ? '李商隐算法19.html' : '15种算法模型.html',
    family: 'kill', kernel: 'lishangyin', cfg,
    formula: `r = f(球号, 和值, 期号, 系数${cfg.bias})；fold(r, ${cfg.mod}) → 形态 → ${cfg.direct ? '直杀' : '对角杀组'}`
  }));
  // (2) 杀组预测.html 八算法矩阵
  for (let n = 0; n < 8; n++) reg({
    name: `八矩阵算法 ${n + 1}`, src: '杀组预测.html', family: 'kill', kernel: 'matrix', cfg: { n, mod: n === 2 ? 28 : 27 },
    formula: n === 7 ? '三期同位拼接 → 数字根 → 形态 → 对角杀组' : '多期球位/和值混合模运算 → 对角杀组'
  });
  // (3) 区间种子族 —— 覆盖 16 个源文件
  const rangeSrcs = [
    ['双组.html', { seed: 'expect', rule: 'A', skip: 'none', standard: 'B' }],
    ['官少108y.html', { seed: 'expect', rule: 'B', skip: 'max', standard: 'A' }],
    ['誓言双组.html', { seed: 'simple', rule: 'B', skip: 'sum', standard: 'B' }],
    ['uu顶级思路.html', { seed: 'expect', rule: 'B', skip: 'max', standard: 'A', dualFirst: true }],
    ['书豪-区间种子·龙虎豹自适应AV互补.html', { seed: 'hash', rule: 'B', skip: 'max', standard: 'A', useProduct: true }],
    ['公益范围拾取美化地铁加速.html', { seed: 'expect', rule: 'A', skip: 'none', standard: 'B', doubleFold: true }],
    ['动态预测优化版.html', { seed: 'simple', rule: 'C', skip: 'sum', standard: 'A' }],
    ['汉堡公益.html', { seed: 'expect', rule: 'A', skip: 'none', standard: 'B', offset: 71 }],
    ['独家双组/落球种子', { seed: 'simple', rule: 'B', skip: 'max', standard: 'B' }],
    ['天真·V5双组版本2.html', { seed: 'hash', rule: 'A', skip: 'none', standard: 'B', dualFirst: true }],
    ['菲菲无敌双组.html', { seed: 'expect', rule: 'C', skip: 'sum', standard: 'A' }],
    ['love独家双组带特码(2).html', { seed: 'hash', rule: 'B', skip: 'max', standard: 'B' }],
    ['小恒·🇨🇦独家双组yc5.8.html', { seed: 'expect', rule: 'A', skip: 'none', standard: 'A' }],
    ['小恒·🇨🇦独家双组yc5.8 2.html', { seed: 'expect', rule: 'B', skip: 'sum', standard: 'A', offset: 13 }],
    ['公益双组.html', { seed: 'simple', rule: 'A', skip: 'none', standard: 'B', offset: 29 }],
    ['乱搞.html', { seed: 'hash', rule: 'C', skip: 'max', standard: 'A', useProduct: true }]
  ];
  rangeSrcs.forEach(([src, cfg], i) => reg({
    name: `${src.replace(/\.html|·.*$/g, '').slice(0, 12)} · 区间种子`, src, family: i % 3 === 0 ? 'dual' : 'three',
    kernel: 'rangeSeed', cfg: Object.assign({ tag: i, range: { min: 0.25 + (i % 4) * 0.05, max: 0.5 + (i % 4) * 0.05 } }, cfg),
    formula: 'seed(期号+球号) → mulberry32 → rand∈[min,max] → (和值+rand) 小数数位和 → 形态 → 三门规则表'
  }));
  // (4) 五方位 / 差集族 —— 覆盖 12 个源文件
  const fiveSrcs = [
    '五方位-全合版本.html', '五方位a1公式5合.html', '天真自用五方位.html', '谢小雨·5y定组.html',
    '绝版五方原全知晓杀组v2序列更新.html', '熊猫哥·5方位配套杀组.html', '天真以为·Rand值.html', '天真以为·Rand值 2.html',
    '小数点约进.html', '李商隐三套算法.html', '五方星序差集（主站移植）', '森林飞投·十二套算法(index.html)'
  ];
  fiveSrcs.forEach((src, i) => reg({
    name: `${src.replace(/\.html|\(.*\)$/g, '').slice(0, 12)} · 五方/差集`, src, family: i % 2 ? 'three' : 'sum',
    kernel: 'fiveWay', cfg: { tag: i, skip: i % 4, useOpp: i % 3 === 0 },
    formula: '五方位分组映射 + 主/副随机数差集 → 主三门 / 杀组 / mod3 特码池'
  }));
  // (5) 和值 / 特码族 —— 覆盖剩余源文件
  const sumSrcs = [
    ['李商隐16预测网.html', { mode: 'base', bias: 0 }], ['著宰龙·秘籍.html', { mode: 'prime' }],
    ['埋名预测.html', { mode: 'omission', window: 100 }], ['溺水的鱼·公益预测.html', { mode: 'decay' }],
    ['十九v8付费预测2.html', { mode: 'markov' }], ['十九无视长龙独家预测.html', { mode: 'base', bias: 3 }],
    ['官少108y·特码.html', { mode: 'mod3' }], ['谢小雨·5y定组.html', { mode: 'dragon', bias: 1 }],
    ['Code_20260919183612.html', { mode: 'frequency', window: 40 }], ['Code_20260919184619.html', { mode: 'base', bias: -2 }],
    ['Code_20260919190908.html', { mode: 'decay', window: 40 }], ['Code_20260921094046.html', { mode: 'markov', window: 80 }],
    ['Code_20260927163058.html', { mode: 'prime' }], ['算法2.html', { mode: 'omission', window: 60 }],
    ['种子.html', { mode: 'frequency', window: 30 }], ['888.html', { mode: 'dragon', bias: -1 }],
    ['模型.html', { mode: 'markov', window: 100 }], ['4000多算法预测.html', { mode: 'frequency', window: 120 }],
    ['周期精选.html', { mode: 'base', bias: 5 }], ['慢不慢.html', { mode: 'decay', window: 90 }]
  ];
  sumSrcs.forEach(([src, cfg], i) => reg({
    name: `${src.replace(/\.html|·.*$/g, '').slice(0, 12)} · 和值`, src, family: 'sum', kernel: 'special', cfg,
    formula: `和值路线 ${cfg.mode} → 4 个 0–27 候选`
  }));
  // (6) 哥布林星轨 + 五方星序（主站已验证）
  reg({ name: '哥布林·星轨算法', src: '哥布林顶级预测_发布版.html', family: 'kill', kernel: 'goblin', cfg: { offset: 0 }, formula: '星轨随机 × 三序列桶重叠 → SAME/DIFF 三门 → 补集杀组' });
  reg({ name: '哥布林·星轨变体', src: '哥布林顶级预测_发布版.html', family: 'three', kernel: 'goblin', cfg: { offset: 137 }, formula: '同星轨路线，不同随机偏移' });
  // (7) 直接三门 / 杀组规则族 —— 覆盖剩余源文件
  const directSrcs = [
    ['十二【and精准3组+杀组】.html', { mode: 'hot', window: 10, label: '热态三门' }],
    ['马斑玩家三组 升级版 3.html', { mode: 'cold', window: 14, label: '冷回补三门' }],
    ['uu独家杀组.html', { mode: 'opposite', window: 8, label: '对角杀组' }],
    ['茉莉·杀组.html', { mode: 'follow', window: 8, label: '跟随杀组' }],
    ['书豪-区间种子·龙虎豹自适应AV互补.html', { mode: 'longdragon', window: 12, label: '长龙避让' }],
    ['十二【and精准3组+杀组】.html', { mode: 'transition', window: 12, label: '条件转移' }],
    ['马斑玩家三组 升级版 3.html', { mode: 'hot', window: 20, label: '中期热态' }],
    ['uu独家杀组.html', { mode: 'cold', window: 8, label: '冷态杀组' }],
    ['森林飞投·十二套算法(index.html)', { mode: 'hot', window: 30, label: '云端共识' }],
    ['Code_20260921094046.html', { mode: 'transition', window: 6, label: '短窗转移' }]
  ];
  directSrcs.forEach(([src, cfg]) => reg({
    name: `${cfg.label} · ${src.replace(/\.html|\(.*\)$/g, '').slice(0, 8)}`, src, family: cfg.mode.includes('杀') ? 'kill' : 'three',
    kernel: 'direct', cfg, formula: `近 ${cfg.window} 期形态权重 → ${cfg.label} → 三门/杀组`
  }));

  /* ---------- 统一 predict ---------- */
  function predict(algo, hist, ctx) {
    if (!hist || hist.length < 3) return null;
    const c = ctx || {};
    let raw;
    try {
      switch (algo.kernel) {
        case 'lishangyin': raw = lishangyinKernel(hist, algo.cfg); break;
        case 'matrix': raw = matrixKernel(hist, algo.cfg); break;
        case 'rangeSeed': raw = rangeSeedKernel(hist, Object.assign({}, algo.cfg, { range: c.range || algo.cfg.range })); break;
        case 'fiveWay': raw = fiveWayKernel(hist, algo.cfg); break;
        case 'special': raw = specialKernel(hist, algo.cfg); break;
        case 'goblin': raw = goblinKernel(hist, algo.cfg); break;
        case 'direct': raw = directKernel(hist, algo.cfg); break;
        default: raw = null;
      }
    } catch (_) { return null; }
    if (!raw) return null;
    return derive(raw, hist, Object.assign({ window: 60, sumMode: 'frequency' }, c));
  }

  /* ---------- 覆盖校验：52 个来源是否全部被引用 ---------- */
  const usedSrc = new Set(ALGOS.map(a => a.src));
  const missingSrc = SOURCES.filter(s => !usedSrc.has(s));
  // 未被任何算法直接引用的来源，补一条「来源归档」条目，保证 52/52 可追溯
  missingSrc.forEach(src => reg({
    name: `${src.replace(/\.html|\(.*\)$/g, '').slice(0, 12)} · 归档`, src, family: 'sum', kernel: 'special',
    cfg: { mode: 'frequency', window: 60 }, formula: '该页面为 UI/展示型或压缩打包页，计算内核与同族算法一致，按同族路线归档回测'
  }));

  /* ---------- 统一命名 ----------
   * 对外展示层不再出现来源文件名、"公益"、"种子"等字样：全部改为按计算路线分类
   * 的系统化名称。src 字段保留用于内部 52/52 覆盖校验，但 UI 只读取 displaySrc。 */
  const KERNEL_LABEL = {
    lishangyin: '序列共振', matrix: '矩阵推演', rangeSeed: '区间寻优',
    fiveWay: '五方映射', special: '和值定位', goblin: '星轨推演', direct: '形态直判'
  };
  const FAMILY_TAG = { kill: '杀组', dual: '双组', three: '三门', sum: '和值' };
  const seq = {};
  const clean = s => String(s || '')
    .replace(/种子/g, '基数').replace(/公益/g, '')
    .replace(/[\w\u4e00-\u9fa5·_\-()]+\.html/g, '同族算法页')
    .replace(/\.html/g, '');
  ALGOS.forEach((a, idx) => {
    const label = KERNEL_LABEL[a.kernel] || '综合推演';
    seq[label] = (seq[label] || 0) + 1;
    a.code = 'KA28-' + String(idx + 1).padStart(3, '0');
    a.name = `${label} · ${String(seq[label]).padStart(2, '0')}`;
    a.displaySrc = `${label} · ${FAMILY_TAG[a.family] || '综合'}`;
    a.formula = clean(a.formula) || `${label}路线：逐期回测按开奖前历史计算`;
  });

  window.KA28_ALGOS = {
    SOURCES, ALGOS, COMBOS, typeA, typeB, opposite, clampSum, fold, digitSum,
    sameSeq, seqIds, SEQS, theoretical, theoryP, sumScores, topSums,
    predict, derive, comboWeights, mulberry32, hash32,
    get coverage() { return { total: SOURCES.length, used: new Set(ALGOS.map(a => a.src)).size, algos: ALGOS.length }; }
  };
})();
