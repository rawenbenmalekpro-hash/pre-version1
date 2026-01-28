// js/vendor/three.module.js
// PlantWallK local vendor shim for Three.js (ESM)
// Fixes: MIME type "text/html" when /js/vendor/three.module.js is missing or mis-served.
// It dynamically loads an ESM build from local /js/vendor/three.module.min.js.
// IMPORTANT: Ensure /js/vendor/three.module.min.js exists in your repo.
// (This file contains no network/CDN usage.)

const CANDIDATES = [
  "/js/vendor/three.module.min.js",
  "/js/vendor/three.module.mjs",
  "/js/vendor/three.module.js.min",
];

async function loadThree() {
  const errors = [];

  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        errors.push(`${url} -> HTTP ${res.status}`);
        continue;
      }
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("javascript") && !ct.includes("ecmascript") && !ct.includes("module")) {
        errors.push(`${url} -> bad content-type: ${ct || "(none)"}`);
        continue;
      }

      // Import as a real module URL (no eval). This keeps it "local only".
      const mod = await import(url);
      return mod;
    } catch (e) {
      errors.push(`${url} -> ${String(e && e.message ? e.message : e)}`);
    }
  }

  const hint =
    "Could not load a local ESM Three.js build. " +
    "Make sure one of these files exists and is served as JS: " +
    CANDIDATES.join(", ");

  const err = new Error(`${hint}\nDetails:\n- ${errors.join("\n- ")}`);
  err.name = "ThreeLoaderError";
  throw err;
}

// Load and re-export everything as THREE namespace exports.
const THREE = await loadThree();

export default THREE;
export * from "/js/vendor/three.module.min.js";
