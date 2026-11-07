/* =============================================================================
 * KA28 · 极早启动脚本（必须放在 <head> 且不使用 defer）
 * -----------------------------------------------------------------------------
 * 职责（两件事，都不含任何用户可见的按钮 / 开关）：
 *  1) 读取「米验服务端上一次已确认的公益放行」缓存，命中时在第一帧就隐藏授权
 *     遮罩并立即启动主程序 —— 因此后台开启公益模式后，每次刷新都直接进主页面，
 *     不出现 KA28 授权认证，也不会先闪一下门再消失（"不墨迹"）。
 *  2) 注入 CSS 兜底，防止 loader.js / miyan-gate.js 随后又把授权门显示出来。
 *
 * 重要边界：
 *  · 缓存不是一个"前端开关"，它只能由 miyan-gate.js 在收到【RSA 验签 + AES
 *    解密后的服务端响应】明确表示公益放行时写入；后台关闭公益后复核会自动清除。
 *  · 不生成 / 不伪造任何卡密或 auth_receipt，不改写服务端校验逻辑。
 *  · ?preview=1 仅用于离线本地验收（隐藏门 + 启动），线上不带此参数。
 * ========================================================================== */
(function () {
  'use strict';
  var GRANT_KEY = 'ka28.miyan.publicGrant';
  var MAX_AGE = 30 * 24 * 3600 * 1000;   /* 缓存最长 30 天，期间仍会后台静默复核 */
  var root = document.documentElement;

  function readGrant() {
    try {
      var raw = localStorage.getItem(GRANT_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.v !== 1 || !o.ts || (Date.now() - o.ts) > MAX_AGE) return null;
      return o;
    } catch (_) { return null; }
  }
  var grant = readGrant();
  var preview = /[?&]preview=1(?:&|$)/.test(location.search || '');
  var bypass = !!grant || preview;

  /* 暴露给授权模块：写入 / 清除服务端确认的公益放行 */
  window.KA28_PUBLIC = {
    CACHE_KEY: GRANT_KEY,
    cached: function () { return readGrant(); },
    isPreview: function () { return preview; },
    write: function (reason) {
      try { localStorage.setItem(GRANT_KEY, JSON.stringify({ v: 1, ts: Date.now(), reason: reason || 'server' })); }
      catch (_) { }
    },
    clear: function () { try { localStorage.removeItem(GRANT_KEY); } catch (_) { } },
    /* 供授权模块在探测到服务端公益信号后调用：隐藏门 + 立即启动（无需刷新） */
    apply: function () {
      root.classList.add('k28-public');
      ['miYanGate', 'miYanNoticeOverlay', 'ka28BootNotice'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) { el.classList.add('k28-preview-hide'); el.hidden = true; }
      });
      if (document.body) document.body.style.overflow = '';
      kickBoot();
    },
    /* 后台关闭公益时复核会调用：撤掉放行态，恢复授权门 */
    revoke: function () {
      root.classList.remove('k28-public');
      var gate = document.getElementById('miYanGate');
      if (gate) { gate.hidden = false; gate.classList.remove('k28-preview-hide'); }
      if (document.body) document.body.style.overflow = 'hidden';
    }
  };
  window.__KA28_PUBLIC_CACHED__ = !!grant;

  /* CSS 兜底：只有"服务端确认过公益"或本地验收态才隐藏门。
     半屏面板打开时仍保留底层滚动锁。 */
  var style = document.createElement('style');
  style.id = 'k28-public-style';
  style.textContent = [
    'html.k28-public #miYanGate,',
    'html.k28-public #miYanNoticeOverlay,',
    'html.k28-public #ka28BootNotice{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important}',
    'html.k28-public body{overflow:auto!important}',
    'html.k28-public body.k28-sheet-open{overflow:hidden!important}'
  ].join('');
  document.head.appendChild(style);

  if (bypass) root.classList.add('k28-public', 'k28-preview');

  /* 尽早触发既有站点 boot()，避免等授权模块/CDN 才渲染主页面 */
  function kickBoot() {
    var tries = 0;
    var kick = function () {
      tries++;
      var fn = window.__KA28_START_AFTER_AUTH;
      if (typeof fn === 'function' && !window.__KA28_STARTED) {
        window.__KA28_STARTED = true;
        try { fn(); } catch (e) { console.warn('[KA28] 主程序启动失败（不影响新增系统）', e); }
      }
      if (tries < 80 && !window.__KA28_STARTED) setTimeout(kick, 250);
    };
    setTimeout(kick, 60);
  }
  if (bypass) kickBoot();
})();
