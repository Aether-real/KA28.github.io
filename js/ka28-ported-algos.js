/* =============================================================================
 * KA28 · 移植算法适配层 (ca28-pro + maple28)
 * -----------------------------------------------------------------------------
 * 把 ca28-pro-source.zip / maple28-source.zip 两套 src/lib/engine.ts 的算法
 * 「原样」并入现有统一算法池：两个 engine 由 esbuild 直接编译为 IIFE bundle
 * （ca28-engine.bundle.js / maple28-engine.bundle.js），算法 run() 逻辑一字未改，
 * 本文件只做三件事：
 *   1. 数据适配：KA28 正序 hist 行 → 两个 engine 约定的 Draw 结构；
 *   2. 输出适配：run() 得到的 28 维和值概率 sumP → 本站统一预测契约
 *      { kill, dual, three, sums }，再交给 A.derive() 补齐（与 87 个原生算法同口径）；
 *   3. 注册：以 kernel='ported' 追加进 A.ALGOS，并包装 A.predict。
 *
 * 因为 ka28-backtest.js / ka28-app.js 都从 window.KA28_ALGOS 取 ALGOS 与 predict，
 * 且本文件排在二者之前加载，追加后：
 *   · 自动进入 B.backtest 逐期回测（S.bt.stats[新算法 id]）
 *   · 自动进入统一排行榜（buildUnified 的 A.ALGOS.map）
 *   · 自动参与融合共识候选池（F1/F2 逐期投票）
 *   · 若进入总榜前三，自动参与「杀组/双组/三门/和值」四类投票与逐期统计
 *   · 自动跟随「历史回测窗口 / 区间寻优 / 自动·手动调节」（ctx.window、ctx.range）
 * 原有 49 公式、2 融合共识、87 原生算法及所有区间控件一律不改。
 *
 * 注意：ka28-backtest.js 顶部用 `const { ALGOS, predict } = A` 解构，
 * 因此 A.predict 的包装必须发生在该文件加载之前；ALGOS 是同一个数组引用，
 * push 之后其 length 变化会被回测循环自动感知。
 * ========================================================================== */
