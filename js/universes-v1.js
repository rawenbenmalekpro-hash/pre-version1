// js/universes-v1.js
// V1 universe implementations (static-site port). ES module.
// Milestone: Universe Rendering Fix — remove Three.js dependency (static servers can't serve node_modules).
// Provides WG1/WG3 WebGL shader runner + WG2 2D canvas sim with robust logging.

const LOG_PREFIX = "[UniversesV1]";
const log = (...a) => console.log(LOG_PREFIX, ...a);
const warn = (...a) => console.warn(LOG_PREFIX, ...a);
const err = (...a) => console.error(LOG_PREFIX, ...a);

/* =========================
   WG1/WG3: UniverseCanvas (V1 Shader)
   ========================= */

const VERT = `
attribute vec2 aPos;
attribute vec2 aUv;
varying vec2 vUv;
void main(){
  vUv = aUv;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`.trim();

const FRAG = `precision highp float;varying vec2 vUv;uniform sampler2D uTex;uniform vec2 uResolution;uniform float uTime;uniform float uUniverse;uniform float uScan;uniform vec3 uChannels;uniform float uMorph;float saturate(float x){return clamp(x,0.0,1.0);}float grid(vec2 uv,float scale,float thickness){vec2 g=abs(fract(uv*scale)-0.5);float line=min(g.x,g.y);return 1.0-smoothstep(thickness,thickness+0.0025,line);}float hash(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return fract(sin(p.x+p.y)*43758.5453123);}void main(){vec2 uv=vUv;vec2 c=uv-0.5;float r=length(c);float wobbleBase=(uUniverse<0.5)?0.0:(uUniverse<1.5)?0.008:0.004;float wobble=wobbleBase==0.0?0.0:wobbleBase+sin(uTime*0.7)*wobbleBase*0.5;vec2 warp=vec2(sin(c.y*8.0+uTime*0.8),cos(c.x*7.0-uTime*0.6))*wobble;vec2 uvWarped=uv+warp;vec3 base=texture2D(uTex,clamp(uvWarped,0.0,1.0)).rgb;vec3 col;if(uUniverse<0.5){float scanPos=uScan;float dist=abs(uv.y-scanPos);vec3 blurred=base*0.25;vec3 sharp=base*1.25+vec3(0.03,0.06,0.08);float band=1.0-smoothstep(0.02,0.09,dist);col=mix(blurred,sharp,band);float line=1.0-smoothstep(0.0,0.004,dist);vec3 lineCol=vec3(0.6,0.95,1.0);col+=lineCol*line*0.8;}else if(uUniverse<1.5){float z=saturate(uMorph);vec3 wallWide=texture2D(uTex,clamp(uv,0.0,1.0)).rgb;vec3 structWide=wallWide*1.05+vec3(0.02,0.03,0.04);vec2 center=vec2(0.55,0.50);vec2 d=uv-center;float dist=length(d);float zoomPhase=smoothstep(0.1,0.8,z);float zoomFactor=mix(1.0,4.5,zoomPhase);float patchRadius=mix(0.46,0.14,zoomPhase);float edge=0.06;float patchMask=1.0-smoothstep(patchRadius+edge,patchRadius-edge,dist);vec2 uvMicro=center+d*zoomFactor;uvMicro=clamp(uvMicro,0.0,1.0);vec3 baseMicro=texture2D(uTex,uvMicro).rgb;float lum=dot(baseMicro,vec3(0.299,0.587,0.114));float fibreDir=uvMicro.y*40.0+lum*6.0;float fibrePattern=sin(fibreDir);float fibreMask=1.0-smoothstep(0.35,0.8,abs(fibrePattern));fibreMask*=smoothstep(0.25,0.85,lum);vec3 fibreCol=vec3(0.10,0.90,0.80)*fibreMask;vec2 metaUV=uvMicro*16.0;vec2 cell=floor(metaUV);vec2 f=fract(metaUV)-0.5;float metaSeed=hash(cell);float slide=fract(metaSeed+uTime*0.12);vec2 centre=vec2(0.0,mix(-0.5,0.5,slide));float metaDist=length(f-centre);float coreA=smoothstep(0.32,0.16,metaDist);float shellA=smoothstep(0.26,0.20,metaDist);float coreB=smoothstep(0.26,0.12,metaDist);float shellB=smoothstep(0.20,0.16,metaDist);float primaryDot=max(0.0,coreA-shellA);float secondaryDot=max(0.0,coreB-shellB);float fibreInfluence=smoothstep(0.2,0.8,fibreMask);primaryDot*=fibreInfluence;secondaryDot*=fibreInfluence;vec3 metaPrimary=vec3(0.98,0.72,0.25)*primaryDot;vec3 metaSecondary=vec3(0.98,0.35,0.82)*secondaryDot;vec2 enzymeCoord=uvMicro*6.0+vec2(uTime*0.05,-uTime*0.03);float enzymeNoise=hash(enzymeCoord);float enzymePulse=smoothstep(0.78,0.98,enzymeNoise+0.25*sin(uTime*1.3));enzymePulse*=fibreMask;vec3 enzymeGlow=vec3(1.0,0.95,0.4)*enzymePulse;fibreCol=mix(fibreCol,fibreCol*0.4,enzymePulse*0.8);fibreCol+=enzymeGlow*0.8;vec3 molecular=vec3(0.0);molecular+=fibreCol*uChannels.r;molecular+=metaPrimary*uChannels.g;molecular+=metaSecondary*uChannels.b;vec3 structZoom=baseMicro*1.1+vec3(0.03,0.04,0.06);molecular+=structZoom*0.25;float molVis=smoothstep(0.35,1.0,z);col=structWide;col=mix(col,molecular,patchMask*molVis);float bandY=0.2+0.6*fract(uTime*0.08);float distBand=abs(uv.y-bandY);float bandMask=1.0-smoothstep(0.02,0.05,distBand);col=mix(col,molecular,bandMask*molVis*0.85);}else{vec3 bril=texture2D(uTex,clamp(uv,0.0,1.0)).rgb;float lum=dot(bril,vec3(0.299,0.587,0.114));float fx=smoothstep(0.06,0.08,uv.x)*(1.0-smoothstep(0.82,0.84,uv.x));float fy=smoothstep(0.12,0.14,uv.y)*(1.0-smoothstep(0.88,0.90,uv.y));float fieldMask=fx*fy;vec2 uvField=mix(uv,uvWarped,fieldMask);float gridCoarse=grid(uvField,12.0,0.015);float gridFine=grid(uvField+vec2(0.015,0.0),24.0,0.010);float mesh=saturate(gridCoarse*0.9+gridFine*0.6);mesh*=smoothstep(0.25,0.85,lum);mesh*=fieldMask;float pulse=0.5+0.5*sin(uTime*1.2+r*8.0);mesh*=mix(0.5,1.0,pulse);vec3 meshTint=vec3(0.40,0.95,0.85);vec3 meshCol=mix(bril*0.3,meshTint,mesh);float m=saturate(uMorph);col=mix(bril,meshCol,m);float scanPos=0.15+0.7*fract(uTime*0.08);float distX=abs(uv.x-scanPos);float band=(1.0-smoothstep(0.01,0.05,distX))*fieldMask;vec3 scanColor=vec3(1.0,1.0,1.0);col=mix(col,scanColor,band*0.18);}float vign=smoothstep(0.97,0.50,r);col*=vign;gl_FragColor=vec4(col,1.0);}`;

