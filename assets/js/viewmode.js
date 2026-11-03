(function () {
  const validModes = ['auto', 'mobile', 'desktop'];
  const query = new URLSearchParams(window.location.search);
  const queryMode = query.get('view');
  const embedded = query.get('embedded') === '1';
  let savedMode = 'auto';
  try {
    const stored = window.localStorage.getItem('triplink-view');
    if (validModes.includes(stored)) savedMode = stored;
  } catch (error) {
    // Storage may be disabled by the browser.
  }

  let mode = validModes.includes(queryMode) ? queryMode : savedMode;
  let effectiveMode = 'mobile';
  let frameTimer = null;
  let frameReady = false;
  const listeners = new Set();
  const root = document.documentElement;
  const viewport = document.querySelector('meta[name="viewport"]');
  const defaultViewport = 'width=device-width, initial-scale=1';
  const desktopViewport = 'width=1200';

  function isWideDevice() {
    return window.screen && window.screen.width > 900;
  }

  function syncUrl(nextMode) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', nextMode);
    if (!embedded) url.searchParams.delete('embedded');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }

  function updateViewport(nextMode) {
    if (viewport) viewport.setAttribute('content', nextMode === 'desktop' ? desktopViewport : defaultViewport);
  }

  function notify(previousMode, source) {
    const detail = { mode, effective: effectiveMode, previous: previousMode, source };
    window.dispatchEvent(new CustomEvent('triplink:viewchange', { detail }));
    listeners.forEach((listener) => listener(detail));
  }

  function renderFrameHost() {
    const shell = document.getElementById('view-frame-shell');
    const frame = document.getElementById('view-frame');
    if (!shell || !frame) return;

    root.dataset.viewHost = 'frame';
    shell.hidden = false;
    if (!frame.src || frame.dataset.mode !== 'mobile') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'mobile');
      url.searchParams.set('embedded', '1');
      frame.dataset.mode = 'mobile';
      frame.src = url.pathname + url.search + url.hash;
    }

    window.clearTimeout(frameTimer);
    frameReady = frame.dataset.loaded === 'true';
    if (!frameReady) {
      frameTimer = window.setTimeout(function () {
        if (root.dataset.viewHost === 'frame' && mode === 'mobile' && !frameReady) fallBackFromFrame();
      }, 20000);
    }
  }

  function fallBackFromFrame() {
    window.clearTimeout(frameTimer);
    const shell = document.getElementById('view-frame-shell');
    if (shell) shell.hidden = true;
    root.dataset.viewHost = 'frame-fallback';
    const previousMode = effectiveMode;
    mode = 'desktop';
    effectiveMode = 'desktop';
    root.dataset.view = effectiveMode;
    updateViewport('desktop');
    syncUrl('desktop');
    notify(previousMode, 'frame-error');
  }

  function apply(nextMode, previousMode, source) {
    mode = nextMode;
    updateViewport(mode === 'desktop' ? 'desktop' : 'mobile');
    const matchesMobile = window.matchMedia
      ? window.matchMedia('(max-width: 900px)').matches
      : window.innerWidth <= 900;
    effectiveMode = mode === 'auto' ? (matchesMobile ? 'mobile' : 'desktop') : mode;
    root.dataset.view = effectiveMode;
    root.dataset.viewEmbedded = embedded ? 'true' : 'false';

    if (!embedded && effectiveMode === 'mobile' && isWideDevice()) {
      renderFrameHost();
    } else {
      window.clearTimeout(frameTimer);
      root.dataset.viewHost = 'page';
      const shell = document.getElementById('view-frame-shell');
      if (shell) shell.hidden = true;
    }
    notify(previousMode, source);
  }

  function set(nextMode) {
    if (!validModes.includes(nextMode)) throw new TypeError('View mode must be auto, mobile, or desktop.');
    const previousMode = effectiveMode;
    try {
      window.localStorage.setItem('triplink-view', nextMode);
    } catch (error) {
      // The URL still preserves the selected view when storage is disabled.
    }
    syncUrl(nextMode);
    apply(nextMode, previousMode, 'user');
  }

  function toggle() {
    set(effectiveMode === 'mobile' ? 'desktop' : 'mobile');
  }

  function get() {
    return effectiveMode;
  }

  function getMode() {
    return mode;
  }

  function onChange(callback) {
    if (typeof callback !== 'function') return function () {};
    listeners.add(callback);
    return function () { listeners.delete(callback); };
  }

  window.TripLinkView = { get, getMode, set, toggle, onChange };
  const initialViewport = mode === 'desktop' ? desktopViewport : defaultViewport;
  if (viewport) viewport.setAttribute('content', initialViewport);
  const initialMatchesMobile = window.matchMedia
    ? window.matchMedia('(max-width: 900px)').matches
    : window.innerWidth <= 900;
  effectiveMode = mode === 'auto' ? (initialMatchesMobile ? 'mobile' : 'desktop') : mode;
  root.dataset.view = effectiveMode;
  root.dataset.viewEmbedded = embedded ? 'true' : 'false';
  root.dataset.viewHost = !embedded && effectiveMode === 'mobile' && isWideDevice() ? 'frame' : 'page';
  if (root.dataset.viewHost === 'frame') {
    document.addEventListener('DOMContentLoaded', renderFrameHost, { once: true });
  }

  window.addEventListener('resize', function () {
    apply(mode, effectiveMode, 'resize');
  });
  if (window.visualViewport) {
    const updateScale = function () {
      const scale = Math.max(0.5, Math.min(4, 1 / (window.visualViewport.scale || 1)));
      root.style.setProperty('--view-switcher-scale', String(scale));
    };
    updateScale();
    window.visualViewport.addEventListener('resize', updateScale);
  }

  document.addEventListener('DOMContentLoaded', function () {
    const frame = document.getElementById('view-frame');
    if (frame) frame.addEventListener('load', function () {
      try {
        if (frame.contentDocument.documentElement.dataset.viewEmbedded !== 'true') {
          fallBackFromFrame();
          return;
        }
      } catch (error) {
        fallBackFromFrame();
        return;
      }
      frame.dataset.loaded = 'true';
      frameReady = true;
      window.clearTimeout(frameTimer);
    });
  }, { once: true });
})();
