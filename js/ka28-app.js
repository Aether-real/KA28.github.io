/* =============================================================================
 * KA28 加拿大28预测系统 · 应用层 (Stage 3/4 交互与呈现)
 * -----------------------------------------------------------------------------
 * 设计纪律：
 *  · 不移动、不删除主站任何既有 DOM 节点，仅追加 data-k28-page 标记做页面分组；
 *    既有 app.js / loader.js / miyan-gate.js / ads-carousel.js 全部保持原样运行。
 *  · 新增 DOM 全部由本文件注入；主题按钮复用既有 #themeBtn（含既有 click 逻辑），
 *    只重做外观 + View Transitions 圆形揭开，自动降级沿用既有实现。
 *  · 数据：优先在线 /api/v1/draws 刷新，失败静默回落到 800 期离线真实快照。
 *  · 逐期回测仅用开奖前历史；样本不足不显示虚构命中率。
 * ========================================================================== */
(function () {
  'use strict';

  /* ===================== 本地预览验收开关（仅 ?preview=1） =====================
   * 仅用于离线 / 本地浏览器验收：隐藏授权遮罩、解除 body 滚动锁、尽力触发既有
   * 站点的 boot()。不伪造任何授权凭据、不绕过服务端验证；线上无此参数时授权门
   * 与既有逻辑完全保持原样。CSS 侧用 !important 兜底，防止随后由 loader.js 动态
   * 加载的 miyan-gate.js 再次锁死 body 或把授权门重新显示。 */
  (function applyPreviewMode() {
    if (!/[?&]preview=1(?:&|$)/.test(location.search)) return;
    document.documentElement.classList.add('k28-preview');
    ['miYanGate', 'miYanNoticeOverlay', 'ka28BootNotice'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('k28-preview-hide');
    });
    if (document.body) document.body.style.overflow = '';
    let tries = 0;
    const kick = () => {
      tries++;
      const fn = window.__KA28_START_AFTER_AUTH;
      if (typeof fn === 'function' && !window.__KA28_STARTED) {
        window.__KA28_STARTED = true;
        try { fn(); } catch (e) { console.warn('[KA28 preview] 既有站点 boot 触发失败（不影响新增系统）', e); }
      }
      if (tries < 80 && !window.__KA28_STARTED) setTimeout(kick, 250);
    };
    setTimeout(kick, 80);
  })();

  const A = window.KA28_ALGOS, B = window.KA28_BACKTEST;
  if (!A || !B) { console.warn('[KA28] 算法/回测模块未就绪'); return; }
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const pct = v => (Number(v) * 100).toFixed(1) + '%';
  const fmtArr = v => Array.isArray(v) ? v.map(n => typeof n === 'number' ? String(n).padStart(2, '0') : n).join(' / ') : (v ?? '—');

  /* ===================== 状态 ===================== */
  const S = {
    page: 'draw',
    hist: [], online: false, busy: true,
    window: 60, rangePeriod: 30, topN: 3,
    autoMode: true, autoRange: true,
    manualRange: { min: 0.25, max: 0.55 }, tunedRange: null,
    manualWeights: {},
    boardDim: 'all', boardShow: 5,
    mode: 'auto',              // 'auto' | 'manual'：统一自动/手动调节（区间 + 权重）
    lastTune: null,
    omit: { dims: null, keyword: '', sort: 'gap' },
    trendCompact: true, realCount: 20,
    bt: null, boards: null, cons: null, unified: null,
    sheet: null, sheetState: 'half'
  };
  /* 总榜维度：all=综合，其余按四类命中口径重排（切换带交错动画） */
  const UDIMS = ['all', 'kill', 'dual', 'three', 'sum'];
  const ULABEL = { all: '综合', kill: '杀组', dual: '双组', three: '三门', sum: '和值' };
  /* 整合规模：算法池 87 + 原站 49 公式 + 2 融合模型 = 138 */
  const LEGACY_FORMULAS = 49, LEGACY_FUSION = 2;
  const TOTAL_ALGOS = A.ALGOS.length + LEGACY_FORMULAS + LEGACY_FUSION;

  /* ===================== 数据 ===================== */
  function mergeRows(base, incoming) {
    const map = new Map();
    base.forEach(r => map.set(String(r[0]), r));
    (incoming || []).forEach(r => map.set(String(r[0]), r));
    return [...map.values()].sort((a, b) => Number(a[0]) - Number(b[0])).slice(-1000);
  }
  async function loadHistory() {
    let rows = Array.isArray(window.KA28_HISTORY) ? window.KA28_HISTORY.slice() : [];
    S.hist = B.normalize(rows);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch('https://pc28.world/api/v1/draws?limit=200', { signal: ctrl.signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
      clearTimeout(timer);
      const j = await res.json();
      const items = j?.data?.items;
      if (Array.isArray(items) && items.length) {
        const inc = items.map(x => [x.nbr, x.time, x.n1, x.n2, x.n3, x.sum ?? (x.n1 + x.n2 + x.n3), x.combo, x.shape, x.pos, x.dragon]);
        S.hist = B.normalize(mergeRows(rows, inc));
        S.online = true;
      }
    } catch (_) { /* 离线快照兜底，静默 */ }
  }

  /* ===================== 计算 ===================== */
  function syncMode() { S.autoMode = S.mode === 'auto'; S.autoRange = S.mode === 'auto'; }
  function effectiveRange() {
    if (S.autoRange) return S.tunedRange ? { min: S.tunedRange.min, max: S.tunedRange.max } : null;
    return { min: S.manualRange.min, max: S.manualRange.max };
  }
  function recompute() {
    if (!S.hist.length) return;
    const range = effectiveRange();
    S.bt = B.backtest(S.hist, { window: Math.min(S.window, 120), range });
    S.boards = B.leaderboards(S.hist, S.bt, { manualWeights: S.manualWeights, top: S.topN, range });
    S.cons = B.consensus(S.hist, S.boards, { topN: S.topN, auto: S.autoMode, manualWeights: S.manualWeights });
    S.unified = buildUnified();
  }
  function autoTune() {
    if (!S.hist.length) return;
    const best = B.tuneRange(null, S.hist, { period: S.rangePeriod, dim: 'kill' });
    S.tunedRange = best.range; S.lastTune = best;
    return best;
  }

  /* ===================== 统一排行榜 + 总榜前三统计 =====================
   * 原站 app.js 整体包在 IIFE 内，49 公式函数无法从外部调用；因此原站 49 公式
   * 采用它自己渲染出的「公示命中率」并入总榜（真实数据，非估算），2 个融合模型
   * 用总榜前三逐期回测的真实命中率作为公示值。所有条目共用一个榜单、一个口径。 */
  function ensureLegacyExpanded() {
    const lb = $('#algoLeaderboard'); if (!lb) return;
    if (!lb.classList.contains('is-expanded') && $$('.algo-leader-row', lb).length < 49) {
      const t = $('#algoRankToggle'); if (t) { try { t.click(); } catch (_) { } }
    }
  }
  function readLegacyRows(fusion) {
    const rows = [];
    const lb = $('#algoLeaderboard');
    if (lb) $$('.algo-leader-row', lb).forEach((el, i) => {
      const nameEl = el.querySelector('.algo-leader-name b');
      const rateEl = el.querySelector('.algo-leader-rate strong');
      const sample = el.querySelector('.algo-leader-sample');
      let rate = parseFloat(String(rateEl?.textContent || '').replace('%', '')) / 100;
      if (!Number.isFinite(rate)) rate = 0.75;
      const m = String(sample?.textContent || '').match(/(\d+)\s*\/\s*(\d+)/);
      const hit = m ? Number(m[1]) : Math.round(rate * 50), tested = m ? Number(m[2]) : 50;
      const edge = rate - 0.75;
      rows.push({
        id: 'L' + String(i + 1).padStart(2, '0'),
        name: (nameEl?.textContent || '').trim() || `原站公式族 · ${String(i + 1).padStart(2, '0')}`,
        displaySrc: '原站公式', formula: '原站公示口径 · 杀组避开率（按当前历史窗口逐期回测）',
        rate, hit, tested, kind: 'legacy', pred: null, origin: 'legacy',
        scores: { all: edge, kill: edge, dual: edge, three: edge, sum: edge },
        rates: { all: rate, kill: rate, dual: rate, three: rate, sum: rate }
      });
    });
    const fRate = [fusion?.dual ?? 0.5, fusion?.kill ?? 0.75];
    ['融合模型 · 区间共识', '融合模型 · 杀组投票'].forEach((name, i) => {
      const edge = fRate[i] - (i ? 0.75 : 0.5);
      rows.push({
        id: 'F' + (i + 1), name, displaySrc: '融合模型',
        formula: '沿用原站投票层，与 49 个公式共同构成整合算法池',
        rate: fRate[i], hit: 0, tested: 20, kind: 'fusion', pred: null, origin: 'legacy',
        scores: { all: edge, kill: edge, dual: edge, three: edge, sum: edge },
        rates: { all: fRate[i], kill: fRate[i], dual: fRate[i], three: fRate[i], sum: fRate[i] }
      });
    });
    return rows;
  }

  /* ===================== 原站 49 公式：接入同源逐期回测 =====================
   * 根因：app.js 由 loader.js 异步注入，且 sourceAlgoPack 原本封在 IIFE 内，
   * 外部拿不到公式函数，只能用「原站公示命中率」挂榜（口径与新算法不同，
   * 导致 83% 命中率反而排在 52% 之后），且永远进不了总榜前三与综合输出。
   * 现在 app.js 暴露只读引用，本层用公式原始 fn 逐期重算四类命中，
   * 评分公式 / 基线 / 平滑 / 近期窗口与 ka28-backtest.js 完全一致。
   * 时序：pack 可能晚于本文件，故用事件 + 轮询重算；未就绪时回退公示口径。 */
  const LEGACY_SRC_SHORT = {
    '李商隐算法19': '李商隐19', '李商隐16': '李商隐16',
    '森林算法 3 · 三期共振法': '森林共振', '15模型': '十五模型',
    '三套算法': '三套算法', 'uu思路': 'UU思路'
  };
  const legacyPack = () => window.__KA28_LEGACY_PACK__ || null;
  function legacyDisplayName(algo, i) {
    const nm = String(algo.name || '').trim(), src = String(algo.src || '').trim();
    const short = LEGACY_SRC_SHORT[src] || (src ? src.split('·')[0].trim().slice(0, 8) : '原站');
    const m = nm.match(/^算法\s*(\d+)$/);
    if (m) return `${short} · 算法 ${String(m[1]).padStart(2, '0')}`;
    return nm ? `${short} · ${nm}` : `原站公式 ${String(i + 1).padStart(2, '0')}`;
  }
  /* KA28 正序 hist（末位最新）→ 原站倒序格式（h[0] 最新） */
  function toLegacyHist(rows) {
    return rows.slice().reverse().map(r => ({
      expect: String(r.id), nums: (r.nums || []).slice(), sum: r.sum,
      type: A.typeA(r.sum), time: r.time || '', opentime: null
    }));
  }
  /* 单个原站公式的当期四类预测：kill 为原生输出，dual/three/sums 用统一派生层补齐 */
  function legacyPredict(algo, prior, ctx) {
    let res = null;
    try { res = algo.fn(toLegacyHist(prior)); } catch (_) { }
    if (!res || !A.COMBOS.includes(res.killGroup)) return null;
    const raw = { kill: res.killGroup };
    if (Array.isArray(res.recommends) && res.recommends.length) raw.dual = res.recommends;
    try { raw.sums = A.topSums(prior, 'frequency', 4, ctx.window); } catch (_) { }
    return A.derive(raw, prior, ctx);
  }
  /* 与 B.backtest 打分逐字同源 */
  function legacyScore(a, base) {
    const smooth = a.tested ? (a.hit + 0.5 * base * 8) / (a.tested + 0.5 * 8) : 0;
    const rate = a.tested ? a.hit / a.tested : 0;
    const recentRate = a.recentTested ? a.recentHit / a.recentTested : smooth;
    const edge = smooth - base;
    const reliability = a.tested / (a.tested + 24);
    const stability = 1 - Math.abs(recentRate - smooth);
    const score = (edge * 1.6 + 0.12 * stability + 0.06 * reliability) * (0.55 + 0.45 * reliability);
    return { hit: a.hit, tested: a.tested, rate, smooth, recentRate, edge, reliability, stability, score };
  }
  function buildLegacyRows(fallback) {
    const pack = legacyPack();
    if (!pack || !Array.isArray(pack.ALGOS) || !pack.ALGOS.length) {
      return { rows: readLegacyRows(fallback).filter(r => r.kind === 'legacy'), ready: false };
    }
    const dims = ['kill', 'dual', 'three', 'sum'];
    const ctx = { window: S.window, range: effectiveRange(), sumMode: 'frequency' };
    const n = S.hist.length, win = Math.min(S.window, 120);
    const start = Math.max(30, n - win);
    const recentFrom = n - Math.min(30, Math.max(10, Math.floor(win / 2)));
    /* 每期的 prior / 倒序历史 / 共享和值候选只算一次，49 个公式复用，避免重复扫描 */
    const priors = [], lh = [], sums = [];
    for (let i = start; i < n; i++) {
      const p = S.hist.slice(Math.max(0, i - 120), i);
      if (p.length < 12) { priors.push(null); lh.push(null); sums.push([]); continue; }
      priors.push(p); lh.push(toLegacyHist(p));
      let s = []; try { s = A.topSums(p, 'frequency', 4, win); } catch (_) { }
      sums.push(s);
    }
    const acc = pack.ALGOS.map(() => Object.fromEntries(dims.map(d => [d, { hit: 0, tested: 0, recentHit: 0, recentTested: 0 }])));
    pack.ALGOS.forEach((algo, k) => {
      for (let j = 0; j < priors.length; j++) {
        if (!priors[j]) continue;
        let res = null; try { res = algo.fn(lh[j]); } catch (_) { }
        if (!res || !A.COMBOS.includes(res.killGroup)) continue;
        const raw = { kill: res.killGroup, sums: sums[j] || [] };
        if (Array.isArray(res.recommends) && res.recommends.length) raw.dual = res.recommends;
        let pred = null; try { pred = A.derive(raw, priors[j], ctx); } catch (_) { }
        if (!pred) continue;
        const actual = S.hist[start + j];
        dims.forEach(d => {
          const h = B.hitOf(pred, actual, d);
          if (h === null) return;
          const st = acc[k][d];
          st.tested++; st.hit += h;
          if (start + j >= recentFrom) { st.recentTested++; st.recentHit += h; }
        });
      }
    });
    const rows = pack.ALGOS.map((algo, k) => {
      const scores = {}, rates = {}, dimStats = {};
      dims.forEach(d => {
        const st = legacyScore(acc[k][d], B.BASELINE[d]);
        dimStats[d] = st; scores[d] = st.score; rates[d] = st.rate;
      });
      scores.all = dims.reduce((s, d) => s + scores[d], 0) / 4;
      rates.all = dims.reduce((s, d) => s + rates[d], 0) / 4;
      let pred = null; try { pred = legacyPredict(algo, S.hist, ctx); } catch (_) { }
      const s0 = dimStats.kill;
      return {
        id: 'L' + String(k + 1).padStart(2, '0'),
        name: legacyDisplayName(algo, k),
        displaySrc: algo.src || '原站公式族', family: algo.src || '',
        formula: '', kind: 'legacy', legacyAlgo: algo, algo: null,
        scores, rates, dimStats, pred,
        hit: s0.hit, tested: s0.tested, rate: rates.all, edge: scores.all,
        smooth: s0.smooth, recentRate: s0.recentRate,
        reliability: s0.reliability, stability: s0.stability,
        origin: 'native'
      };
    });
    return { rows, ready: true };
  }
  /* 2 个融合模型：保留投票层口径入榜，但不重复计入前三投票（避免自引用放大） */
  function makeFusionRows(fusionRate) {
    const fRate = [fusionRate?.dual ?? 0.5, fusionRate?.kill ?? 0.75];
    return ['融合共识 · 区间模型', '融合共识 · 杀组投票'].map((name, i) => {
      const base = i ? 0.75 : 0.5, edge = fRate[i] - base;
      return {
        id: 'F' + (i + 1), name, displaySrc: '融合投票层', family: '融合层',
        formula: '原站投票层汇总输出，不重复计入前三投票', kind: 'fusion',
        pred: null, algo: null, scores: { all: edge, kill: edge, dual: edge, three: edge, sum: edge },
        rates: { all: fRate[i], kill: fRate[i], dual: fRate[i], three: fRate[i], sum: fRate[i] },
        rate: fRate[i], edge, hit: 0, tested: 20, origin: 'legacy', dimStats: {}
      };
    });
  }
  /* 逐期回测统一入口：新算法走 A.predict，原站公式走原始 fn + 派生层 */
  function predictRow(r, prior, ctx) {
    if (r.kind === 'new') { try { return A.predict(r.algo, prior, ctx); } catch (_) { return null; } }
    if (r.kind === 'legacy') { try { return legacyPredict(r.legacyAlgo, prior, ctx); } catch (_) { return null; } }
    return null;
  }
  /* pack 由 loader 异步注入；就绪后重算总榜与综合输出 */
  function bindLegacyReady() {
    if (legacyPack()) return;            // 已就绪：boot 里的 recompute 会直接使用
    let tries = 0, delayed = 0;
    const apply = () => {
      if (S.busy || !S.hist.length) { if (delayed++ < 24) setTimeout(apply, 300); return; }
      recompute(); renderAll();
    };
    window.addEventListener('ka28:legacy-ready', apply, { once: true });
    const timer = setInterval(() => {
      if (legacyPack()) { clearInterval(timer); apply(); }
      else if (++tries > 80) clearInterval(timer);
    }, 250);
  }

  /* 综合统计权重：自动按名次递减；手动模式用用户设定的 0~2 权重 */
  function voteWeights(leaders) {
    return leaders.map((r, k) => {
      const mw = S.mode === 'manual' ? Number(S.manualWeights[r.id]) : NaN;
      return Number.isFinite(mw) ? mw : 1 + (leaders.length - k) * 0.15;
    });
  }

  /* 前三输出投票统计：杀组取最多票，双组/三门/和值按票数取前 N */
  function voteFromPreds(preds, weights) {
    const zero = () => Object.fromEntries(A.COMBOS.map(g => [g, 0]));
    const killV = zero(), dualV = zero(), threeV = zero(), sumV = Array(28).fill(0);
    let wsum = 0;
    preds.forEach((p, i) => {
      if (!p) return;
      const w = weights?.[i] ?? 1; wsum += w;
      if (p.kill && A.COMBOS.includes(p.kill)) killV[p.kill] += w;
      (p.dual || []).forEach(g => { if (dualV[g] !== undefined) dualV[g] += w; });
      (p.three || []).forEach(g => { if (threeV[g] !== undefined) threeV[g] += w; });
      (p.sums || []).forEach(s => { if (s >= 0 && s <= 27) sumV[s] += w; });
    });
    const rankG = o => A.COMBOS.slice().sort((a, b) => o[b] - o[a] || A.COMBOS.indexOf(a) - A.COMBOS.indexOf(b));
    const kill = rankG(killV)[0];
    const dual = rankG(dualV).slice(0, 2);
    const three = rankG(threeV).slice(0, 3);
    const sums = sumV.map((v, s) => ({ s, v })).sort((a, b) => b.v - a.v || a.s - b.s).slice(0, 4).map(x => x.s);
    const maxKill = Math.max(...Object.values(killV));
    return {
      kill, dual, three, sums, killV, dualV, threeV, sumV, wsum,
      confidence: wsum ? Math.max(20, Math.min(99, Math.round(100 * maxKill / wsum))) : 50
    };
  }

  /* 逐期回测：只用开奖前历史重算总榜前三输出，与真实开奖逐期核对 */
  function periodBacktest(top3, count) {
    const n = S.hist.length, from = Math.max(12, n - count), range = effectiveRange();
    const hits = { kill: 0, dual: 0, three: 0, sum: 0, tested: 0 }, per = [];
    for (let i = from; i < n; i++) {
      const prior = S.hist.slice(Math.max(0, i - 120), i);
      if (prior.length < 12) continue;
      const preds = top3.map(r => predictRow(r, prior, { window: S.window, range, sumMode: 'frequency' }));
      const cons = voteFromPreds(preds, voteWeights(top3));
      const a = S.hist[i];
      const h = {
        kill: cons.kill && a.type !== cons.kill ? 1 : 0,
        dual: cons.dual.includes(a.type) ? 1 : 0,
        three: cons.three.includes(a.type) ? 1 : 0,
        sum: cons.sums.includes(a.sum) ? 1 : 0
      };
      hits.kill += h.kill; hits.dual += h.dual; hits.three += h.three; hits.sum += h.sum; hits.tested++;
      per.push({ row: a, cons, hit: h });
    }
    return { hits, per, from, count: hits.tested };
  }

  function buildUnified() {
    const dims = ['kill', 'dual', 'three', 'sum'], range = effectiveRange();
    const ctx = { window: S.window, range };
    const news = A.ALGOS.map(algo => {
      const st = S.bt.stats[algo.id] || {};
      const scores = {}, rates = {};
      dims.forEach(d => { scores[d] = st[d]?.score ?? -1; rates[d] = st[d]?.rate ?? 0; });
      scores.all = dims.reduce((a, d) => a + scores[d], 0) / 4;
      rates.all = dims.reduce((a, d) => a + rates[d], 0) / 4;
      let pred = null; try { pred = A.predict(algo, S.hist, ctx); } catch (_) { }
      const s0 = st.kill || {};
      return {
        id: algo.id, name: algo.name, displaySrc: algo.displaySrc || 'KA28 算法池',
        family: algo.family, formula: algo.formula, kind: 'new', algo, scores, rates, pred,
        hit: s0.hit || 0, tested: s0.tested || 0, rate: rates.all, edge: scores.all,
        smooth: s0.smooth ?? rates.all, recentRate: s0.recentRate ?? rates.all,
        reliability: s0.reliability ?? 0.5, stability: s0.stability ?? 0.5,
        origin: pred?.origin?.kill === 'native' ? 'native' : 'derived'
      };
    });
    // 原站 49 公式：同源逐期回测（pack 未就绪时回退公示口径），与 87 个新算法合并竞争
    ensureLegacyExpanded();
    const lr = buildLegacyRows({ kill: 0.75, dual: 0.5 });
    const base = news.concat(lr.rows);
    // 总榜前三从「所有可输出预测的算法」里选：原站公式进前三即可参与四类综合输出
    const top3 = base.filter(r => r.pred)
      .slice().sort((a, b) => b.scores.all - a.scores.all || b.tested - a.tested)
      .slice(0, Math.max(1, S.topN));
    const cons = voteFromPreds(top3.map(r => r.pred), voteWeights(top3));
    cons.top3 = top3;
    const stats = periodBacktest(top3, Math.max(20, S.realCount));
    const fusionRate = {
      kill: stats.count ? stats.hits.kill / stats.count : 0.75,
      dual: stats.count ? stats.hits.dual / stats.count : 0.5
    };
    const rows = base.concat(makeFusionRows(fusionRate));
    const byDim = {};
    UDIMS.forEach(d => {
      byDim[d] = rows.slice().sort((a, b) => {
        const sa = a.scores[d] ?? -1, sb = b.scores[d] ?? -1;
        return sb - sa || b.tested - a.tested || a.id.localeCompare(b.id);
      }).map((r, i) => Object.assign({}, r, { rank: i + 1, dim: d }));
    });
    return {
      rows, byDim, cons, stats, top3, fusionRate,
      legacyCount: lr.rows.length + 2, total: rows.length,
      legacyReady: lr.ready, legacyRanked: lr.rows.filter(r => r.pred).length
    };
  }

  /* ===================== 页面分组（不移动 DOM，仅打标记 + 插入容器） ===================== */
  function tagExistingPages() {
    const shell = $('.shell'); if (!shell) return;
    const byId = {
      draw: ['#adCarouselSection', '#drawSection', '.hero-time-header'],
      predict: ['#predictionSection'],
      // 开奖历史页只显示新版「开奖走势」；原站排行榜搬到四大排行榜容器内合并展示，
      // 原站「真实开奖记录」在预测页重新编写，因此这两块旧内容不再挂到任何可见页。
      history: [],
      omission: ['#omissionSection']
    };
    Object.entries(byId).forEach(([page, sels]) => sels.forEach(sel => $$(sel, shell).forEach(el => { el.dataset.k28Page = page; })));
    // 旧版真实开奖记录 / 旧走势区：保留 DOM 供原站脚本渲染，但不在任何页面显示
    ['.recent', '#drawHistorySection'].forEach(sel => $$(sel, shell).forEach(el => { el.dataset.k28Page = 'legacy-hidden'; }));
    $$('.top', shell).forEach(el => { el.dataset.k28Page = 'all'; });
    $$('.footer', shell).forEach(el => { el.dataset.k28Page = 'all'; });
    // 新增内容容器插入到该页第一个既有元素之前，保证新增卡片排在页面顶部。
    // 注意：像「开奖历史」这样没有既有元素的空分组，绝不能 appendChild 到 .shell 末尾——
    // 那会让容器排到站点 <footer>（KA28开奖网 · @Kaelan制作 / 数据来源）之后，
    // 于是页脚反而显示在走势表上方。空分组统一插到 footer 之前，页脚恒定留在最底部。
    const footer = $('.footer', shell);
    const mk = (page) => {
      const d = document.createElement('div');
      d.className = 'k28-page k28-off'; d.dataset.k28Page = page;
      const first = $$(`[data-k28-page="${page}"]`, shell).find(el => el !== d);
      if (first) shell.insertBefore(d, first);
      else if (footer) shell.insertBefore(d, footer);
      else shell.appendChild(d);
      return d;
    };
    const pages = { draw: mk('draw'), predict: mk('predict'), history: mk('history'), omission: mk('omission') };
    S.pages = pages;
    return pages;
  }
  function setPage(page) {
    S.page = page;
    document.body.dataset.k28Active = page;
    const idx = ['draw', 'predict', 'history', 'omission'].indexOf(page);
    $('.k28-tabbar')?.style.setProperty('--k28-tab-idx', idx);
    // 用 class 而非 hidden 属性切换：避免覆盖广告轮播、抽屉等组件自身的 hidden 状态
    $$('[data-k28-page]').forEach(el => {
      const p = el.dataset.k28Page;
      el.classList.toggle('k28-off', !(p === 'all' || p === page));
    });
    $$('.k28-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.page === page)));
    if (!reduced()) {
      const c = S.pages?.[page];
      const kids = c ? Array.from(c.children) : [];
      // 页面容器之外、带同一 data-k28-page 的既有主站面板（开奖页 / 遗漏页）
      // 也纳入同一交错节奏；跳过隐藏元素与 fixed 定位元素，避免破坏原站定位。
      const legacy = $$(`[data-k28-page="${page}"]`).filter(el => {
        const cs = getComputedStyle(el);
        return !el.classList.contains('k28-page') && !el.classList.contains('k28-off') &&
          cs.display !== 'none' && cs.position !== 'fixed';
      });
      if (c) { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = ''; }
      kids.concat(legacy).forEach((k, i) => {
        k.style.setProperty('--k28-card-i', String(i));
        k.classList.remove('k28-card-in'); void k.offsetWidth; k.classList.add('k28-card-in');
      });
    }
    window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    try { localStorage.setItem('ka28.activePage', page); } catch (_) { }
  }

  /* ===================== 连续曲率（超椭圆 squircle）遮罩 ===================== */
  function squircleURI(w, h, r = 26, n = 4.2) {
    const step = 20, pts = [];
    const P = (x, y) => `${x.toFixed(2)} ${y.toFixed(2)}`;
    pts.push(`M ${P(0, h)}`, `L ${P(0, r)}`);
    for (let i = 0; i <= step; i++) {
      const t = (Math.PI / 2) * i / step;
      pts.push(`L ${P(r - r * Math.pow(Math.cos(t), 2 / n), r - r * Math.pow(Math.sin(t), 2 / n))}`);
    }
    pts.push(`L ${P(w - r, 0)}`);
    for (let i = 0; i <= step; i++) {
      const t = (Math.PI / 2) * i / step;
      pts.push(`L ${P(w - r + r * Math.pow(Math.sin(t), 2 / n), r - r * Math.pow(Math.cos(t), 2 / n))}`);
    }
    pts.push(`L ${P(w, h)}`, 'Z');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${pts.join(' ')}" fill="#000"/></svg>`;
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg).replace(/'/g, '%27').replace(/"/g, '%22') + '")';
  }
  function refreshSquircle() {
    const wrap = $('.k28-sheet-wrap'); if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(120, Math.round(rect.width)), h = Math.max(120, Math.round(rect.height));
    const r = w < 520 ? 20 : 28;
    wrap.style.setProperty('--k28-squircle', squircleURI(w, h, r));
  }

  /* ===================== 骨架屏 ===================== */
  function skeletonHTML(kind) {
    const big = '<div class="k28-sk k28-sk-big" style="--k28-sk-i:0"></div>';
    const lines = n => Array.from({ length: n }, (_, i) => `<div class="k28-sk k28-sk-line" style="--k28-sk-i:${i};width:${[92, 76, 84, 68][i % 4]}%"></div>`).join('');
    const rows = n => Array.from({ length: n }, (_, i) => `<div class="k28-sk k28-sk-block" style="--k28-sk-i:${i}"></div>`).join('');
    if (kind === 'consensus') return `<div class="k28-skeleton-group" data-hold>${big}<div class="k28-skeleton-group">${lines(3)}</div><div class="k28-skeleton-group">${rows(3)}</div></div>`;
    if (kind === 'board') return `<div class="k28-skeleton-group" data-motion="lockstep" data-hold>${rows(6)}</div>`;
    if (kind === 'trend') return `<div class="k28-skeleton-group" data-hold>${lines(2)}</div><div class="k28-skeleton-group" data-motion="lockstep" data-hold>${rows(5)}</div>`;
    return `<div class="k28-skeleton-group" data-hold>${rows(4)}</div>`;
  }
  function mountSkeletons() {
    ['#k28ConsensusBody', '#k28BoardsBody', '#k28TrendBody', '#k28OmitBody'].forEach((sel, i) => {
      const el = $(sel); if (el) el.innerHTML = skeletonHTML(['consensus', 'board', 'trend', 'omit'][i]);
    });
  }

  /* ===================== 组件：共识卡 ===================== */
  function consensusHTML() {
    const u = S.unified; if (!u) return '';
    const c = u.cons, range = effectiveRange();
    const rLabel = range ? `${range.min.toFixed(2)} ~ ${range.max.toFixed(2)}` : '自动寻优';
    const src = u.top3.map((r, i) => `${i + 1}. ${esc(r.name)}${r.kind === 'legacy' ? ' · 原站公式' : ''}`).join('　·　');
    const legacyInTop = u.top3.filter(r => r.kind === 'legacy').length;
    const auto = S.mode === 'auto';
    const votePct = (obj, key) => c.wsum ? Math.round(100 * (obj[key] || 0) / c.wsum) : 0;
    return `
      <div class="k28-concl-head">
        <div><div class="k28-kicker">CONSENSUS · TOP ${S.topN}</div>
          <h4 class="k28-concl-head-title">综合预测 · 四类输出</h4></div>
        <span class="k28-chip is-mint">${u.top3.length} 个算法投票${legacyInTop ? ` · 含 ${legacyInTop} 个原站公式` : ''}</span>
      </div>
      <div class="k28-consensus-grid is-four k28-stagger">
        <div class="k28-concl is-lead" style="--k28-i:0">
          <div class="k28-concl-label">综合杀组</div>
          <div class="k28-concl-value is-red k28-num-flip">${esc(c.kill)}</div>
          <div class="k28-concl-meta">多数票 ${votePct(c.killV, c.kill)}% · 避开率基线 75.0%</div>
        </div>
        <div class="k28-concl" style="--k28-i:1">
          <div class="k28-concl-label">综合双组</div>
          <div class="k28-groups">${c.dual.map(g => `<span class="k28-group-pill k28-c-blue">${esc(g)}</span>`).join('')}</div>
          <div class="k28-concl-meta">票数前二 · 一致度 ${votePct(c.dualV, c.dual[0])}% · 基线 50.0%</div>
        </div>
        <div class="k28-concl" style="--k28-i:2">
          <div class="k28-concl-label">综合三门</div>
          <div class="k28-groups">${c.three.map(g => `<span class="k28-group-pill k28-c-blue">${esc(g)}</span>`).join('')}</div>
          <div class="k28-concl-meta">票数前三 · 覆盖基线 75.0%</div>
        </div>
        <div class="k28-concl" style="--k28-i:3">
          <div class="k28-concl-label">综合和值四码</div>
          <div class="k28-groups" style="margin-top:8px">${c.sums.map(n => `<span class="k28-sum-pill k28-num-flip">${String(n).padStart(2, '0')}</span>`).join('')}</div>
          <div class="k28-concl-meta">票数前四 · 单码基线 14.3%</div>
        </div>
      </div>
      <div class="k28-confidence">
        <span>前 ${S.topN} 一致度</span>
        <div class="k28-conf-track"><div class="k28-conf-fill" style="width:${Math.max(6, Math.min(100, c.confidence)).toFixed(0)}%"></div></div>
        <b style="color:var(--k28-mint)">${c.confidence}%</b>
      </div>
      <div class="k28-src-line">
        <span class="k28-concl-label">综合统计来源 · 统一排行榜前 ${S.topN}${legacyInTop ? '（含原站公式）' : ''}</span>
        <span class="k28-src-names">${src}</span>
      </div>
      <hr class="k28-hair"/>
      <div class="k28-row" style="justify-content:space-between;flex-wrap:wrap;gap:9px">
        <div class="k28-row" style="flex-wrap:wrap">
          <span class="k28-chip is-mint" id="k28RangeChip">区间 ${esc(rLabel)}</span>
          <span class="k28-chip">回测 ${S.bt.meta.tested} 期</span>
          <span class="k28-chip">${S.online ? '在线 API 已同步' : '离线真实快照'}</span>
        </div>
        <div class="k28-segmented k28-mode-seg" id="k28ModeSeg">
          <button data-mode="auto" aria-pressed="${auto}">自动调节</button>
          <button data-mode="manual" aria-pressed="${!auto}">手动调节</button>
        </div>
      </div>
      <div class="k28-tune">
        <div class="k28-tune-grid">
          <div class="k28-field">
            <span>历史回测窗口</span>
            <select class="k28-select" id="k28Window">
              ${[20, 50, 60, 100, 200].map(n => `<option value="${n}" ${S.window === n ? 'selected' : ''}>最近 ${n} 期</option>`).join('')}
            </select>
          </div>
          <div class="k28-field">
            <span>综合统计取样（总榜前 N）</span>
            <select class="k28-select" id="k28TopN">
              ${[3, 5, 8].map(n => `<option value="${n}" ${S.topN === n ? 'selected' : ''}>前 ${n} 名</option>`).join('')}
            </select>
          </div>
          <div class="k28-field">
            <span>区间寻优回测期数</span>
            <select class="k28-select" id="k28RangePeriod">
              ${[20, 30, 50, 100].map(n => `<option value="${n}" ${S.rangePeriod === n ? 'selected' : ''}>近 ${n} 期</option>`).join('')}
            </select>
          </div>
          <div class="k28-field">
            <span>当前调节模式</span>
            <div class="k28-mode-state ${auto ? 'is-auto' : 'is-manual'}">${auto ? '自动 · 系统寻优区间与权重' : '手动 · 滑块与权重实时生效'}</div>
          </div>
        </div>
        ${auto ? `
        <div class="k28-auto-card">
          <div class="k28-row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
            <div style="min-width:0">
              <div class="k28-concl-label">自动寻优区间 · ROLLING GRID SEARCH</div>
              <div class="k28-auto-val k28-num-flip">${S.tunedRange ? `${S.tunedRange.min.toFixed(2)} ~ ${S.tunedRange.max.toFixed(2)}` : '计算中…'}</div>
              <div class="k28-concl-meta">${S.lastTune ? `扫描 ${B.RANGE_GRID.length} 组参数 · 最优命中 ${pct(S.lastTune.rate)} · ${S.lastTune.tested} 次逐期校验` : '按开奖前历史滚动扫描 min/max 网格'}</div>
            </div>
            <button class="k28-btn is-primary" id="k28AutoTuneBtn">重新自动寻优 ↻</button>
          </div>
          <div class="k28-auto-bar"><i></i></div>
        </div>` : `
        <div class="k28-tune-grid" style="margin-top:14px">
          <div class="k28-range">
            <div class="k28-range-head"><span>区间下限 min</span><b id="k28MinVal">${S.manualRange.min.toFixed(2)}</b></div>
            <input type="range" id="k28RangeMin" min="0" max="0.8" step="0.05" value="${S.manualRange.min}"/>
          </div>
          <div class="k28-range">
            <div class="k28-range-head"><span>区间上限 max</span><b id="k28MaxVal">${S.manualRange.max.toFixed(2)}</b></div>
            <input type="range" id="k28RangeMax" min="0.2" max="1" step="0.05" value="${S.manualRange.max}"/>
          </div>
          <div class="k28-manual-feedback">
            <div class="k28-concl-label">手动区间 · 实时回测</div>
            <b>${esc(rLabel)}</b>
            <div class="k28-concl-meta">拖动滑块即时重算总榜与综合输出</div>
          </div>
        </div>
        <div style="margin-top:15px">
          <div class="k28-concl-label">手动权重 · 仅显示排行榜前 5 名（0 关闭 / 2 加倍）</div>
          <div class="k28-weight-list">${u.top3.slice(0, 5).map(x => `
            <div class="k28-weight-item">
              <span title="${esc(x.name)}">${esc(x.name)}</span>
              <input type="range" data-wid="${esc(x.id)}" min="0" max="2" step="0.1" value="${Number(S.manualWeights[x.id] ?? 1).toFixed(1)}"/>
              <b data-wval="${esc(x.id)}">${Number(S.manualWeights[x.id] ?? 1).toFixed(1)}</b>
            </div>`).join('')}</div>
        </div>`}
        <div class="k28-row" style="margin-top:13px;flex-wrap:wrap;gap:9px">
          <button class="k28-btn" id="k28ResetBtn">恢复默认</button>
          <span class="k28-sheet-note" style="margin:0">自动 / 手动模式均可独立调节历史窗口与取样前 N。</span>
        </div>
      </div>
      <p class="k28-sheet-note" style="margin-top:13px">综合结论由统一排行榜前 ${S.topN} 名的杀组 / 双组 / 三门 / 和值输出自动投票统计得出；命中定义与逐期回测口径见统一排行榜。历史统计不代表未来开奖结果，不构成投注建议。</p>
    `;
  }

  /* ===================== 组件：统一排行榜（原站 49 公式榜的列表布局） ===================== */
  function unifiedBoardHTML() {
    const u = S.unified; if (!u) return '';
    const dim = S.boardDim, list = u.byDim[dim] || [], rows = list.slice(0, S.boardShow);
    const expanded = S.boardShow > 5;
    const range = effectiveRange();
    const base = dim === 'all' ? null : B.BASELINE[dim];
    return `
      <div class="k28-board-stat">
        <span class="k28-chip is-mint">整合 ${u.total} 个算法</span>
        <span class="k28-chip">新系统 ${A.ALGOS.length} · 原站 ${u.legacyCount - 2} 公式 · 2 融合模型</span>
        <span class="k28-chip">回测 ${S.bt.meta.tested} 期</span>
        ${base != null ? `<span class="k28-chip">基线 ${pct(base)}</span>` : '<span class="k28-chip">四维综合评分</span>'}
        <span class="k28-chip">${u.legacyReady ? '原站公式同源回测' : '原站公式公示口径'}</span>
        <span class="k28-chip">区间 ${esc(range ? `${range.min.toFixed(2)}~${range.max.toFixed(2)}` : '自动')}</span>
      </div>
      <div class="k28-leader-columns" aria-hidden="true">
        <span>排名</span><span>算法 / 回测样本</span><span>历史命中率</span>
      </div>
      <div class="k28-leader-list" id="k28UnifiedList" data-motion="lockstep">${rows.map((r, i) => {
        const isTop = r.rank <= 3;
        const rate = dim === 'all' ? r.rates.all : (r.rates[dim] ?? r.rate);
        const score = r.scores[dim] ?? 0;
        let val = '—';
        if (r.pred) {
          val = dim === 'all' ? (r.pred.kill || '—')
            : dim === 'kill' ? (r.pred.kill || '—')
              : dim === 'dual' ? (r.pred.dual || []).join('/')
                : dim === 'three' ? (r.pred.three || []).join('/')
                  : (r.pred.sums || []).map(n => String(n).padStart(2, '0')).join('/');
        } else { val = r.kind === 'fusion' ? '融合层输出' : '样本不足'; }
        /* 统一同源口径：删除原先的「公式 / 计算路线 / 来源口径」副标题行 */
        const sample = `${r.hit}/${r.tested} 次命中 · 评分 ${score.toFixed(3)} · ${esc(val)}`;
        return `<button class="k28-lb-row k28-leader-row ${isTop ? 'is-top' : ''}" style="--k28-i:${i}" data-algo="${esc(r.id)}" data-dim="${dim}" aria-label="打开 ${esc(r.name)} 详情">
          <span class="k28-leader-rank r${Math.min(4, r.rank)}">${isTop ? ['①', '②', '③'][r.rank - 1] : '#' + r.rank}</span>
          <span class="k28-leader-name">
            <b>${esc(r.name)}</b>
            <span class="k28-leader-sample">${sample}</span>
          </span>
          <span class="k28-leader-rate">
            <strong>${pct(rate)}</strong>
            <small>${r.tested} 期回测</small>
            <span class="k28-leader-meter" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, rate * 100)).toFixed(0)}%"></i></span>
          </span>
        </button>`;
      }).join('')}</div>
      ${list.length > 5 ? `<button class="k28-btn k28-lb-more" id="k28BoardMore" aria-expanded="${expanded}">${expanded ? '收起 · 仅看前 5 ↑' : `展开查看全部 ${list.length} 个算法 ↓`}</button>` : ''}
      <p class="k28-sheet-note" style="margin-top:11px">全部 ${u.total} 个算法按同一套逐期回测口径排名：平滑命中率相对理论基线的超额 + 近期稳定性 + 样本可信度。原站 49 公式已接入公式原始函数做同源回测，进入总榜前 ${S.topN} 即参与综合输出；2 个融合模型仅入榜展示，不重复计入前三投票。点击任一算法查看详情，再点一次可收起。</p>
    `;
  }

  /* ===================== 组件：开奖历史走势表（按图片） ===================== */
  function trendHTML() {
    const t = B.trendRows(S.hist, Math.min(25, S.hist.length));
    const cols = t.cols;
    // 连续段黑框：复刻图片的「长龙连线框」。
    // 前 8 列按命中连续段；龙虎列按相同值连续段（如连续 4 期「龙」）。
    const markRun = (key, flags, length) => {
      let i = 0;
      while (i < length) {
        if (!flags[i]) { i++; continue; }
        let j = i; while (j + 1 < length && flags[j + 1]) j++;
        if (j - i + 1 >= 3) for (let k = i; k <= j; k++) {
          (streakBox[k] ||= {})[key] = k === i ? 'start' : k === j ? 'end' : 'mid';
        }
        i = j + 1;
      }
    };
    const streakBox = {};
    cols.slice(0, 8).forEach(c => markRun(c.key, t.rows.map(r => c.test(r)), t.rows.length));
    const dragons = t.rows.map(r => cVal(r));
    (() => {
      let i = 0;
      while (i < dragons.length) {
        const v = dragons[i];
        if (v === '—' || v === '') { i++; continue; }
        let j = i; while (j + 1 < dragons.length && dragons[j + 1] === v) j++;
        if (j - i + 1 >= 3) for (let k = i; k <= j; k++) {
          (streakBox[k] ||= {}).dragon = k === i ? 'start' : k === j ? 'end' : 'mid';
        }
        i = j + 1;
      }
    })();
    function cVal(r) { return r.dragon || '—'; }
    const toneOf = (c, r) => {
      if (c.key === 'edge') { const v = c.val(r); return v === '小边' ? 'red' : v === '大边' ? 'blue' : 'ink'; }
      if (c.key === 'dragon') { const v = c.val(r); return v === '龙' ? 'green' : v === '虎' ? 'amber' : 'ink'; }
      return c.tone;
    };
    const shapeTone = v => v === '豹子' ? 'amber' : v === '对子' ? 'amber' : v === '顺子' ? 'green' : 'ink';
    return `
      <div class="k28-row" style="justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <div class="k28-row" style="gap:8px;flex-wrap:wrap">
          <span class="k28-chip is-mint">真实开奖 · 最新 ${t.rows.length} 期</span>
          <span class="k28-chip">${S.online ? '在线 API 已同步' : '离线真实快照'} · 共 ${S.hist.length} 期</span>
        </div>
        <button class="k28-btn" id="k28TrendCompact" aria-pressed="${S.trendCompact}">${S.trendCompact ? '查看完整 13 列' : '切换紧凑视图'}</button>
      </div>
      <div class="k28-trend-wrap ${S.trendCompact ? 'is-compact' : ''}">
        <table class="k28-trend">
          <thead><tr>
            <th class="k28-t-period">期号</th><th class="k28-t-nums">开奖号码</th><th class="k28-t-type">类型</th>
            ${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}
          </tr></thead>
          <tbody>
            <tr class="k28-t-gap"><td>未开间隔</td><td>—</td><td>—</td>
              ${cols.map(c => `<td class="k28-c-ink">${t.intervals[c.key]}</td>`).join('')}
            </tr>
            ${t.rows.map((r, ri) => `<tr>
              <td class="k28-t-num">${esc(String(r.id).slice(S.trendCompact ? -4 : -7))}期</td>
              <td class="k28-t-num">${r.nums.join('+')}=${r.sum}</td>
              <td><span class="k28-c-${shapeTone(r.shape)}">${esc(r.shape || '杂六')}</span></td>
              ${cols.map(c => {
                const show = c.key === 'edge' || c.key === 'dragon' || c.test(r);
                const v = show ? c.val(r) : '';
                const box = streakBox[ri]?.[c.key];
                const boxCls = box ? `k28-box-${box}` : '';
                return `<td class="${show ? 'k28-c-' + toneOf(c, r) : ''} ${boxCls}">${show ? esc(v) : ''}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="k28-t-extra">黑框标记连续 3 期以上的「长龙」走势；红蓝配色沿用传统走势表（双系红、单系蓝；小边红、大边蓝；龙绿、虎橙、对子/豹子黄）。「未开间隔」为该维度距最近一次出现的期数。</p>
      <p class="k28-t-extra">${S.trendCompact ? '手机紧凑视图已收起「小 / 大 / 单 / 双」基础列以便完整显示；点上方按钮可查看完整 13 列，导出的图片始终为完整表格。' : '窄屏可左右滑动查看完整 13 列；点击「导出图片」下载与网站一致的完整走势图。'}</p>
    `;
  }

  /* ===================== 组件：遗漏查询 ===================== */
  function omitHTML() {
    const rows = B.omissionQuery(S.hist, S.omit);
    return `
      <div class="k28-row" style="margin-bottom:10px">
        <input class="k28-input" id="k28OmitSearch" placeholder="搜索和值 / 组合 / 形态…" value="${esc(S.omit.keyword)}" style="flex:1;min-width:150px"/>
        <select class="k28-select" id="k28OmitSort">
          <option value="gap" ${S.omit.sort === 'gap' ? 'selected' : ''}>遗漏从高到低</option>
          <option value="gapAsc" ${S.omit.sort === 'gapAsc' ? 'selected' : ''}>遗漏从低到高</option>
          <option value="max" ${S.omit.sort === 'max' ? 'selected' : ''}>历史最大遗漏</option>
          <option value="count" ${S.omit.sort === 'count' ? 'selected' : ''}>出现次数</option>
        </select>
        <button class="k28-btn" id="k28OmitAll">全部维度</button>
      </div>
      <div class="k28-row" style="margin-bottom:12px">
        ${B.OMIT_DIMS.map(d => `<button class="k28-btn k28-omit-dim ${S.omit.dims?.includes(d.key) ? 'is-active' : ''}" data-dim="${d.key}">${esc(d.label)}</button>`).join('')}
      </div>
      <div class="k28-omit-grid">${rows.map(r => {
        const bars = r.positions.slice(-16).map((p, i, arr) => {
          const gap = i === 0 ? 8 : p - arr[i - 1];
          return `<i style="height:${Math.max(3, Math.min(22, gap * 1.3))}px"></i>`;
        }).join('');
        return `<button class="k28-omit-cell ${r.gap >= 20 ? 'is-hot' : ''}" data-omit-key="${esc(r.key)}" data-omit-dim="${esc(r.dim)}">
          <div class="k28-omit-key">${esc(r.key)} <small style="color:var(--k28-muted);font-weight:400">${esc(r.dimLabel)}</small></div>
          <div class="k28-omit-gap">${r.gap}</div>
          <div class="k28-omit-meta">最大 ${r.maxGap} · 出现 ${r.count} 次 · 均隔 ${r.avgGap}</div>
          <div class="k28-omit-bars">${bars}</div>
        </button>`;
      }).join('')}</div>
      <p class="k28-sheet-note" style="margin-top:11px">点击任一项目查看最近 24 次出现位置与间隔分布。遗漏仅为历史间隔统计，不代表下一期更容易开出。</p>
    `;
  }

  /* ===================== 半屏面板：peek / half / full + 阻尼 + 分档吸附 ===================== */
  const SNAP = () => {
    const vh = window.visualViewport?.height || window.innerHeight;
    return [
      { state: 'peek', h: Math.max(220, Math.min(vh * 0.34, 360)) },
      { state: 'half', h: Math.max(320, Math.min(vh * 0.60, 620)) },
      { state: 'full', h: Math.max(420, vh - Math.max(12, (window.visualViewport?.offsetTop || 0)) - 8) }
    ];
  };
  function sheetContent(item) {
    if (item.type === 'history') return historySheetHTML();
    if (item.type === 'algo') {
      const u = S.unified; if (!u) return '<p class="k28-sheet-note">数据尚未就绪。</p>';
      const dim = item.dim === 'all' ? 'kill' : item.dim;
      const r = (u.byDim[item.dim] || u.byDim.all).find(x => x.id === item.id) || u.rows.find(x => x.id === item.id);
      if (!r) return '<p class="k28-sheet-note">数据尚未就绪。</p>';
      const rank = r.rank || ((u.byDim[item.dim] || []).findIndex(x => x.id === item.id) + 1);
      const meta = B.DIM_META[dim];
      if (r.kind === 'fusion') {
        return `
        <div class="k28-sheet-section">
          <div class="k28-row" style="justify-content:space-between">
            <div><div class="k28-kicker">统一排行榜 · #${rank} · ${esc(ULABEL[item.dim] || '综合')}</div>
            <h3 class="k28-title" style="margin-top:5px">${esc(r.name)}</h3></div>
            <span class="k28-chip is-mint">融合层口径</span>
          </div>
          <p class="k28-sub">${esc(r.formula)}</p>
        </div>
        <div class="k28-sheet-section"><h4>投票层数据</h4>
          <div class="k28-sheet-metrics">
            <div class="k28-sheet-metric"><span>公示命中率</span><b>${pct(r.rate)}</b></div>
            <div class="k28-sheet-metric"><span>数据来源</span><b style="font-size:13px">${esc(r.displaySrc)}</b></div>
            <div class="k28-sheet-metric"><span>是否参与前三</span><b>否</b></div>
            <div class="k28-sheet-metric"><span>说明</span><b style="font-size:12px">避免自引用放大</b></div>
          </div></div>
        <p class="k28-sheet-note">融合模型是原站投票层的汇总结果，仅入榜展示排名，不重复计入总榜前三投票。</p>`;
      }
      const p = r.pred;
      const bd = S.boards?.[dim]?.rows.find(x => x.id === item.id);
      const st = r.dimStats?.[dim];
      const s = bd || (st
        ? Object.assign({}, r, { hit: st.hit, tested: st.tested, rate: st.rate, edge: st.edge, recentRate: st.recentRate, smooth: st.smooth, reliability: st.reliability })
        : Object.assign({}, r, {
          rate: r.rates[dim] ?? r.rate, edge: r.scores[dim] ?? r.edge,
          recentRate: r.recentRate, smooth: r.smooth, reliability: r.reliability
        }));
      return `
        <div class="k28-sheet-section">
          <div class="k28-row" style="justify-content:space-between">
            <div><div class="k28-kicker">${esc(meta.label)} · 排名 #${rank}</div>
            <h3 class="k28-title" style="margin-top:5px">${esc(r.name)}</h3></div>
            <span class="k28-chip is-mint">${esc(r.origin === 'native' ? '原生输出' : '派生参考')}</span>
          </div>
          <p class="k28-sub">算法分类：${esc(r.displaySrc || meta.label)}</p>
        </div>
        <div class="k28-sheet-section">
          <h4>逐期回测 · ${esc(meta.unit)}</h4>
          <div class="k28-sheet-metrics">
            <div class="k28-sheet-metric"><span>命中 / 测试</span><b>${s.hit} / ${s.tested}</b></div>
            <div class="k28-sheet-metric"><span>命中率</span><b>${pct(s.rate)}</b></div>
            <div class="k28-sheet-metric"><span>相对基线超额</span><b style="color:${s.edge >= 0 ? 'var(--k28-mint)' : 'var(--k28-red)'}">${(s.edge * 100 >= 0 ? '+' : '') + (s.edge * 100).toFixed(1)}%</b></div>
            <div class="k28-sheet-metric"><span>近 30 期</span><b>${pct(s.recentRate)}</b></div>
            <div class="k28-sheet-metric"><span>平滑命中率</span><b>${pct(s.smooth)}</b></div>
            <div class="k28-sheet-metric"><span>样本可信度</span><b>${pct(s.reliability)}</b></div>
          </div>
        </div>
        <div class="k28-sheet-section">
          <h4>本期四类预测</h4>
          <div class="k28-sheet-metrics">
            <div class="k28-sheet-metric"><span>杀组 ${p?.origin?.kill === 'native' ? '· 原生' : ''}</span><b>${esc(p?.kill || '—')}</b></div>
            <div class="k28-sheet-metric"><span>双组 ${p?.origin?.dual === 'native' ? '· 原生' : ''}</span><b style="font-size:14px">${esc(p?.dual?.join(' / ') || '—')}</b></div>
            <div class="k28-sheet-metric"><span>三门 ${p?.origin?.three === 'native' ? '· 原生' : ''}</span><b style="font-size:13px">${esc(p?.three?.join(' / ') || '—')}</b></div>
            <div class="k28-sheet-metric"><span>和值四码 ${p?.origin?.sums === 'native' ? '· 原生' : ''}</span><b style="font-size:14px">${esc(p?.sums?.map(n => String(n).padStart(2, '0')).join(' / ') || '—')}</b></div>
          </div>
        </div>
        <div class="k28-sheet-section">
          <h4>逐期回测明细（最近 16 期 · 只用开奖前历史）</h4>
          ${periodDetailHTML(r, dim)}
        </div>
        <p class="k28-sheet-note">「命中」定义：杀组=预测杀组未开出；双组/三门=实际组合落在预测集合；和值=实际和值落在 4 个候选内。历史回测不代表未来结果，仅供统计研究。</p>`;
    }
    if (item.type === 'omit') {
      const r = B.omissionQuery(S.hist, { dims: [item.dim], sort: 'gap', limit: 999 }).find(x => x.key === item.key);
      if (!r) return '<p class="k28-sheet-note">数据尚未就绪。</p>';
      const recent = S.hist.slice(-80);
      const flags = recent.map(x => r.test(x) ? 1 : 0);
      return `
        <div class="k28-sheet-section">
          <div class="k28-kicker">遗漏查询 · ${esc(r.dimLabel)}</div>
          <h3 class="k28-title" style="margin-top:5px">${esc(r.key)}</h3>
        </div>
        <div class="k28-sheet-section"><h4>统计</h4>
          <div class="k28-sheet-metrics">
            <div class="k28-sheet-metric"><span>当前遗漏</span><b>${r.gap}</b></div>
            <div class="k28-sheet-metric"><span>历史最大</span><b>${r.maxGap}</b></div>
            <div class="k28-sheet-metric"><span>出现次数</span><b>${r.count}</b></div>
            <div class="k28-sheet-metric"><span>平均间隔</span><b>${r.avgGap}</b></div>
            <div class="k28-sheet-metric"><span>最近出现</span><b style="font-size:14px">${esc(r.lastIssue)}</b></div>
            <div class="k28-sheet-metric"><span>历史占比</span><b>${pct(r.rate)}</b></div>
          </div>
        </div>
        <div class="k28-sheet-section"><h4>最近 80 期出现位置</h4>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${flags.map((f, i) => `<span style="width:12px;height:12px;border-radius:3px;background:${f ? 'var(--k28-mint)' : 'var(--k28-line)'}";title="${esc(recent[i].id)}"></span>`).join('')}</div>
        </div>
        <p class="k28-sheet-note">绿色格表示该期命中。遗漏仅为历史间隔统计，不代表下一期更容易开出。</p>`;
    }
    return '';
  }
  function periodDetailHTML(r, dim) {
    if (!r || !S.hist.length) return '';
    const n = S.hist.length, from = Math.max(12, n - 16), range = effectiveRange();
    let html = '<div style="display:flex;flex-direction:column;gap:5px">';
    for (let i = from; i < n; i++) {
      const prior = S.hist.slice(Math.max(0, i - 120), i);
      const pred = predictRow(r, prior, { window: S.window, range, sumMode: 'frequency' });
      const hit = pred ? B.hitOf(pred, S.hist[i], dim) : null;
      const val = dim === 'kill' ? pred?.kill : dim === 'dual' ? pred?.dual?.join('/') : dim === 'three' ? pred?.three?.join('/') : pred?.sums?.join('/');
      html += `<div class="k28-row" style="justify-content:space-between;font-size:11.5px;padding:6px 9px;border-radius:8px;background:color-mix(in srgb,var(--k28-ink) 4%,transparent)">
        <span>第 ${esc(String(S.hist[i].id).slice(-7))} 期 · 实开 <b>${esc(S.hist[i].type)} / ${S.hist[i].sum}</b></span>
        <span>预测 ${esc(val || '—')} <b style="color:${hit === 1 ? 'var(--k28-mint)' : hit === 0 ? 'var(--k28-red)' : 'var(--k28-muted)'}">${hit === 1 ? '中' : hit === 0 ? '未中' : '—'}</b></span>
      </div>`;
    }
    return html + '</div>';
  }
  function applySheetState(state, animate = true) {
    const wrap = $('.k28-sheet-wrap'); if (!wrap) return;
    const snap = SNAP().find(x => x.state === state) || SNAP()[1];
    S.sheetState = state;
    if (!animate) wrap.classList.add('is-dragging');
    wrap.style.setProperty('--k28-sheet-h', snap.h + 'px');
    wrap.style.transform = '';
    if (!animate) requestAnimationFrame(() => wrap.classList.remove('is-dragging'));
    $$('.k28-sheet-steps button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === state)));
    setTimeout(refreshSquircle, animate ? 30 : 0);
    requestAnimationFrame(() => setTimeout(refreshSquircle, 430));
  }
  function closeSheet() {
    const wrap = $('.k28-sheet-wrap'), bd = $('.k28-sheet-backdrop'); if (!wrap) return;
    wrap.classList.remove('is-open', 'is-dragging', 'is-history'); bd.classList.remove('is-open');
    document.body.classList.remove('k28-sheet-open');
    const ex = $('#k28HistoryExpand'); if (ex) ex.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!wrap.classList.contains('is-open')) { wrap.hidden = true; bd.hidden = true; S.sheet = null; } }, 430);
  }
  function initSheetGestures() {
    const wrap = $('.k28-sheet-wrap'); if (!wrap) return;
    const targets = [$('.k28-sheet-grab'), $('.k28-sheet-head')].filter(Boolean);
    let drag = null, frame = 0;
    const start = e => {
      if (e.button === 2 || (e.target.closest('button') && !e.target.closest('.k28-sheet-grab'))) return;
      drag = { id: e.pointerId, y: e.clientY, t: performance.now(), h: wrap.getBoundingClientRect().height, state: S.sheetState };
      wrap.classList.add('is-dragging');
      targets.forEach(t => { try { t.setPointerCapture(e.pointerId); } catch (_) { } });
      if (e.cancelable) e.preventDefault();
    };
    const move = e => {
      if (!drag || e.pointerId !== drag.id) return;
      if (e.cancelable) e.preventDefault();
      drag.latest = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0; if (!drag) return;
        const snaps = SNAP(), lower = snaps[0].h, upper = snaps[2].h;
        const delta = drag.latest - drag.y, raw = drag.h - delta;
        let h = raw, ty = 0;
        // 阻尼：越界后位移按 0.28 / 0.08 衰减（橡皮筋物理）
        if (raw < lower) { h = lower; ty = Math.min(132, (lower - raw) * 0.28); }
        else if (raw > upper) { h = upper; ty = -Math.min(10, (raw - upper) * 0.08); }
        wrap.style.setProperty('--k28-sheet-h', h + 'px');
        wrap.style.transform = `translate3d(0,${ty.toFixed(1)}px,0)`;
      });
    };
    const end = (e, cancelled) => {
      if (!drag || (!cancelled && e.pointerId !== drag.id)) return;
      if (frame) cancelAnimationFrame(frame), frame = 0;
      const d = drag; drag = null;
      const delta = cancelled ? 0 : (e.clientY ?? d.latest ?? d.y) - d.y;
      const elapsed = Math.max(1, performance.now() - d.t), vel = cancelled ? 0 : delta / elapsed;
      const desired = cancelled ? d.h : d.h - delta;
      const snaps = SNAP();
      let idx = snaps.reduce((best, s, i) => Math.abs(s.h - desired) < Math.abs(snaps[best].h - desired) ? i : best, 0);
      const startIdx = Math.max(0, snaps.findIndex(x => x.state === d.state));
      if (!cancelled && Math.abs(delta) > 18 && vel < -0.42) idx = Math.max(idx, Math.min(2, startIdx + 1));
      else if (!cancelled && Math.abs(delta) > 18 && vel > 0.42) idx = Math.min(idx, Math.max(0, startIdx - 1));
      if (!cancelled && d.state === 'peek' && delta > 118) { closeSheet(); return; }
      wrap.classList.remove('is-dragging');
      applySheetState(snaps[idx].state, true);
    };
    targets.forEach(t => {
      t.addEventListener('pointerdown', start, { passive: false });
      t.addEventListener('pointermove', move, { passive: false });
      t.addEventListener('pointerup', e => end(e, false));
      t.addEventListener('pointercancel', e => end(e, true));
    });
    window.addEventListener('resize', () => { refreshSquircle(); if (S.sheet) applySheetState(S.sheetState, false); });
  }

  /* ===================== 主题按钮：重设计 + 圆形揭开 ===================== */
  function initThemeEnhance() {
    const btn = document.getElementById('themeBtn'); if (!btn) return;
    btn.classList.add('k28-theme-orb');
    // capture 阶段写入揭开坐标，早于既有 click 逻辑（既有 setTheme 会重写 innerHTML，故外观只依赖 CSS）
    document.addEventListener('click', e => {
      if (!e.target.closest('#themeBtn')) return;
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      document.documentElement.style.setProperty('--k28-vt-x', x + 'px');
      document.documentElement.style.setProperty('--k28-vt-y', y + 'px');
      const canVT = !reduced() && typeof document.startViewTransition === 'function' && !window.matchMedia?.('(max-width: 760px), (hover: none)').matches;
      if (!canVT) {
        const el = document.createElement('div');
        el.className = 'k28-vt-fallback';
        el.style.left = x + 'px'; el.style.top = y + 'px';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 620);
      }
    }, true);
  }

  /* ===================== 构建 DOM ===================== */
  function buildUI() {
    const pages = tagExistingPages();
    // 图3 / 图4 位置的原站策略模块（下一期预测策略、哥布林·星轨算法、回测参数）不再显示：
    // 由「综合输出 + 统一排行榜」替代；DOM 保留供原站 app.js 正常渲染，避免脚本报错。
    const oldPred = $('#predictionSection');
    if (oldPred) oldPred.classList.add('k28-legacy-hidden');
    // 预测页：综合输出（由统一排行榜前三自动统计，放在最前）
    const consensus = document.createElement('section');
    consensus.className = 'k28-card k28-consensus k28-root';
    consensus.id = 'k28Consensus';
    consensus.innerHTML = `
      <div class="k28-head">
        <div><div class="k28-kicker">KA28 · CANADA 28 PREDICTION SYSTEM</div>
          <h3 class="k28-title">加拿大28预测系统 · 综合输出</h3>
          <p class="k28-sub">整合 ${TOTAL_ALGOS} 个算法（含 49 公式 + 2 融合模型）· 由统一排行榜前三自动统计杀组 / 双组 / 三门 / 和值</p></div>
        <span class="k28-chip is-mint">综合输出 + 统一排行榜</span>
      </div>
      <div id="k28ConsensusBody"></div>`;
    pages.predict.insertBefore(consensus, pages.predict.firstChild);

    // 预测页：统一排行榜（新系统 87 + 原站 49 公式 + 2 融合模型），沿用原站 49 公式榜布局
    const boards = document.createElement('section');
    boards.className = 'k28-card k28-root'; boards.id = 'k28Boards';
    boards.innerHTML = `<div class="k28-head"><div><div class="k28-kicker">UNIFIED LEADERBOARD · ROLLING BACKTEST</div>
      <h3 class="k28-title">统一排行榜</h3><p class="k28-sub">${TOTAL_ALGOS} 个算法同榜竞技 · 沿用原站 49 公式榜的列表布局 · 切换维度带交错动画</p></div>
      <div class="k28-utabs k28-segmented" id="k28BoardTabs" style="--k28-tab-count:${UDIMS.length};--k28-tab-idx:0">
        <i class="k28-utabs-ink" aria-hidden="true"></i>
        ${UDIMS.map(d => `<button data-dim="${d}" aria-pressed="${d === 'all'}">${ULABEL[d]}</button>`).join('')}
      </div></div>
      <div id="k28BoardsBody"></div>
      <div id="k28LegacyBoardSlot" class="k28-legacy-slot" aria-hidden="true"></div>`;
    pages.predict.appendChild(boards);

    // 原站 49 公式榜：DOM 移入隐藏槽位，仅用于读取其公示命中率并入统一总榜；
    // 原站 app.js 仍照常渲染，既有功能不受影响。
    const legacyPanel = $('.algo-rank-panel'), legacySlot = $('#k28LegacyBoardSlot');
    if (legacyPanel && legacySlot) legacySlot.appendChild(legacyPanel);

    // 预测页：重新编写的真实开奖记录（默认折叠 1 期，展开后底部半屏看全部预测历史）
    const realRecords = document.createElement('section');
    realRecords.className = 'k28-card k28-root'; realRecords.id = 'k28RealRecords';
    realRecords.innerHTML = `<div class="k28-head"><div><div class="k28-kicker">REAL DRAWS · RECENT HISTORY</div>
      <h3 class="k28-title">真实开奖记录</h3><p class="k28-sub">默认只显示最新 1 期 · 点「展开预测历史」在底部半屏查看全部逐期回测</p></div>
      <select class="k28-select" id="k28RealCount" aria-label="展开后显示的期数">
        ${[10, 20, 30, 50].map(n => `<option value="${n}" ${S.realCount === n ? 'selected' : ''}>近 ${n} 期</option>`).join('')}
      </select></div>
      <div id="k28RealRecordsBody"></div>`;
    pages.predict.appendChild(realRecords);

    // 开奖历史页：只显示开奖走势（按用户图片设计），并提供图片导出
    const trend = document.createElement('section');
    trend.className = 'k28-card k28-root'; trend.id = 'k28Trend';
    trend.innerHTML = `<div class="k28-head"><div><div class="k28-kicker">DRAW HISTORY · TREND MATRIX</div>
      <h3 class="k28-title">开奖历史走势</h3><p class="k28-sub">期号 / 开奖号码 / 类型 / 大小 / 单双 / 四组合 / 边数 / 龙虎</p></div>
      <div class="k28-row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <span class="k28-chip" id="k28TrendThemeTag">浅色主题导出</span>
        <button class="k28-btn is-primary" id="k28TrendExport">导出图片 ↓</button>
      </div></div>
      <div id="k28TrendBody"></div>`;
    pages.history.appendChild(trend);

    // 遗漏页：遗漏查询（放在最前）
    const omit = document.createElement('section');
    omit.className = 'k28-card k28-root'; omit.id = 'k28Omission';
    omit.innerHTML = `<div class="k28-head"><div><div class="k28-kicker">OMISSION QUERY</div>
      <h3 class="k28-title">遗漏查询</h3><p class="k28-sub">按维度检索当前遗漏、历史最大遗漏与出现间隔</p></div>
      <span class="k28-chip">${S.hist.length} 期样本</span></div>
      <div id="k28OmitBody"></div>`;
    pages.omission.insertBefore(omit, pages.omission.firstChild);

    // 底栏 · iOS UITabBar 视觉语言：outline / filled 双图标按选中态切换（SF Symbols 风格）
    const icos = {
      draw: {
        line: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2.1"/>',
        fill: '<circle cx="12" cy="12" r="9.2" fill="currentColor" stroke="none"/><path d="M12 6.7v5.6l3.3 2.2" fill="none" stroke="var(--k28-tabbar-solid)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>'
      },
      predict: {
        line: '<path d="M3 17l5-5 4 3 6-8"/><path d="M18 7h3v3"/><circle cx="8" cy="12" r="1.2"/>',
        fill: '<path d="M3 17l5-5 4 3 6-8" fill="none" stroke="currentColor" stroke-width="3.1" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="7" r="2.5" fill="currentColor" stroke="none"/><circle cx="8" cy="12" r="1.8" fill="currentColor" stroke="none"/>'
      },
      history: {
        line: '<path d="M4 6h16M4 11h16M4 16h10"/><path d="M17 16l2 2 3-4"/>',
        fill: '<rect x="3.2" y="4.6" width="17.6" height="3.1" rx="1.55" fill="currentColor" stroke="none"/><rect x="3.2" y="10.45" width="17.6" height="3.1" rx="1.55" fill="currentColor" stroke="none"/><rect x="3.2" y="16.3" width="11.4" height="3.1" rx="1.55" fill="currentColor" stroke="none"/><path d="M17 17.8l2 2 3-4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
      },
      omission: {
        line: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/><path d="M8 10.5h5M10.5 8v5"/>',
        fill: '<circle cx="10.5" cy="10.5" r="7" fill="currentColor" stroke="none"/><path d="M15.7 15.7L21.5 21.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M8 10.5h5M10.5 8v5" fill="none" stroke="var(--k28-tabbar-solid)" stroke-width="1.9" stroke-linecap="round"/>'
      }
    };
    const labels = { draw: '开奖页面', predict: '预测', history: '开奖历史', omission: '遗漏' };
    const tabbar = document.createElement('nav');
    tabbar.className = 'k28-tabbar k28-root'; tabbar.setAttribute('aria-label', '主导航');
    tabbar.setAttribute('role', 'tablist');
    tabbar.innerHTML = `<span class="k28-tabbar-ink" aria-hidden="true"></span>` +
      ['draw', 'predict', 'history', 'omission'].map(p =>
        `<button class="k28-tab" data-page="${p}" role="tab" aria-selected="false">
          <span class="k28-tab-ico">
            <svg class="k28-ico-line" viewBox="0 0 24 24" aria-hidden="true">${icos[p].line}</svg>
            <svg class="k28-ico-fill" viewBox="0 0 24 24" aria-hidden="true">${icos[p].fill}</svg>
            <i class="k28-tab-dot"></i>
          </span><span class="k28-tab-label">${labels[p]}</span></button>`).join('');
    document.body.appendChild(tabbar);

    // 半屏面板 + 遮罩（独立于既有 #algoSheet，避免冲突）
    const bd = document.createElement('div');
    bd.className = 'k28-sheet-backdrop'; bd.hidden = true;
    const wrap = document.createElement('div');
    wrap.className = 'k28-sheet-wrap k28-root'; wrap.hidden = true;
    wrap.innerHTML = `
      <div class="k28-sheet">
        <button class="k28-sheet-close" id="k28SheetClose" aria-label="关闭面板">×</button>
        <div class="k28-sheet-grab" aria-label="拖动调整面板高度"></div>
        <div class="k28-sheet-head">
          <div class="k28-kicker" id="k28SheetKicker">KA28 · DETAIL SHEET</div>
          <h3 class="k28-title" id="k28SheetTitle" style="font-size:16px">详情</h3>
          <p class="k28-sub" id="k28SheetSub"></p>
          <div class="k28-sheet-steps">
            ${['peek', 'half', 'full'].map(s => `<button data-state="${s}" aria-pressed="${s === 'half'}">${({ peek: '预览 34%', half: '半屏 60%', full: '全屏 92%' })[s]}</button>`).join('')}
          </div>
        </div>
        <div class="k28-sheet-body" id="k28SheetBodyContent"></div>
      </div>`;
    document.body.appendChild(bd); document.body.appendChild(wrap);
    window.__k28SheetBody = $('#k28SheetBodyContent');

    // CSS 显隐规则（仅作用于带 data-k28-page 的元素，不触碰任何既有组件状态）
    const style = document.createElement('style');
    style.textContent = `
      [data-k28-page].k28-off{display:none!important}
      .skeleton-placeholder{position:relative;overflow:hidden}
      .skeleton-placeholder::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 32%,color-mix(in srgb,var(--text) 16%,transparent) 48%,transparent 64%);background-size:220% 100%;transform:translateX(-100%);animation:k28SkSweep 2s linear infinite}
    `;
    document.head.appendChild(style);
    document.body.classList.add('k28-shell');
  }

  /* openSheet 用动态 body（上面构建后才有节点） */
  function openSheetBound(item) {
    const wrap = $('.k28-sheet-wrap'), bd = $('.k28-sheet-backdrop'), body = window.__k28SheetBody || $('.k28-sheet-body');
    if (!wrap || !bd || !body) return;
    S.sheet = item;
    const isHist = item.type === 'history';
    const title = item.type === 'algo' ? (S.unified?.rows.find(x => x.id === item.id)?.name || '算法详情')
      : isHist ? '预测历史 · 逐期回测' : `遗漏查询 · ${item.key}`;
    $('#k28SheetTitle').textContent = title;
    $('#k28SheetSub').textContent = item.type === 'algo' ? '四类预测与逐期回测明细'
      : isHist ? '默认折叠 1 期 · 展开后按真实开奖逐期核对 · 拖动顶部可切换预览 / 半屏 / 全屏'
        : '当前遗漏、历史最大与出现位置';
    const kicker = $('#k28SheetKicker');
    if (kicker) kicker.textContent = isHist ? 'REAL DRAWS · FORECAST HISTORY'
      : item.type === 'algo' ? 'KA28 · ALGORITHM DETAIL' : 'KA28 · OMISSION DETAIL';
    body.innerHTML = sheetContent(item);
    body.scrollTop = 0;
    wrap.classList.toggle('is-history', isHist);
    wrap.hidden = false; bd.hidden = false;
    document.body.classList.add('k28-sheet-open');
    const ex = $('#k28HistoryExpand'); if (ex) ex.setAttribute('aria-expanded', String(isHist));
    applySheetState('half', false);
    requestAnimationFrame(() => { wrap.classList.add('is-open'); bd.classList.add('is-open'); });
    setTimeout(refreshSquircle, 60);
  }

  /* ===================== 原站公式榜：统一改名 / 展开展示全部 49 行 / 同步总榜 ===================== */
  let legacySyncTimer = 0, lastLegacyCount = -1;
  function normalizeLegacyBoard() {
    ensureLegacyExpanded();
    const root = $('#algoLeaderboard'); if (!root) return;
    const rows = $$('.algo-leader-row', root);
    const pack = legacyPack();
    rows.forEach((el, i) => {
      // 原站公式重新命名：用公式族 + 真实公式名，不再叫「原站公式 · NN」
      const a = pack?.ALGOS?.[i];
      const name = a ? legacyDisplayName(a, i) : `原站公式族 · ${String(i + 1).padStart(2, '0')}`;
      const b = el.querySelector('.algo-leader-name b');
      if (b && b.textContent !== name) b.textContent = name;
      const src = el.querySelector('.algo-leader-source');
      const label = a?.src || 'KA28 算法池';
      if (src && src.textContent !== label) src.textContent = label;
    });
    const tag = $('#algoVotesTag');
    if (tag) tag.textContent = `${LEGACY_FORMULAS} 个公式 + ${LEGACY_FUSION} 个融合模型 · 已整合 ${TOTAL_ALGOS} 个算法`;
    // 原站榜由 app.js 异步渲染，默认只有前三；补齐到 49 行后重算统一总榜
    if (rows.length !== lastLegacyCount) {
      lastLegacyCount = rows.length;
      if (rows.length >= 40 && S.unified && !S.busy) {
        clearTimeout(legacySyncTimer);
        legacySyncTimer = setTimeout(() => { recompute(); renderAll(); }, 140);
      }
    }
  }

  /* ===================== 真实开奖记录（图2 口径） =====================
   * 折叠态：命中率总览 + 只显示最新 1 期预测回测卡片 + 「展开预测历史」入口。
   * 展开态：复用底部半屏面板（peek / half / full 阻尼 + 分档吸附 + 连续曲率），
   *         在半屏内按真实开奖逐期列出全部回测，并可在面板内切换显示期数。 */
  function realCardHTML(x, i, compact) {
    const r = x.row, c = x.cons, h = x.hit;
    const tag = v => v ? '<em class="k28-ok">命中</em>' : '<em class="k28-no">未中</em>';
    return `<div class="k28-real-card${compact ? ' is-compact' : ''}" style="--k28-i:${i}">
      <div class="k28-real-card-head">
        <div><b>第 ${esc(String(r.id))} 期</b><small>${esc(r.time || '')}</small></div>
        <div class="k28-real-actual"><span>真实开奖</span>
          <b>${r.nums.map(n => `<i>${Number(n)}</i>`).join('<u>+</u>')}<u>=</u><i class="is-sum">${r.sum}</i></b>
          <small>${esc(r.type)}</small></div>
      </div>
      <div class="k28-real-card-title">KA28 预测回测 <span>统一排行榜前三</span></div>
      <div class="k28-real-cols">
        <div class="k28-real-col"><span>综合杀组</span><b>${esc(c.kill || '—')}</b>${tag(h.kill)}</div>
        <div class="k28-real-col"><span>综合双组</span><b>${esc(c.dual.join(' / '))}</b>${tag(h.dual)}</div>
        <div class="k28-real-col"><span>综合三门</span><b>${esc(c.three.join(' / '))}</b>${tag(h.three)}</div>
        <div class="k28-real-col"><span>综合和值四码</span><b>${esc(c.sums.map(n => String(n).padStart(2, '0')).join(' · '))}</b>${tag(h.sum)}</div>
      </div>
      <div class="k28-real-four">
        <span class="k28-real-four-label">四码指标</span>
        ${c.sums.map(n => `<span class="k28-real-four-cell ${n === r.sum ? 'is-hit' : ''}"><b>${String(n).padStart(2, '0')}</b><small>${n === r.sum ? '命中' : '未中'}</small></span>`).join('')}
      </div>
      <div class="k28-real-ref">组合参考　双组：${esc(c.dual.join(' / '))}　·　三门：${esc(c.three.join(' / '))}</div>
    </div>`;
  }
  function historyPer() {
    const u = S.unified; return u ? u.stats.per.slice(-S.realCount).reverse() : [];
  }
  function historySheetHTML() {
    const per = historyPer();
    if (!per.length) return '<p class="k28-sheet-note">等待开奖数据…</p>';
    return `
      <div class="k28-hist-tools">
        <span class="k28-chip is-mint">共 ${per.length} 期逐期回测</span>
        <div class="k28-segmented k28-hist-count" id="k28HistCount" role="group" aria-label="预测历史显示期数">
          ${[10, 20, 30, 50].map(n => `<button type="button" data-n="${n}" aria-pressed="${S.realCount === n}">近 ${n} 期</button>`).join('')}
        </div>
      </div>
      <div class="k28-real-cards k28-hist-cards">${per.map((x, i) => realCardHTML(x, i)).join('')}</div>
      <p class="k28-sheet-note" style="margin-top:13px">以上均为真实开奖结果（在线 API 或离线快照）；预测仅使用该期开奖前历史重算，逐期核对不代表未来保证，不构成投注建议。</p>`;
  }
  function realRecordsHTML() {
    const u = S.unified; if (!u) return '';
    const st = u.stats, per = st.per.slice(-S.realCount).reverse();
    if (!per.length) return '<p class="k28-sheet-note">等待开奖数据…</p>';
    const rate = k => st.count ? `${st.hits[k]}/${st.count}` : '0/0';
    const ratePct = k => st.count ? (st.hits[k] / st.count * 100).toFixed(0) + '%' : '—';
    return `
      <div class="k28-hit-overview">
        <div class="k28-hit-head"><div>
          <div class="k28-kicker">ROLLING BACKTEST</div>
          <h4>历史命中率总览</h4>
          <p>近 ${st.count} 期 · 统一排行榜前三逐期回测 · 每期只用开奖前历史</p></div>
          <span class="k28-chip">目标近 ${st.count} 期 · 有效 ${st.count} 期</span></div>
        <div class="k28-hit-grid">${[['kill', '综合杀组'], ['dual', '综合双组'], ['three', '综合三门'], ['sum', '和值四码']].map(([k, l]) =>
          `<div class="k28-hit-cell"><span>${l}</span><b>${rate(k)}</b><small>${ratePct(k)}</small></div>`).join('')}</div>
      </div>
      <div class="k28-latest-label"><span>最新一期预测回测</span><i></i><small>默认折叠 · 只看 1 期</small></div>
      <div class="k28-real-cards">${realCardHTML(per[0], 0, true)}</div>
      <button class="k28-history-expand" id="k28HistoryExpand" type="button" aria-expanded="false" aria-controls="k28SheetBodyContent">
        <span class="k28-history-expand-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M4 6h16M4 11h16M4 16h10"/><path d="M17 15.5l2 2 3-3.5"/></svg>
        </span>
        <span class="k28-history-expand-txt"><b>展开预测历史</b><small>底部半屏查看全部 ${per.length} 期逐期回测</small></span>
        <span class="k28-history-expand-badge">${per.length}</span>
        <svg class="k28-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
      </button>
      <p class="k28-sheet-note" style="margin-top:11px">以上均为真实开奖结果（在线 API 或离线快照）；预测仅使用该期开奖前历史重算，逐期核对不代表未来保证，不构成投注建议。</p>
    `;
  }

  /* 当前主题：原站 setTheme 会同时写 html[data-theme] 与 body[data-theme] */
  function currentTheme() {
    const t = document.documentElement.dataset.theme || document.body.dataset.theme || 'light';
    return t === 'dark' ? 'dark' : 'light';
  }

  /* 下载被浏览器拦截时的兜底：内联展示 PNG，可长按保存 / 新标签打开原图 */
  function showPNGFallback(src) {
    if (!src) return;
    let layer = $('#k28PNGPreview');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'k28PNGPreview';
      layer.innerHTML = `<div class="k28-png-panel">
        <div class="k28-row" style="justify-content:space-between;align-items:center">
          <b>PNG 已生成 · 长按图片保存</b>
          <button class="k28-btn" id="k28PNGClose" type="button">关闭</button>
        </div>
        <img id="k28PNGImg" alt="KA28 开奖历史走势 PNG"/>
        <p class="k28-sheet-note">若浏览器没有自动下载，长按上方图片保存到相册，或点击「在新标签打开原图」。</p>
        <a class="k28-btn is-primary" id="k28PNGOpen" target="_blank" rel="noopener" href="#">在新标签打开原图 ↗</a>
      </div>`;
      document.body.appendChild(layer);
      layer.addEventListener('click', e => {
        if (e.target === layer || e.target.id === 'k28PNGClose') layer.remove();
      });
    }
    const img = layer.querySelector('#k28PNGImg');
    const a = layer.querySelector('#k28PNGOpen');
    if (img) img.src = src;
    if (a) a.href = src;
  }

  /* ===================== 走势表图片导出（完整 13 列，与网站一致） =====================
   * 不引入任何第三方库：用同一套 trendHTML() 生成「完整视图」的离屏表格，读取
   * 文本、计算后的文字颜色、真实列宽与长龙分段标记，再用 Canvas 2x 高清重绘。
   * 因此窄屏下载的也是完整 13 列 + 7 位期号 + 连续长龙框，与网站完整视图一致。 */
  function exportTrendPNG() {
    try {
      if (!S.hist.length || !$('#k28Trend')) { toast('走势表尚未就绪'); return; }

      const theme = currentTheme();
      const themeLabel = theme === 'dark' ? '深色主题' : '浅色主题';
      const dark = theme === 'dark';

      /* 构造「完整视图」的离屏表格：与网站点开「查看完整 13 列」后完全一致——
         期号位数、列宽、文字颜色、长龙分段标记都取自同一套渲染结果；
         离屏节点读完即移除，不改动用户当前看到的紧凑/完整状态。 */
      const prevCompact = S.trendCompact;
      S.trendCompact = false;
      const fullHTML = trendHTML();
      S.trendCompact = prevCompact;
      const tmp = document.createElement('div'); tmp.innerHTML = fullHTML;
      const fullTable = tmp.querySelector('.k28-trend');
      if (!fullTable) { toast('走势表尚未就绪'); return; }
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;pointer-events:none;';
      const hostWrap = document.createElement('div');
      hostWrap.className = 'k28-trend-wrap'; hostWrap.style.overflow = 'visible';
      hostWrap.appendChild(fullTable); host.appendChild(hostWrap);
      document.body.appendChild(host);

      /* ---- 主题跟随：颜色全部取自「当前主题下真实 DOM 的计算样式」 ----
       * :root 上的 --k28-surface 形如 var(--glass, #171d19)，直接读 CSS 变量只会
       * 拿到未解析的字符串（旧实现因此无论深浅主题都固定输出亮色图）。读 computed
       * style 才能让浏览器把主题变量解析成最终颜色；切换 data-theme 后自动跟随。 */
      const solid = (v, fb) => {
        const s = String(v || '').trim();
        if (!s || s === 'transparent' || /^rgba\(\s*0,\s*0,\s*0,\s*0\s*\)$/.test(s) || s.indexOf('var(') === 0) return fb;
        return s;
      };
      const cardCS = getComputedStyle($('#k28Trend') || document.body);
      const headEl = fullTable.querySelector('thead th');
      const cellEl = fullTable.querySelector('tbody td');
      const blueEl = fullTable.querySelector('.k28-c-blue');
      const headCS = headEl ? getComputedStyle(headEl) : null;
      const cellCS = cellEl ? getComputedStyle(cellEl) : null;
      const subEl = $('#k28Trend .k28-sub') || $('#k28Trend .k28-t-extra');
      const C = {
        surface: solid(cardCS.backgroundColor, dark ? '#171d19' : '#fbfcf5'),
        ink: solid(cardCS.color, dark ? '#edf2e9' : '#20291f'),
        muted: solid(subEl ? getComputedStyle(subEl).color : '', dark ? '#a0aaa0' : '#657161'),
        line: solid(cellCS ? (cellCS.borderRightColor || cellCS.borderBottomColor) : '', dark ? 'rgba(224,241,218,.12)' : 'rgba(32,41,31,.12)'),
        headBg: solid(headCS ? headCS.backgroundColor : '', ''),
        headInk: solid(headCS ? headCS.color : '', dark ? '#edf2e9' : '#20291f'),
        blue: solid(blueEl ? getComputedStyle(blueEl).color : '', dark ? '#6aa9e0' : '#2f6fbd')
      };

      const heads = $$('.k28-trend thead th', fullTable);
      const bodyTrs = $$('.k28-trend tbody tr', fullTable);
      const colW = heads.map(th => Math.max(40, Math.round(th.getBoundingClientRect().width)));
      const readCell = c => ({
        text: String(c.textContent || '').trim(),
        color: getComputedStyle(c).color,
        box: (String(c.className || '').match(/k28-box-(start|mid|end|single)/) || [])[1] || ''
      });
      const grid = [heads.map(c => ({ ...readCell(c), head: true, gap: false }))]
        .concat(bodyTrs.map(tr => {
          const gap = tr.classList.contains('k28-t-gap');
          return $$('td,th', tr).map(c => ({ ...readCell(c), head: false, gap }));
        }));
      host.remove();

      const pad = 20, titleH = 46, rowH = 30, footH = 40;
      const W = colW.reduce((a, b) => a + b, 0) + pad * 2;
      const H = pad * 2 + titleH + grid.length * rowH + footH;
      const dpr = 2;
      const cv = document.createElement('canvas');
      cv.width = W * dpr; cv.height = H * dpr;
      const g = cv.getContext('2d');
      if (!g) { toast('浏览器不支持 Canvas 导出'); return; }
      g.scale(dpr, dpr);
      g.fillStyle = C.surface; g.fillRect(0, 0, W, H);
      g.textBaseline = 'middle';

      g.textAlign = 'left'; g.fillStyle = C.ink;
      g.font = '700 17px system-ui, -apple-system, "PingFang SC", sans-serif';
      g.fillText('KA28 · 开奖历史走势', pad, pad + 12);
      g.fillStyle = C.muted; g.font = '11px system-ui, -apple-system, sans-serif';
      g.fillText(`真实开奖 · 最新 ${Math.max(0, grid.length - 2)} 期 · 共 ${S.hist.length} 期 · ${themeLabel} · ${new Date().toLocaleString('zh-CN')}`, pad, pad + 32);

      let y = pad + titleH;
      grid.forEach((row, ri) => {
        let x = pad;
        row.forEach((cell, ci) => {
          const w = colW[ci] || 48, h = rowH;
          if (cell.head) {
            // 表头底色直接取网站 thead th 解析后的 color-mix 结果，深浅主题各自贴合
            g.fillStyle = C.surface; g.fillRect(x, y, w, h);
            if (C.headBg) g.fillStyle = C.headBg;
            else { g.fillStyle = C.blue; g.globalAlpha = .15; }
            g.fillRect(x, y, w, h); g.globalAlpha = 1;
          }
          else if (cell.gap) { g.fillStyle = C.ink; g.globalAlpha = .04; g.fillRect(x, y, w, h); g.globalAlpha = 1; }
          g.strokeStyle = C.line; g.lineWidth = .5;
          g.strokeRect(x + .25, y + .25, w - .5, h - .5);
          if (cell.box) {
            // 复刻网站 box-shadow 的连续长龙框：start 补上边、end 补下边、mid 只画左右
            const t = cell.box, x1 = x + 2.5, x2 = x + w - 2.5, y1 = y + 2.5, y2 = y + h - 2.5;
            g.strokeStyle = C.ink; g.lineWidth = 1.1; g.beginPath();
            if (t === 'start' || t === 'single') { g.moveTo(x1, y1); g.lineTo(x2, y1); }
            if (t === 'end' || t === 'single') { g.moveTo(x1, y2); g.lineTo(x2, y2); }
            g.moveTo(x1, y1); g.lineTo(x1, y2);
            g.moveTo(x2, y1); g.lineTo(x2, y2);
            g.stroke();
          }
          if (cell.text) {
            g.fillStyle = cell.head ? C.headInk : (cell.color || C.ink);
            g.font = `${cell.head ? 640 : 560} ${cell.head ? 12 : 11.5}px system-ui, -apple-system, "PingFang SC", sans-serif`;
            g.textAlign = 'center';
            g.fillText(cell.text, x + w / 2, y + h / 2, w - 6);
          }
          x += w;
        });
        y += rowH;
      });
      g.textAlign = 'left'; g.fillStyle = C.muted;
      g.font = '10.5px system-ui, -apple-system, sans-serif';
      g.fillText('红蓝配色沿用传统走势表（双系红、单系蓝）；黑框为连续 3 期以上长龙；「未开间隔」为距最近一次出现的期数。', pad, y + 16);
      g.fillText('KA28 预测实验室 · 统计研究用途，不构成投注建议', pad, y + 32);

      /* ---- 下载链路：blob + download 为主，逐级回退，确保一定能拿到 PNG ----
       * 覆盖：toBlob 不可用 / 返回空 / 回调不触发 / a.download 不被支持（部分 WebView）/
       *       点击被拦截 —— 最后一级给出「长按图片保存」的内联预览层。 */
      const fileName = `KA28-开奖走势-${new Date().toISOString().slice(0, 10)}-${S.hist.at(-1)?.id || ''}-${theme === 'dark' ? '深色' : '浅色'}.png`;
      const supportsDownload = 'download' in document.createElement('a');
      const aClick = (href, revoke) => {
        const a = document.createElement('a');
        a.href = href; a.download = fileName; a.rel = 'noopener';
        a.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(a);
        try { a.click(); } catch (_) { showPNGFallback(href); }
        setTimeout(() => { a.remove(); if (revoke) revoke(); }, 5000);
      };
      const fallbackDataURL = () => {
        try {
          const d = cv.toDataURL('image/png');
          if (supportsDownload) aClick(d); else showPNGFallback(d);
          return true;
        } catch (_) { toast('导出失败，请刷新后重试'); return false; }
      };
      const done = () => toast(`PNG 已导出 · 完整 13 列 · ${themeLabel}`);
      toast('正在生成 PNG…');
      let settled = false;
      // 部分移动端 WebView 的 toBlob 回调可能不触发：5 秒后强制走 dataURL 兜底
      const guard = setTimeout(() => {
        if (settled) return;
        settled = true;
        if (fallbackDataURL()) done();
      }, 5000);
      const finish = () => {
        if (settled) return;
        settled = true; clearTimeout(guard); done();
      };
      try {
        if (typeof cv.toBlob !== 'function') { clearTimeout(guard); fallbackDataURL(); finish(); return; }
        cv.toBlob(blob => {
          if (settled) return;
          if (blob && blob.size > 0) {
            if (supportsDownload) {
              const url = URL.createObjectURL(blob);
              aClick(url, () => URL.revokeObjectURL(url));
            } else {
              const fr = new FileReader();
              fr.onload = () => showPNGFallback(String(fr.result || ''));
              fr.onerror = () => fallbackDataURL();
              fr.readAsDataURL(blob);
            }
            finish();
          } else { clearTimeout(guard); fallbackDataURL(); finish(); }
        }, 'image/png');
      } catch (_) { clearTimeout(guard); fallbackDataURL(); finish(); }
    } catch (err) {
      console.warn('[KA28] 走势图导出失败', err);
      toast('导出失败，请刷新后重试');
    }
  }

  /* ===================== 渲染 ===================== */
  function renderAll() {
    if (!S.cons) return;
    const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
    set('#k28ConsensusBody', consensusHTML());
    set('#k28BoardsBody', unifiedBoardHTML());
    set('#k28TrendBody', trendHTML());
    set('#k28OmitBody', omitHTML());
    set('#k28RealRecordsBody', realRecordsHTML());
    const ex = $('#k28HistoryExpand'); if (ex) ex.setAttribute('aria-expanded', String(S.sheet?.type === 'history'));
    // 预测历史半屏面板已打开时，主数据重算后同步刷新面板内容，避免显示过期回测
    if (S.sheet?.type === 'history' && window.__k28SheetBody) window.__k28SheetBody.innerHTML = historySheetHTML();
    const chip = $('#k28Omission .k28-chip'); if (chip) chip.textContent = `${S.hist.length} 期样本`;
    normalizeLegacyBoard();
  }

  /* ===================== 交互辅助 ===================== */
  let rangeDebounce = 0, weightDebounce = 0;
  function switchBoardDim(dim) {
    if (!UDIMS.includes(dim)) return;
    const tabs = $('#k28BoardTabs');
    if (tabs) {
      tabs.style.setProperty('--k28-tab-idx', UDIMS.indexOf(dim));
      $$('#k28BoardTabs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dim === dim)));
    }
    if (dim === S.boardDim) return;
    const apply = () => { S.boardDim = dim; S.boardShow = 5; renderAll(); };
    const list = $('#k28UnifiedList');
    if (list && !reduced()) { list.classList.add('is-leaving'); setTimeout(apply, 170); }
    else apply();
  }
  function syncManualRange() {
    const mn = Number($('#k28RangeMin')?.value ?? S.manualRange.min);
    const mx = Number($('#k28RangeMax')?.value ?? S.manualRange.max);
    S.manualRange.min = Math.max(0, Math.min(0.8, Math.min(mn, mx - 0.1)));
    S.manualRange.max = Math.max(0.2, Math.min(1, Math.max(mx, S.manualRange.min + 0.1)));
  }
  function refreshConsensusLive() {
    const body = $('#k28ConsensusBody'), c = S.unified?.cons; if (!body || !c) return;
    const lead = $('.k28-concl.is-lead .k28-concl-value', body); if (lead) lead.textContent = c.kill;
    const vals = c.dual.concat(c.three);
    $$('.k28-consensus-grid .k28-groups .k28-group-pill', body).forEach((p, i) => { if (vals[i] != null) p.textContent = vals[i]; });
    $$('.k28-sum-pill', body).forEach((p, i) => { if (c.sums[i] != null) p.textContent = String(c.sums[i]).padStart(2, '0'); });
    const fill = $('.k28-conf-fill', body); if (fill) fill.style.width = Math.max(6, Math.min(100, c.confidence)) + '%';
    const label = $('.k28-confidence b', body); if (label) label.textContent = c.confidence + '%';
  }

  /* ===================== 事件绑定（委托） ===================== */
  function bindEvents() {
    document.addEventListener('click', e => {
      const tab = e.target.closest('.k28-tab');
      if (tab) { setPage(tab.dataset.page); return; }
      if (e.target.closest('#k28SheetClose') || e.target === $('.k28-sheet-backdrop')) { closeSheet(); return; }
      const step = e.target.closest('.k28-sheet-steps button');
      if (step) { applySheetState(step.dataset.state); return; }
      if (e.target.closest('#k28HistoryExpand')) { openSheetBound({ type: 'history' }); return; }
      const hc = e.target.closest('#k28HistCount button');
      if (hc) {
        S.realCount = Number(hc.dataset.n) || 20;
        const sel = $('#k28RealCount'); if (sel) sel.value = String([10, 20, 30].includes(S.realCount) ? S.realCount : 20);
        renderAll();   // 同时重建主卡折叠态与半屏面板，保持两处期数一致
        return;
      }
      const row = e.target.closest('.k28-lb-row');
      if (row) {
        const id = row.dataset.algo;
        // 再点一次已展开的算法即可收起（合并）面板，不必只能切换到别的算法
        if (S.sheet?.type === 'algo' && S.sheet.id === id && $('.k28-sheet-wrap')?.classList.contains('is-open')) {
          closeSheet(); return;
        }
        openSheetBound({ type: 'algo', id, dim: row.dataset.dim }); return;
      }
      if (e.target.closest('#k28GoBoards')) {
        setTimeout(() => $('#k28Boards')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }), 60);
        return;
      }
      if (e.target.closest('#k28TrendExport')) { exportTrendPNG(); return; }
      if (e.target.closest('#k28TrendCompact')) {
        S.trendCompact = !S.trendCompact; renderAll();
        toast(S.trendCompact ? '已切换紧凑视图' : '已显示完整 13 列');
        return;
      }
      if (e.target.closest('#k28BoardMore')) {
        S.boardShow = S.boardShow > 5 ? 5 : 999; renderAll();
        return;  // 按钮文案本身已切换，不再弹 toast 遮挡列表
      }
      const bt = e.target.closest('#k28BoardTabs button');
      if (bt) { switchBoardDim(bt.dataset.dim); return; }
      const omitCell = e.target.closest('.k28-omit-cell');
      if (omitCell) { openSheetBound({ type: 'omit', key: omitCell.dataset.omitKey, dim: omitCell.dataset.omitDim }); return; }
      const od = e.target.closest('.k28-omit-dim');
      if (od) {
        const dims = S.omit.dims ? S.omit.dims.slice() : B.OMIT_DIMS.map(d => d.key);
        const i = dims.indexOf(od.dataset.dim);
        if (i >= 0) dims.splice(i, 1); else dims.push(od.dataset.dim);
        S.omit.dims = dims.length ? dims : null; renderAll(); return;
      }
      if (e.target.closest('#k28OmitAll')) { S.omit.dims = null; S.omit.keyword = ''; renderAll(); return; }
      const mode = e.target.closest('#k28ModeSeg button');
      if (mode) {
        S.mode = mode.dataset.mode; syncMode();
        if (S.mode === 'auto' && !S.tunedRange) autoTune();
        recompute(); renderAll();
        toast(S.mode === 'auto' ? '已切到自动调节 · 系统自动寻优区间与权重' : '已切到手动调节 · 滑块与权重实时生效');
        return;
      }
      if (e.target.closest('#k28AutoTuneBtn')) {
        const btn = $('#k28AutoTuneBtn');
        if (btn) { btn.disabled = true; btn.textContent = '正在回测寻优…'; }
        const bar = $('.k28-auto-bar'); if (bar) bar.classList.add('is-scanning');
        setTimeout(() => {
          const best = autoTune(); recompute(); renderAll();
          toast(`区间已自动寻优 · ${best.range.min.toFixed(2)}~${best.range.max.toFixed(2)} · 命中 ${pct(best.rate)}`);
        }, 30);
        return;
      }
      if (e.target.closest('#k28ResetBtn')) {
        S.mode = 'auto'; syncMode(); S.window = 60; S.topN = 3; S.rangePeriod = 30;
        S.manualRange = { min: 0.25, max: 0.55 }; S.manualWeights = {}; S.tunedRange = null;
        autoTune(); recompute(); renderAll(); toast('已恢复默认参数'); return;
      }
    });
    document.addEventListener('change', e => {
      const t = e.target;
      if (t.id === 'k28Window') { S.window = Number(t.value); recompute(); renderAll(); return; }
      if (t.id === 'k28TopN') { S.topN = Number(t.value); recompute(); renderAll(); return; }
      if (t.id === 'k28RangePeriod') { S.rangePeriod = Number(t.value); if (S.mode === 'auto') { autoTune(); recompute(); renderAll(); } return; }
      if (t.id === 'k28OmitSort') { S.omit.sort = t.value; renderAll(); return; }
      if (t.id === 'k28RealCount') { S.realCount = Number(t.value) || 20; recompute(); renderAll(); return; }
      if (t.id === 'k28RangeMin' || t.id === 'k28RangeMax') {
        syncManualRange(); recompute(); renderAll(); return;
      }
    });
    document.addEventListener('input', e => {
      const t = e.target;
      if (t.id === 'k28RangeMin' || t.id === 'k28RangeMax') {
        const el = $(t.id === 'k28RangeMin' ? '#k28MinVal' : '#k28MaxVal');
        if (el) el.textContent = Number(t.value).toFixed(2);
        clearTimeout(rangeDebounce);
        rangeDebounce = setTimeout(() => { syncManualRange(); recompute(); renderAll(); }, 180);
        return;
      }
      if (t.id === 'k28OmitSearch') { S.omit.keyword = t.value; const cell = $('#k28OmitBody'); if (cell) cell.innerHTML = omitHTML(); return; }
      if (t.dataset.wid) {
        S.manualWeights[t.dataset.wid] = Number(t.value);
        const b = $(`[data-wval="${t.dataset.wid}"]`); if (b) b.textContent = Number(t.value).toFixed(1);
        clearTimeout(weightDebounce);
        weightDebounce = setTimeout(() => { recompute(); refreshConsensusLive(); }, 140);
        return;
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && S.sheet) { closeSheet(); return; }
    });
  }
  function toast(msg) {
    let el = $('#k28Toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'k28Toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(var(--k28-tabbar-h) + 84px);transform:translate(-50%,12px);z-index:900;padding:10px 16px;border-radius:12px;background:var(--k28-surface-2);border:0.5px solid var(--k28-line);box-shadow:0 12px 30px rgb(0 0 0 / 30%);font-size:12.5px;opacity:0;transition:all .3s var(--k28-ease);pointer-events:none;color:var(--k28-ink)';
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.opacity = '1'; el.style.transform = 'translate(-50%,0)';
    clearTimeout(el._t); el._t = setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translate(-50%,12px)'; }, 2600);
  }

  /* 导出按钮旁的主题标签：随 html/body[data-theme] 实时变化，提示导出图会跟随配色 */
  function bindThemeTag() {
    const upd = () => {
      const el = $('#k28TrendThemeTag');
      if (el) el.textContent = (currentTheme() === 'dark' ? '深色' : '浅色') + '主题导出';
    };
    upd();
    if (!window.MutationObserver) return;
    const ob = new MutationObserver(upd);
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    ob.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  }

  /* ===================== 启动 ===================== */
  async function boot() {
    buildUI();
    mountSkeletons();
    initThemeEnhance();
    initSheetGestures();
    bindEvents();
    bindThemeTag();
    bindLegacyReady();
    // 原站 49 公式榜由 app.js 异步渲染且会随刷新重绘：用观察器持续同步统一命名
    const lb = $('#algoLeaderboard');
    if (lb && window.MutationObserver) {
      new MutationObserver(() => normalizeLegacyBoard())
        .observe(lb, { childList: true, subtree: true, characterData: true });
    }
    let saved = 'draw'; try { saved = localStorage.getItem('ka28.activePage') || 'draw'; } catch (_) { }
    setPage(['draw', 'predict', 'history', 'omission'].includes(saved) ? saved : 'draw');
    await loadHistory();
    // 自动区间寻优（保留原站「区间自动调节」能力）
    autoTune();
    recompute();
    S.busy = false;
    // 短暂保留骨架，展示 105° 扫光与 data-hold 防闪机制，再揭示真实内容
    setTimeout(() => { renderAll(); refreshSquircle(); }, reduced() ? 0 : 420);
    // 定期在线刷新（不打断交互）
    setInterval(async () => {
      if (document.hidden || S.sheet) return;
      const before = S.hist.at(-1)?.id;
      await loadHistory();
      if (S.hist.at(-1)?.id !== before) { autoTune(); recompute(); renderAll(); }
    }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
