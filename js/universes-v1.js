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


/* REPLACE THE ENTIRE 'const FRAG = ...' STRING with this Premium Shader */

const FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uResolution;
uniform float uTime;
uniform float uUniverse; // 0=Micro, 1=Chem(unused here), 2=Model
uniform float uScan;
uniform vec3 uChannels;
uniform float uMorph; // Stress/Focus

// Color ramps
vec3 viridis(float t) {
    vec3 c0 = vec3(0.267, 0.003, 0.329);
    vec3 c1 = vec3(0.127, 0.566, 0.550);
    vec3 c2 = vec3(0.993, 0.906, 0.143);
    return mix(c0, mix(c1, c2, smoothstep(0.4, 0.8, t)), smoothstep(0.0, 0.5, t));
}

vec3 magma(float t) {
    return mix(vec3(0.05,0.05,0.1), vec3(1.0,0.2,0.1), t*t);
}

void main(){
  vec2 uv = vUv;
  vec4 baseTex = texture2D(uTex, uv);
  vec3 col = baseTex.rgb;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));

  // === WG1: Microscopy (Focus Peaking + Aberration) ===
  if (uUniverse < 0.5) {
      // Chromatic Aberration at edges
      float dist = distance(uv, vec2(0.5));
      float aber = 0.003 * (1.0 + uMorph * 2.0) * dist;
      float r = texture2D(uTex, uv - aber).r;
      float b = texture2D(uTex, uv + aber).b;
      col = vec3(r, col.g, b);

      // Focus Plane / Scan
      float scanY = uScan;
      float dScan = abs(uv.y - scanY);
      
      // Focus Peaking (Edge Detection)
      float dx = 1.0/uResolution.x;
      float dy = 1.0/uResolution.y;
      float val = dot(texture2D(uTex, uv).rgb, vec3(0.333));
      float valR = dot(texture2D(uTex, uv + vec2(dx, 0.0)).rgb, vec3(0.333));
      float valU = dot(texture2D(uTex, uv + vec2(0.0, dy)).rgb, vec3(0.333));
      float edge = length(vec2(val - valR, val - valU)) * 10.0;
      
      // Scan band logic
      float focusWidth = 0.15;
      float inFocus = 1.0 - smoothstep(0.0, focusWidth, dScan);
      
      // Peaking color (Cyan/Green)
      vec3 peakColor = vec3(0.2, 1.0, 0.8);
      
      // Inside focus band: sharp + peaking
      // Outside: blurred
      if (inFocus > 0.01) {
         col += edge * peakColor * inFocus * 0.8;
      } else {
         // Cheap blur via LOD bias simulation or just dimming
         col *= 0.5; 
         col += vec3(0.1, 0.15, 0.2) * 0.2; // blue tint
      }
      
      // Scanline
      float line = 1.0 - smoothstep(0.0, 0.005, dScan);
      col += vec3(0.5, 0.9, 1.0) * line;
  } 
  
  // === WG3: Modelling (FEM Mesh + Heatmap) ===
  else {
      float stress = uMorph; // 0..1
      
      // Deform grid based on brightness and stress
      vec2 gridUV = uv;
      float displacement = lum * stress * 0.15;
      gridUV += vec2(displacement);
      
      // Grid lines
      float scale = 30.0;
      vec2 g = abs(fract(gridUV * scale) - 0.5);
      float mesh = 1.0 - smoothstep(0.02, 0.05, min(g.x, g.y));
      
      // Heatmap overlay
      // Areas with high displacement get 'hot' colors
      vec3 stressColor = magma(displacement * 6.0 + stress * 0.2);
      
      // Composite
      vec3 wireframe = vec3(0.0);
      if (mesh > 0.1) {
          wireframe = mix(vec3(0.2), stressColor, 0.8);
      }
      
      // Base model fade
      col = mix(col * 0.3, col, 1.0 - stress * 0.5); 
      
      // Add mesh
      col = mix(col, wireframe, mesh * 0.6);
      
      // Highlight high stress areas
      col += stressColor * stress * lum * 0.4;
  }

  // Global vignette
  float v = 1.0 - length(uv - 0.5) * 0.8;
  col *= smoothstep(0.0, 1.0, v);

  gl_FragColor = vec4(col, 1.0);
}`;


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
/* REPLACE existing createChemistryWallCanvasV1 function */

export function createChemistryWallCanvasV1(opts) {
  const canvas = opts.canvas;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  // WG2: Deep Learning / Computer Vision Theme
  const ROOT_IMAGE_SRC = opts.rootImageSrc || "./images/arabidopsis_root_stained_with_pectin_probe.webp";
  
  let zoom = opts.zoom;
  // Channels map to: [0]=Image Visibility, [1]=Analysis Overlay, [2]=Bounding Boxes
  let channels = opts.channels || [1, 1, 1]; 

  let dims = { width: 0, height: 0 };
  let raf = 0;
  let img = null;
  let detections = []; 
  let scanY = 0;

  // Load image
  const i = new Image();
  i.crossOrigin = "anonymous";
  i.src = ROOT_IMAGE_SRC;
  i.onload = () => { img = i; generateDetections(); };

  // Create fake "bounding box" data
  const generateDetections = () => {
     detections = [];
     for(let k=0; k<12; k++) {
       detections.push({
         x: 0.2 + Math.random() * 0.6,
         y: 0.2 + Math.random() * 0.6,
         w: 0.05 + Math.random() * 0.1,
         h: 0.05 + Math.random() * 0.1,
         label: Math.random() > 0.5 ? "WALL " + (Math.random()*0.9).toFixed(2) : "JUNC " + (Math.random()*0.9).toFixed(2),
         color: Math.random() > 0.5 ? "#00ffcc" : "#ff00ff"
       });
     }
  };

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    ctx.scale(dpr, dpr);
    dims = { width: r.width, height: r.height };
  };

  const draw = (time) => {
    const { width, height } = dims;
    if (!width || !height) { raf = requestAnimationFrame(draw); return; }
    
    // Background: Dark "Lab Monitor" Grey
    ctx.fillStyle = "#0f172a"; 
    ctx.fillRect(0, 0, width, height);

    if (img && channels[0] > 0.5) {
      // Calculate fit
      const scale = Math.min(width / img.width, height / img.height) * (0.8 + zoom * 0.05);
      const iw = img.width * scale;
      const ih = img.height * scale;
      const ix = (width - iw) / 2;
      const iy = (height - ih) / 2;

      ctx.save();
      
      // "Analyzed" look: slightly desaturated and high contrast
      if (channels[1] > 0.5) {
        ctx.filter = "contrast(1.2) grayscale(0.8) brightness(0.7)";
      }
      ctx.drawImage(img, ix, iy, iw, ih);
      ctx.restore();

      // Scanning Laser Line
      scanY = (time * 0.0004) % 1.2; 
      const lineY = iy + scanY * ih;

      if (channels[1] > 0.5) {
        // Draw Laser
        ctx.beginPath();
        ctx.moveTo(ix, lineY);
        ctx.lineTo(ix+iw, lineY);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.8)"; // WG2 Blue/Cyan
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Scan Trail
        const grad = ctx.createLinearGradient(0, lineY - 40, 0, lineY);
        grad.addColorStop(0, "rgba(56, 189, 248, 0)");
        grad.addColorStop(1, "rgba(56, 189, 248, 0.2)");
        ctx.fillStyle = grad;
        ctx.fillRect(ix, lineY - 40, iw, 40);
      }

      // Draw Bounding Boxes (if laser has passed them)
      if (channels[2] > 0.5) {
        ctx.lineWidth = 1.5;
        ctx.font = "10px monospace";

        detections.forEach(d => {
          const dy = iy + d.y * ih;
          // Reveal if scan passed or if zoomed in
          if (lineY > dy || zoom > 5) {
             const dx = ix + d.x * iw;
             const dw = d.w * iw;
             const dh = d.h * ih;

             ctx.strokeStyle = d.color;
             ctx.strokeRect(dx, dy, dw, dh);
             
             // Label bg
             ctx.fillStyle = d.color;
             ctx.fillRect(dx, dy - 12, dw, 12);
             
             // Label text
             ctx.fillStyle = "#000";
             ctx.fillText(d.label, dx + 2, dy - 2);
             
             // Mask overlay
             ctx.fillStyle = d.color + "22"; // Low opacity hex
             ctx.fillRect(dx, dy, dw, dh);
          }
        });
      }
    }

    raf = requestAnimationFrame(draw);
  };

  window.addEventListener("resize", resize);
  resize();
  raf = requestAnimationFrame(draw);

  return {
    setZoom(z) { zoom = z; },
    setChannels(c) { channels = c; },
    destroy() {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    }
  };
}
