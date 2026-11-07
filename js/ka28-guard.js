/* =============================================================================
 * KA28 轻量源码防护（"简单防止"，不是安全边界）
 * -----------------------------------------------------------------------------
 * 覆盖：右键菜单、文本选择 / 复制 / 剪切、左键拖拽选取、移动端长按与
 *       系统菜单、F12 / Ctrl+U / Ctrl+S / Ctrl+Shift+I|J|C|K 等查看源码快捷键。
 * 保留：输入框可编辑可选可粘贴；图片与导出预览层可长按保存。
 *
 * 诚实说明（请务必看 README / 实施报告）：
 *   纯前端站点的 HTML/CSS/JS 必然会被下载到浏览器，任何前端手段都只能提高
 *   "随手复制"的门槛，无法真正阻止查看源码。真正的保护要靠服务端鉴权、代码
 *   混淆与授权协议。本文件不制造 debugger 死循环，避免拖慢页面或误伤用户。
 * ========================================================================== */
(function () {
  'use strict';
  if (window.__KA28_GUARD__) return;
  window.__KA28_GUARD__ = true;

  var ROOT = document.documentElement;
  ROOT.classList.add('k28-guard');

  function allowed(e) {
    if (!e || !e.closest) return false;
    return !!e.closest('input,textarea,select,[contenteditable="true"],[contenteditable=""],.allow-select,img,.k28-png-panel,.k28-png-panel *');
  }

  /* ---- CSS：禁选中 / 禁长按系统菜单，白名单放行 ---- */
  var css = document.createElement('style');
  css.id = 'k28-guard-style';
  css.textContent = [
    'html.k28-guard body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}',
    'html.k28-guard input,html.k28-guard textarea,html.k28-guard [contenteditable],',
    'html.k28-guard .allow-select,html.k28-guard .allow-select *{-webkit-user-select:text;user-select:text}',
    'html.k28-guard img,html.k28-guard .k28-png-panel,html.k28-guard .k28-png-panel *',
    '{-webkit-touch-callout:default;-webkit-user-select:auto;user-select:auto}'
  ].join('');
  document.head.appendChild(css);

  /* ---- 事件拦截（capture，早于业务脚本） ---- */
  function blockIf(e, fn) { if (!allowed(e.target)) fn(e); }
  document.addEventListener('contextmenu', function (e) {
    blockIf(e, function (x) { x.preventDefault(); });
  }, { capture: true, passive: false });

  ['copy', 'cut', 'dragstart', 'selectstart'].forEach(function (type) {
    document.addEventListener(type, function (e) {
      blockIf(e, function (x) { x.preventDefault(); });
    }, { capture: true, passive: false });
  });

  /* ---- 键盘：查看源码 / 开发者工具 / 另存 ---- */
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey;
    if (allowed(e.target)) return;                 /* 输入框内不拦，保证卡密可输入 */
    var hit = k === 'f12'
      || (ctrl && !shift && (k === 'u' || k === 's' || k === 'p'))
      || (ctrl && shift && (k === 'i' || k === 'j' || k === 'c' || k === 'k' || k === 'm'))
      || (e.keyCode === 123);
    if (hit) { e.preventDefault(); e.stopPropagation(); return false; }
  }, { capture: true, passive: false });

  /* ---- 移动端长按：阻止选中文本与系统菜单（图片 / 白名单除外） ---- */
  var pressTimer = 0, startX = 0, startY = 0;
  document.addEventListener('touchstart', function (e) {
    if (allowed(e.target)) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(function () {
      /* 长按只做轻量提示，不 blur 页面、不阻断滚动 */
      try { window.getSelection && window.getSelection().removeAllRanges(); } catch (_) { }
    }, 520);
  }, { capture: true, passive: true });
  ['touchmove', 'touchend', 'touchcancel'].forEach(function (t) {
    document.addEventListener(t, function (e) {
      if (t === 'touchmove' && Math.abs(e.touches[0].clientX - startX) + Math.abs(e.touches[0].clientY - startY) > 10) clearTimeout(pressTimer);
      else clearTimeout(pressTimer);
    }, { capture: true, passive: true });
  });

  /* ---- 极轻量开发者工具提示：只提示一次，不做 debugger 死循环 ---- */
  var warned = false;
  function devtoolsHint() {
    if (warned) return;
    var gap = Math.abs((window.outerWidth || 0) - (window.innerWidth || 0));
    var gapY = Math.abs((window.outerHeight || 0) - (window.innerHeight || 0));
    if (gap > 170 || gapY > 170) {
      warned = true;
      try { console.info('%cKA28', 'color:#7dbb52;font-weight:700', '本项目为前端统计演示，源码与算法说明见 README.md；请勿直接复制转售。'); } catch (_) { }
    }
  }
  window.addEventListener('resize', devtoolsHint, { passive: true });
  setTimeout(devtoolsHint, 1500);
})();
