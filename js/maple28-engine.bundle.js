var MAPLE28_ENGINE = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../../root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d6a-f4aa5f523000/analysis/maple28/maple28/src/lib/engine.ts
  var engine_exports = {};
  __export(engine_exports, {
    ALGOS: () => ALGOS,
    BASE_ALGOS: () => BASE_ALGOS,
    THEO: () => THEO,
    THEO_BIG: () => THEO_BIG,
    THEO_COMBO: () => THEO_COMBO,
    THEO_ODD: () => THEO_ODD,
    THEO_ZONE: () => THEO_ZONE,
    backtest: () => backtest,
    backtestAll: () => backtestAll,
    bigOmit: () => bigOmit,
    comboIdx: () => comboIdx,
    comboOf: () => comboOf,
    comboOmit: () => comboOmit,
    derivePicks: () => derivePicks,
    dragonOmit: () => dragonOmit,
    isBig: () => isBig,
    isOdd: () => isOdd,
    movingAvg: () => movingAvg,
    oddOmit: () => oddOmit,
    ratio: () => ratio,
    rowBacktest: () => rowBacktest,
    streak: () => streak,
    sumOf: () => sumOf,
    sumOmit: () => sumOmit,
    zoneOf: () => zoneOf,
    zoneOmit: () => zoneOmit
  });
  var sumOf = (d) => d.n1 + d.n2 + d.n3;
  var isBig = (s) => s >= 14;
  var isOdd = (s) => s % 2 === 1;
  var comboOf = (s) => `${isBig(s) ? "\u5927" : "\u5C0F"}${isOdd(s) ? "\u5355" : "\u53CC"}`;
  var zoneOf = (s) => s <= 9 ? 0 : s <= 18 ? 1 : 2;
  var comboIdx = (s) => (isBig(s) ? 0 : 2) + (isOdd(s) ? 1 : 0);
  var THEO = (() => {
    const d = new Array(28).fill(0);
    for (let a = 0; a < 10; a++)
      for (let b = 0; b < 10; b++)
        for (let c = 0; c < 10; c++) d[a + b + c] += 1e-3;
    return d;
  })();
  var sum = (a) => a.reduce((x, y) => x + y, 0);
  var normalize = (p) => {
    const t = sum(p);
    if (!isFinite(t) || t <= 0) return THEO.slice();
    return p.map((v) => isFinite(v) && v > 0 ? v / t : 0);
  };
  var THEO_BIG = sum(THEO.slice(14));
  var THEO_ODD = THEO.reduce((a, v, i) => i % 2 === 1 ? a + v : a, 0);
  var THEO_ZONE = [
    sum(THEO.slice(0, 10)),
    sum(THEO.slice(10, 19)),
    sum(THEO.slice(19, 28))
  ];
  var THEO_COMBO = [0, 0, 0, 0];
  THEO.forEach((p, s) => {
    THEO_COMBO[comboIdx(s)] += p;
  });
  function fromMargins(pBig, pOdd) {
    const lb = Math.max(1e-6, Math.min(1 - 1e-6, pBig));
    const lo = Math.max(1e-6, Math.min(1 - 1e-6, pOdd));
    const p = new Array(28).fill(0);
    for (let s = 0; s < 28; s++) {
      const rb = isBig(s) ? lb / THEO_BIG : (1 - lb) / (1 - THEO_BIG);
      const ro = isOdd(s) ? lo / THEO_ODD : (1 - lo) / (1 - THEO_ODD);
      p[s] = THEO[s] * rb * ro;
    }
    return normalize(p);
  }
  function fromCombo(comboP) {
    const p = new Array(28).fill(0);
    for (let s = 0; s < 28; s++) {
      const ci = comboIdx(s);
      const base = THEO[s] / THEO_COMBO[ci];
      p[s] = Math.max(1e-6, comboP[ci]) * base;
    }
    return normalize(p);
  }
  function smoothCounts(counts, prior, kappa) {
    const n = sum(counts);
    const p = prior.map((pr, i) => (pr * kappa + (counts[i] || 0)) / (kappa + n));
    return normalize(p);
  }
  var fallback = () => ({ sumP: THEO.slice() });
  var theoAlgo = {
    id: "theo",
    name: "\u7406\u8BBA\u57FA\u7EBF",
    tag: "\u6570\u5B66",
    desc: "\u4E09\u4E2A 0\u20139 \u72EC\u7ACB\u5747\u5300\uFF0C\u76F4\u63A5\u5377\u79EF\u51FA\u548C\u503C\u5206\u5E03\uFF0C\u4E0D\u53C2\u8003\u4EFB\u4F55\u5386\u53F2\u3002\u662F\u6240\u6709\u5176\u4ED6\u7B97\u6CD5\u7684\u5BF9\u7167\u57FA\u51C6\u3002",
    run: () => fallback()
  };
  var momentumAlgo = {
    id: "momentum",
    name: "\u8FD1\u671F\u52A8\u91CF",
    tag: "\u8D8B\u52BF",
    desc: "\u6309\u534A\u8870\u671F\u505A\u6307\u6570\u52A0\u6743\u7EDF\u8BA1\u8FD1\u671F\u548C\u503C\u843D\u70B9\uFF0C\u8FD1\u671F\u5F00\u5F97\u591A\u7684\u4F4D\u7F6E\u6743\u91CD\u66F4\u9AD8\uFF0C\u518D\u4E0E\u7406\u8BBA\u5206\u5E03\u6309 7:3 \u6536\u7F29\u9632\u6B62\u8FC7\u70ED\u3002",
    run: (h) => {
      if (h.length < 6) return fallback();
      const counts = new Array(28).fill(0);
      let w = 1;
      let sw = 0;
      for (let i = h.length - 1; i >= 0; i--) {
        counts[h[i].sum] += w;
        sw += w;
        w *= 0.9;
        if (w < 1e-4) break;
      }
      const emp = counts.map((c) => c / sw);
      const p = emp.map((v, i) => v * 0.7 + THEO[i] * 0.3);
      return { sumP: normalize(p) };
    }
  };
  var gapAlgo = {
    id: "gap",
    name: "\u9057\u6F0F\u56DE\u5F52",
    tag: "\u51B7\u70ED",
    desc: "\u7EDF\u8BA1\u6BCF\u4E2A\u548C\u503C\u7684\u5F53\u524D\u9057\u6F0F\u4E0E\u5386\u53F2\u5E73\u5747\u95F4\u9694\uFF0C\u9057\u6F0F\u660E\u663E\u8D85\u51FA\u5E38\u6001\u7684\u4F4D\u7F6E\u7ED9\u4E00\u70B9\u56DE\u8865\u6743\u91CD\uFF0C\u6743\u91CD\u4E0A\u9650\u53D7\u63A7\uFF0C\u907F\u514D\u65E0\u8111\u8FFD\u51B7\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const last = new Array(28).fill(-1);
      const gaps = Array.from({ length: 28 }, () => []);
      h.forEach((d, i) => {
        if (last[d.sum] >= 0) gaps[d.sum].push(i - last[d.sum]);
        last[d.sum] = i;
      });
      const cur = last.map((v) => v < 0 ? h.length : h.length - 1 - v);
      const p = THEO.map((base, s) => {
        const g = gaps[s];
        const avg = g.length ? sum(g) / g.length : 30;
        const ratio2 = (cur[s] + 1) / (avg + 1);
        const adj = Math.max(0.55, Math.min(1.9, 1 + 0.28 * (ratio2 - 1)));
        return base * adj;
      });
      return { sumP: normalize(p) };
    }
  };
  var markovAlgo = {
    id: "markov",
    name: "\u72B6\u6001\u8F6C\u79FB",
    tag: "\u94FE\u5F0F",
    desc: "\u628A\u6BCF\u671F\u5F52\u6210\u300C\u5927\u5355/\u5927\u53CC/\u5C0F\u5355/\u5C0F\u53CC\u300D\u56DB\u6001\uFF0C\u7EDF\u8BA1\u4E00\u9636\u8F6C\u79FB\u9891\u6B21\uFF0C\u6309\u4E0A\u671F\u6240\u5904\u7684\u6001\u63A8\u7B97\u4E0B\u671F\u56DB\u6001\u6982\u7387\uFF0C\u518D\u644A\u56DE\u548C\u503C\u3002",
    run: (h) => {
      if (h.length < 24) return fallback();
      const m = Array.from({ length: 4 }, () => new Array(4).fill(0));
      for (let i = 1; i < h.length; i++) m[comboIdx(h[i - 1].sum)][comboIdx(h[i].sum)] += 1;
      const cur = comboIdx(h[h.length - 1].sum);
      const row = m[cur];
      const total = sum(row);
      const comboP = [0, 0, 0, 0].map(
        (_, j) => total === 0 ? THEO_COMBO[j] : (row[j] * 0.85 + THEO_COMBO[j] * 0.15 * total) / (total * 0.85 + total * 0.15)
      );
      return { sumP: fromCombo(comboP) };
    }
  };
  var cycleAlgo = {
    id: "cycle",
    name: "\u5468\u671F\u5171\u632F",
    tag: "\u8282\u594F",
    desc: "\u5BF9\u5927\u5C0F\u5E8F\u5217\u4E0E\u5355\u53CC\u5E8F\u5217\u5206\u522B\u505A\u81EA\u76F8\u5173\u626B\u63CF\uFF0C\u627E\u51FA\u663E\u8457\u4E3B\u5468\u671F\uFF0C\u6309\u76F8\u4F4D\u4E0A\u7684\u5386\u53F2\u53D6\u5411\u52A0\u6743\u9884\u6D4B\uFF0C\u6355\u6349\u5F00\u5956\u7684\u8282\u594F\u6BB5\u3002",
    run: (h) => {
      if (h.length < 40) return fallback();
      const B = h.map((d) => isBig(d.sum) ? 1 : -1);
      const O = h.map((d) => isOdd(d.sum) ? 1 : -1);
      const acf = (x) => {
        const n = x.length;
        const mean = sum(x) / n;
        const den = sum(x.map((v) => (v - mean) ** 2)) || 1;
        const out = [];
        for (let lag = 2; lag <= Math.min(36, Math.floor(n / 3)); lag++) {
          let c = 0;
          for (let i = lag; i < n; i++) c += (x[i] - mean) * (x[i - lag] - mean);
          out.push(c / den);
        }
        return out;
      };
      const vote = (ac, x) => {
        let bestLag = 0;
        let best = 0;
        ac.forEach((v, i) => {
          if (Math.abs(v) > Math.abs(best)) {
            best = v;
            bestLag = i + 2;
          }
        });
        if (Math.abs(best) < 0.12) return 0;
        const n = x.length;
        let acc = 0;
        for (let k = 1; k <= 4; k++) {
          const idx = n - bestLag * k;
          if (idx >= 0) acc += x[idx] * best ** (k - 1);
        }
        return Math.max(-1, Math.min(1, acc / 2.2));
      };
      const vb = vote(acf(B), B);
      const vo = vote(acf(O), O);
      const pBig = THEO_BIG + vb * 0.16;
      const pOdd = THEO_ODD + vo * 0.16;
      return { sumP: fromMargins(pBig, pOdd) };
    }
  };
  var bayesAlgo = {
    id: "bayes",
    name: "\u8D1D\u53F6\u65AF\u540E\u9A8C",
    tag: "\u6982\u7387",
    desc: "\u5148\u9A8C\u53D6\u7406\u8BBA\u6982\u7387\u3001\u5F3A\u5EA6 \u03BA=14\uFF0C\u7528\u5168\u90E8\u5386\u53F2\u66F4\u65B0\u540E\u9A8C\u3002\u6837\u672C\u5C11\u65F6\u8D34\u8FD1\u7406\u8BBA\uFF0C\u6837\u672C\u591A\u65F6\u9010\u6B65\u76F8\u4FE1\u6570\u636E\uFF0C\u4E0D\u4F1A\u56E0\u4E3A\u51E0\u671F\u8FDE\u5F00\u5C31\u8FC7\u5EA6\u503E\u659C\u3002",
    run: (h) => {
      if (h.length < 10) return fallback();
      const K = 14;
      const nBig = h.filter((d) => isBig(d.sum)).length;
      const nOdd = h.filter((d) => isOdd(d.sum)).length;
      const n = h.length;
      const pBig = (THEO_BIG * K + nBig) / (K + n);
      const pOdd = (THEO_ODD * K + nOdd) / (K + n);
      return { sumP: fromMargins(pBig, pOdd) };
    }
  };
  var modAlgo = {
    id: "mod",
    name: "\u4F59\u6570\u5171\u632F",
    tag: "\u4F59\u6570",
    desc: "\u5206\u522B\u7EDF\u8BA1\u548C\u503C\u5BF9 3\u3001\u5BF9 4\u3001\u5BF9 5 \u53D6\u4F59\u7684\u5386\u53F2\u5206\u5E03\uFF0C\u7528\u8D1D\u53F6\u65AF\u5E73\u6ED1\u540E\u6309\u4F3C\u7136\u6BD4\u52A0\u6743\u5230\u6BCF\u4E2A\u548C\u503C\u4E0A\uFF0C\u6355\u6349\u4F59\u6570\u5C42\u9762\u7684\u504F\u597D\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const K = 10;
      const build = (m) => {
        const c = new Array(m).fill(0);
        h.forEach((d) => c[d.sum % m]++);
        const n = h.length;
        const p2 = c.map((v) => (v + K / m) / (n + K));
        return p2;
      };
      const p3 = build(3);
      const p4 = build(4);
      const p5 = build(5);
      const p = THEO.map((base, s) => {
        const t3 = sum(THEO.filter((_, i) => i % 3 === s % 3));
        const t4 = sum(THEO.filter((_, i) => i % 4 === s % 4));
        const t5 = sum(THEO.filter((_, i) => i % 5 === s % 5));
        const r = p3[s % 3] / t3 * Math.pow(p4[s % 4] / t4, 0.7) * Math.pow(p5[s % 5] / t5, 0.5);
        return base * Math.max(0.6, Math.min(1.7, r));
      });
      return { sumP: normalize(p) };
    }
  };
  var shapeAlgo = {
    id: "shape",
    name: "\u5F62\u6001\u8DDF\u968F",
    tag: "\u5F62\u6001",
    desc: "\u6309\u4E0A\u671F\u5F62\u6001\uFF08\u8C79\u5B50 / \u5BF9\u5B50 / \u987A\u5B50 / \u6742\u516D\uFF09\u5206\u7EC4\uFF0C\u7EDF\u8BA1\u5386\u53F2\u4E0A\u540C\u7C7B\u5F62\u6001\u4E4B\u540E\u7684\u548C\u503C\u843D\u70B9\uFF0C\u9884\u6D4B\u4E0B\u671F\u5206\u5E03\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const cur = h[h.length - 1].shape || "\u6742\u516D";
      const counts = new Array(28).fill(0);
      let n = 0;
      for (let i = 0; i < h.length - 1; i++) {
        if ((h[i].shape || "\u6742\u516D") === cur) {
          counts[h[i + 1].sum]++;
          n++;
        }
      }
      if (n < 8) return fallback();
      return { sumP: smoothCounts(counts, THEO, 12) };
    }
  };
  var dragonAlgo = {
    id: "dragon",
    name: "\u9F99\u864E\u8DDF\u968F",
    tag: "\u4F4D\u7F6E",
    desc: "\u7528\u4E0A\u671F\u7684\u9F99\u864E\u5173\u7CFB\u4E0E\u4F4D\u7F6E\u6863\uFF08\u5C0F\u8FB9 / \u4E2D / \u5927\u8FB9\uFF09\u4F5C\u6761\u4EF6\uFF0C\u7EDF\u8BA1\u5386\u53F2\u540C\u6761\u4EF6\u4E0B\u7684\u548C\u503C\u5206\u5E03\uFF0C\u9A8C\u8BC1\u9996\u4F4D\u4E0E\u672B\u4F4D\u7684\u529B\u91CF\u5BF9\u6BD4\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const curD = h[h.length - 1].dragon;
      const curP = h[h.length - 1].pos || "\u4E2D";
      const key = (d) => `${d.dragon}|${d.pos || "\u4E2D"}`;
      const counts = new Array(28).fill(0);
      let n = 0;
      for (let i = 0; i < h.length - 1; i++) {
        if (key(h[i]) === `${curD}|${curP}`) {
          counts[h[i + 1].sum]++;
          n++;
        }
      }
      if (n < 10) {
        const c2 = new Array(28).fill(0);
        let n2 = 0;
        for (let i = 0; i < h.length - 1; i++) {
          if (h[i].dragon === curD) {
            c2[h[i + 1].sum]++;
            n2++;
          }
        }
        if (n2 < 10) return fallback();
        return { sumP: smoothCounts(c2, THEO, 14) };
      }
      return { sumP: smoothCounts(counts, THEO, 12) };
    }
  };
  var FUSION_W = {
    theo: 0.1,
    momentum: 0.18,
    gap: 0.09,
    markov: 0.15,
    cycle: 0.11,
    bayes: 0.14,
    mod: 0.08,
    shape: 0.08,
    dragon: 0.07
  };
  var fusionAlgo = {
    id: "fusion",
    name: "\u878D\u5408\u6A21\u578B",
    tag: "\u96C6\u6210",
    desc: "\u628A\u4E0A\u9762\u4E5D\u5957\u7B97\u6CD5\u7684\u5206\u5E03\u6309\u5404\u81EA\u7A33\u5B9A\u6027\u52A0\u6743\u5408\u6210\uFF1A\u8D8B\u52BF\u4E0E\u8F6C\u79FB\u7ED9\u8F83\u9AD8\u6743\u91CD\uFF0C\u7384\u5B66\u7C7B\u6761\u4EF6\u5206\u5E03\u7ED9\u4F4E\u6743\u91CD\uFF0C\u957F\u671F\u8868\u73B0\u6700\u7A33\u3002",
    run: (h) => {
      const p = new Array(28).fill(0);
      for (const a of BASE_ALGOS) {
        const w = FUSION_W[a.id] ?? 0.05;
        const f = a.run(h).sumP;
        for (let i = 0; i < 28; i++) p[i] += f[i] * w;
      }
      return { sumP: normalize(p) };
    }
  };
  var BASE_ALGOS = [
    theoAlgo,
    momentumAlgo,
    gapAlgo,
    markovAlgo,
    cycleAlgo,
    bayesAlgo,
    modAlgo,
    shapeAlgo,
    dragonAlgo
  ];
  var ALGOS = [...BASE_ALGOS, fusionAlgo];
  function derivePicks(sumP) {
    const pBig = sum(sumP.slice(14));
    const pOdd = sumP.reduce((a, v, i) => i % 2 === 1 ? a + v : a, 0);
    const zone = [
      sum(sumP.slice(0, 10)),
      sum(sumP.slice(10, 19)),
      sum(sumP.slice(19, 28))
    ];
    const combo = [0, 0, 0, 0];
    sumP.forEach((p, s) => {
      combo[comboIdx(s)] += p;
    });
    let pickZone = 0;
    zone.forEach((v, i) => {
      if (v > zone[pickZone]) pickZone = i;
    });
    let pickCombo = 0;
    combo.forEach((v, i) => {
      if (v > combo[pickCombo]) pickCombo = i;
    });
    let kill = 0;
    combo.forEach((v, i) => {
      if (v < combo[kill]) kill = i;
    });
    const ranked = sumP.map((p, s) => ({ s, p })).sort((a, b) => b.p - a.p);
    const topSums = ranked.slice(0, 6);
    let bestLo = 0;
    let bestCover = 0;
    for (let lo = 0; lo <= 19; lo++) {
      const c = sum(sumP.slice(lo, lo + 9));
      if (c > bestCover) {
        bestCover = c;
        bestLo = lo;
      }
    }
    const topZone = Math.max(...zone);
    const topP = ranked[0].p;
    const zoneBase = Math.max(...THEO_ZONE);
    const edge = topZone - zoneBase;
    const confidence = Math.max(0.25, Math.min(0.78, 0.38 + edge * 0.9 + (topP - 0.11) * 1.2));
    return {
      big: { p: pBig, pick: pBig >= 0.5 ? "\u5927" : "\u5C0F" },
      odd: { p: pOdd, pick: pOdd >= 0.5 ? "\u5355" : "\u53CC" },
      zone: { p: zone, pick: pickZone },
      combo: { p: combo, pick: pickCombo, kill },
      topSums,
      band: { lo: bestLo, hi: bestLo + 8, cover: bestCover },
      confidence
    };
  }
  var KILL_BASE = 0.75;
  function backtest(h, algo, window = 100) {
    const end = h.length - 1;
    const start = Math.max(20, end - window);
    let n = 0;
    let big = 0;
    let odd = 0;
    let zone = 0;
    let kill = 0;
    for (let i = start; i < end; i++) {
      const hist = h.slice(0, i);
      if (hist.length < 20) continue;
      const f = algo.run(hist);
      const picks = derivePicks(f.sumP);
      const act = h[i];
      n++;
      if (picks.big.p >= 0.5 === isBig(act.sum)) big++;
      if (picks.odd.p >= 0.5 === isOdd(act.sum)) odd++;
      if (picks.zone.pick === zoneOf(act.sum)) zone++;
      if (picks.combo.kill !== comboIdx(act.sum)) kill++;
    }
    const safe = (v) => n ? v / n : 0;
    const bigRate = safe(big);
    const oddRate = safe(odd);
    const doubleRate = (bigRate + oddRate) / 2;
    const zoneRate = safe(zone);
    const killRate = safe(kill);
    const zoneBase = Math.max(...THEO_ZONE);
    const lift = 0.35 * (doubleRate / 0.5 - 1) + 0.35 * (zoneRate / zoneBase - 1) + 0.3 * (killRate / KILL_BASE - 1);
    return {
      id: algo.id,
      name: algo.name,
      tag: algo.tag,
      desc: algo.desc,
      n,
      bigRate,
      oddRate,
      doubleRate,
      zoneRate,
      killRate,
      avgConfidence: 0,
      score: Math.round((100 + lift * 100) * 10) / 10,
      zoneBase
    };
  }
  function backtestAll(h, window = 100) {
    return ALGOS.map((a) => backtest(h, a, window)).sort((x, y) => y.score - x.score);
  }
  function rowBacktest(h, algo = fusionAlgo, n = 60) {
    const out = [];
    const end = h.length - 1;
    const start = Math.max(20, end - n);
    for (let i = start; i < end; i++) {
      const hist = h.slice(0, i);
      if (hist.length < 20) continue;
      const picks = derivePicks(algo.run(hist).sumP);
      const act = h[i];
      out.push({
        nbr: act.nbr,
        time: act.time,
        sum: act.sum,
        combo: comboOf(act.sum),
        zone: zoneOf(act.sum),
        predBig: picks.big.p >= 0.5,
        predOdd: picks.odd.p >= 0.5,
        predZone: picks.zone.pick,
        predKill: picks.combo.kill,
        okBig: picks.big.p >= 0.5 === isBig(act.sum),
        okOdd: picks.odd.p >= 0.5 === isOdd(act.sum),
        okZone: picks.zone.pick === zoneOf(act.sum),
        okKill: picks.combo.kill !== comboIdx(act.sum)
      });
    }
    return out.reverse();
  }
  function omitFor(h, token, keys, label) {
    const lastIdx = /* @__PURE__ */ new Map();
    const maxGap = /* @__PURE__ */ new Map();
    const gaps = /* @__PURE__ */ new Map();
    h.forEach((d, i) => {
      const k = token(d);
      if (lastIdx.has(k)) {
        const g = i - lastIdx.get(k);
        const arr = gaps.get(k) || [];
        arr.push(g);
        gaps.set(k, arr);
        maxGap.set(k, Math.max(maxGap.get(k) || 0, g));
      }
      lastIdx.set(k, i);
    });
    const n = h.length;
    return keys.map((k) => {
      const li = lastIdx.has(k) ? lastIdx.get(k) : -1;
      const g = gaps.get(k) || [];
      return {
        key: label(k),
        cur: li < 0 ? n : n - 1 - li,
        never: li < 0,
        max: maxGap.get(k) || 0,
        avg: g.length ? Math.round(sum(g) / g.length * 10) / 10 : 0,
        lastNbr: li >= 0 ? h[li].nbr : null,
        lastTime: li >= 0 ? h[li].time : null
      };
    });
  }
  var sumOmit = (h) => omitFor(h, (d) => d.sum, Array.from({ length: 28 }, (_, i) => i), (k) => `${k}`);
  var bigOmit = (h) => omitFor(h, (d) => isBig(d.sum) ? "\u5927" : "\u5C0F", ["\u5927", "\u5C0F"], (k) => k);
  var oddOmit = (h) => omitFor(h, (d) => isOdd(d.sum) ? "\u5355" : "\u53CC", ["\u5355", "\u53CC"], (k) => k);
  var zoneOmit = (h) => omitFor(h, (d) => zoneOf(d.sum), [0, 1, 2], (k) => ["\u4F4E\u95E8", "\u4E2D\u95E8", "\u9AD8\u95E8"][k]);
  var comboOmit = (h) => omitFor(h, (d) => comboOf(d.sum), ["\u5927\u5355", "\u5927\u53CC", "\u5C0F\u5355", "\u5C0F\u53CC"], (k) => k);
  var dragonOmit = (h) => omitFor(h, (d) => d.dragon || "\u548C", ["\u9F99", "\u864E", "\u548C"], (k) => k);
  function streak(h) {
    if (!h.length) return { big: { key: "\u2014", length: 0 } };
    const cur = isBig(h[h.length - 1].sum) ? "\u5927" : "\u5C0F";
    let n = 0;
    for (let i = h.length - 1; i >= 0; i--) {
      if ((isBig(h[i].sum) ? "\u5927" : "\u5C0F") === cur) n++;
      else break;
    }
    return { big: { key: cur, length: n } };
  }
  function ratio(h, n) {
    const sub = h.slice(-n);
    if (!sub.length) return { big: 0.5, odd: 0.5, dragon: 0.5, avg: 13.5 };
    return {
      big: sub.filter((d) => isBig(d.sum)).length / sub.length,
      odd: sub.filter((d) => isOdd(d.sum)).length / sub.length,
      dragon: sub.filter((d) => d.dragon === "\u9F99").length / sub.length,
      avg: sum(sub.map((d) => d.sum)) / sub.length
    };
  }
  function movingAvg(values, win) {
    return values.map((_, i) => {
      if (i < win - 1) return null;
      let s = 0;
      for (let k = i - win + 1; k <= i; k++) s += values[k];
      return s / win;
    });
  }
  return __toCommonJS(engine_exports);
})();