/** Compile helper with logs */
function compile(gl, type, src) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh) || "";
    err("Shader compile failed:", info);
    err("Source snippet:", src.slice(0, 220) + (src.length > 220 ? "..." : ""));
    gl.deleteShader(sh);
    throw new Error("shader compile failed");
  }
  return sh;
}

function link(gl, vs, fs) {
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(prog) || "";
    err("Program link failed:", info);
    gl.deleteProgram(prog);
    throw new Error("program link failed");
  }
  return prog;
}

function isWebGL2(gl) {
  return typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
}

/**
 * Create V1 UniverseCanvas renderer (WG1 microscopy, WG3 modelling).
 * @param {Object} opts
 * @param {"microscopy"|"chemistry"|"modelling"} opts.universe
 * @param {HTMLElement} opts.container
 * @param {string} opts.imagePath
 * @param {number} [opts.scan]
 * @param {number} [opts.morph]
 * @param {[number,number,number]} [opts.channels]
 */
export function createUniverseCanvasV1(opts) {
  const { universe, container, imagePath } = opts;
  let scan = typeof opts.scan === "number" ? opts.scan : 0.3;
  let morph = typeof opts.morph === "number" ? opts.morph : 0.0;
  const ch = opts.channels || [1, 1, 1];

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);

  /** @type {WebGLRenderingContext|WebGL2RenderingContext|null} */
  const gl =
    canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true }) ||
    canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: true });

  if (!gl) {
    err("WebGL unavailable. Canvas will stay blank.");
    return {
      setScan() {},
      setMorph() {},
      setChannels() {},
      destroy() {
        if (canvas.parentElement === container) container.removeChild(canvas);
      }
    };
  }

  const onLost = (e) => {
    e.preventDefault();
    warn("WebGL context lost");
  };
  const onRestored = () => {
    warn("WebGL context restored (reload recommended)");
  };
  canvas.addEventListener("webglcontextlost", onLost, false);
  canvas.addEventListener("webglcontextrestored", onRestored, false);

  // Size / DPR
  let w = 0, h = 0, dpr = 1;
  const resize = () => {
    const r = container.getBoundingClientRect();
    const nw = Math.max(1, Math.floor(r.width || 320));
    const nh = Math.max(1, Math.floor(r.height || 320));
    const ndpr = Math.min(2, window.devicePixelRatio || 1);
    if (nw === w && nh === h && ndpr === dpr) return;
    w = nw; h = nh; dpr = ndpr;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  // Program
  let prog;
  try {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    prog = link(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  } catch (e) {
    err("WebGL shader init failed:", e);
    return {
      setScan() {},
      setMorph() {},
      setChannels() {},
      destroy() {
        canvas.removeEventListener("webglcontextlost", onLost);
        canvas.removeEventListener("webglcontextrestored", onRestored);
        if (canvas.parentElement === container) container.removeChild(canvas);
      }
    };
  }

  gl.useProgram(prog);

  // Geometry: full-screen quad
  const posLoc = gl.getAttribLocation(prog, "aPos");
  const uvLoc = gl.getAttribLocation(prog, "aUv");
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // x,y,u,v for 4 vertices as triangle strip
  const quad = new Float32Array([
    -1, -1, 0, 0,
     1, -1, 1, 0,
    -1,  1, 0, 1,
     1,  1, 1, 1
  ]);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uvLoc);
  gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);

  // Uniform locations
  const uTime = gl.getUniformLocation(prog, "uTime");
  const uRes = gl.getUniformLocation(prog, "uResolution");
  const uUniverse = gl.getUniformLocation(prog, "uUniverse");
  const uScan = gl.getUniformLocation(prog, "uScan");
  const uMorph = gl.getUniformLocation(prog, "uMorph");
  const uChannels = gl.getUniformLocation(prog, "uChannels");
  const uTex = gl.getUniformLocation(prog, "uTex");

  const uniVal = universe === "microscopy" ? 0 : universe === "chemistry" ? 1 : 2;
  gl.uniform1f(uUniverse, uniVal);
  gl.uniform1f(uScan, scan);
  gl.uniform1f(uMorph, morph);
  gl.uniform3f(uChannels, ch[0], ch[1], ch[2]);
  if (uTex) gl.uniform1i(uTex, 0);

  // Texture
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // 1x1 placeholder
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

  let texReady = false;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (isWebGL2(gl)) gl.generateMipmap(gl.TEXTURE_2D); // safe in WebGL2, image likely POT? If not, ignored in practice.
      texReady = true;
      log("Texture loaded:", imagePath, `${img.naturalWidth}x${img.naturalHeight}`);
    } catch (e) {
      err("Texture upload failed:", e);
    }
  };
  img.onerror = () => {
    err("Texture failed to load:", imagePath);
  };
  img.src = imagePath;

  // Render loop
  let raf = 0;
  const t0 = performance.now();
  const draw = () => {
    resize();
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, (performance.now() - t0) / 1000);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // If texture isn't ready yet, still draw (shader uses placeholder black)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);

  // Resize observer: catches overlay open / layout changes
  let ro = null;
  if ("ResizeObserver" in window) {
    ro = new ResizeObserver(() => resize());
    ro.observe(container);
  }
  window.addEventListener("resize", resize, { passive: true });

  return {
    setScan(v) {
      scan = v;
      if (uScan) gl.uniform1f(uScan, v);
    },
    setMorph(v) {
      morph = v;
      if (uMorph) gl.uniform1f(uMorph, v);
    },
    setChannels(rgb) {
      if (!rgb || rgb.length < 3) return;
      if (uChannels) gl.uniform3f(uChannels, rgb[0], rgb[1], rgb[2]);
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      if (ro) ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      try { gl.bindTexture(gl.TEXTURE_2D, null); } catch (_) {}
      if (tex) gl.deleteTexture(tex);
      if (buf) gl.deleteBuffer(buf);
      if (prog) gl.deleteProgram(prog);
      if (canvas.parentElement === container) container.removeChild(canvas);
      if (!texReady) warn("Destroyed before texture ready:", imagePath);
    }
  };
}

