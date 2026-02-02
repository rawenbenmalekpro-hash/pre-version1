/**
 * PlantWallK Participation Map
 * Phase 15 - V1-style glowing lab markers + biological annotation callout
 * Phase 16a - DATA POLICY + light-mode clarity + WG colour rings
 *   - Show ONLY WG presence (WG1/WG2/WG3) + leadership names/roles (from leadership field)
 *   - No participant name lists
 *   - WG presence encoded as coloured rings around markers
 *   - Keep hover/scale behavior stable (no marker drift/jitter)
 */

(function () {
  'use strict';

  const CONFIG = {
    viewBox: { width: 900, height: 500 },
    fitPadding: 50,
    zoom: { min: 0.5, max: 8, step: 1.5 },
    paths: {
      topoJson: './data/world.topojson',
      mapData: './content/combined-participation.json'
    },
    marker: {
      baseRadius: 5,
      minScale: 0.65,
      maxScale: 1.6,
      minMembers: 1,
      maxMembers: 30
    },
    callout: {
      padding: 12,
      offset: 18,
      maxWidth: 420
    }
  };

  const state = {
    container: null,
    wrapper: null,
    svg: null,
    g: null,
    pathGenerator: null,
    projection: null,
    zoom: null,
    reducedMotion: false,

    topoCountries: [],
    participating: new Set(),
    participatingFeatures: [],
    countryData: new Map(),
    nameToCodeMap: new Map(),

    markerMeta: new Map(), // code -> {x,y,r,data,markerEl}

    // Callout
    calloutLayer: null,
    calloutEl: null,
    calloutSvg: null,
    calloutPath: null,
    pinnedCode: null,
    pinnedExpanded: false,
    activeCode: null,
    activeSelection: 'all',
    raf: 0
  };

  // Minimal name->ISO2 mapping for world-atlas names
  const NAME_TO_CODE = {
    'czech republic': 'CZ', 'czechia': 'CZ',
    'france': 'FR',
    'türkiye': 'TR', 'turkey': 'TR',
    'spain': 'ES', 'portugal': 'PT', 'germany': 'DE', 'italy': 'IT',
    'united kingdom': 'GB', 'ireland': 'IE', 'netherlands': 'NL', 'belgium': 'BE',
    'sweden': 'SE', 'finland': 'FI', 'norway': 'NO', 'denmark': 'DK',
    'poland': 'PL', 'austria': 'AT', 'switzerland': 'CH', 'greece': 'GR',
    'hungary': 'HU', 'romania': 'RO', 'bulgaria': 'BG', 'croatia': 'HR',
    'slovenia': 'SI', 'slovakia': 'SK', 'serbia': 'RS', 'albania': 'AL',
    'bosnia and herzegovina': 'BA', 'cyprus': 'CY', 'egypt': 'EG',
    'israel': 'IL', 'palestine': 'PS', 'kosovo': 'XK', 'lithuania': 'LT',
    'ukraine': 'UA'
  };

  function t(key) {
    return (window.PlantWallK && typeof window.PlantWallK.t === 'function')
      ? window.PlantWallK.t(key)
      : key;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function prefersReducedMotion() {
    return (
      document.documentElement.classList.contains('reduce-motion') ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ======== Entry ========
  async function renderMap(container) {
    state.container = container;
    state.reducedMotion = prefersReducedMotion();

    container.classList.add('map-container--loading');

    try {
      const [topoRes, dataRes] = await Promise.all([
        fetch(CONFIG.paths.topoJson).then(r => r.json()),
        fetch(CONFIG.paths.mapData).then(r => r.json())
      ]);

      processMapData(dataRes);
      processTopoJson(topoRes);
      initSvg();
      drawCountries();
      drawMarkers();
      initCallout();
      initZoom();
      initResizeReposition();

      container.classList.remove('map-container--loading');
    } catch (error) {
      console.error('[Map] Render error:', error);
      container.classList.remove('map-container--loading');
      container.classList.add('map-container--error');
    }
  }

  // ======== Data Processing ========
function processMapData(data) {
    if (!Array.isArray(data)) return;

    data.forEach(c => {
      if (!c.code) return;
      state.participating.add(c.code);
      state.countryData.set(c.code, c);
    });

    // Update global counters
    const countryCount = data.length;
    // Calculate total participants (MC members + simple counts if available, assuming minimal logic here as per prompt "global participant total")
    // Note: Previous prompts implies we hide specific counts, but display global. 
    // Since we don't have exact counts for non-MC countries in the CSV, we'll hide the participant counter or set it to MC count.
    // The prompt says "include ALL the countries... not just MC members".
    
    const cEl = document.querySelector('.counter[data-target="26"] .counter__value');
    if(cEl) cEl.innerText = countryCount;

    // Remove participant counter if not provided, or show MC count
    const totalMC = data.reduce((acc, c) => acc + (c.mc ? c.mc.length : 0), 0);
    const pEl = document.querySelector('.counter[data-target="108"] .counter__value');
    if(pEl) {
        // If we don't have total participant numbers, we show MC count or hide
        pEl.innerText = totalMC; 
        const label = pEl.nextElementSibling;
        if(label) label.innerText = "Participants"; // Update label to be accurate
    }

    Object.entries(NAME_TO_CODE).forEach(([name, code]) => {
      state.nameToCodeMap.set(name.toLowerCase(), code);
    });

    renderTable(data);
  }

  function processTopoJson(topo) {
    const featureKey = Object.keys(topo.objects)[0];
    state.topoCountries = topojson.feature(topo, topo.objects[featureKey]).features;

    state.participatingFeatures = state.topoCountries.filter(f => {
      const name = (f.properties.name || '').toLowerCase();
      const code = state.nameToCodeMap.get(name);
      if (code && state.participating.has(code)) {
        f.properties.iso2 = code;
        return true;
      }
      return false;
    });
  }

  // ======== SVG + Countries ========
  function initSvg() {
    const wrapper = document.createElement('div');
    wrapper.className = 'map-wrapper-inner';
    wrapper.style.cssText = 'position:relative;width:100%;height:100%;';
    state.container.innerHTML = '';
    state.container.appendChild(wrapper);
    state.wrapper = wrapper;

    state.svg = d3.select(wrapper)
      .append('svg')
      .attr('class', 'map-svg')
      .attr('viewBox', `0 0 ${CONFIG.viewBox.width} ${CONFIG.viewBox.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Glow filter
    const defs = state.svg.append('defs');
    const filter = defs.append('filter')
      .attr('id', 'marker-glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('in', 'SourceGraphic')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    filter.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', d => d);

    state.g = state.svg.append('g').attr('class', 'map-main-group');

    // Projection centered on Europe
    state.projection = d3.geoMercator()
      .center([15, 52])
      .scale(600)
      .translate([CONFIG.viewBox.width / 2, CONFIG.viewBox.height / 2]);

    state.pathGenerator = d3.geoPath().projection(state.projection);
  }


  //========= Draw Countries ========== */

  function drawCountries() {
    // Non-participating countries
    state.g.selectAll('.map-country')
      .data(state.topoCountries)
      .enter()
      .append('path')
      .attr('class', 'map-country')
      .attr('d', state.pathGenerator);

    // Participating countries (highlighted)
    const participatingPaths = state.g.selectAll('.map-country--participating')
      .data(state.participatingFeatures)
      .enter()
      .append('path')
      .attr('class', 'map-country map-country--participating')
      .attr('d', state.pathGenerator);

    // Add interaction to the country shapes themselves (for countries without markers)
    participatingPaths.on('mouseenter', (e, d) => {
      const code = d.properties.iso2;
      // Only trigger if not pinned
      if (!state.pinnedCode) showCallout(code, { pin: false, expanded: false });
    });
    participatingPaths.on('mouseleave', () => {
      if (!state.pinnedCode) hideCallout();
    });
    participatingPaths.on('click', (e, d) => {
      e.stopPropagation();
      togglePinnedExpanded(d.properties.iso2);
    });
  }



  // ======== Markers ======== */
function drawMarkers() {
    const markersG = state.g.append('g').attr('class', 'markers-layer');

    state.participatingFeatures.forEach(f => {
      const code = f.properties.iso2;
      const data = state.countryData.get(code);
      if (!data) return;

      const centroid = state.pathGenerator.centroid(f);
      if (!centroid || isNaN(centroid[0])) return;

      // FIX: Shift Israel marker West to uncover Palestine (PS)
      if (code === 'IL') {
        centroid[1] += 10; 
      }
      

      // Calculate radius based on members (kept for scaling logic if needed later, or fixed)
      const members = data.members || 1;
      const scale = clamp(
        CONFIG.marker.minScale +
          ((members - CONFIG.marker.minMembers) /
            (CONFIG.marker.maxMembers - CONFIG.marker.minMembers)) *
            (CONFIG.marker.maxScale - CONFIG.marker.minScale),
        CONFIG.marker.minScale,
        CONFIG.marker.maxScale
      );
      const r = CONFIG.marker.baseRadius * scale;

      // 1. ALWAYS register metadata so the callout knows where to point (even if marker is invisible)
      state.markerMeta.set(code, {
        x: centroid[0],
        y: centroid[1],
        r,
        data,
        markerEl: null // Will update if we draw it
      });

      // 2. CHECK: Only draw visible marker if MC members exist
      const hasMC = data.mc && data.mc.length > 0;
      if (!hasMC) return; // Stop here for non-MC countries (they rely on drawCountries events)

      // 3. Draw Marker for MC countries
      const wgPresence = {
        wg1: Boolean(data.wg1),
        wg2: Boolean(data.wg2),
        wg3: Boolean(data.wg3)
      };

      const groupsLabel = [];
      if (wgPresence.wg1) groupsLabel.push('WG1');
      if (wgPresence.wg2) groupsLabel.push('WG2');
      if (wgPresence.wg3) groupsLabel.push('WG3');

      const countryName = data.name || '';
      const memberPart = `${members} ${t('members')}`;
      const wgPart = groupsLabel.length ? ` · ${groupsLabel.join(', ')} ${t('workingGroups')}` : '';
      const ariaLabel = countryName
        ? `${countryName}: ${memberPart}${wgPart}`
        : `${memberPart}${wgPart}`;

      const markerG = markersG.append('g')
        .attr('class', 'map-marker')
        .attr('tabindex', '0')
        .attr('role', 'button')
        .attr('aria-label', ariaLabel)
        .attr('data-code', code)
        .attr('transform', `translate(${centroid[0]}, ${centroid[1]})`);

      // Update meta with the element
      state.markerMeta.get(code).markerEl = markerG;

      const body = markerG.append('g').attr('class', 'map-marker__body');

      // WG presence rings
      const ringsGroup = body.append('g').attr('class', 'marker-rings');
      const wgKeys = ['wg1', 'wg2', 'wg3'];
      let ringIndex = 0;
      wgKeys.forEach(key => {
        if (!wgPresence[key]) return;
        ringIndex += 1;
        const ringRadius = r + 3 + ringIndex * 2;
        ringsGroup.append('circle')
          .attr('class', `marker-ring marker-ring--${key} is-present`)
          .attr('r', ringRadius);
      });

      // Pulse
      body.append('circle')
        .attr('class', 'marker-pulse')
        .attr('r', r + 6);

      // Halo
      body.append('circle')
        .attr('class', 'marker-halo')
        .attr('r', r + 4);

      // Core
      body.append('circle')
        .attr('class', 'marker-core')
        .attr('r', r);

      // Events
      markerG.on('mouseenter', () => {
        if (!state.pinnedCode) showCallout(code, { pin: false, expanded: false });
      });
      markerG.on('mouseleave', () => {
        if (!state.pinnedCode) hideCallout();
      });
      markerG.on('click', (e) => {
        e.stopPropagation();
        togglePinnedExpanded(code);
      });
      markerG.on('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePinnedExpanded(code);
        }
        if (e.key === 'Escape' && state.pinnedCode) {
          state.pinnedCode = null;
          state.pinnedExpanded = false;
          hideCallout(true);
        }
      });
      markerG.on('focus', () => {
        if (!state.pinnedCode) showCallout(code, { pin: false, expanded: false });
      });
      markerG.on('blur', () => {
        if (!state.pinnedCode) hideCallout();
      });
    });

    // Click outside handler remains same...
    state.svg.on('click', () => {
      if (state.pinnedCode) {
        state.pinnedCode = null;
        state.pinnedExpanded = false;
        hideCallout(true);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.pinnedCode) {
        state.pinnedCode = null;
        state.pinnedExpanded = false;
        hideCallout(true);
      }
    }, true);
  }


  // ======== Callout Layer ========
  function initCallout() {
    // Layer
    const layer = document.createElement('div');
    layer.className = 'map-callout-layer';
    layer.setAttribute('aria-hidden', 'true');
    state.wrapper.appendChild(layer);
    state.calloutLayer = layer;

    // SVG for leader line
    const svgNS = 'http://www.w3.org/2000/svg';
    const lineSvg = document.createElementNS(svgNS, 'svg');
    lineSvg.setAttribute('class', 'map-callout-svg');
    layer.appendChild(lineSvg);
    state.calloutSvg = lineSvg;

    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('class', 'map-callout__line');
    lineSvg.appendChild(path);
    state.calloutPath = path;

    // Callout box
    const box = document.createElement('div');
    box.className = 'map-callout';
    box.setAttribute('role', 'tooltip');
    box.setAttribute('aria-hidden', 'true');
    layer.appendChild(box);
    state.calloutEl = box;
  }

  function togglePinnedExpanded(code) {
    if (state.pinnedCode !== code) {
      state.pinnedCode = code;
      state.pinnedExpanded = true;
      showCallout(code, { pin: true, expanded: true });
      return;
    }

    // Same marker: toggle expanded state
    state.pinnedExpanded = !state.pinnedExpanded;
    showCallout(code, { pin: true, expanded: state.pinnedExpanded });
  }

  function showCallout(code, opts) {
    const meta = state.markerMeta.get(code);
    if (!meta) return;

    state.activeCode = code;
    state.activeSelection = state.activeSelection || 'all';

    buildCalloutContent(meta.data, Boolean(opts && opts.expanded));
    positionCallout();

    state.calloutEl.setAttribute('aria-hidden', 'false');
    state.calloutLayer.setAttribute('aria-hidden', 'false');

    const expanded = Boolean(opts && opts.expanded);
    state.calloutEl.classList.toggle('is-pinned', Boolean(opts && opts.pin));
    state.calloutEl.classList.toggle('is-expanded', expanded);
    state.calloutEl.setAttribute('role', expanded ? 'dialog' : 'tooltip');

    if (expanded) {
      state.calloutEl.setAttribute('aria-label', `${meta.data.name} details`);
    } else {
      state.calloutEl.removeAttribute('aria-label');
    }

    animateLeaderLine(!state.reducedMotion);

    if (state.reducedMotion) {
      state.calloutEl.classList.add('is-visible');
    } else {
      state.calloutEl.classList.remove('is-visible');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => state.calloutEl.classList.add('is-visible'));
      });
    }
  }

  function hideCallout(force) {
    if (!force && state.pinnedCode) return;

    state.activeCode = null;
    state.calloutEl?.classList.remove('is-visible', 'is-pinned', 'is-expanded');
    state.calloutEl?.setAttribute('aria-hidden', 'true');
    state.calloutLayer?.setAttribute('aria-hidden', 'true');

    if (state.calloutPath) {
      state.calloutPath.setAttribute('d', '');
      state.calloutPath.style.strokeDasharray = '';
      state.calloutPath.style.strokeDashoffset = '';
      state.calloutPath.style.transition = '';
    }
  }

  // ======== Callout Content (DATA POLICY APPLIED) ========
function buildCalloutContent(data, expanded) {
    const countryName = data.name || data.code;
    let html = `<div class="map-callout__title-row"><div class="map-callout__title">${escapeHtml(countryName)}</div></div>`;
    if (data.mc && data.mc.length > 0) {
      // MC Present: Show list
      html += `<div style="margin-top:8px; font-weight:600; font-size:0.85em; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Management Committee</div>`;
      html += `<ul class="map-callout__leaders" style="list-style:none; padding:0; margin:0;">`;
      data.mc.forEach(p => {
        html += `<li style="margin-bottom:6px; font-size:0.9em; padding-left:8px; border-left:2px solid var(--color-accent);">
          <strong style="display:block; line-height:1.2">${escapeHtml(p.name)}</strong>
          <span style="font-size:0.85em; opacity:0.8">${escapeHtml(p.role || 'MC Member')}</span>
        </li>`;
      });
      html += `</ul>`;
    } else {
      // No MC: Just text, no buttons, no lists
      html += `<div class="map-callout__stat" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border-subtle); color:var(--text-secondary);">Participating country</div>`;
    }

    state.calloutEl.innerHTML = html;
  }


  function pillSpan(key, label, isPresent) {
    const classes = [
      'wg-pill',
      `wg-pill--${key}`,
      isPresent ? 'is-present' : ''
    ].filter(Boolean).join(' ');
    return `<span class="${classes}" aria-hidden="true">${escapeHtml(label)}</span>`;
  }

  // ======== Callout Positioning + Line ========
  function positionCallout() {
    if (!state.activeCode) return;

    const meta = state.markerMeta.get(state.activeCode);
    if (!meta) return;

    const wrapperRect = state.wrapper.getBoundingClientRect();
    const markerPt = markerPointToWrapper(meta.x, meta.y, wrapperRect);

    state.calloutEl.style.left = '0px';
    state.calloutEl.style.top = '0px';

    const w = wrapperRect.width || 1;
    const h = wrapperRect.height || 1;

    const box = state.calloutEl.getBoundingClientRect();
    const boxW = Math.min(CONFIG.callout.maxWidth, box.width || 240);
    const boxH = box.height || 120;

    const preferLeft = markerPt.x > w * 0.62;
    const preferDown = markerPt.y < h * 0.25;

    let left = markerPt.x + (preferLeft ? -(boxW + CONFIG.callout.offset) : CONFIG.callout.offset);
    let top = markerPt.y + (preferDown ? CONFIG.callout.offset : -(boxH + CONFIG.callout.offset));

    left = clamp(left, CONFIG.callout.padding, w - boxW - CONFIG.callout.padding);
    top = clamp(top, CONFIG.callout.padding, h - boxH - CONFIG.callout.padding);

    state.calloutEl.style.left = `${left}px`;
    state.calloutEl.style.top = `${top}px`;

    drawLeaderLine(markerPt, { left, top, width: boxW, height: boxH });
  }

  function markerPointToWrapper(x, y, wrapperRect) {
    const gNode = state.g.node();
    const svgNode = state.svg.node();
    if (!gNode || !svgNode) return { x: 0, y: 0 };

    const pt = svgNode.createSVGPoint();
    pt.x = x;
    pt.y = y;

    const ctm = gNode.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };

    const screen = pt.matrixTransform(ctm);
    return { x: screen.x - wrapperRect.left, y: screen.y - wrapperRect.top };
  }

  function drawLeaderLine(start, box) {
    const endOnLeft = (box.left > start.x);
    const endX = endOnLeft ? box.left : (box.left + box.width);
    const endY = box.top + 22;

    const midX = (start.x + endX) / 2;
    const midY = (start.y + endY) / 2;
    const bend = endOnLeft ? -14 : 14;

    const cx = midX + bend;
    const cy = midY - 10;

    const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
    state.calloutPath.setAttribute('d', d);
  }

  function animateLeaderLine(animate) {
    if (!state.calloutPath) return;

    const path = state.calloutPath;

    if (!path.getAttribute('d')) positionCallout();
    if (!path.getAttribute('d')) return;

    try {
      const len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);

      if (!animate) {
        path.style.transition = 'none';
        path.style.strokeDashoffset = '0';
        return;
      }

      path.style.transition = 'stroke-dashoffset 520ms cubic-bezier(0.2, 0.9, 0.2, 1)';
      path.getBoundingClientRect();
      requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
    } catch (e) {
      path.style.strokeDasharray = '';
      path.style.strokeDashoffset = '';
      path.style.transition = '';
    }
  }

  // ======== Zoom ========
  function initZoom() {
    state.zoom = d3.zoom()
      .scaleExtent([CONFIG.zoom.min, CONFIG.zoom.max])
      .on('zoom', (e) => {
        state.g.attr('transform', e.transform);
        hideCallout(true);
      });

    state.svg.call(state.zoom);

    const duration = state.reducedMotion ? 0 : 300;

    // Controls
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      state.svg.transition().duration(duration).call(state.zoom.scaleBy, CONFIG.zoom.step);
    });
    document.getElementById('zoom-out')?.addEventListener('click', () => {
      state.svg.transition().duration(duration).call(state.zoom.scaleBy, 1 / CONFIG.zoom.step);
    });
    document.getElementById('zoom-reset')?.addEventListener('click', () => {
      state.svg.transition().duration(duration).call(state.zoom.transform, d3.zoomIdentity);
    });
  }

  // ======== Resize Handling (reposition callout only) ========
  function initResizeReposition() {
    const onResize = () => {
      if (!state.activeCode) return;
      cancelAnimationFrame(state.raf);
      state.raf = requestAnimationFrame(() => {
        positionCallout();
        animateLeaderLine(false);
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
  }

  //======== Added Render Table ================= 

function renderTable(data) {
    const tbody = document.querySelector('.data-table tbody');
    const thead = document.querySelector('.data-table thead tr');
    if (!tbody || !thead) return;

    // Headers: Country | Management Committee
    thead.innerHTML = `
      <th scope="col" style="width: 30%">Participating Country</th>
      <th scope="col">Management Committee Member(s)</th>
    `;

    // Sort by Country
    data.sort((a, b) => (a.name || '').localeCompare(b.name));

    const rows = data.map(c => {
      let mcContent = '<span style="color:var(--text-muted); font-style:italic;">—</span>';
      if (c.mc && c.mc.length > 0) {
        mcContent = `<ul style="list-style:none; padding:0; margin:0;">
          ${c.mc.map(p => `<li><strong>${escapeHtml(p.name)}</strong> <span style="opacity:0.7">(${escapeHtml(p.role)})</span></li>`).join('')}
        </ul>`;
      }
      return `<tr>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${mcContent}</td>
      </tr>`;
    }).join('');

    tbody.innerHTML = rows;
    
    const tfoot = document.querySelector('.data-table tfoot');
    if(tfoot) tfoot.remove();
  }
  // ======== Export ========
  window.PlantWallKMap = { render: renderMap };
})();
