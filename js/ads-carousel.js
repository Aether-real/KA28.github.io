/* KA28 compact ad carousel.
 * Primary source: remote plain-text document. The same-origin ads.txt is used
 * only when the remote request fails. A successful empty document hides ads.
 * No arrow buttons or pagination controls: navigation is swipe + autoplay only.
 */
(function () {
  'use strict';

  var REMOTE_URL = 'https://198.44.176.67/fileecho.php?user=3989097332&file=KA28.txt.txt';
  var LOCAL_URL = './ads.txt';
  var REFRESH_MS = 5 * 60 * 1000;
  var RESUME_REFRESH_COOLDOWN_MS = 4500;
  var STALE_REQUEST_MS = 12000;
  var REMOTE_TIMEOUT_MS = 4500;
  var LOCAL_TIMEOUT_MS = 2500;
  var ROTATE_MS = 6200;
  var root = document.getElementById('adCarouselSection');
  var viewport = document.getElementById('adCarouselViewport');
  var track = document.getElementById('adCarouselTrack');
  var position = document.getElementById('adCarouselPosition');
  if (!root || !viewport || !track) return;

  var ads = [];
  var current = 0;
  var rotateTimer = 0;
  var refreshTimer = 0;
  var pointerStart = null;
  var hovered = false;
  var focusWithin = false;
  var pointerActive = false;
  var refreshInFlight = false;
  var refreshStartedAt = 0;
  var refreshToken = 0;
  var firstLoadDone = false;
  var lastResumeRefreshAt = 0;
  var suppressClickUntil = 0;
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function cleanText(value) {
    return String(value == null ? '' : value)
      .replace(/\uFEFF/g, '')
      .replace(/\r/g, '')
      .replace(/\$\$\$\s*\.\s*是空/g, '')
      .trim();
  }

  function readTag(text, label) {
    var safe = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var re = new RegExp('【' + safe + '】([\\s\\S]*?)【' + safe + '】', 'm');
    var match = re.exec(text);
    return match ? cleanText(match[1]) : '';
  }

  function safeHttpUrl(raw) {
    try {
      var parsed = new URL(cleanText(raw));
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (_) {
      return '';
    }
  }

  function parseAds(rawText) {
    // In the local fallback file, lines starting with # are comments.
    var uncommented = String(rawText == null ? '' : rawText).split(/\n/).filter(function (line) {
      return !/^\s*#/.test(line);
    }).join('\n');
    var text = cleanText(uncommented);
    if (!text) return [];
    var re = /【广告(\d+)】([\s\S]*?)【广告\1】/g;
    var match;
    var parsed = [];
    var seen = Object.create(null);
    while ((match = re.exec(text)) !== null) {
      var id = match[1];
      if (seen[id]) continue;
      seen[id] = true;
      var body = cleanText(match[2]);
      var name = readTag(text, '广告' + id + '名字');
      var subtitle = readTag(text, '广告' + id + '副标题');
      var href = safeHttpUrl(readTag(text, '广告' + id + '链接'));
      // Reject incomplete/unsafe records. All remote fields are inserted as text only.
      if (!href || !(name || body || subtitle)) continue;
      parsed.push({ id: Number(id), name: name || body || '广告', body: body, subtitle: subtitle, href: href });
    }
    return parsed.sort(function (a, b) { return a.id - b.id; });
  }

  function makeSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M4 10v4h3l5 4V6l-5 4H4Zm11-1.5a5 5 0 0 1 0 7m2.5-9.5a8.5 8.5 0 0 1 0 12');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.7');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function appendClampedText(parent, className, value, maxLength) {
    var clean = cleanText(value);
    if (!clean) return;
    var element = document.createElement('p');
    element.className = className;
    // Safety bound against pathological remote strings; CSS further clamps lines.
    element.textContent = clean.length > maxLength ? clean.slice(0, maxLength - 1) + '…' : clean;
    parent.appendChild(element);
  }

  function createSlide(ad, index) {
    var article = document.createElement('article');
    article.className = 'ad-slide';
    article.setAttribute('role', 'group');
    article.setAttribute('aria-roledescription', '广告');
    article.setAttribute('aria-label', (index + 1) + ' / ' + ads.length + '：' + (ad.name || '广告'));

    var mark = document.createElement('div');
    mark.className = 'ad-brand-mark';
    mark.appendChild(makeSvg());

    var copy = document.createElement('div');
    copy.className = 'ad-copy';
    var title = document.createElement('h3');
    title.className = 'ad-card-title';
    title.textContent = ad.name || ad.body || '广告';
    copy.appendChild(title);
    if (ad.body && ad.body !== ad.name) appendClampedText(copy, 'ad-card-body', ad.body, 150);
    if (ad.subtitle) appendClampedText(copy, 'ad-card-subtitle', ad.subtitle, 180);

    var action = document.createElement('a');
    action.className = 'ad-visit-button';
    action.href = ad.href;
    action.target = '_blank';
    action.rel = 'noopener noreferrer sponsored';
    action.setAttribute('aria-label', '打开广告：' + (ad.name || '广告') + '（新标签页）');
    action.textContent = '查看';

    article.appendChild(mark);
    article.appendChild(copy);
    article.appendChild(action);
    return article;
  }

  function setActive(index, animate) {
    if (!ads.length) return;
    current = (index + ads.length) % ads.length;
    track.style.transitionDuration = (animate && !(motionQuery && motionQuery.matches)) ? '280ms' : '0ms';
    track.style.transform = 'translate3d(' + (-current * 100) + '%,0,0)';
    Array.prototype.forEach.call(track.children, function (slide, i) {
      slide.setAttribute('aria-hidden', i === current ? 'false' : 'true');
      slide.inert = i !== current;
    });
    if (position) {
      Array.prototype.forEach.call(position.children, function (dot, i) {
        dot.classList.toggle('is-active', i === current);
        dot.setAttribute('aria-hidden', 'true');
      });
      position.hidden = ads.length < 2;
      if (ads.length > 1) position.setAttribute('aria-label', '第 ' + (current + 1) + ' 条，共 ' + ads.length + ' 条广告');
    }
  }

  function stopTimer() {
    if (rotateTimer) window.clearInterval(rotateTimer);
    rotateTimer = 0;
  }

  function startTimer() {
    stopTimer();
    // Reduced-motion users still get automatic rotation, but setActive() removes
    // the slide transition. This avoids disabling carousel functionality entirely.
    if (ads.length < 2 || hovered || focusWithin || pointerActive || document.hidden) return;
    rotateTimer = window.setInterval(function () { setActive(current + 1, true); }, ROTATE_MS);
  }

  function makeSkeleton() {
    var slide = document.createElement('div');
    slide.className = 'ad-skeleton-slide';
    slide.setAttribute('aria-hidden', 'true');
    var mark = document.createElement('span'); mark.className = 'ad-skeleton-mark';
    var copy = document.createElement('span'); copy.className = 'ad-skeleton-copy';
    var title = document.createElement('i'); title.className = 'ad-skeleton-line title';
    var body = document.createElement('i'); body.className = 'ad-skeleton-line body';
    copy.appendChild(title); copy.appendChild(body);
    var action = document.createElement('span'); action.className = 'ad-skeleton-action';
    slide.appendChild(mark); slide.appendChild(copy); slide.appendChild(action);
    return slide;
  }

  function showSkeleton() {
    root.hidden = false;
    root.setAttribute('aria-busy', 'true');
    root.classList.add('is-loading');
    track.replaceChildren(makeSkeleton());
    track.style.transform = 'translate3d(0,0,0)';
    track.style.transitionDuration = '0ms';
    if (position) { position.replaceChildren(); position.hidden = true; position.removeAttribute('aria-label'); }
  }

  function render(list) {
    ads = Array.isArray(list) ? list : [];
    current = Math.min(current, Math.max(ads.length - 1, 0));
    track.replaceChildren();
    root.classList.remove('is-loading');
    root.setAttribute('aria-busy', 'false');
    if (!ads.length) {
      root.hidden = true;
      stopTimer();
      if (position) { position.replaceChildren(); position.hidden = true; position.removeAttribute('aria-label'); }
      return;
    }
    var fragment = document.createDocumentFragment();
    var indicatorFragment = document.createDocumentFragment();
    ads.forEach(function (ad, i) {
      fragment.appendChild(createSlide(ad, i));
      var dot = document.createElement('span');
      dot.className = 'ad-carousel-dot';
      dot.setAttribute('aria-hidden', 'true');
      indicatorFragment.appendChild(dot);
    });
    track.appendChild(fragment);
    if (position) {
      position.replaceChildren(indicatorFragment);
      position.hidden = ads.length < 2;
      if (ads.length > 1) position.setAttribute('aria-label', '第 1 条，共 ' + ads.length + ' 条广告');
      else position.removeAttribute('aria-label');
    }
    track.style.transitionDuration = '0ms';
    root.hidden = false;
    setActive(current, false);
    startTimer();
  }

  async function timeoutFetch(url, timeoutMs) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timerId = window.setTimeout(function () { if (controller) controller.abort(); }, timeoutMs);
    try {
      var response = await fetch(url, {
        method: 'GET', cache: 'no-store', credentials: 'omit', mode: 'cors',
        signal: controller ? controller.signal : undefined,
        headers: { 'Accept': 'text/plain,*/*' }
      });
      if (!response.ok) throw new Error('广告配置 HTTP ' + response.status);
      return await response.text();
    } finally { window.clearTimeout(timerId); }
  }

  async function refreshAds(options) {
    options = options || {};
    if (document.hidden) return;
    var now = Date.now();
    // Mobile browsers can suspend JS/fetch while backgrounded. Recover an old
    // in-flight flag on resume so the stale request cannot permanently block refresh.
    if (refreshInFlight && now - refreshStartedAt > STALE_REQUEST_MS) {
      refreshInFlight = false;
      refreshToken += 1; // invalidate any late result from the old request
    }
    if (refreshInFlight) return;

    var token = ++refreshToken;
    refreshInFlight = true;
    refreshStartedAt = now;
    try {
      // A successful remote response is authoritative, including an empty file.
      var remoteText = await timeoutFetch(REMOTE_URL, REMOTE_TIMEOUT_MS);
      if (token !== refreshToken || document.hidden) return;
      render(parseAds(remoteText));
    } catch (remoteError) {
      if (token !== refreshToken || document.hidden) return;
      try {
        var localText = await timeoutFetch(LOCAL_URL + '?v=20261026-coop-disclosure5', LOCAL_TIMEOUT_MS);
        if (token !== refreshToken || document.hidden) return;
        var fallbackAds = parseAds(localText);
        if (fallbackAds.length) {
          render(fallbackAds);
        } else if (!ads.length) {
          // Hide only when no previously valid ad exists. A transient network
          // failure must not erase the last known-good carousel on resume.
          render([]);
        } else {
          console.warn('[KA28 ads] Using last known-good ads after temporary source failure.');
          startTimer();
        }
      } catch (localError) {
        if (token !== refreshToken || document.hidden) return;
        console.warn('[KA28 ads] Remote and local ad sources unavailable.', remoteError, localError);
        if (!ads.length) render([]);
        else startTimer();
      }
    } finally {
      // Do not let an older, resumed/superseded request unlock a newer one.
      if (token === refreshToken) {
        firstLoadDone = true;
        refreshInFlight = false;
        refreshStartedAt = 0;
      }
    }
  }

  // Swipe-only navigation. Do not let a swipe that starts on the link open it accidentally.
  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (Date.now() < suppressClickUntil && anchor && root.contains(anchor)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
  }, true);
  viewport.addEventListener('pointerdown', function (event) {
    if (ads.length < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    pointerActive = true;
    stopTimer();
  });
  window.addEventListener('pointerup', function (event) {
    if (!pointerStart || pointerStart.id !== event.pointerId) return;
    var dx = event.clientX - pointerStart.x;
    var dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.15 && ads.length > 1) {
      suppressClickUntil = Date.now() + 450;
      setActive(current + (dx < 0 ? 1 : -1), true);
    }
    pointerActive = false;
    startTimer();
  });
  viewport.addEventListener('pointercancel', function () { pointerStart = null; pointerActive = false; startTimer(); });
  root.addEventListener('mouseenter', function () { hovered = true; stopTimer(); });
  root.addEventListener('mouseleave', function () { hovered = false; startTimer(); });
  root.addEventListener('focusin', function () { focusWithin = true; stopTimer(); });
  root.addEventListener('focusout', function (event) {
    if (!root.contains(event.relatedTarget)) { focusWithin = false; startTimer(); }
  });
  function resumeCarousel(reason) {
    if (document.hidden) return;
    if (!refreshTimer) startRefreshTimer();
    var now = Date.now();
    // pageshow, visibilitychange and focus can all fire for one resume. Coalesce
    // these events to avoid a burst of duplicate network requests.
    if (now - lastResumeRefreshAt >= RESUME_REFRESH_COOLDOWN_MS) {
      lastResumeRefreshAt = now;
      refreshAds({ reason: reason || 'resume' });
    }
    pointerStart = null;
    pointerActive = false;
    hovered = root.matches ? root.matches(':hover') : false;
    focusWithin = root.contains(document.activeElement);
    // Rebuild DOM if a browser/webview discarded the carousel subtree while
    // preserving the page shell in the back/forward cache.
    if (ads.length && track.children.length === 0) {
      render(ads);
    } else {
      startTimer();
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopTimer();
      pointerStart = null;
      pointerActive = false;
    } else {
      resumeCarousel('visibilitychange');
    }
  });
  window.addEventListener('pageshow', function () { resumeCarousel('pageshow'); });
  window.addEventListener('focus', function () { resumeCarousel('focus'); });
  window.addEventListener('online', function () { resumeCarousel('online'); });
  window.addEventListener('pagehide', function () {
    stopTimer();
    pointerStart = null;
    pointerActive = false;
    if (refreshTimer) { window.clearInterval(refreshTimer); refreshTimer = 0; }
  });
  if (motionQuery && typeof motionQuery.addEventListener === 'function') {
    motionQuery.addEventListener('change', function () {
      if (motionQuery.matches) track.style.transitionDuration = '0ms';
      else track.style.transitionDuration = '280ms';
      startTimer();
    });
  }

  function startRefreshTimer() {
    if (refreshTimer) window.clearInterval(refreshTimer);
    refreshTimer = window.setInterval(function () {
      if (!document.hidden) refreshAds({ reason: 'interval' });
    }, REFRESH_MS);
  }

  function start() {
    if (!firstLoadDone) showSkeleton();
    refreshAds({ reason: 'initial' });
    startRefreshTimer();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