/* =========================
   WG2: ChemistryWallCanvas (V1 2D canvas sim)
   ========================= */

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }
function smoothstep(edge0, edge1, x) { const t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); }

/** V1 chemistry page opacity ramp (start/end thresholds) */
export function computeChemOpacityFromZoom(zoom) {
  const zoomNorm = clamp((zoom - 1) / 49, 0, 1);
  const start = 0.2, end = 0.7;
  if (zoomNorm <= start) return 0;
  if (zoomNorm >= end) return 1;
  return (zoomNorm - start) / (end - start);
}

/**
 * Create V1 ChemistryWallCanvas on a <canvas>.
 * @param {Object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {number} opts.zoom
 * @param {[number,number,number]} opts.channels
 * @param {string} [opts.rootImageSrc]
 * @param {string} [opts.zoomImageSrc]
 */
export function createChemistryWallCanvasV1(opts) {
  const canvas = opts.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const ROOT_IMAGE_SRC = opts.rootImageSrc || "../images/arabidopsis_root_stained_with_pectin_probe.webp";
  const ZOOM_IMAGE_SRC = opts.zoomImageSrc || "../images/atroot_zoom.png";

  let zoom = opts.zoom;
  /** @type {[number,number,number]} */ let channels = opts.channels || [1, 1, 1];

  /** @type {{width:number,height:number}} */ let dims = { width: 0, height: 0 };
  /** @type {number|null} */ let lastTime = null;
  /** @type {number} */ let raf = 0;

  /** @type {Array<any>} */ let bundles = [];
  /** @type {Array<any>} */ let metabolites = [];
  /** @type {Array<any>} */ let pulses = [];

  /** @type {HTMLImageElement|null} */ let rootImg = null;
  /** @type {HTMLImageElement|null} */ let zoomImg = null;

  const loadImg = (src, cb) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { log("Chem img loaded:", src); cb(img); };
    img.onerror = () => err("Chem img failed:", src);
    img.src = src;
    return img;
  };
  loadImg(ROOT_IMAGE_SRC, (img) => { rootImg = img; });
  loadImg(ZOOM_IMAGE_SRC, (img) => { zoomImg = img; });

  const initScene = (w, h) => {
    dims = { width: w, height: h };
    bundles = [];
    const bundleCount = 11;
    for (let i = 0; i < bundleCount; i++) {
      const t = i / (bundleCount - 1);
      const centerY = h * (0.25 + 0.5 * t) + (Math.random() - 0.5) * 14;
      bundles.push({ centerY, thickness: 10 + Math.random() * 12, phase: Math.random() * Math.PI * 2, warp: 8 + Math.random() * 10, hue: 145 + Math.random() * 35 });
    }
    metabolites = [];
    for (let i = 0; i < bundles.length; i++) {
      const count = 4 + Math.floor(Math.random() * 4);
      for (let j = 0; j < count; j++) {
        metabolites.push({ bundleIndex: i, u: Math.random(), speed: 0.08 + Math.random() * 0.08, offset: (Math.random() - 0.5) * 12, radius: 2.5 + Math.random() * 1.5, type: Math.random() < 0.4 ? "secondary" : "primary" });
      }
    }
    pulses = [];
  };

  const handleResize = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initScene(rect.width, rect.height);
  };

  const draw = (time) => {
    const { width, height } = dims;
    if (!width || !height) { raf = requestAnimationFrame(draw); return; }

    const z = zoom;
    const zoomNorm = clamp((z - 1) / 49, 0, 1);
    const bundleWeight = channels[0], primaryWeight = channels[1], secondaryWeight = channels[2];

    const tSec = time / 1000;
    const last = lastTime ?? time;
    const dt = Math.min(0.05, (time - last) / 1000);
    lastTime = time;

    ctx.clearRect(0, 0, width, height);

    const phaseRoot = clamp(1 - zoomNorm / 0.7, 0, 1);
    const phaseZoom = smoothstep(0.15, 0.7, zoomNorm);

    if ((rootImg || zoomImg) && (phaseRoot > 0.02 || phaseZoom > 0.02)) {
      ctx.save();
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, width, height);

      if (rootImg && phaseRoot > 0.02) {
        ctx.save();
        ctx.globalAlpha = phaseRoot;
        const baseScaleRoot = Math.max(width / rootImg.width, height / rootImg.height);
        const maxExtraZoom = 1.7;
        const zoomFactor = 1 + zoomNorm * (maxExtraZoom - 1);
        const rootScale = baseScaleRoot * zoomFactor;
        const rootW = rootImg.width * rootScale;
        const rootH = rootImg.height * rootScale;
        const rootX = width / 2 - rootW * (0.4 + zoomNorm * 0.1);
        const rootY = height / 2 - rootH * 0.6;
        ctx.filter = "contrast(1.2) saturate(1.35) brightness(0.9)";
        ctx.drawImage(rootImg, rootX, rootY, rootW, rootH);
        ctx.filter = "none";
        ctx.restore();
      }

      if (zoomImg && phaseZoom > 0.02) {
        ctx.save();
        ctx.globalAlpha = phaseZoom;
        const baseScaleZoom = Math.max(width / zoomImg.width, height / zoomImg.height);
        const extraZoom = 1.4 + zoomNorm * 1.2;
        const zoomScale = baseScaleZoom * extraZoom;
        const zoomW = zoomImg.width * zoomScale;
        const zoomH = zoomImg.height * zoomScale;
        const zoomX = width / 2 - zoomW * 0.6;
        const zoomY = height / 2 - zoomH * 0.7;
        ctx.filter = "contrast(1.5) saturate(1.6)";
        ctx.drawImage(zoomImg, zoomX, zoomY, zoomW, zoomH);
        ctx.filter = "none";

        const cx = width * 0.6, cy = height * 0.5;
        const rBase = Math.min(width, height) * 0.26;
        const rr = rBase * (0.8 + zoomNorm * 0.9);
        const g = ctx.createRadialGradient(cx, cy, rr * 0.5, cx, cy, rr);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.95)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(123,255,218,0.9)";
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }
      ctx.restore();
    }

    const simPhase = smoothstep(0.5, 0.9, zoomNorm);
    if (simPhase <= 0.01) { raf = requestAnimationFrame(draw); return; }

    ctx.save();
    ctx.globalAlpha = simPhase;

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "rgba(3,8,18,0.95)");
    bgGrad.addColorStop(0.4, "rgba(4,18,40,0.98)");
    bgGrad.addColorStop(1, "rgba(2,5,12,1)");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.08 * simPhase;
    const cellSize = 36;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(123,255,218,0.45)";
    for (let y = height * 0.25; y < height * 0.8; y += cellSize) {
      ctx.beginPath();
      ctx.moveTo(width * 0.12, y);
      ctx.lineTo(width * 0.88, y + Math.sin(y * 0.01) * 3);
      ctx.stroke();
    }
    ctx.restore();

    if (Math.random() < 0.03 * simPhase) {
      const b = bundles[Math.floor(Math.random() * bundles.length)];
      const x = width * (0.15 + Math.random() * 0.7);
      pulses.push({ x, y: b.centerY + (Math.random() - 0.5) * (b.thickness * 0.7), radius: 0, life: 0 });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.life += dt * (0.7 + simPhase);
      p.radius += dt * 48;
      if (p.life >= 1) pulses.splice(i, 1);
    }

    ctx.save();
    for (let i = 0; i < bundles.length; i++) {
      const b = bundles[i];
      const warpAmount = b.warp;
      const bundleAlpha = (0.4 + 0.35 * simPhase) * bundleWeight;
      if (bundleAlpha < 0.02) continue;

      const half = b.thickness * (0.6 + simPhase * 0.6);
      const segments = 52;

      ctx.beginPath();
      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const x = width * (0.1 + 0.8 * u);
        const base = b.centerY;
        const curve = Math.sin(u * Math.PI * 2 + b.phase) * warpAmount;
        const yTop = base + curve - half;
        if (s === 0) ctx.moveTo(x, yTop); else ctx.lineTo(x, yTop);
      }
      for (let s = segments; s >= 0; s--) {
        const u = s / segments;
        const x = width * (0.1 + 0.8 * u);
        const base = b.centerY;
        const curve = Math.sin(u * Math.PI * 2 + b.phase) * warpAmount;
        const yBottom = base + curve + half;
        ctx.lineTo(x, yBottom);
      }
      ctx.closePath();

      const hueShift = 15 * (i / bundles.length) - 7;
      const baseHue = b.hue + hueShift;
      const fillColor = `hsla(${baseHue}, 80%, ${40 + simPhase * 15}%, ${bundleAlpha})`;
      const edgeColor = `hsla(${baseHue + 10}, 90%, ${58 + simPhase * 8}%, ${bundleAlpha * 1.2})`;

      ctx.fillStyle = fillColor;
      ctx.shadowColor = `hsla(${baseHue}, 90%, 70%, ${0.4 * simPhase * bundleWeight})`;
      ctx.shadowBlur = 14 * simPhase * bundleWeight;
      ctx.fill();

      ctx.save();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.4 + simPhase * 0.7;
      ctx.strokeStyle = edgeColor;
      ctx.beginPath();
      for (let s = 0; s <= segments; s++) {
        const u = s / segments;
        const x = width * (0.1 + 0.8 * u);
        const base = b.centerY;
        const curve = Math.sin(u * Math.PI * 2 + b.phase) * warpAmount;
        const yMid = base + curve;
        if (s === 0) ctx.moveTo(x, yMid); else ctx.lineTo(x, yMid);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    ctx.save();
    for (const p of pulses) {
      const alpha = (1 - p.life) * (0.6 + 0.3 * simPhase) * bundleWeight;
      if (alpha < 0.02) continue;
      const coreR = p.radius * 0.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,221,122,${alpha * 0.45})`; ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,221,122,${alpha})`; ctx.fill();
    }
    ctx.restore();

    for (const m of metabolites) { m.u += m.speed * dt * (0.5 + simPhase * 1.3); if (m.u > 1.15) m.u -= 1.2; }

    ctx.save();
    for (const m of metabolites) {
      const b = bundles[m.bundleIndex];
      const layerWeight = m.type === "secondary" ? secondaryWeight : primaryWeight;
      if (layerWeight < 0.05) continue;

      const u = m.u;
      const x = width * (0.1 + 0.8 * u);
      const base = b.centerY;
      const curve = Math.sin(u * Math.PI * 2 + b.phase) * b.warp;
      const baseY = base + curve + m.offset;

      const pulse = 1 + 0.5 * Math.sin(tSec * 4 + m.offset);
      const rr = m.radius * (0.8 + simPhase * 0.9) * pulse;

      const baseAlpha = 0.7 + simPhase * 0.3;
      const alpha = baseAlpha * layerWeight;

      ctx.beginPath();
      ctx.arc(x, baseY, rr, 0, Math.PI * 2);
      if (m.type === "secondary") { ctx.fillStyle = `rgba(255,122,228,${alpha})`; ctx.shadowColor = "rgba(255,122,228,0.9)"; }
      else { ctx.fillStyle = `rgba(123,255,218,${alpha})`; ctx.shadowColor = "rgba(123,255,218,0.9)"; }
      ctx.shadowBlur = 12 * layerWeight;
      ctx.fill();
    }
    ctx.restore();

    ctx.restore();
    raf = requestAnimationFrame(draw);
  };

  handleResize();
  window.addEventListener("resize", handleResize);
  raf = requestAnimationFrame(draw);

  return {
    setZoom(v) { zoom = v; },
    setChannels(rgb) { channels = rgb; },
    destroy() {
      window.removeEventListener("resize", handleResize);
      if (raf) cancelAnimationFrame(raf);
    }
  };
}
