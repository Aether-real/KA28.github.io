/* =============================================================================
 * KA28 Spring · 临界阻尼弹簧引擎
 * -----------------------------------------------------------------------------
 * 依据 WWDC 2018 Session 803「Designing Fluid Interfaces」的交互模型：
 *   UISpringTimingParameters(dampingRatio: initialVelocity:)
 *     → 阻尼比 dampingRatio = 1（临界阻尼，最快收敛且无过冲/无振荡）
 *     → initialVelocity 直接继承手势松手瞬间的速度，动画从手势动量接续
 *   UIScrollView rubber banding
 *     → 越界位移按 (1 - 1/(x*c/dim + 1))*dim 衰减，松手由弹簧拉回边界
 *   UIScrollView decelerationRate 动量投影
 *     → 用松手速度预估落点，决定吸附到哪一档，而不是只看手指停在哪
 *
 * Web 端实现说明（重要）：
 *  · CSS 缓动无法读取「松手速度」，所以所有手势驱动的动画走 rAF 物理引擎；
 *  · 非手势的入场 / 状态动画用同一条临界阻尼曲线的 CSS linear() 缓动；
 *  · ζ=1 使用解析解 x(t)=target+(D+(v0+ωD)t)·e^(-ωt)，无数值累积误差；
 *  · 其它阻尼比走半隐式欧拉积分，便于按需调参；
 *  · prefers-reduced-motion 直接跳到终态，不做任何位移。
 * ========================================================================== */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var prefersReduced = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* ---------- 1. 解析解：阻尼比 = 1（临界阻尼） ---------- */
  /* omega = 7 / response ：response 秒内衰减到 ~0.1%，视觉上自然收尾 */
  function omegaOf(response) { return 7 / Math.max(0.12, response || 0.42); }

  function criticalAt(from, to, v0, omega, t) {
    var D = from - to;
    var C = v0 + omega * D;
    var e = Math.exp(-omega * t);
    return {
      x: to + (D + C * t) * e,
      v: (v0 - omega * C * t) * e
    };
  }

  /* ---------- 2. 通用弹簧（支持任意阻尼比，默认 ζ=1） ---------- */
  /**
   * @param {Object} o
   *   from, to            起止值（px 或任意标量）
   *   velocity            松手速度，单位「单位/秒」；向下/向右为正
   *   dampingRatio        阻尼比，默认 1（临界阻尼）
   *   response            收敛时长（秒），默认 0.42
   *   onUpdate(x, v, p)   每帧回调，p 为归一化进度 0..1
   *   onComplete()
   *   epsilon             位置收敛阈值
   *   min, max            硬边界；越界先经 rubberBand 再回弹
   *   dimension           rubberBand 的参考尺寸（默认视口高度）
   */
  function settle(o) {
    var from = Number(o.from) || 0, to = Number(o.to) || 0;
    var v0 = Number(o.velocity) || 0;
    var zeta = o.dampingRatio == null ? 1 : Math.max(0.2, Number(o.dampingRatio));
    var omega = omegaOf(o.response);
    var onUpdate = o.onUpdate || function () { };
    var onComplete = o.onComplete || function () { };
    var eps = o.epsilon == null ? 0.4 : o.epsilon;
    var maxMs = o.maxMs || 1600;
    var min = o.min, max = o.max, dim = o.dimension || (window.innerHeight || 800);

    if (prefersReduced() || (Math.abs(to - from) < eps && Math.abs(v0) < 12)) {
      onUpdate(to, 0, 1); onComplete();
      return { cancel: function () { } };
    }

    var start = performance.now();
    var raf = 0, cancelled = false, x = from, v = v0;
    var lastT = 0;

    function frame(now) {
      if (cancelled) return;
      var t = Math.min(maxMs / 1000, (now - start) / 1000);
      var dt = Math.max(1 / 240, Math.min(1 / 30, t - lastT)); lastT = t;

      if (zeta === 1) {
        var s = criticalAt(from, to, v0, omega, t);
        x = s.x; v = s.v;
      } else {
        /* 半隐式欧拉：a = -ω²(x-to) - 2ζωv */
        var steps = Math.max(1, Math.ceil(dt / (1 / 120)));
        var h = dt / steps;
        for (var i = 0; i < steps; i++) {
          var a = -omega * omega * (x - to) - 2 * zeta * omega * v;
          v += a * h; x += v * h;
        }
      }

      /* 边界：越界部分按橡皮筋压缩，视觉上「顶得住、回得来」 */
      if (min != null && x < min) x = min - rubberBand(min - x, dim, 0.55);
      if (max != null && x > max) x = max + rubberBand(x - max, dim, 0.55);

      var dx = to - from;
      var p = Math.abs(dx) < 0.001 ? 1 : Math.max(0, Math.min(1, (x - from) / dx));
      onUpdate(x, v, p);

      var settled = Math.abs(x - to) < eps && Math.abs(v) < 12;
      if (!settled && t < maxMs / 1000) { raf = requestAnimationFrame(frame); return; }
      onUpdate(to, 0, 1);
      onComplete();
    }
    raf = requestAnimationFrame(frame);
    return { cancel: function () { cancelled = true; cancelAnimationFrame(raf); } };
  }

  /* ---------- 3. iOS UIScrollView 橡皮筋 ---------- */
  function rubberBand(distance, dimension, constant) {
    var c = constant == null ? 0.55 : constant;
    var dim = dimension || 1;
    if (distance <= 0) return 0;
    return (1 - 1 / (distance * c / dim + 1)) * dim;
  }

  /* ---------- 4. 动量投影：用松手速度决定吸附档位 ---------- */
  /**
   * 与 UIScrollView decelerationRate 同构：velocity 越大，额外「甩」出的距离越远。
   * velocity 单位 px/s，返回预估额外位移 px。
   */
  function project(velocity, decelerationRate, ms) {
    var rate = decelerationRate == null ? 0.995 : decelerationRate;
    var dur = (ms == null ? 180 : ms) / 1000;
    /* 指数衰减下的总位移 v/(-ln rate) * (1 - rate^dur*1000) 的实用近似 */
    var k = 1 / (1 - rate);
    return velocity * dur * Math.min(1, 0.55 + 0.00035 * k) * 0.5;
  }

  /* ---------- 5. 生成临界阻尼 CSS linear() 缓动 ---------- */
  /* 采样阶跃响应 f(t) = 1 - (1 + ωt)·e^(-ωt)，t∈[0,1]，用于非手势动画 */
  function easing(samples, omega) {
    var n = samples || 24, w = omega || 7;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var f = 1 - (1 + w * t) * Math.exp(-w * t);
      pts.push(f.toFixed(5));
    }
    return 'linear(' + pts.join(', ') + ')';
  }

  /* 浏览器支持 linear() 时才覆盖 CSS 变量；不支持则保留 CSS 里的无过冲回退 */
  function installCSSEasing() {
    var ok = !!(window.CSS && CSS.supports && CSS.supports('animation-timing-function', 'linear(0, 1)'));
    if (!ok) return false;
    var root = document.documentElement;
    root.style.setProperty('--k28-spring', easing(24, 7));       /* 通用收敛 */
    root.style.setProperty('--k28-spring-quick', easing(20, 9));  /* 按钮 / 图标 */
    root.style.setProperty('--k28-spring-soft', easing(28, 5.6)); /* 面板 / 大位移 */
    root.classList.add('k28-spring-css');
    return true;
  }

  /* ---------- 6. 轻量滚动边界回弹（不改原生滚动，只做视觉回弹） ---------- */
  /* 用 wheel / touch 在到达顶/底时给容器一个短暂的 translate，松手由弹簧归零。 */
  function attachEdgeBounce(el, axis) {
    if (!el || prefersReduced() || window.__k28EdgeBounceOff) return function () { };
    var vertical = (axis || 'y') === 'y';
    var offset = 0, running = null, last = 0;

    function setOffset(px) {
      offset = px;
      el.style.transform = vertical
        ? 'translate3d(0,' + px.toFixed(2) + 'px,0)'
        : 'translate3d(' + px.toFixed(2) + 'px,0,0)';
    }
    function bounce(delta) {
      var dim = vertical ? el.clientHeight : el.clientWidth;
      setOffset(rubberBand(Math.min(120, Math.abs(delta)), Math.max(120, dim), 0.55) * (delta < 0 ? -1 : 1));
      if (running) running.cancel();
      running = settle({
        from: offset, to: 0, velocity: 0, dampingRatio: 1, response: 0.36,
        onUpdate: setOffset,
        onComplete: function () { el.style.transform = ''; running = null; }
      });
    }
    function atTop() { return vertical ? el.scrollTop <= 0 : el.scrollLeft <= 0; }
    function atBottom() {
      return vertical
        ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        : el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
    }
    function onWheel(e) {
      var d = vertical ? e.deltaY : e.deltaX;
      if (!d) return;
      if ((d < 0 && atTop()) || (d > 0 && atBottom())) bounce(d * 0.55);
    }
    var touchY = 0;
    function onTouchStart(e) { touchY = vertical ? e.touches[0].clientY : e.touches[0].clientX; }
    function onTouchMove(e) {
      var cur = vertical ? e.touches[0].clientY : e.touches[0].clientX;
      var d = touchY - cur; touchY = cur;
      if ((d < 0 && atTop()) || (d > 0 && atBottom())) bounce(d * 0.8);
    }
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    return function () {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      if (running) running.cancel();
      el.style.transform = '';
    };
  }

  window.KA28_SPRING = {
    settle: settle,
    rubberBand: rubberBand,
    project: project,
    easing: easing,
    omegaOf: omegaOf,
    installCSSEasing: installCSSEasing,
    attachEdgeBounce: attachEdgeBounce,
    reduced: prefersReduced
  };

  /* 尽早安装，避免首屏动画仍走旧的过冲 bezier */
  if (document.documentElement) installCSSEasing();
})();
