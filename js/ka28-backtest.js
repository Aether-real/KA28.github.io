/* =============================================================================
 * KA28 加拿大28预测系统 · 逐期回测 / 四大排行榜 / 综合共识 (Stage 2)
 * -----------------------------------------------------------------------------
 * 回测纪律：预测第 i 期时，只允许使用 hist.slice(0, i)（该期开奖之前的数据），
 *          且只吃最近 120 期滚动样本；绝不把预测目标自身或未来期当作输入。
 * 命中定义：
 *   kill  = 预测杀组「未出现」于该期实际组合（杀组避开率，理论基线 75%）
 *   dual  = 实际组合落在预测的两组内（理论基线 50%）
 *   three = 实际组合落在预测的三门内（理论基线 75%）
 *   sum   = 实际和值落在预测的 4 个和值候选内（理论基线约 14.3%）
 * 排序分数：平滑命中率 + 相对基线超额 + 近期稳定性 + 样本可信度，
 *          避免小样本随机波动冲榜（Jeffreys / Laplace 平滑）。
 * ========================================================================== */
(function () {
  'use strict';
  const A = window.KA28_ALGOS;
  const { ALGOS, COMBOS, predict } = A;

  const BASELINE = { kill: 0.75, dual: 0.50, three: 0.75, sum: 4 / 28 };
  const DIM_META = {
    kill: { label: '杀组排行榜', unit: '避开率', desc: '杀组未开出即命中，理论基线 75%' },
    dual: { label: '双组排行榜', unit: '命中率', desc: '实际组合落在预测双组内，理论基线 50%' },
    three: { label: '三门排行榜', unit: '命中率', desc: '实际组合落在预测三门内，理论基线 75%' },
    sum: { label: '和值预测排行榜', unit: '命中率', desc: '实际和值落在 4 个候选内，理论基线约 14.3%' }
  };

  function normalize(rows) {
    // rows: [[期号, 时间, n1,n2,n3, 和值, 组合, 形态, 边, 龙虎], ...] 由旧到新
    return rows.map(r => {
      const nums = [Number(r[2]), Number(r[3]), Number(r[4])];
      const sum = Number(r[5]) || nums[0] + nums[1] + nums[2];
      // API 原始口径：龙虎为「龙/虎/合」，边数为「中/小边/大边」；展示层按图片把「合」显示为「和」。
      const rawDragon = r[9] || '';
      return {
        id: String(r[0]), time: String(r[1] || ''), nums, sum,
        type: r[6] || A.typeA(sum), shape: r[7] || '', edge: r[8] || '', dragon: rawDragon === '合' ? '和' : rawDragon,
        size: sum <= 13 ? '小' : '大', parity: sum % 2 ? '单' : '双'
      };
    }).filter(r => r.nums.every(n => Number.isInteger(n) && n >= 0 && n <= 9) && r.sum >= 0 && r.sum <= 27);
  }

  /* ---------- 单次评估 ---------- */
  function hitOf(pred, actual, dim) {
    if (!pred) return null;
    switch (dim) {
      case 'kill': return pred.kill && COMBOS.includes(pred.kill) ? (actual.type !== pred.kill ? 1 : 0) : null;
      case 'dual': return pred.dual?.length === 2 ? (pred.dual.includes(actual.type) ? 1 : 0) : null;
      case 'three': return pred.three?.length === 3 ? (pred.three.includes(actual.type) ? 1 : 0) : null;
      case 'sum': return pred.sums?.length ? (pred.sums.includes(actual.sum) ? 1 : 0) : null;
    }
    return null;
  }

  /* ---------- 全量逐期回测 ---------- */
  function backtest(hist, opts) {
    const o = Object.assign({ window: 60, range: null, lookback: 120, warmup: 30 }, opts || {});
    const n = hist.length;
    const start = Math.max(o.warmup, n - o.window);
    const stats = {};
    ALGOS.forEach(a => { stats[a.id] = {}; ['kill', 'dual', 'three', 'sum'].forEach(d => { stats[a.id][d] = { hit: 0, tested: 0, recentHit: 0, recentTested: 0 }; }); });

    const recentFrom = n - Math.min(30, Math.max(10, Math.floor(o.window / 2)));
    for (let i = start; i < n; i++) {
      const prior = hist.slice(Math.max(0, i - o.lookback), i);
      if (prior.length < 12) continue;
      const actual = hist[i];
      const ctx = { window: o.window, range: o.range, sumMode: 'frequency' };
      for (let k = 0; k < ALGOS.length; k++) {
        const algo = ALGOS[k];
        const pred = predict(algo, prior, ctx);
        if (!pred) continue;
        const st = stats[algo.id];
        ['kill', 'dual', 'three', 'sum'].forEach(d => {
          const h = hitOf(pred, actual, d);
          if (h === null) return;
          st[d].tested++; st[d].hit += h;
          if (i >= recentFrom) { st[d].recentTested++; st[d].recentHit += h; }
        });
      }
    }

    // 打分
    const result = {};
    ALGOS.forEach(algo => {
      const st = stats[algo.id];
      result[algo.id] = {};
      ['kill', 'dual', 'three', 'sum'].forEach(d => {
        const { hit, tested, recentHit, recentTested } = st[d];
        const base = BASELINE[d];
        // Jeffreys 平滑 (alpha=.5)，向理论基线收缩
        const smooth = tested ? (hit + 0.5 * base * 8) / (tested + 0.5 * 8) : 0;
        const rate = tested ? hit / tested : 0;
        const recentRate = recentTested ? recentHit / recentTested : smooth;
        const edge = smooth - base;                       // 相对基线超额
        const reliability = tested / (tested + 24);       // 样本可信度
        const stability = 1 - Math.abs(recentRate - smooth); // 近期稳定性
        const score = (edge * 1.6 + 0.12 * stability + 0.06 * reliability) * (0.55 + 0.45 * reliability);
        result[algo.id][d] = {
          hit, tested, rate, smooth, recentRate, edge, reliability, stability, score,
          sampleEnough: tested >= 20
        };
      });
    });
    return { stats: result, meta: { start, end: n - 1, tested: n - start, window: o.window, range: o.range, recentFrom } };
  }

  /* ---------- 四大排行榜 ---------- */
  function leaderboards(hist, bt, opts) {
    const o = Object.assign({ manualWeights: {}, top: 3, range: null }, opts || {});
    const boards = {};
    ['kill', 'dual', 'three', 'sum'].forEach(dim => {
      const rows = ALGOS.map(algo => {
        const s = bt.stats[algo.id]?.[dim] || { hit: 0, tested: 0, rate: 0, smooth: 0, edge: -1, score: -1 };
        let pred = null;
        try { pred = predict(algo, hist, { window: bt.meta.window, range: o.range || bt.meta.range }); } catch (_) { }
        const mw = Number(o.manualWeights[algo.id]);
        const weight = Number.isFinite(mw) ? mw : Math.max(0.05, Math.min(2.2, 0.7 + s.score * 2));
        return {
          id: algo.id, name: algo.name, src: algo.src, displaySrc: algo.displaySrc || '', family: algo.family, formula: algo.formula,
          ...s, weight, pred,
          value: dim === 'kill' ? pred?.kill : dim === 'dual' ? pred?.dual : dim === 'three' ? pred?.three : pred?.sums,
          origin: pred?.origin?.[dim === 'sum' ? 'sums' : dim]
        };
      }).filter(r => r.tested > 0)
        .sort((a, b) => b.score - a.score || b.tested - a.tested || a.id.localeCompare(b.id));
      rows.forEach((r, i) => { r.rank = i + 1; });
      boards[dim] = { meta: DIM_META[dim], rows, top: rows.slice(0, o.top) };
    });
    return boards;
  }

  /* ---------- 综合共识：四大榜前三（或前 N）加权投票 ---------- */
  function consensus(hist, boards, opts) {
    const o = Object.assign({ topN: 3, auto: true, manualWeights: {}, comboBias: null }, opts || {});
    const comboVote = { '大单': 0, '小单': 0, '大双': 0, '小双': 0 };
    const sumVote = Array(28).fill(0);
    const contributors = [];
    ['kill', 'dual', 'three', 'sum'].forEach(dim => {
      boards[dim].rows.slice(0, o.topN).forEach(r => {
        const w = o.auto ? r.weight : (Number(o.manualWeights[r.id]) || r.weight);
        const p = r.pred; if (!p) return;
        if (dim === 'kill') {
          // 杀掉的组合得负票，其余得正票
          COMBOS.forEach(g => { if (g === p.kill) comboVote[g] -= w; else comboVote[g] += w / 3; });
        } else {
          const list = dim === 'dual' ? p.dual : dim === 'three' ? p.three : [];
          list.forEach(g => { if (comboVote[g] !== undefined) comboVote[g] += w / list.length; });
        }
        (p.sums || []).forEach(s => { if (s >= 0 && s <= 27) sumVote[s] += w * (dim === 'sum' ? 1.4 : 0.35); });
        contributors.push({ dim, id: r.id, name: r.name, src: r.src, weight: w, rank: r.rank, rate: r.rate, edge: r.edge, value: r.value });
      });
    });
    if (o.comboBias) Object.keys(o.comboBias).forEach(g => { if (comboVote[g] !== undefined) comboVote[g] += Number(o.comboBias[g]) || 0; });

    const comboRank = COMBOS.map(g => ({ g, v: comboVote[g] })).sort((a, b) => b.v - a.v || COMBOS.indexOf(a.g) - COMBOS.indexOf(b.g));
    const sumRank = sumVote.map((v, sum) => ({ sum, v })).sort((a, b) => b.v - a.v || a.sum - b.sum);
    const kill = comboRank[comboRank.length - 1].g;              // 票数最低 = 综合杀组
    const three = comboRank.slice(0, 3).map(x => x.g);
    const dual = comboRank.slice(0, 2).map(x => x.g);
    const sums = sumRank.slice(0, 4).map(x => x.sum);

    return {
      kill, dual, three, sums, comboRank, sumRank: sumRank.slice(0, 8), contributors,
      top3: Object.fromEntries(['kill', 'dual', 'three', 'sum'].map(d => [d, boards[d].top])),
      confidence: (() => {
        const edges = contributors.map(c => c.edge).filter(Number.isFinite);
        const avg = edges.length ? edges.reduce((a, b) => a + b, 0) / edges.length : 0;
        return Math.max(0, Math.min(100, 50 + avg * 260));
      })()
    };
  }

  /* ---------- 区间自动 / 手动调节（保留原站能力） ---------- */
  const RANGE_GRID = (() => {
    const out = [];
    for (let min = 0; min <= 0.8; min += 0.1) for (let w = 0.2; w <= 0.5; w += 0.1) {
      if (min + w <= 1.0001) out.push({ min: Number(min.toFixed(2)), max: Number((min + w).toFixed(2)) });
    }
    return out;
  })();
  function tuneRange(rows, hist, opts) {
    const o = Object.assign({ period: 30, dim: 'kill', sampleSize: 14 }, opts || {});
    const begin = Math.max(12, hist.length - o.period);
    // 只用区间种子族算法参与扫描（与源算法「区间回测选参」一致）
    const candidates = ALGOS.filter(a => a.kernel === 'rangeSeed').slice(0, o.sampleSize);
    let best = null;
    RANGE_GRID.forEach(range => {
      let hit = 0, tested = 0;
      for (let i = begin; i < hist.length; i++) {
        const prior = hist.slice(Math.max(0, i - 120), i);
        if (prior.length < 12) continue;
        for (let k = 0; k < candidates.length; k++) {
          const pred = predict(candidates[k], prior, { range, window: o.period });
          if (!pred) continue;
          const h = hitOf(pred, hist[i], o.dim);
          if (h === null) continue;
          tested++; hit += h;
        }
      }
      const rate = tested ? hit / tested : 0;
      const penalty = 0.02 * Math.abs((range.max - range.min) - 0.3);
      const score = rate - penalty;
      if (!best || score > best.score) best = { range, rate, hit, tested, score };
    });
    return best || { range: { min: 0.25, max: 0.55 }, rate: 0, hit: 0, tested: 0, score: 0 };
  }

  /* ---------- 遗漏查询 ---------- */
  const OMIT_DIMS = [
    { key: 'sum', label: '和值 0–27', items: Array.from({ length: 28 }, (_, n) => ({ key: String(n).padStart(2, '0'), test: r => r.sum === n })) },
    { key: 'combo', label: '大小单双组合', items: COMBOS.map(g => ({ key: g, test: r => r.type === g })) },
    { key: 'size', label: '大小 / 单双', items: [['小', r => r.size === '小'], ['大', r => r.size === '大'], ['单', r => r.parity === '单'], ['双', r => r.parity === '双']].map(([k, t]) => ({ key: k, test: t })) },
    { key: 'edge', label: '边数', items: [['小边 0–7', r => r.sum <= 7], ['中边 8–17', r => r.sum >= 8 && r.sum <= 17], ['大边 18–27', r => r.sum >= 18], ['极小 0–5', r => r.sum <= 5], ['极大 22–27', r => r.sum >= 22]].map(([k, t]) => ({ key: k, test: t })) },
    { key: 'shape', label: '形态', items: [['豹子', r => r.shape === '豹子'], ['对子', r => r.shape === '对子'], ['顺子', r => r.shape === '顺子'], ['杂六', r => r.shape === '杂六']].map(([k, t]) => ({ key: k, test: t })) },
    { key: 'dragon', label: '龙虎', items: [['龙', r => r.dragon === '龙'], ['虎', r => r.dragon === '虎'], ['和', r => r.dragon === '和']].map(([k, t]) => ({ key: k, test: t })) }
  ];
  function omissionQuery(hist, opts) {
    const o = Object.assign({ dims: null, keyword: '', sort: 'gap', limit: 40 }, opts || {});
    const dims = OMIT_DIMS.filter(d => !o.dims || o.dims.includes(d.key));
    const out = [];
    dims.forEach(dim => dim.items.forEach(item => {
      let gap = hist.length, lastIdx = -1, count = 0, maxGap = 0, positions = [];
      for (let i = 0; i < hist.length; i++) if (item.test(hist[i])) { positions.push(i); count++; }
      for (let j = 0; j < positions.length; j++) {
        const g = j === 0 ? positions[0] + 1 : positions[j] - positions[j - 1] - 1;
        maxGap = Math.max(maxGap, j === 0 ? positions[0] : g);
      }
      lastIdx = positions.length ? positions[positions.length - 1] : -1;
      gap = lastIdx === -1 ? hist.length : hist.length - 1 - lastIdx;
      maxGap = Math.max(maxGap, gap);
      const avgGap = count > 1 ? (hist.length - 1 - positions[0]) / count : hist.length;
      out.push({
        dim: dim.key, dimLabel: dim.label, key: item.key, gap, maxGap, count,
        avgGap: Number(avgGap.toFixed(1)), lastIssue: lastIdx === -1 ? '—' : hist[lastIdx].id,
        rate: hist.length ? count / hist.length : 0, positions: positions.slice(-24), test: item.test
      });
    }));
    const kw = String(o.keyword || '').trim();
    let rows = kw ? out.filter(r => r.key.includes(kw) || r.dimLabel.includes(kw)) : out;
    if (o.sort === 'gap') rows.sort((a, b) => b.gap - a.gap || a.key.localeCompare(b.key));
    else if (o.sort === 'gapAsc') rows.sort((a, b) => a.gap - b.gap || a.key.localeCompare(b.key));
    else if (o.sort === 'max') rows.sort((a, b) => b.maxGap - a.maxGap);
    else if (o.sort === 'count') rows.sort((a, b) => b.count - a.count);
    else rows.sort((a, b) => a.dimLabel.localeCompare(b.dimLabel) || a.key.localeCompare(b.key));
    return rows.slice(0, o.limit);
  }

  /* ---------- 走势（开奖历史表格）数据 ---------- */
  const TREND_COLS = [
    { key: 'small', label: '小', test: r => r.size === '小', val: () => '小', tone: 'blue' },
    { key: 'big', label: '大', test: r => r.size === '大', val: () => '大', tone: 'red' },
    { key: 'odd', label: '单', test: r => r.parity === '单', val: () => '单', tone: 'blue' },
    { key: 'even', label: '双', test: r => r.parity === '双', val: () => '双', tone: 'red' },
    { key: 'xd', label: '小单', test: r => r.type === '小单', val: () => '小单', tone: 'blue' },
    { key: 'xs', label: '小双', test: r => r.type === '小双', val: () => '小双', tone: 'red' },
    { key: 'dd', label: '大单', test: r => r.type === '大单', val: () => '大单', tone: 'blue' },
    { key: 'ds', label: '大双', test: r => r.type === '大双', val: () => '大双', tone: 'red' },
    { key: 'edge', label: '边数', test: () => false, val: r => r.edge || (r.sum <= 7 ? '小边' : r.sum <= 17 ? '中' : '大边'), tone: 'edge' },
    { key: 'dragon', label: '龙虎', test: () => false, val: r => r.dragon || '—', tone: 'dragon' }
  ];
  function trendRows(hist, count) {
    const rows = hist.slice(-count).reverse(); // 由新到旧
    const intervals = {};
    TREND_COLS.forEach((c, i) => {
      let gap = 0;
      if (i < 8) { for (let j = 0; j < rows.length; j++, gap++) if (c.test(rows[j])) break; }
      intervals[c.key] = i < 8 ? gap : '—';
    });
    return { rows, intervals, cols: TREND_COLS };
  }

  window.KA28_BACKTEST = {
    BASELINE, DIM_META, OMIT_DIMS, TREND_COLS, RANGE_GRID,
    normalize, backtest, leaderboards, consensus, tuneRange, omissionQuery, trendRows, hitOf
  };
})();