(function () {
  'use strict';
  const A = window.KA28_ALGOS;
  const CA = window.CA28_ENGINE;
  const MA = window.MAPLE28_ENGINE;
  if (!A || !CA || !MA || !Array.isArray(A.ALGOS)) {
    console.warn('[KA28] 移植算法未就绪：需要 ka28-algos.js + 两个 engine bundle 先加载');
    return;
  }

  const COMBOS = A.COMBOS;                       // ['大单','小单','大双','小双']
  const comboName = (s) => (s >= 14 ? '大' : '小') + (s % 2 === 1 ? '单' : '双');
  const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

  /* ---------- 1. KA28 hist → engine Draw ----------
   * hist 行：{ id, time, nums:[n1,n2,n3], sum, type, shape, edge, dragon, size, parity }
   * Draw：{ nbr, time, n1,n2,n3, sum, big, odd, combo, shape, pos, extreme,
   *        dragon, mod3, mod4, mod5 }
   * 两个 engine 实际只读 nbr/time/n1/n2/n3/sum/big/odd/dragon/pos/shape，
   * 其余字段一并补齐，保证任何 run() 都不缺字段。 */
  function toDraws(hist, ctx) {
    const win = Math.max(30, Math.min(120, Number(ctx && ctx.window) || 60));
    return hist.slice(-Math.min(hist.length, win)).map((r) => {
      const nums = r.nums || [];
      const n1 = finite(nums[0]), n2 = finite(nums[1]), n3 = finite(nums[2]);
      const sum = finite(r.sum) || n1 + n2 + n3;
      let shape = String(r.shape || '');
      if (!shape) {
        const u = new Set([n1, n2, n3]);
        shape = u.size === 1 ? '豹子' : u.size === 2 ? '对子'
          : (n2 - n1 === 1 && n3 - n2 === 1) || (n1 - n2 === 1 && n2 - n3 === 1) ? '顺子' : '杂六';
      }
      return {
        nbr: Number(r.id) || 0,
        time: String(r.time || ''),
        n1, n2, n3, sum,
        big: sum >= 14,
        odd: sum % 2 === 1,
        combo: comboName(sum),
        shape,
        pos: String(r.edge || ''),
        extreme: sum <= 5 ? '极小' : sum >= 22 ? '极大' : '',
        dragon: String(r.dragon || ''),
        mod3: ((sum % 3) + 3) % 3,
        mod4: ((sum % 4) + 4) % 4,
        mod5: ((sum % 5) + 5) % 5,
        keno: undefined,
      };
    });
  }

  /* ---------- 2. sumP → 四类预测 ----------
   * 杀组 = combo 概率最低的一个；三门/双组 = 概率最高的 3 / 2 个。
   * 和值四码 = 区间调节后按概率降序的 4 个：
   *   ctx.range 为 {min,max}（自动寻优或手动滑块给出），用来限定累积分布
   *   分位窗口；窗口内不足 4 个和值时退回全局 top4。
   *   因此「自动调节 / 手动调节 / 回测窗口」对移植算法同样真实生效。 */
  function pickSums(sumP, range) {
    const all = sumP.map((v, s) => ({ s, p: finite(v) })).sort((a, b) => b.p - a.p || a.s - b.s);
    const r = range && Number.isFinite(range.min) && Number.isFinite(range.max) ? range : null;
    if (!r) return all.slice(0, 4).map((x) => x.s);
    const lo = Math.max(0, Math.min(1, Number(r.min))), hi = Math.max(lo, Math.min(1, Number(r.max)));
    const total = sumP.reduce((a, b) => a + finite(b), 0) || 1;
    let acc = 0;
    const pool = [];
    for (let s = 0; s < 28; s++) {
      const prev = acc;
      acc += finite(sumP[s]) / total;
      // 该和值的累积区间与 [lo,hi] 有交集即纳入候选
      if (acc >= lo && prev <= hi) pool.push(s);
    }
    const picked = pool.length >= 4
      ? all.filter((x) => pool.indexOf(x.s) !== -1).slice(0, 4)
      : all.slice(0, 4);
    return (picked.length ? picked : all.slice(0, 4)).map((x) => x.s);
  }

  function fromSumP(sumP, range) {
    const cp = Object.fromEntries(COMBOS.map((g) => [g, 0]));
    for (let s = 0; s < 28; s++) {
      const g = comboName(s);
      if (cp[g] !== undefined) cp[g] += finite(sumP[s]);
    }
    const ranked = COMBOS.slice().sort((a, b) => cp[b] - cp[a] || COMBOS.indexOf(a) - COMBOS.indexOf(b));
    return {
      three: ranked.slice(0, 3),
      dual: ranked.slice(0, 2),
      kill: ranked[3],
      sums: pickSums(sumP, range),
    };
  }

  function portedPredict(algo, hist, ctx) {
    if (!hist || hist.length < 3 || typeof algo._run !== 'function') return null;
    const c = ctx || {};
    let forecast = null;
    try { forecast = algo._run(toDraws(hist, c)); } catch (_) { return null; }
    if (!forecast || !Array.isArray(forecast.sumP) || forecast.sumP.length !== 28) return null;
    const sumP = forecast.sumP.map(finite);
    if (!sumP.some((v) => v > 0)) return null;
    const raw = fromSumP(sumP, c.range);
    raw.detail = `${algo.displaySrc} · ${algo.name}：28 维和值分布 → combo 概率定杀组/双组/三门，累积分位定和值四码${c.range ? `（区间 ${Number(c.range.min).toFixed(2)}~${Number(c.range.max).toFixed(2)}）` : ''}`;
    try { return A.derive(raw, hist, Object.assign({ window: 60, sumMode: 'frequency' }, c)); }
    catch (_) { return null; }
  }

  /* ---------- 3. 注册 ---------- */
  const PORTED_META = [
    { prefix: 'C', engine: 'CA28', src: 'ca28-pro-source.zip', label: 'CA28 移植', en: 'CA28 / TS ENGINE', algos: CA.ALGOS },
    { prefix: 'M', engine: 'MAPLE28', src: 'maple28-source.zip', label: 'Maple28 移植', en: 'MAPLE28 / TS ENGINE', algos: MA.ALGOS },
  ];
  const ported = [];
  PORTED_META.forEach((m) => {
    m.algos.forEach((a, i) => {
      const seq = String(i + 1).padStart(3, '0');
      ported.push({
        id: m.prefix + seq,                       // C001.. / M001..，不与 A001.. 冲突
        code: `${m.engine}-${seq}`,
        name: `${m.label} · ${a.name || a.id}`,
        displaySrc: `${m.label} · 和值分布模型`,
        family: 'sum',                            // 原生强项：28 维和值概率
        kernel: 'ported',
        cfg: { engine: m.engine, src: m.src, algoId: a.id, tag: a.tag || '', desc: a.desc || '' },
        formula: `${m.en} · ${a.tag || '统计模型'}：${a.desc || '28 维和值概率分布'}`,
        _run: a.run,                             // 直接引用编译后的原函数，逻辑零改写
      });
    });
  });

  // 先包装 predict，再 push 数组：保证 ka28-backtest.js 解构到包装后的函数。
  const originalPredict = A.predict;
  A.predict = function (algo, hist, ctx) {
    if (algo && algo.kernel === 'ported') return portedPredict(algo, hist, ctx);
    return originalPredict(algo, hist, ctx);
  };
  Array.prototype.push.apply(A.ALGOS, ported);

  window.KA28_PORTED = {
    count: ported.length,
    byEngine: { CA28: CA.ALGOS.length, MAPLE28: MA.ALGOS.length },
    ids: ported.map((a) => a.id),
    predict: portedPredict,
  };
  console.info(`[KA28] 移植算法已并入统一池：CA28 ${CA.ALGOS.length} + Maple28 ${MA.ALGOS.length} = ${ported.length} 个；算法池总数 ${A.ALGOS.length}`);
})();
