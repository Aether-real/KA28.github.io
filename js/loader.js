/* Load crypto dependencies with CDN failover; then load local app code in strict order. */
(function () {
  'use strict';
  var VERSION = '20261026-status-top3-expand3';
  var notice = document.getElementById('ka28BootNotice');
  function hideNotice() { if (notice) notice.classList.add('is-hidden'); }
  function loadScript(url, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;
      var timer = setTimeout(function () { finish(new Error('Script timeout: ' + url)); }, timeoutMs || 9000);
      function finish(error) {
        if (settled) return;
        settled = true; clearTimeout(timer);
        script.onload = null; script.onerror = null;
        if (error) { script.remove(); reject(error); } else { resolve(url); }
      }
      script.async = true;
      script.src = url;
      script.onload = function () { finish(); };
      script.onerror = function () { finish(new Error('Script load failed: ' + url)); };
      document.head.appendChild(script);
    });
  }
  async function loadFirstWorking(label, urls, ready) {
    if (ready()) return true;
    for (var i = 0; i < urls.length; i++) {
      try { await loadScript(urls[i], 8000); } catch (_) {}
      if (ready()) return true;
    }
    console.warn('[KA28 loader] Unable to load ' + label + ' from configured CDNs.');
    return false;
  }
  async function loadLocal(file) {
    await loadScript('./js/' + file + '?v=' + VERSION, 12000);
  }
  async function start() {
    var deps = await Promise.all([
      loadFirstWorking('JSEncrypt', [
        'https://cdn.jsdelivr.net/npm/jsencrypt@3.3.2/bin/jsencrypt.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/jsencrypt/3.3.2/jsencrypt.min.js',
        'https://cdn.bootcdn.net/ajax/libs/jsencrypt/3.3.2/jsencrypt.min.js'
      ], function () { return typeof window.JSEncrypt === 'function'; }),
      loadFirstWorking('CryptoJS', [
        'https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js',
        'https://cdn.bootcdn.net/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
      ], function () { return !!window.CryptoJS; })
    ]);
    try {
      await loadLocal('app.js');
      await loadLocal('miyan-gate.js');
      hideNotice();
      if (!deps[0] || !deps[1]) {
        var status = document.getElementById('miYanStatus');
        if (status) { status.textContent = '加密组件未能从可用 CDN 加载，请切换网络后刷新页面。'; status.className = 'miyan-status err'; }
      }
    } catch (err) {
      console.error('[KA28 loader] Local application asset failed to load.', err);
      if (notice) {
        notice.classList.remove('is-hidden');
        notice.textContent = '页面组件加载失败，请检查页面资源后重新加载。';
        notice.style.color = '#ff91a6';
      }
    }
  }
  start();
})();
