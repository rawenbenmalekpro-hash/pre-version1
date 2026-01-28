/**
 * PlantWallK Main JavaScript
 * Phase 15/16a - Premium polish + background canvas + Lab Universes overlay
 */

(function () {
  'use strict';

  // ======== Internationalization ========
  const LANG = {
    en: {
      switchToTable: 'Switch to table',
      switchToMap: 'Switch to map',
      darkMode: 'Dark mode',
      lightMode: 'Light mode',
      accessibility: 'Accessibility',
      dyslexiaMode: 'Dyslexia-friendly mode',
      dyslexiaDesc: 'Increased spacing, heavier font',
      highContrast: 'High contrast',
      highContrastDesc: 'Enhanced text visibility',
      reduceMotion: 'Reduce motion',
      reduceMotionDesc: 'Disable animations',
      close: 'Close',
      loading: 'Loading map...',
      countries: 'countries',
      members: 'members',
      workingGroups: 'Working groups',
      all: 'All',
      leadership: 'Leadership',
      leadershipPresent: 'Leadership present',
      wg1: 'WG1',
      wg2: 'WG2',
      wg3: 'WG3',
      officialCostPage: 'Official COST Action page ↗',
      openLabUniverse: 'Open lab universe'
    }
  };

  const t = (key) => LANG.en[key] || key;

  // Expose translator for other modules (map.js)
  window.PlantWallK = window.PlantWallK || {};
  window.PlantWallK.t = t;

  // ======== Configuration ========
  const CONFIG = {
    lazyLoad: { rootMargin: '200px 0px', threshold: 0 },
    paths: {
      d3: '/js/vendor/d3.v7.min.js',
      topojson: '/js/vendor/topojson-client.min.js',
      map: '/js/map.js'
    },
    selectors: {
      mapTrigger: '[data-lazy-map]',
      mapContainer: '.map-container',
      mobileMenuBtn: '.mobile-menu-btn',
      mobileNav: '#mobile-nav',
      counters: '.counter',
      viewToggleBtn: '#view-toggle-btn',
      mapView: '#map-view',
      tableView: '#table-view',
      tableHeading: '#table-view-heading',
      themeToggle: '[data-theme-toggle]',
      a11yToggle: '[data-a11y-toggle]',
      a11yPanel: '#a11y-panel',
      a11yOverlay: '#a11y-overlay',
      a11yClose: '#a11y-close',
      bgCanvas: '#bg-canvas'
    },
    storage: {
      theme: 'plantwallk-theme',
      dyslexia: 'plantwallk-dyslexia',
      highContrast: 'plantwallk-contrast',
      reduceMotion: 'plantwallk-motion'
    }
  };

  const state = {
    initialized: false,
    mapLoaded: false,
    countersAnimated: false,
    prefersReducedMotion: false,
    currentView: 'map',
    currentTheme: 'dark',
    settings: null,
    labOverlayInit: false
  };

  // ======== Initialize ========
  function init() {
    if (state.initialized) return;
    state.initialized = true;

    document.documentElement.classList.remove('no-js');
    document.documentElement.classList.add('js');

    state.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (window.location.protocol === 'file:') {
      showProtocolWarning();
      return;
    }

    initTheme();
    initMobileNav();
    initLazyMap();
    initCounters();
    initViewToggle();
    initNavHighlight();
    initAccessibilityPanel();
    initBackgroundCanvas();
    loadAccessibilitySettings();
    initLabUniverses(); // cinematic lab overlay (V1 parity renderer)

    console.log('[PlantWallK] ✓ Initialized');
  }

  // ======== Theme Toggle ========
  function initTheme() {
    const saved = localStorage.getItem(CONFIG.storage.theme);
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    state.currentTheme = saved || (systemDark ? 'dark' : 'light');
    applyTheme(state.currentTheme, false);

    document.querySelectorAll(CONFIG.selectors.themeToggle).forEach(btn => {
      btn.addEventListener('click', toggleTheme);
      updateThemeButton(btn);
    });

    // Listen for system preference changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem(CONFIG.storage.theme)) {
        applyTheme(e.matches ? 'dark' : 'light', true);
      }
    });
  }

  function toggleTheme() {
    const newTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme, true);
    localStorage.setItem(CONFIG.storage.theme, newTheme);
  }

  function applyTheme(theme, animate) {
    state.currentTheme = theme;

    if (
      animate &&
      !state.prefersReducedMotion &&
      !document.documentElement.classList.contains('reduce-motion')
    ) {
      document.documentElement.classList.add('theme-transitioning');
      setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll(CONFIG.selectors.themeToggle).forEach(updateThemeButton);

    // Notify background + others to re-resolve theme-aware assets.
    try {
      window.dispatchEvent(new CustomEvent('plantwallk:themechange', { detail: { theme } }));
    } catch (e) { /* no-op */ }
  }

  function updateThemeButton(btn) {
    const isDark = state.currentTheme === 'dark';
    btn.setAttribute('aria-label', isDark ? t('lightMode') : t('darkMode'));
    const iconEl = btn.querySelector('.control-btn__icon');
    const textEl = btn.querySelector('.control-btn__text');
    if (iconEl) iconEl.textContent = isDark ? '☀️' : '🌙';
    if (textEl) textEl.textContent = isDark ? 'Light' : 'Dark';
  }

  // ======== Mobile Navigation ========
  function initMobileNav() {
    const btn = document.querySelector(CONFIG.selectors.mobileMenuBtn);
    const nav = document.querySelector(CONFIG.selectors.mobileNav);
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
      const isExpanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isExpanded));
      nav.hidden = isExpanded;
      if (!isExpanded) nav.querySelector('a')?.focus();
    });

    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        btn.setAttribute('aria-expanded', 'false');
        nav.hidden = true;
      });
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !nav.hidden) {
        btn.setAttribute('aria-expanded', 'false');
        nav.hidden = true;
        btn.focus();
      }
    });
  }

  // ======== Accessibility Panel ========
  function initAccessibilityPanel() {
    const toggles = document.querySelectorAll(CONFIG.selectors.a11yToggle);
    const panel = document.querySelector(CONFIG.selectors.a11yPanel);
    const overlay = document.querySelector(CONFIG.selectors.a11yOverlay);
    const closeBtn = document.querySelector(CONFIG.selectors.a11yClose);
    if (!panel) return;

    function openPanel() {
      panel.setAttribute('aria-hidden', 'false');
      overlay?.classList.add('a11y-overlay--visible');
      closeBtn?.focus();
      document.body.style.overflow = 'hidden';
    }

    function closePanel() {
      panel.setAttribute('aria-hidden', 'true');
      overlay?.classList.remove('a11y-overlay--visible');
      document.body.style.overflow = '';
      toggles[0]?.focus();
    }

    toggles.forEach(toggle => {
      toggle.addEventListener('click', e => {
        e.preventDefault();
        openPanel();
      });
    });

    closeBtn?.addEventListener('click', closePanel);
    overlay?.addEventListener('click', closePanel);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && panel.getAttribute('aria-hidden') === 'false') closePanel();
    });

    const dyslexiaToggle = document.getElementById('toggle-dyslexia');
    const contrastToggle = document.getElementById('toggle-contrast');
    const motionToggle = document.getElementById('toggle-motion');

    dyslexiaToggle?.addEventListener('change', e => {
      document.documentElement.classList.toggle('dyslexia-mode', e.target.checked);
      localStorage.setItem(CONFIG.storage.dyslexia, String(e.target.checked));
    });

    contrastToggle?.addEventListener('change', e => {
      document.documentElement.classList.toggle('high-contrast', e.target.checked);
      localStorage.setItem(CONFIG.storage.highContrast, String(e.target.checked));
    });

    motionToggle?.addEventListener('change', e => {
      document.documentElement.classList.toggle('reduce-motion', e.target.checked);
      localStorage.setItem(CONFIG.storage.reduceMotion, String(e.target.checked));
      state.prefersReducedMotion = !!e.target.checked;
    });
  }

  function loadAccessibilitySettings() {
    const dyslexia = localStorage.getItem(CONFIG.storage.dyslexia) === 'true';
    const contrast = localStorage.getItem(CONFIG.storage.highContrast) === 'true';
    const motion = localStorage.getItem(CONFIG.storage.reduceMotion) === 'true' || state.prefersReducedMotion;

    if (dyslexia) {
      document.documentElement.classList.add('dyslexia-mode');
      const toggle = document.getElementById('toggle-dyslexia');
      if (toggle) toggle.checked = true;
    }

    if (contrast) {
      document.documentElement.classList.add('high-contrast');
      const toggle = document.getElementById('toggle-contrast');
      if (toggle) toggle.checked = true;
    }

    if (motion) {
      document.documentElement.classList.add('reduce-motion');
      const toggle = document.getElementById('toggle-motion');
      if (toggle) toggle.checked = true;
      state.prefersReducedMotion = true;
    }
  }

  // ======== Continuous Background Canvas ========
  // Goal: 1 background image per active section, with a smooth fade ONLY when switching sections.
  function initBackgroundCanvas() {
    const canvas = document.querySelector(CONFIG.selectors.bgCanvas);
    if (!canvas) return;

    const layerA = canvas.querySelector('.bg-layer--a');
    const layerB = canvas.querySelector('.bg-layer--b');
    if (!layerA || !layerB) return;

    const sections = Array.from(document.querySelectorAll('section.section[id]'));
    if (!sections.length) return;

    const reduced = state.prefersReducedMotion || document.documentElement.classList.contains('reduce-motion');
    if (reduced) document.documentElement.classList.add('bg-reduce-motion');

    const data = {
      bgMaps: { dark: {}, light: {} },
      bgMapFlat: {},
      secMap: null,
      fallbackKey: null
    };

    const resolveKey = (sectionEl) => {
      const id = sectionEl.id;
      return (data.secMap && id && data.secMap[id])
        ? data.secMap[id]
        : (sectionEl.getAttribute('data-bg') || id || 'hero');
    };

    const resolveUrl = (key, theme) => {
      const th = theme || state.currentTheme || document.documentElement.getAttribute('data-theme') || 'dark';
      const themedMap = (data.bgMaps && data.bgMaps[th]) ? data.bgMaps[th] : null;

      const themed = themedMap ? themedMap[key] : null;
      const legacy = data.bgMapFlat ? data.bgMapFlat[key] : null;

      const fallbackThemed = (themedMap && data.fallbackKey) ? themedMap[data.fallbackKey] : null;
      const fallbackLegacy = (data.bgMapFlat && data.fallbackKey) ? data.bgMapFlat[data.fallbackKey] : null;

      const finalPath = themed || legacy || fallbackThemed || fallbackLegacy;
      return finalPath ? `url('${finalPath}')` : '';
    };

    const last = { key: null, theme: null };
    let topIsA = true;

    function setVisibleLayer(url, animate) {
      const incoming = topIsA ? layerB : layerA;
      const outgoing = topIsA ? layerA : layerB;

      // If reduced motion or no outgoing image, do an immediate swap.
      if (!animate || reduced) {
        outgoing.style.backgroundImage = url || '';
        outgoing.style.opacity = '1';
        incoming.style.opacity = '0';
        topIsA = !topIsA;
        return;
      }

      incoming.style.backgroundImage = url || '';
      incoming.style.opacity = '1';
      outgoing.style.opacity = '0';
      topIsA = !topIsA;
    }

    function applyForSection(sectionEl, animate) {
      if (!sectionEl) return;

      const theme = state.currentTheme || document.documentElement.getAttribute('data-theme') || 'dark';
      const key = resolveKey(sectionEl) || data.fallbackKey || 'hero';

      if (!data.fallbackKey) data.fallbackKey = key;

      // Theme-only change: refresh URL without crossfading to itself (prevents double-images).
      if (key === last.key && theme !== last.theme) {
        const url = resolveUrl(key, theme) || '';
        const live = topIsA ? layerA : layerB;
        const hidden = topIsA ? layerB : layerA;
        live.style.backgroundImage = url;
        live.style.opacity = '1';
        hidden.style.opacity = '0';
        last.theme = theme;
        return;
      }

      if (key === last.key) return;

      const url = resolveUrl(key, theme) || '';
      setVisibleLayer(url, !!animate);

      last.key = key;
      last.theme = theme;
    }

    function pickInitialSection() {
      const vpMid = (window.innerHeight || 1) * 0.52;
      let best = sections[0];
      let bestDist = Infinity;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        const cy = r.top + r.height * 0.5;
        const d = Math.abs(cy - vpMid);
        if (d < bestDist) { bestDist = d; best = s; }
      }
      return best;
    }

    loadSettings().then(settings => {
      const bg = (settings && settings.backgrounds) ? settings.backgrounds : null;

      if (bg && typeof bg === 'object' && (bg.dark || bg.light)) {
        data.bgMaps.dark = (bg.dark && typeof bg.dark === 'object') ? bg.dark : {};
        data.bgMaps.light = (bg.light && typeof bg.light === 'object') ? bg.light : {};
        data.bgMapFlat = (bg._legacyFlat && typeof bg._legacyFlat === 'object') ? bg._legacyFlat : {};
      } else if (bg && typeof bg === 'object') {
        data.bgMapFlat = bg;
        data.bgMaps.dark = {};
        data.bgMaps.light = {};
      } else {
        data.bgMapFlat = {};
        data.bgMaps.dark = {};
        data.bgMaps.light = {};
      }

      data.secMap = (settings && settings.backgroundCanvas && settings.backgroundCanvas.sections)
        ? settings.backgroundCanvas.sections
        : null;

      applyOverlayTokens(settings);

      // Init: set a single image immediately.
      const initial = pickInitialSection();
      const theme = state.currentTheme || document.documentElement.getAttribute('data-theme') || 'dark';
      const initialKey = initial ? resolveKey(initial) : 'hero';
      data.fallbackKey = initialKey || 'hero';

      const initialUrl = resolveUrl(data.fallbackKey, theme) || '';
      layerA.style.backgroundImage = initialUrl;
      layerB.style.backgroundImage = initialUrl;
      layerA.style.opacity = '1';
      layerB.style.opacity = '0';
      topIsA = true;
      last.key = data.fallbackKey;
      last.theme = theme;

      // Use IntersectionObserver to switch backgrounds discretely per section.
      let active = initial || sections[0];

      const io = new IntersectionObserver((entries) => {
        // Pick the most visible intersecting section.
        let bestEntry = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          if (!bestEntry || e.intersectionRatio > bestEntry.intersectionRatio) bestEntry = e;
        }
        if (!bestEntry) return;

        const next = bestEntry.target;
        if (next && next !== active) {
          active = next;
          applyForSection(active, true);
        }
      }, {
        root: null,
        // "active" around middle of viewport; reduces rapid toggling and overlap.
        rootMargin: '-45% 0px -45% 0px',
        threshold: [0, 0.01, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8]
      });

      sections.forEach(s => io.observe(s));

      // Resize: re-pick the closest section (no fade) to avoid wrong active state.
      window.addEventListener('resize', () => {
        const nearest = pickInitialSection();
        if (nearest) {
          active = nearest;
          applyForSection(active, false);
        }
      }, { passive: true });

      // Theme change: refresh current section mapping immediately without crossfade.
      window.addEventListener('plantwallk:themechange', () => {
        applyForSection(active || pickInitialSection() || sections[0], false);
      });
    }).catch(() => { /* silent */ });
  }

  async function loadSettings() {
    if (state.settings) return state.settings;
    try {
      const res = await fetch('/content/settings.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('settings fetch failed');
      const json = await res.json();
      state.settings = json;
      return json;
    } catch (e) {
      state.settings = null;
      return null;
    }
  }

  function applyOverlayTokens(settings) {
    if (!settings || !settings.themeOverlays) return;
    const root = document.documentElement;
    const tkn = settings.themeOverlays;

    if (tkn.dark && typeof tkn.dark.noiseOpacity === 'number') {
      root.style.setProperty('--bg-noise-opacity-token-dark', String(tkn.dark.noiseOpacity));
    }
    if (tkn.light && typeof tkn.light.noiseOpacity === 'number') {
      root.style.setProperty('--bg-noise-opacity-token-light', String(tkn.light.noiseOpacity));
    }
  }

  // (PART 2/2 will continue with the rest of the file unchanged)
  // ======== View Toggle ========
  function initViewToggle() {
    const btn = document.querySelector(CONFIG.selectors.viewToggleBtn);
    const mapView = document.querySelector(CONFIG.selectors.mapView);
    const tableView = document.querySelector(CONFIG.selectors.tableView);
    const tableHeading = document.querySelector(CONFIG.selectors.tableHeading);
    const mapHeading = document.getElementById('participating-title');

    if (!btn || !mapView || !tableView) return;

    btn.addEventListener('click', () => {
      const isMap = btn.dataset.currentView === 'map';

      if (isMap) {
        mapView.hidden = true;
        tableView.hidden = false;
        btn.dataset.currentView = 'table';
        btn.setAttribute('aria-pressed', 'true');
        btn.querySelector('.view-toggle__text').textContent = t('switchToMap');
        btn.querySelector('.view-toggle__icon').textContent = '🗺️';
        tableHeading?.focus();
        state.currentView = 'table';
      } else {
        tableView.hidden = true;
        mapView.hidden = false;
        btn.dataset.currentView = 'map';
        btn.setAttribute('aria-pressed', 'false');
        btn.querySelector('.view-toggle__text').textContent = t('switchToTable');
        btn.querySelector('.view-toggle__icon').textContent = '📋';
        mapHeading?.focus();
        state.currentView = 'map';
      }
    });
  }

  // ======== Navigation Highlight ========
  function initNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link, .mobile-nav__link');
    if (!sections.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
              link.classList.toggle('nav-link--active', href === `#${id}`);
            }
          });
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    sections.forEach(s => observer.observe(s));
  }

  // ======== Animated Counters ========
  function initCounters() {
    const counters = document.querySelectorAll(CONFIG.selectors.counters);
    if (!counters.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !state.countersAnimated) {
          state.countersAnimated = true;
          animateCounters(counters);
          observer.disconnect();
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(c => observer.observe(c));
  }

  function animateCounters(counters) {
    const shouldAnimate =
      !state.prefersReducedMotion &&
      !document.documentElement.classList.contains('reduce-motion');

    counters.forEach(counter => {
      const target = parseInt(counter.dataset.target, 10);
      const valueEl = counter.querySelector('.counter__value');
      if (!valueEl || isNaN(target)) return;

      if (!shouldAnimate) {
        valueEl.textContent = String(target);
        return;
      }

      const duration = 1500;
      const start = performance.now();

      function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        valueEl.textContent = String(Math.round(eased * target));

        if (progress < 1) requestAnimationFrame(update);
        else valueEl.textContent = String(target);
      }

      requestAnimationFrame(update);
    });
  }

  // ======== Lazy Map Loading ========
  function initLazyMap() {
    if (!('IntersectionObserver' in window)) {
      loadMapAssets();
      return;
    }

    const trigger = document.querySelector(CONFIG.selectors.mapTrigger);
    if (!trigger) return;

    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !state.mapLoaded) {
        state.mapLoaded = true;
        observer.disconnect();
        loadMapAssets();
      }
    }, CONFIG.lazyLoad);

    observer.observe(trigger);
  }

  async function loadMapAssets() {
    try {
      await loadScript(CONFIG.paths.d3, 'D3.js');
      await loadScript(CONFIG.paths.topojson, 'TopoJSON');
      await loadScript(CONFIG.paths.map, 'Map module');

      const container = document.querySelector(CONFIG.selectors.mapContainer);
      if (container && window.PlantWallKMap) {
        await window.PlantWallKMap.render(container);
      }
    } catch (error) {
      console.error('[Map] Load failed:', error);
      showMapFallback();
    }
  }

  function loadScript(src, name) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${name}`));
      document.head.appendChild(script);
    });
  }

  // ======== Lab Universes Overlay (WG1/2/3 cinematic) ========
  // (UNCHANGED LOGIC — only formatting/structure fixes around it)
  function initLabUniverses() {
    if (state.labOverlayInit) return;
    state.labOverlayInit = true;

    const universeTemplates = document.querySelectorAll('.wg-universe[data-universe-id]');
    if (!universeTemplates.length) return;

    // Lazy module loader (only when a universe is opened)
    let universesModulePromise = null;
    const getUniversesModule = () => {
      if (!universesModulePromise) {
        universesModulePromise = import('/js/universes-v1.js');
      }
      return universesModulePromise;
    };

    // Active renderer runtime handle
    let runtime = null;
    const destroyRuntime = () => {
      if (runtime && typeof runtime.destroy === 'function') {
        try { runtime.destroy(); } catch (e) { /* noop */ }
      }
      runtime = null;
    };

    // Build overlay shell once
    const overlay = document.createElement('div');
    overlay.className = 'wg-universe-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    overlay.innerHTML = `
      <div class="wg-universe-overlay__backdrop" aria-hidden="true"></div>
      <div class="wg-universe-overlay__frame" role="dialog" aria-modal="true" aria-label="${t('workingGroups')} lab universe">
        <button type="button" class="wg-universe-overlay__close" aria-label="${t('close')}">×</button>
        <div class="wg-universe-overlay__content"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    const backdrop = overlay.querySelector('.wg-universe-overlay__backdrop');
    const contentHost = overlay.querySelector('.wg-universe-overlay__content');
    const closeBtn = overlay.querySelector('.wg-universe-overlay__close');

    const universeMap = new Map();
    universeTemplates.forEach(u => {
      const id = u.getAttribute('data-universe-id');
      if (!id) return;
      u.hidden = true; // keep as template
      universeMap.set(id, { node: u, originParent: u.parentElement || null });
    });

    let activeId = null;
    let lastToggle = null;

    function clamp01(x) {
      if (isNaN(x)) return 0;
      return Math.max(0, Math.min(1, x));
    }

    // Start V1 renderer for the opened universe (if expected DOM hooks exist)
    async function startUniverseRuntime(root, id) {
      destroyRuntime();

      const mod = await getUniversesModule();

      if (id === 'wg1-microscopy') {
        const container = root.querySelector('[data-universe-canvas]');
        if (!container) return;

        const scanInput = root.querySelector('input[type="range"][data-universe-control="wg1-intensity"]');
        const scan = scanInput ? clamp01(parseFloat(scanInput.value) / 100) : 0.35;

        runtime = mod.createUniverseCanvasV1({
          universe: 'microscopy',
          container,
          imagePath: '/images/asplenium_daucifolium_root_10x_upraveno.webp',
          scan,
          morph: 0,
          channels: [1, 1, 1]
        });
      }

      if (id === 'wg2-chemistry') {
        const canvas = root.querySelector('canvas[data-chem-canvas]');
        const layer = root.querySelector('[data-chem-layer]');
        if (!canvas || !layer) return;

        const zoomInput = root.querySelector('input[type="range"][data-chem-zoom]');
        const zoomLabel = root.querySelector('[data-chem-zoom-label]');

        const chBundles = root.querySelector('input[type="checkbox"][data-chem-ch="bundles"]');
        const chPrimary = root.querySelector('input[type="checkbox"][data-chem-ch="primary"]');
        const chSecondary = root.querySelector('input[type="checkbox"][data-chem-ch="secondary"]');

        const getZoom = () => zoomInput ? parseFloat(zoomInput.value) : 1;
        const getChannels = () => [
          chBundles ? (chBundles.checked ? 1 : 0) : 1,
          chPrimary ? (chPrimary.checked ? 1 : 0) : 1,
          chSecondary ? (chSecondary.checked ? 1 : 0) : 1
        ];

        layer.style.transition = 'opacity 200ms ease-out';

        const applyOpacity = (z) => {
          const op = mod.computeChemOpacityFromZoom(z);
          layer.style.opacity = String(op);
        };

        runtime = mod.createChemistryWallCanvasV1({
          canvas,
          zoom: getZoom(),
          channels: getChannels(),
          rootImageSrc: '/images/arabidopsis_root_stained_with_pectin_probe.webp',
          zoomImageSrc: '/images/atroot_zoom.png'
        });

        const onZoom = () => {
          const z = getZoom();
          if (zoomLabel) zoomLabel.textContent = `${z}×`;
          if (runtime && runtime.setZoom) runtime.setZoom(z);
          applyOpacity(z);
        };

        const onChannels = () => {
          const ch = getChannels();
          if (runtime && runtime.setChannels) runtime.setChannels(ch);
        };

        zoomInput?.addEventListener('input', onZoom);
        chBundles?.addEventListener('change', onChannels);
        chPrimary?.addEventListener('change', onChannels);
        chSecondary?.addEventListener('change', onChannels);

        onZoom();
        onChannels();
      }

      if (id === 'wg3-modelling') {
        const container = root.querySelector('[data-universe-canvas]');
        if (!container) return;

        const morphInput = root.querySelector('input[type="range"][data-universe-control="wg3-stress"]');
        const morph = morphInput ? clamp01(parseFloat(morphInput.value) / 100) : 0.55;

        runtime = mod.createUniverseCanvasV1({
          universe: 'modelling',
          container,
          imagePath: '/images/micrasterias_cos_488_1_day_post_label.webp',
          scan: 0.2,
          morph,
          channels: [1, 1, 1]
        });
      }
    }

    function openUniverse(id, toggleEl) {
      const entry = universeMap.get(id);
      if (!entry) return;

      destroyRuntime();

      activeId = id;
      lastToggle = toggleEl || null;

      contentHost.innerHTML = '';
      contentHost.appendChild(entry.node);
      entry.node.hidden = false;

      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      document.querySelectorAll('.wg-card__toggle').forEach(btn => {
        btn.setAttribute('aria-expanded', btn === toggleEl ? 'true' : 'false');
      });

      closeBtn?.focus();
      startUniverseRuntime(entry.node, id);
    }

    function closeUniverse() {
      if (!activeId) return;
      const entry = universeMap.get(activeId);

      destroyRuntime();

      if (entry && entry.originParent && !entry.originParent.contains(entry.node)) {
        entry.node.hidden = true;
        entry.originParent.appendChild(entry.node);
      }

      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';

      document.querySelectorAll('.wg-card__toggle').forEach(btn => {
        btn.setAttribute('aria-expanded', 'false');
      });

      if (lastToggle) lastToggle.focus();

      activeId = null;
      lastToggle = null;
    }

    document.querySelectorAll('.wg-card').forEach(card => {
      const toggle = card.querySelector('.wg-card__toggle');
      const universe = card.querySelector('.wg-universe[data-universe-id]');
      if (!toggle || !universe) return;

      const id = universe.getAttribute('data-universe-id');
      if (!id) return;

      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        if (activeId === id) closeUniverse();
        else openUniverse(id, toggle);
      });
    });

    overlay.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;

      const controlKey = target.getAttribute('data-universe-control');
      if (!controlKey) return;

      const universeRoot = overlay.querySelector('.wg-universe');
      if (!universeRoot) return;

      const value = parseFloat(target.value);
      const norm = clamp01(value / 100);

      if (controlKey === 'wg1-intensity') {
        universeRoot.style.setProperty('--wg1-intensity', String(norm));
        if (activeId === 'wg1-microscopy' && runtime && runtime.setScan) runtime.setScan(norm);
      } else if (controlKey === 'wg3-stress') {
        universeRoot.style.setProperty('--wg3-stress', String(norm));
        if (activeId === 'wg3-modelling' && runtime && runtime.setMorph) runtime.setMorph(norm);
      }
    });

    closeBtn?.addEventListener('click', closeUniverse);
    backdrop?.addEventListener('click', closeUniverse);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activeId) {
        event.preventDefault();
        closeUniverse();
      }
    });
  }

  // ======== Error Handling ========
  function showProtocolWarning() {
    const warning = document.createElement('div');
    warning.style.cssText = 'position:fixed;top:0;left:0;right:0;padding:20px;background:#1d4ed8;color:white;text-align:center;z-index:9999;font-family:system-ui';
    warning.innerHTML = '<strong>⚠️ HTTP Server Required</strong><br>Run: npm run serve';
    document.body.prepend(warning);
  }

  function showMapFallback() {
    const container = document.querySelector(CONFIG.selectors.mapContainer);
    if (container) {
      container.classList.remove('map-container--loading');
      container.classList.add('map-container--error');
    }
    document.querySelector(CONFIG.selectors.viewToggleBtn)?.click();
  }

  // ======== Bootstrap ========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.PlantWallK = window.PlantWallK || {};
  window.PlantWallK.state = state;
  window.PlantWallK.toggleTheme = toggleTheme;
})();

