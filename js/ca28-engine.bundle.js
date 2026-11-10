var CA28_ENGINE = (() => {
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

  // ../../root/.codebuddy/artifact/2f8a7d30-9c21-4f0b-1d6a-f4aa5f523000/analysis/ca28/src/lib/engine.ts
  var engine_exports = {};
  __export(engine_exports, {
    ALGOS: () => ALGOS,
    ALGO_META: () => ALGO_META,
    HI_CONF: () => HI_CONF,
    THEO: () => THEO,
    THEO_BIG: () => THEO_BIG,
    THEO_COMBO: () => THEO_COMBO,
    THEO_MAX_ZONE: () => THEO_MAX_ZONE,
    THEO_ODD: () => THEO_ODD,
    THEO_ZONE: () => THEO_ZONE,
    backtest: () => backtest,
    backtestAll: () => backtestAll,
    bigOmit: () => bigOmit,
    bigPick: () => bigPick,
    comboIdx: () => comboIdx,
    comboKill: () => comboKill,
    comboOf: () => comboOf,
    comboOmit: () => comboOmit,
    comboPick: () => comboPick,
    consensus: () => consensus,
    derivePicks: () => derivePicks,
    dragonOmit: () => dragonOmit,
    getAlgo: () => getAlgo,
    isBig: () => isBig,
    isOdd: () => isOdd,
    movingAvg: () => movingAvg,
    norm: () => norm,
    oddOmit: () => oddOmit,
    oddPick: () => oddPick,
    ratio: () => ratio,
    rowBacktest: () => rowBacktest,
    streaks: () => streaks,
    sumOf: () => sumOf,
    sumOmit: () => sumOmit,
    zoneOf: () => zoneOf,
    zoneOmit: () => zoneOmit,
    zonePick: () => zonePick
  });
  var sumOf = (d) => d.n1 + d.n2 + d.n3;
  var isBig = (s) => s >= 14;
  var isOdd = (s) => s % 2 === 1;
  var comboOf = (s) => `${isBig(s) ? "\u5927" : "\u5C0F"}${isOdd(s) ? "\u5355" : "\u53CC"}`;
  var zoneOf = (s) => s <= 9 ? 0 : s <= 18 ? 1 : 2;
  var comboIdx = (s) => (isBig(s) ? 0 : 2) + (isOdd(s) ? 0 : 1);
  var zeros = () => new Array(28).fill(0);
  var total = (a) => a.reduce((x, y) => x + y, 0);
  var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  var THEO = (() => {
    const d = new Array(28).fill(0);
    for (let a = 0; a < 10; a++)
      for (let b = 0; b < 10; b++)
        for (let c = 0; c < 10; c++) d[a + b + c] += 1e-3;
    return d;
  })();
  var THEO_BIG = THEO.slice(14).reduce((a, v) => a + v, 0);
  var THEO_ODD = THEO.reduce((a, v, i) => i % 2 === 1 ? a + v : a, 0);
  var THEO_ZONE = [
    THEO.slice(0, 10).reduce((a, v) => a + v, 0),
    THEO.slice(10, 19).reduce((a, v) => a + v, 0),
    THEO.slice(19).reduce((a, v) => a + v, 0)
  ];
  var THEO_COMBO = [0, 0, 0, 0];
  THEO.forEach((p, s) => {
    THEO_COMBO[comboIdx(s)] += p;
  });
  var THEO_MAX_ZONE = Math.max(...THEO_ZONE);
  var THEO_MOD3 = [0, 0, 0];
  var THEO_MOD4 = [0, 0, 0, 0];
  var THEO_MOD5 = [0, 0, 0, 0, 0];
  THEO.forEach((p, s) => {
    THEO_MOD3[s % 3] += p;
    THEO_MOD4[s % 4] += p;
    THEO_MOD5[s % 5] += p;
  });
  function norm(p) {
    const t = total(p);
    if (!isFinite(t) || t <= 0) return THEO.slice();
    return p.map((v) => isFinite(v) && v > 0 ? v / t : 0);
  }
  var mix = (a, b, w) => norm(a.map((v, i) => v * w + b[i] * (1 - w)));
  function smooth(counts, prior, kappa) {
    const n = total(counts);
    return norm(prior.map((pr, i) => (pr * kappa + (counts[i] || 0)) / (kappa + n)));
  }
  function fromMargins(pBig, pOdd) {
    const lb = clamp(pBig, 1e-4, 1 - 1e-4);
    const lo = clamp(pOdd, 1e-4, 1 - 1e-4);
    const p = new Array(28).fill(0);
    for (let s = 0; s < 28; s++) {
      const rb = isBig(s) ? lb / THEO_BIG : (1 - lb) / (1 - THEO_BIG);
      const ro = isOdd(s) ? lo / THEO_ODD : (1 - lo) / (1 - THEO_ODD);
      p[s] = THEO[s] * rb * ro;
    }
    return norm(p);
  }
  function fromCombo(comboP) {
    const p = new Array(28).fill(0);
    for (let s = 0; s < 28; s++) {
      const ci = comboIdx(s);
      p[s] = Math.max(1e-6, comboP[ci]) * (THEO[s] / Math.max(1e-9, THEO_COMBO[ci]));
    }
    return norm(p);
  }
  function fromMod(modP, k, theoMod) {
    const p = new Array(28).fill(0);
    for (let s = 0; s < 28; s++) {
      const m = s % k;
      p[s] = THEO[s] * (Math.max(1e-6, modP[m]) / Math.max(1e-9, theoMod[m]));
    }
    return norm(p);
  }
  function gauss(mu, sd) {
    const s = clamp(sd, 2.5, 9);
    return norm(new Array(28).fill(0).map((_, i) => Math.exp(-0.5 * ((i - mu) / s) ** 2)));
  }
  var avg = (a) => a.length ? total(a) / a.length : 0;
  function shapeOf(d) {
    const v = [d.n1, d.n2, d.n3].sort((a, b) => a - b);
    if (v[0] === v[2]) return "\u8C79\u5B50";
    if (v[0] + 1 === v[1] && v[1] + 1 === v[2]) return "\u987A\u5B50";
    if (v[0] === v[1] || v[1] === v[2]) return "\u5BF9\u5B50";
    return "\u6742\u516D";
  }
  function derivePicks(sumP) {
    const p = norm(sumP);
    let pBig = 0;
    let pOdd = 0;
    const zone = [0, 0, 0];
    const combo = [0, 0, 0, 0];
    p.forEach((v, s) => {
      if (isBig(s)) pBig += v;
      if (isOdd(s)) pOdd += v;
      zone[zoneOf(s)] += v;
      combo[comboIdx(s)] += v;
    });
    const order = p.map((v, s) => ({ s, v })).sort((a, b) => b.v - a.v);
    const sumTop = order.slice(0, 5).map((x) => x.s);
    const target = 0.6;
    let lo = order[0].s;
    let hi = order[0].s;
    let covered = order[0].v;
    let cursor = 1;
    while (covered < target && cursor < order.length) {
      const s = order[cursor].s;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
      covered += order[cursor].v;
      cursor++;
    }
    const killSums = order.slice(-4).map((x) => x.s);
    const kl = p.reduce((a, v, s) => a + Math.max(0, v) * Math.log(Math.max(1e-6, v) / THEO[s]), 0);
    const conf = clamp(kl * 22, 0, 1);
    return {
      big: pBig,
      odd: pOdd,
      zone,
      combo,
      sumTop,
      range: [lo, hi],
      rangeCover: covered,
      killSums,
      sumP: p,
      zoneKill: zone.indexOf(Math.min(...zone)),
      zoneKillTheo: THEO_ZONE.indexOf(Math.min(...THEO_ZONE)),
      conf
    };
  }
  var bigPick = (p) => p.big >= 0.5 ? "\u5927" : "\u5C0F";
  var oddPick = (p) => p.odd >= 0.5 ? "\u5355" : "\u53CC";
  var zonePick = (p) => p.zone.indexOf(Math.max(...p.zone));
  var comboPick = (p) => p.combo.indexOf(Math.max(...p.combo));
  var comboKill = (p) => p.combo.indexOf(Math.min(...p.combo));
  var fallback = () => ({ sumP: THEO.slice() });
  var A_THEO = {
    id: "theo",
    name: "\u7406\u8BBA\u57FA\u7EBF",
    tag: "\u6570\u5B66",
    desc: "\u4E09\u4E2A 0\u20139 \u72EC\u7ACB\u5747\u5300\uFF0C\u76F4\u63A5\u5377\u79EF\u51FA\u548C\u503C\u5206\u5E03\uFF0C\u4E0D\u770B\u4EFB\u4F55\u5386\u53F2\u3002\u662F\u6240\u6709\u7B97\u6CD5\u7684\u5BF9\u7167\u57FA\u51C6\uFF0C\u4EE3\u8868\u300C\u5B8C\u5168\u968F\u673A\u300D\u65F6\u7684\u6700\u4F18\u89E3\u3002",
    run: () => fallback()
  };
  var A_MOMENTUM = {
    id: "momentum",
    name: "\u52A8\u91CF\u52A0\u6743",
    tag: "\u8D8B\u52BF",
    desc: "\u6309\u534A\u8870\u671F\u5BF9\u5386\u53F2\u505A\u6307\u6570\u52A0\u6743\uFF0C\u8D8A\u8FD1\u7684\u671F\u6743\u91CD\u8D8A\u5927\uFF0C\u518D\u4E0E\u7406\u8BBA\u5206\u5E03\u6536\u7F29\uFF0C\u6293\u8FD1\u671F\u70ED\u5EA6\u8FC1\u79FB\u3002",
    run: (h) => {
      if (h.length < 8) return fallback();
      const c = zeros();
      let w = 1;
      let sw = 0;
      for (let i = h.length - 1; i >= 0 && w > 1e-3; i--) {
        c[h[i].sum] += w;
        sw += w;
        w *= 0.9;
      }
      return { sumP: smooth(c, THEO, sw * 0.55) };
    }
  };
  var A_HOT = {
    id: "hot",
    name: "\u70ED\u53F7\u8FFD\u8E2A",
    tag: "\u51B7\u70ED",
    desc: "\u7EDF\u8BA1\u6700\u8FD1 40 \u671F\u548C\u503C\u9891\u7387\uFF0C\u7528\u7406\u8BBA\u5206\u5E03\u505A\u5C0F\u5F3A\u5EA6\u5E73\u6ED1\uFF0C\u70ED\u53F7\u8F7B\u63A8\uFF0C\u907F\u514D\u5C0F\u6837\u672C\u566A\u58F0\u88AB\u653E\u5927\u3002",
    run: (h) => {
      if (h.length < 12) return fallback();
      const c = zeros();
      for (const d of h.slice(-40)) c[d.sum]++;
      return { sumP: smooth(c, THEO, 18) };
    }
  };
  var A_COLD = {
    id: "cold",
    name: "\u51B7\u53F7\u56DE\u8865",
    tag: "\u51B7\u70ED",
    desc: "\u7528\u8FD1 70 \u671F\u5B9E\u9645\u9891\u7387\u4E0E\u7406\u8BBA\u9891\u7387\u7684\u6BD4\u503C\u53CD\u5411\u52A0\u6743\uFF0C\u51B7\u53F7\u7ED9\u4E00\u70B9\u56DE\u8865\u6743\u91CD\uFF0C\u5E45\u5EA6\u786C\u6027\u9650\u5236\u5728 0.72\u20131.35 \u4E4B\u95F4\uFF0C\u4E0D\u65E0\u8111\u8FFD\u51B7\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const c = zeros();
      for (const d of h.slice(-70)) c[d.sum]++;
      const emp = smooth(c, THEO, 14);
      const p = THEO.map((base, s) => {
        const ratio2 = base / Math.max(emp[s], 1e-5);
        return base * clamp(Math.pow(ratio2, 0.3), 0.72, 1.35);
      });
      return { sumP: norm(p) };
    }
  };
  var A_GAP = {
    id: "gap",
    name: "\u9057\u6F0F\u56DE\u5F52",
    tag: "\u9057\u6F0F",
    desc: "\u7B97\u6BCF\u4E2A\u548C\u503C\u7684\u5F53\u524D\u9057\u6F0F\u4E0E\u5386\u53F2\u5E73\u5747\u95F4\u9694\u4E4B\u6BD4\uFF0C\u660E\u663E\u8D85\u671F\u7684\u4F4D\u7F6E\u7ED9\u56DE\u5F52\u6743\u91CD\uFF0C\u4E0A\u9650\u53D7\u63A7\u3002",
    run: (h) => {
      if (h.length < 25) return fallback();
      const last = new Array(28).fill(-1);
      const gaps = Array.from({ length: 28 }, () => []);
      h.forEach((d, i) => {
        if (last[d.sum] >= 0) gaps[d.sum].push(i - last[d.sum]);
        last[d.sum] = i;
      });
      const cur = last.map((v) => v < 0 ? h.length : h.length - 1 - v);
      const p = THEO.map((base, s) => {
        const g = gaps[s];
        const mean = g.length ? total(g) / g.length : 26;
        const ratio2 = (cur[s] + 1) / (mean + 1);
        return base * clamp(1 + 0.3 * (ratio2 - 1), 0.6, 1.85);
      });
      return { sumP: norm(p) };
    }
  };
  var A_BAYES = {
    id: "bayes",
    name: "\u8D1D\u53F6\u65AF\u540E\u9A8C",
    tag: "\u6982\u7387",
    desc: "\u4EE5\u7406\u8BBA\u5206\u5E03\u4E3A\u5148\u9A8C\u3001\u8FD1 90 \u671F\u89C2\u6D4B\u4E3A\u8BC1\u636E\u505A Dirichlet \u540E\u9A8C\u66F4\u65B0\uFF0C\u6837\u672C\u8D8A\u591A\u8D8A\u4FE1\u6570\u636E\uFF0C\u5148\u9A8C\u5F3A\u5EA6 26\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const c = zeros();
      for (const d of h.slice(-90)) c[d.sum]++;
      return { sumP: smooth(c, THEO, 26) };
    }
  };
  var A_MARKOV = {
    id: "markov",
    name: "\u4E00\u9636\u94FE",
    tag: "\u8F6C\u79FB",
    desc: "\u4EE5\u300C\u4E0A\u4E00\u671F\u548C\u503C\u300D\u4E3A\u72B6\u6001\uFF0C\u7528\u8DDD\u79BB\u6838\uFF08\u8D8A\u63A5\u8FD1\u4E0A\u671F\u548C\u503C\u7684\u6837\u672C\u6743\u91CD\u8D8A\u9AD8\uFF09\u7EDF\u8BA1\u4E0B\u4E00\u671F\u843D\u70B9\uFF0C\u5F97\u5230\u6761\u4EF6\u8F6C\u79FB\u5206\u5E03\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const last = h[h.length - 1].sum;
      const c = zeros();
      for (let i = 1; i < h.length; i++) {
        const w = Math.exp(-Math.abs(h[i - 1].sum - last) / 1.7);
        if (w > 0.03) c[h[i].sum] += w;
      }
      return { sumP: smooth(c, THEO, 12) };
    }
  };
  var A_MARKOV2 = {
    id: "markov2",
    name: "\u7EC4\u5408\u94FE",
    tag: "\u8F6C\u79FB",
    desc: "\u4EE5\u300C\u5927\u5355/\u5927\u53CC/\u5C0F\u5355/\u5C0F\u53CC\u300D\u56DB\u6001\u4E3A\u72B6\u6001\u505A\u4E00\u9636\u8F6C\u79FB\uFF0C\u7EDF\u8BA1\u5386\u53F2\u4E0A\u540C\u7EC4\u5408\u4E4B\u540E\u7684\u4E0B\u4E00\u671F\u7EC4\u5408\uFF0C\u518D\u644A\u56DE\u548C\u503C\u3002",
    run: (h) => {
      if (h.length < 24) return fallback();
      const last = comboIdx(h[h.length - 1].sum);
      const c = [0, 0, 0, 0];
      for (let i = 1; i < h.length; i++) {
        if (comboIdx(h[i - 1].sum) === last) c[comboIdx(h[i].sum)]++;
      }
      const n = total(c);
      const p = c.map((v) => (v + 0.25 * 8) / (n + 8));
      return { sumP: fromCombo(p) };
    }
  };
  var A_POSITION = {
    id: "position",
    name: "\u4F4D\u7F6E\u72EC\u7ACB",
    tag: "\u7ED3\u6784",
    desc: "\u628A\u4E09\u4E2A\u5F00\u5956\u6570\u5B57\u62C6\u5F00\uFF0C\u5404\u81EA\u7EDF\u8BA1\u8FD1 80 \u671F\u7684 0\u20139 \u5206\u5E03\uFF08\u5411\u5747\u5300\u6536\u7F29\uFF09\uFF0C\u518D\u5377\u79EF\u6210\u548C\u503C\u5206\u5E03\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const sub = h.slice(-80);
      const cnt = [new Array(10).fill(0), new Array(10).fill(0), new Array(10).fill(0)];
      for (const d of sub) {
        cnt[0][d.n1]++;
        cnt[1][d.n2]++;
        cnt[2][d.n3]++;
      }
      const pd = cnt.map((c) => c.map((v) => (v + 3) / (sub.length + 30)));
      const p = zeros();
      for (let a = 0; a < 10; a++)
        for (let b = 0; b < 10; b++)
          for (let c = 0; c < 10; c++) p[a + b + c] += pd[0][a] * pd[1][b] * pd[2][c];
      return { sumP: mix(norm(p), THEO, 0.55) };
    }
  };
  var A_CYCLE = {
    id: "cycle",
    name: "\u5468\u671F\u5171\u632F",
    tag: "\u5468\u671F",
    desc: "\u5BF9\u6700\u8FD1 72 \u671F\u548C\u503C\u5E8F\u5217\u505A\u79BB\u6563\u5085\u91CC\u53F6\u53D8\u6362\uFF0C\u53D6\u632F\u5E45\u6700\u5F3A\u7684\u4E09\u4E2A\u5468\u671F\uFF0C\u628A\u5386\u53F2\u4E2D\u540C\u76F8\u4F4D\u7684\u4E0B\u4E00\u671F\u843D\u70B9\u52A0\u6743\u6C47\u603B\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const N = Math.min(h.length, 72);
      const seq = h.slice(-N).map((d) => d.sum);
      const mean = avg(seq);
      const amps = [];
      for (let k = 2; k <= 18; k++) {
        let re = 0;
        let im = 0;
        for (let t = 0; t < N; t++) {
          const ang = 2 * Math.PI * k * t / N;
          re += (seq[t] - mean) * Math.cos(ang);
          im += (seq[t] - mean) * Math.sin(ang);
        }
        amps.push({ k, amp: Math.hypot(re, im) / N });
      }
      amps.sort((a, b) => b.amp - a.amp);
      const c = zeros();
      for (const { k, amp } of amps.slice(0, 3)) {
        for (let t = 0; t + 1 < N; t++) {
          if ((N - t) % k === 0) c[seq[t + 1]] += Math.max(0.08, amp);
        }
      }
      return { sumP: smooth(c, THEO, 10) };
    }
  };
  var A_MOD3 = {
    id: "mod3",
    name: "012 \u8DEF",
    tag: "\u4F59\u6570",
    desc: "\u7EDF\u8BA1\u548C\u503C\u9664 3 \u4F59\u6570\u7684\u8F6C\u79FB\u5173\u7CFB\uFF080/1/2 \u8DEF\uFF09\uFF0C\u5F97\u51FA\u4E0B\u4E00\u671F\u4F59\u6570\u5206\u5E03\uFF0C\u518D\u6309\u7406\u8BBA\u7ED3\u6784\u644A\u56DE\u5177\u4F53\u548C\u503C\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const last = h[h.length - 1].sum % 3;
      const c = [0, 0, 0];
      for (let i = 1; i < h.length; i++) if (h[i - 1].sum % 3 === last) c[h[i].sum % 3]++;
      const n = total(c);
      const p = c.map((v, j) => (v + THEO_MOD3[j] * 8) / (n + 8));
      return { sumP: fromMod(p, 3, THEO_MOD3) };
    }
  };
  var A_MOD4 = {
    id: "mod4",
    name: "\u56DB\u8DEF\u4F59\u6570",
    tag: "\u4F59\u6570",
    desc: "\u540C 012 \u8DEF\u601D\u8DEF\uFF0C\u6362\u6210\u9664 4 \u4F59\u6570\u56DB\u6001\u8F6C\u79FB\uFF0C\u7C92\u5EA6\u66F4\u7EC6\u3001\u6837\u672C\u8981\u6C42\u66F4\u9AD8\uFF0C\u7528\u7406\u8BBA\u503C\u505A\u5F3A\u5EA6 6 \u7684\u5E73\u6ED1\u3002",
    run: (h) => {
      if (h.length < 28) return fallback();
      const last = h[h.length - 1].sum % 4;
      const c = [0, 0, 0, 0];
      for (let i = 1; i < h.length; i++) if (h[i - 1].sum % 4 === last) c[h[i].sum % 4]++;
      const n = total(c);
      const p = c.map((v, j) => (v + THEO_MOD4[j] * 6) / (n + 6));
      return { sumP: fromMod(p, 4, THEO_MOD4) };
    }
  };
  var A_MOD5 = {
    id: "mod5",
    name: "\u4E94\u8DEF\u4F59\u6570",
    tag: "\u4F59\u6570",
    desc: "\u9664 5 \u4F59\u6570\u4E94\u6001\u8F6C\u79FB\uFF0C\u914D\u5408\u4E94\u7801\u7ED3\u6784\uFF08\u8C79\u5B50/\u987A\u5B50\u4E4B\u5916\u7684\u5C3E\u6570\u5206\u5E03\uFF09\u7ED9\u548C\u503C\u52A0\u6743\u3002",
    run: (h) => {
      if (h.length < 32) return fallback();
      const last = h[h.length - 1].sum % 5;
      const c = [0, 0, 0, 0, 0];
      for (let i = 1; i < h.length; i++) if (h[i - 1].sum % 5 === last) c[h[i].sum % 5]++;
      const n = total(c);
      const p = c.map((v, j) => (v + THEO_MOD5[j] * 5) / (n + 5));
      return { sumP: fromMod(p, 5, THEO_MOD5) };
    }
  };
  var A_SHAPE = {
    id: "shape",
    name: "\u5F62\u6001\u8DDF\u968F",
    tag: "\u5F62\u6001",
    desc: "\u628A\u6BCF\u671F\u5F52\u4E3A\u8C79\u5B50/\u987A\u5B50/\u5BF9\u5B50/\u6742\u516D\u56DB\u7C7B\uFF0C\u7EDF\u8BA1\u300C\u4E0A\u4E00\u671F\u540C\u5F62\u6001\u300D\u4E4B\u540E\u7684\u4E0B\u4E00\u671F\u548C\u503C\u5206\u5E03\uFF0C\u5224\u65AD\u5F62\u6001\u5EF6\u7EED\u65F6\u548C\u7684\u843D\u70B9\u3002",
    run: (h) => {
      if (h.length < 25) return fallback();
      const last = shapeOf(h[h.length - 1]);
      const c = zeros();
      for (let i = 1; i < h.length; i++) {
        if (shapeOf(h[i - 1]) === last) c[h[i].sum]++;
      }
      return { sumP: smooth(c, THEO, 14) };
    }
  };
  var A_DRAGON = {
    id: "dragon",
    name: "\u9F99\u864E\u8DDF\u968F",
    tag: "\u7ED3\u6784",
    desc: "\u9F99\u864E\u53CD\u6620\u4E09\u4F4D\u7684\u76F8\u5BF9\u5927\u5C0F\u7ED3\u6784\uFF0C\u7EDF\u8BA1\u540C\u9F99\u864E\u72B6\u6001\u4E4B\u540E\u7684\u4E0B\u4E00\u671F\u548C\u503C\u5206\u5E03\uFF0C\u7528\u6765\u5224\u65AD\u6781\u7AEF\u503C\u503E\u5411\u3002",
    run: (h) => {
      if (h.length < 25) return fallback();
      const last = h[h.length - 1].dragon || "\u548C";
      const c = zeros();
      for (let i = 1; i < h.length; i++) {
        if ((h[i - 1].dragon || "\u548C") === last) c[h[i].sum]++;
      }
      return { sumP: smooth(c, THEO, 16) };
    }
  };
  var A_REGRESS = {
    id: "regress",
    name: "\u5747\u503C\u56DE\u5F52",
    tag: "\u56DE\u5F52",
    desc: "\u5BF9\u8FD1 100 \u671F\u62DF\u5408\u4E00\u9636\u81EA\u56DE\u5F52 AR(1)\uFF0C\u7528\u81EA\u76F8\u5173\u7CFB\u6570\u628A\u4E0A\u671F\u548C\u503C\u5F80\u957F\u671F\u5747\u503C\u62C9\uFF0C\u5F97\u5230\u671F\u671B\u843D\u70B9\u540E\u5957\u9AD8\u65AF\u6838\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const s = h.slice(-100).map((d) => d.sum);
      const mean = avg(s);
      let cov = 0;
      let vr = 0;
      for (let i = 1; i < s.length; i++) {
        cov += (s[i - 1] - mean) * (s[i] - mean);
        vr += (s[i - 1] - mean) ** 2;
      }
      const phi = vr > 0 ? clamp(cov / vr, -0.6, 0.6) : 0;
      const pred = clamp(mean + phi * (s[s.length - 1] - mean), 2, 25);
      return { sumP: mix(gauss(pred, 5.4), THEO, 0.5) };
    }
  };
  var A_EXTREME = {
    id: "extreme",
    name: "\u6781\u503C\u8DDF\u968F",
    tag: "\u56DE\u5F52",
    desc: "\u6309\u4E0A\u671F\u548C\u503C\u628A\u5C40\u9762\u5206\u6210\u6781\u4F4E / \u5E38\u6001 / \u6781\u9AD8\u4E09\u4E2A\u533A\u95F4\uFF0C\u7EDF\u8BA1\u5386\u53F2\u4E0A\u540C\u533A\u95F4\u4E4B\u540E\u7684\u4E0B\u4E00\u671F\u843D\u70B9\uFF0C\u6355\u6349\u6781\u7AEF\u503C\u540E\u7684\u56DE\u5F52\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const bandOf = (s) => s <= 6 ? 0 : s >= 21 ? 2 : 1;
      const band = bandOf(h[h.length - 1].sum);
      const c = zeros();
      for (let i = 1; i < h.length; i++) {
        if (bandOf(h[i - 1].sum) === band) c[h[i].sum]++;
      }
      return { sumP: smooth(c, THEO, 15) };
    }
  };
  var A_ASSOC = {
    id: "assoc",
    name: "\u5173\u8054\u89C4\u5219",
    tag: "\u5173\u8054",
    desc: "\u62FF\u4E0A\u4E00\u671F\u4E09\u4E2A\u5F00\u5956\u6570\u5B57\u53BB\u5386\u53F2\u91CC\u627E\u540C\u4F4D\u7F6E\u76F8\u540C\u6216\u76F8\u90BB\u7684\u6837\u672C\uFF0C\u547D\u4E2D\u8D8A\u591A\u6743\u91CD\u8D8A\u9AD8\uFF0C\u6C47\u603B\u8FD9\u4E9B\u6837\u672C\u7684\u4E0B\u4E00\u671F\u548C\u503C\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const last = h[h.length - 1];
      const c = zeros();
      for (let i = 1; i < h.length; i++) {
        const p0 = h[i - 1];
        let w = 0;
        if (Math.abs(p0.n1 - last.n1) <= 1) w += 1;
        if (Math.abs(p0.n2 - last.n2) <= 1) w += 0.8;
        if (Math.abs(p0.n3 - last.n3) <= 1) w += 0.8;
        if (w >= 1.6) c[h[i].sum] += w;
      }
      return { sumP: smooth(c, THEO, 12) };
    }
  };
  var A_MC = {
    id: "mc",
    name: "\u8499\u7279\u5361\u6D1B",
    tag: "\u62BD\u6837",
    desc: "\u4EE5\u8FD1 150 \u671F\u4E3A\u6C60\uFF0C\u6309\u4E0E\u5F53\u524D\u548C\u503C\u7684\u63A5\u8FD1\u7A0B\u5EA6\u52A0\u6743\u505A 1200 \u6B21\u786E\u5B9A\u6027\u91CD\u91C7\u6837\uFF08\u56FA\u5B9A\u79CD\u5B50\uFF0C\u7ED3\u679C\u53EF\u590D\u73B0\uFF09\uFF0C\u7528\u62BD\u6837\u76F4\u65B9\u56FE\u4F30\u8BA1\u5206\u5E03\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const pool = h.slice(-150).map((d) => d.sum);
      const last = h[h.length - 1].sum;
      let seed = 20261109;
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      const c = zeros();
      for (let k = 0; k < 1200; k++) {
        const i = Math.floor(rnd() * pool.length);
        const v = pool[i];
        const w = Math.exp(-Math.abs(v - last) / 6);
        c[v] += 0.35 + w;
      }
      return { sumP: smooth(c, THEO, 16) };
    }
  };
  function featureRows(h, end) {
    const out = [];
    const start = Math.max(8, end - 180);
    for (let i = start; i < end; i++) {
      const prev = h.slice(Math.max(0, i - 8), i);
      const last = h[i - 1].sum;
      const m3 = avg(h.slice(Math.max(0, i - 3), i).map((d) => d.sum));
      const m8 = avg(prev.map((d) => d.sum));
      const bigR = prev.filter((d) => isBig(d.sum)).length / Math.max(1, prev.length);
      const oddR = prev.filter((d) => isOdd(d.sum)).length / Math.max(1, prev.length);
      const gapBig = (() => {
        let n = 0;
        for (let j = prev.length - 1; j >= 0; j--) {
          if (isBig(prev[j].sum)) break;
          n++;
        }
        return n;
      })();
      out.push({
        x: [1, (last - 13.5) / 4, (m3 - 13.5) / 4, (m8 - 13.5) / 4, (bigR - 0.5) * 2, (oddR - 0.5) * 2, gapBig / 5],
        big: isBig(h[i].sum) ? 1 : 0,
        odd: isOdd(h[i].sum) ? 1 : 0
      });
    }
    return out;
  }
  function sigmoid(x) {
    return 1 / (1 + Math.exp(-clamp(x, -20, 20)));
  }
  var A_LOGIT = {
    id: "logit",
    name: "\u903B\u8F91\u56DE\u5F52",
    tag: "\u5B66\u4E60",
    desc: "\u7528\u8FD1 180 \u671F\u6784\u9020 6 \u7EF4\u7279\u5F81\uFF08\u4E0A\u671F\u548C\u503C\u30013 \u671F\u5747\u503C\u30018 \u671F\u5747\u503C\u3001\u5927\u6BD4\u4F8B\u3001\u5355\u6BD4\u4F8B\u3001\u8FDE\u5927\u957F\u5EA6\uFF09\uFF0C\u5206\u522B\u8BAD\u7EC3\u5927\u5C0F\u4E0E\u5355\u53CC\u4E24\u4E2A\u7EBF\u6027\u5206\u7C7B\u5668\uFF0C\u518D\u628A\u4E24\u4E2A\u8FB9\u7F18\u6982\u7387\u5408\u6210\u548C\u503C\u5206\u5E03\u3002",
    run: (h) => {
      if (h.length < 60) return fallback();
      const rows = featureRows(h, h.length);
      if (rows.length < 40) return fallback();
      const train = (label) => {
        const w = new Array(rows[0].x.length).fill(0);
        for (let it = 0; it < 26; it++) {
          const g = new Array(w.length).fill(0);
          for (const r of rows) {
            const z = r.x.reduce((a, v, i) => a + v * w[i], 0);
            const err = sigmoid(z) - label(r);
            for (let i = 0; i < w.length; i++) g[i] += err * r.x[i];
          }
          for (let i = 0; i < w.length; i++) w[i] -= 0.18 * g[i] / rows.length;
        }
        return w;
      };
      const wb = train((r) => r.big);
      const wo = train((r) => r.odd);
      const lastR = featureRows(h, h.length).slice(-1)[0];
      const x = lastR ? lastR.x : [1, 0, 0, 0, 0, 0, 0];
      const pBig = sigmoid(x.reduce((a, v, i) => a + v * wb[i], 0));
      const pOdd = sigmoid(x.reduce((a, v, i) => a + v * wo[i], 0));
      return { sumP: mix(fromMargins(pBig, pOdd), THEO, 0.42) };
    }
  };
  var A_BIN = {
    id: "bin",
    name: "\u5206\u7BB1\u52A0\u6743",
    tag: "\u5B66\u4E60",
    desc: "\u5BF9\u6BCF\u4E2A\u7279\u5F81\u5207 5 \u4E2A\u7BB1\uFF0C\u7EDF\u8BA1\u7BB1\u5185\u5386\u53F2\u4E0A\u5F00\u51FA\u5927 / \u5355\u7684\u9891\u7387\uFF08\u62C9\u666E\u62C9\u65AF\u5E73\u6ED1\uFF09\uFF0C\u9884\u6D4B\u65F6\u5404\u7279\u5F81\u7684\u5BF9\u6570\u51E0\u7387\u76F8\u52A0\uFF0C\u662F\u68AF\u5EA6\u63D0\u5347\u6811\u7684\u8F7B\u91CF\u66FF\u4EE3\u3002",
    run: (h) => {
      if (h.length < 60) return fallback();
      const rows = featureRows(h, h.length);
      if (rows.length < 40) return fallback();
      const dim = rows[0].x.length;
      const bins = 5;
      const edge = [];
      for (let d = 0; d < dim; d++) {
        const vals = rows.map((r) => r.x[d]).sort((a, b) => a - b);
        const e = [];
        for (let b = 1; b < bins; b++) e.push(vals[Math.floor(vals.length * b / bins)]);
        edge.push(e);
      }
      const idx = (v, e) => {
        let i = 0;
        while (i < e.length && v > e[i]) i++;
        return i;
      };
      const stat = (label) => {
        const t = Array.from({ length: dim }, () => new Array(bins).fill(0));
        const f = Array.from({ length: dim }, () => new Array(bins).fill(0));
        for (const r of rows) {
          const y = label(r);
          for (let d = 0; d < dim; d++) {
            const b = idx(r.x[d], edge[d]);
            t[d][b] += y;
            f[d][b] += 1 - y;
          }
        }
        return { t, f };
      };
      const sb = stat((r) => r.big);
      const so = stat((r) => r.odd);
      const lastR = rows.slice(-1)[0];
      const score = (s) => {
        let z = 0;
        for (let d = 1; d < dim; d++) {
          const b = idx(lastR.x[d], edge[d]);
          z += Math.log((s.t[d][b] + 2) / (s.f[d][b] + 2));
        }
        return sigmoid(z * 0.55);
      };
      return { sumP: mix(fromMargins(score(sb), score(so)), THEO, 0.45) };
    }
  };
  var A_GAUSS = {
    id: "gauss",
    name: "\u6B63\u6001\u62DF\u5408",
    tag: "\u5206\u5E03",
    desc: "\u7528\u8FD1 80 \u671F\u7684\u548C\u503C\u5747\u503C\u4E0E\u6807\u51C6\u5DEE\u62DF\u5408\u6B63\u6001\u5206\u5E03\uFF0C\u518D\u505A\u79BB\u6563\u5316\u548C\u7406\u8BBA\u6DF7\u5408\uFF0C\u9002\u5408\u5224\u65AD\u6574\u4F53\u91CD\u5FC3\u504F\u79FB\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      const s = h.slice(-80).map((d) => d.sum);
      const mu = avg(s);
      const sd = Math.sqrt(avg(s.map((v) => (v - mu) ** 2)));
      return { sumP: mix(gauss(mu, sd), THEO, 0.35) };
    }
  };
  var A_KALMAN = {
    id: "kalman",
    name: "\u5361\u5C14\u66FC\u6EE4\u6CE2",
    tag: "\u6EE4\u6CE2",
    desc: "\u628A\u548C\u503C\u5F53\u5E26\u566A\u89C2\u6D4B\uFF0C\u7528\u4E00\u7EF4\u5361\u5C14\u66FC\u6EE4\u6CE2\u9012\u63A8\u4F30\u8BA1\u6F5C\u5728\u6C34\u5E73\uFF0C\u518D\u7528\u4F30\u8BA1\u503C\u548C\u4E0D\u786E\u5B9A\u5EA6\u751F\u6210\u5206\u5E03\uFF0C\u5BF9\u566A\u58F0\u4E0D\u654F\u611F\u3002",
    run: (h) => {
      if (h.length < 30) return fallback();
      let x = 13.5;
      let P = 10;
      for (const d of h.slice(-120)) {
        P += 3.2;
        const K = P / (P + 11);
        x += K * (d.sum - x);
        P *= 1 - K;
      }
      return { sumP: mix(gauss(x, Math.sqrt(P) + 3.4), THEO, 0.32) };
    }
  };
  var A_CONTRARIAN = {
    id: "contrarian",
    name: "\u53CD\u5411\u5171\u8BC6",
    tag: "\u535A\u5F08",
    desc: "\u628A\u52A8\u91CF\u7B97\u6CD5\u7684\u504F\u79BB\u65B9\u5411\u53CD\u8FC7\u6765\u7528\uFF1A\u5927\u4F17\u8D8A\u8FFD\u70ED\uFF0C\u8D8A\u5F80\u540E\u64A4\u4E00\u90E8\u5206\u6982\u7387\u8D28\u91CF\uFF0C\u7528\u6765\u68C0\u9A8C\u300C\u53CD\u8FFD\u70ED\u300D\u662F\u5426\u6709\u7EDF\u8BA1\u4EF7\u503C\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const m = A_MOMENTUM.run(h).sumP;
      const p = THEO.map((base, i) => Math.max(1e-5, base - 0.55 * (m[i] - base)));
      return { sumP: norm(p) };
    }
  };
  var A_TRIPLE = {
    id: "triple",
    name: "\u4E09\u73E0\u8DEF",
    tag: "\u8DEF\u7EB8",
    desc: "\u5708\u91CC\u5E38\u8BF4\u7684\u4E09\u73E0\u8DEF\uFF08\u4E09\u671F\u5F62\u6001\u6CD5\uFF09\uFF1A\u53D6\u6700\u8FD1\u4E09\u671F\u7684\u5927\u5C0F\u6392\u5217\u5F53\u8DEF\u7EB8\uFF0C\u5728\u5386\u53F2\u91CC\u627E\u540C\u6837\u7684\u4E09\u8FDE\u5F62\u6001\uFF0C\u7EDF\u8BA1\u5B83\u4EEC\u4E4B\u540E\u90A3\u4E00\u671F\u7684\u548C\u503C\u843D\u70B9\uFF0C\u6837\u672C\u8D8A\u7A00\u5E73\u6ED1\u8D8A\u91CD\u3002",
    run: (h) => {
      if (h.length < 40) return fallback();
      const big = h.map((d) => isBig(d.sum) ? 1 : 0);
      const last3 = big.slice(-3).join("");
      const c = zeros();
      let hits = 0;
      for (let i = 3; i < h.length; i++) {
        if (big.slice(i - 3, i).join("") === last3) {
          c[h[i].sum]++;
          hits++;
        }
      }
      return { sumP: smooth(c, THEO, 10 + Math.max(0, 14 - hits)) };
    }
  };
  var A_CHI = {
    id: "chi",
    name: "\u5361\u65B9\u504F\u5DEE",
    tag: "\u51B7\u70ED",
    desc: "\u5BF9\u8FD1 60 \u671F\u56DB\u4E2A\u7EC4\u5408\u505A\u5361\u65B9\u6B8B\u5DEE\u5206\u6790\uFF0C\u5F00\u5F97\u660E\u663E\u504F\u591A\u7684\u7EC4\u5408\u7ED9\u8D1F\u6743\u91CD\u3001\u504F\u5C11\u7684\u7ED9\u6B63\u6743\u91CD\uFF0C\u7528\u6765\u6355\u6349\u77ED\u7A97\u53E3\u5185\u7684\u7ED3\u6784\u6027\u504F\u70ED\u3002",
    run: (h) => {
      if (h.length < 40) return fallback();
      const sub = h.slice(-60);
      const cnt = [0, 0, 0, 0];
      for (const d of sub) cnt[comboIdx(d.sum)]++;
      const exp = sub.length / 4;
      const comboP = cnt.map((v) => {
        const z = (v - exp) / Math.sqrt(Math.max(1, exp));
        return Math.max(0.06, 0.25 - 0.045 * z);
      });
      const t = total(comboP);
      return { sumP: fromCombo(comboP.map((v) => v / t)) };
    }
  };
  var A_MEDIAN = {
    id: "median",
    name: "\u4E2D\u4F4D\u6570\u6EE4\u6CE2",
    tag: "\u6EE4\u6CE2",
    desc: "\u53D6\u6700\u8FD1 9 \u671F\u548C\u503C\u7684\u4E2D\u4F4D\u6570\u5F53\u91CD\u5FC3\uFF0C\u907F\u5F00\u5355\u671F\u8DF3\u70B9\u5BF9\u5747\u503C\u7684\u62C9\u626F\uFF0C\u518D\u5957\u9AD8\u65AF\u6838\u5E76\u4E0E\u7406\u8BBA\u6DF7\u5408\uFF0C\u9002\u5408\u8D70\u52BF\u53CD\u590D\u6A2A\u8DF3\u7684\u9636\u6BB5\u3002",
    run: (h) => {
      if (h.length < 20) return fallback();
      const s = h.slice(-9).map((d) => d.sum).sort((a, b) => a - b);
      const med = s[Math.floor(s.length / 2)];
      return { sumP: mix(gauss(med, 5.1), THEO, 0.46) };
    }
  };
  var A_FUSION = {
    id: "fusion",
    name: "\u878D\u5408\u6A21\u578B",
    tag: "\u96C6\u6210",
    desc: "\u628A\u52A8\u91CF\u3001\u9057\u6F0F\u3001\u4E00\u9636\u94FE\u3001\u8D1D\u53F6\u65AF\u3001\u5747\u503C\u56DE\u5F52\u3001\u4F4D\u7F6E\u72EC\u7ACB\u516D\u4E2A\u6A21\u578B\u7684\u5206\u5E03\u6309\u56FA\u5B9A\u5148\u9A8C\u6743\u91CD\u52A0\u6743\u5E73\u5747\uFF0C\u5355\u6A21\u578B\u6CE2\u52A8\u88AB\u644A\u5E73\uFF0C\u901A\u5E38\u66F4\u7A33\u3002",
    run: (h) => {
      const parts = [
        { p: A_MOMENTUM.run(h).sumP, w: 0.16 },
        { p: A_GAP.run(h).sumP, w: 0.13 },
        { p: A_MARKOV.run(h).sumP, w: 0.19 },
        { p: A_BAYES.run(h).sumP, w: 0.2 },
        { p: A_REGRESS.run(h).sumP, w: 0.16 },
        { p: A_POSITION.run(h).sumP, w: 0.16 }
      ];
      const p = zeros();
      for (const it of parts) for (let i = 0; i < 28; i++) p[i] += it.p[i] * it.w;
      return { sumP: norm(p) };
    }
  };
  var ALGOS = [
    A_FUSION,
    A_MARKOV,
    A_BAYES,
    A_MOMENTUM,
    A_GAP,
    A_LOGIT,
    A_BIN,
    A_KALMAN,
    A_REGRESS,
    A_GAUSS,
    A_MARKOV2,
    A_POSITION,
    A_CYCLE,
    A_MOD3,
    A_MOD4,
    A_MOD5,
    A_SHAPE,
    A_DRAGON,
    A_EXTREME,
    A_ASSOC,
    A_MC,
    A_HOT,
    A_COLD,
    A_TRIPLE,
    A_CHI,
    A_MEDIAN,
    A_CONTRARIAN,
    A_THEO
  ];
  var ALGO_META = ALGOS.map(({ id, name, tag, desc }) => ({ id, name, tag, desc }));
  var getAlgo = (id) => ALGOS.find((a) => a.id === id) || A_FUSION;
  function consensus(h) {
    let bigVotes = 0;
    let oddVotes = 0;
    const zoneVotes = [0, 0, 0];
    const killVotes = [0, 0, 0, 0];
    let usable = 0;
    for (const a of ALGOS) {
      if (a.id === "theo") continue;
      const p = derivePicks(a.run(h).sumP);
      usable++;
      if (p.big >= 0.5) bigVotes++;
      if (p.odd >= 0.5) oddVotes++;
      zoneVotes[zonePick(p)]++;
      killVotes[comboKill(p)]++;
    }
    const top = Math.max(bigVotes, usable - bigVotes);
    const zoneTop = Math.max(...zoneVotes);
    return {
      n: usable,
      bigVotes,
      oddVotes,
      zoneVotes,
      killVotes,
      strength: Math.round((0.55 * (top / usable) + 0.45 * (zoneTop / usable)) * 100) / 100
    };
  }
  var HI_CONF = 0.26;
  function backtest(h, algo, window = 120) {
    const end = h.length - 1;
    const start = Math.max(24, end - window);
    let n = 0;
    let big = 0;
    let odd = 0;
    let both = 0;
    let zone = 0;
    let zoneKill = 0;
    let zoneKillTheo = 0;
    let kill = 0;
    let killSum = 0;
    let range = 0;
    let hiN = 0;
    let hiDouble = 0;
    let hiZone = 0;
    let hiKill = 0;
    let hiKillSum = 0;
    for (let i = start; i < end; i++) {
      const hist = h.slice(Math.max(0, i - 420), i);
      if (hist.length < 26) continue;
      const picks = derivePicks(algo.run(hist).sumP);
      const act = h[i];
      const z2 = zoneOf(act.sum);
      const okBig = picks.big >= 0.5 === isBig(act.sum);
      const okOdd = picks.odd >= 0.5 === isOdd(act.sum);
      const okZone = zonePick(picks) === z2;
      const okZoneKill = picks.zoneKill !== z2;
      const okZoneKillTheo = picks.zoneKillTheo !== z2;
      const okKill = comboKill(picks) !== comboIdx(act.sum);
      const okKillSum = !picks.killSums.includes(act.sum);
      const okRange = act.sum >= picks.range[0] && act.sum <= picks.range[1];
      n++;
      if (okBig) big++;
      if (okOdd) odd++;
      if (okBig && okOdd) both++;
      if (okZone) zone++;
      if (okZoneKill) zoneKill++;
      if (okZoneKillTheo) zoneKillTheo++;
      if (okKill) kill++;
      if (okKillSum) killSum++;
      if (okRange) range++;
      if (picks.conf >= HI_CONF) {
        hiN++;
        if (okBig && okOdd) hiDouble++;
        if (okZone) hiZone++;
        if (okKill) hiKill++;
        if (okKillSum) hiKillSum++;
      }
    }
    const safe = (v, d = n) => d ? v / d : 0;
    const bigRate = safe(big);
    const oddRate = safe(odd);
    const doubleRate = safe(both);
    const zoneRate = safe(zone);
    const zoneKillRate = safe(zoneKill);
    const zoneKillTheoRate = safe(zoneKillTheo);
    const killRate = safe(kill);
    const killSumRate = safe(killSum);
    const rangeRate = safe(range);
    const zBase = THEO_MAX_ZONE;
    const hiDoubleRate = safe(hiDouble, hiN);
    const hiZoneRate = safe(hiZone, hiN);
    const hiKillRate = safe(hiKill, hiN);
    const hiKillSumRate = safe(hiKillSum, hiN);
    const shrink = (v, base) => {
      const k = Math.min(1, hiN / 30);
      return v * k + base * (1 - k);
    };
    const hiK = shrink(hiKillRate, killRate);
    const hiZ = shrink(hiZoneRate, zoneRate);
    const hiD = shrink(hiDoubleRate, doubleRate);
    const z = (rate, base) => n ? (rate - base) / Math.sqrt(base * (1 - base) / n) : 0;
    const score = 100 + 3.2 * (0.14 * z(bigRate, 0.5) + 0.14 * z(oddRate, 0.5) + 0.18 * z(doubleRate, 0.25) + 0.2 * z(zoneRate, zBase) + 0.16 * z(zoneKillRate, 1 - Math.min(...THEO_ZONE)) + 0.18 * z(killRate, 0.75));
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
      zoneKillRate,
      zoneKillTheoRate,
      killRate,
      killSumRate,
      rangeRate,
      hiN,
      hiDouble: hiD,
      hiZone: hiZ,
      hiKill: hiK,
      hiKillSum: hiKillSumRate,
      killLift: killRate - 0.75,
      score: Math.round(score * 10) / 10
    };
  }
  function backtestAll(h, window = 120) {
    return ALGOS.map((a) => backtest(h, a, window)).sort((x, y) => y.score - x.score);
  }
  function rowBacktest(h, algo, n = 60) {
    const out = [];
    const end = h.length - 1;
    const start = Math.max(26, end - n);
    for (let i = start; i < end; i++) {
      const hist = h.slice(Math.max(0, i - 420), i);
      if (hist.length < 26) continue;
      const picks = derivePicks(algo.run(hist).sumP);
      const act = h[i];
      out.push({
        nbr: act.nbr,
        time: act.time,
        sum: act.sum,
        zone: zoneOf(act.sum),
        predBig: picks.big >= 0.5,
        predOdd: picks.odd >= 0.5,
        predZone: zonePick(picks),
        predKill: comboKill(picks),
        conf: picks.conf,
        okBig: picks.big >= 0.5 === isBig(act.sum),
        okOdd: picks.odd >= 0.5 === isOdd(act.sum),
        okZone: zonePick(picks) === zoneOf(act.sum),
        okKill: comboKill(picks) !== comboIdx(act.sum)
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
        avg: g.length ? Math.round(total(g) / g.length * 10) / 10 : 0,
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
  function ratio(h, n) {
    const sub = h.slice(-n);
    if (!sub.length) return { big: 0.5, odd: 0.5, dragon: 0.5, avg: 13.5 };
    return {
      big: sub.filter((d) => isBig(d.sum)).length / sub.length,
      odd: sub.filter((d) => isOdd(d.sum)).length / sub.length,
      dragon: sub.filter((d) => d.dragon === "\u9F99").length / sub.length,
      avg: total(sub.map((d) => d.sum)) / sub.length
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
  function streaks(h) {
    const out = [];
    const walk = (label, fn) => {
      if (!h.length) return;
      const cur = fn(h[h.length - 1]);
      let n = 0;
      for (let i = h.length - 1; i >= 0; i--) {
        if (fn(h[i]) === cur) n++;
        else break;
      }
      out.push({ label, key: cur, len: n });
    };
    walk("\u5927\u5C0F", (d) => isBig(d.sum) ? "\u5927" : "\u5C0F");
    walk("\u5355\u53CC", (d) => isOdd(d.sum) ? "\u5355" : "\u53CC");
    walk("\u7EC4\u5408", (d) => comboOf(d.sum));
    walk("\u9F99\u864E", (d) => d.dragon || "\u548C");
    return out;
  }
  return __toCommonJS(engine_exports);
})();
