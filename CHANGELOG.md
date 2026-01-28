# CHANGELOG — PlantWallK

## Phase 15 (Visual Polish & Accessibility)

### Seamless Background Transitions
- Single fixed `#bg-canvas` with smooth scroll-based crossfade between sections
- Top/bottom blend gradients (18vh) prevent visible seams during transitions
- Microscopy-friendly overlays: dark theme with cool vignette, light theme with holographic sheen

### Frosted Glass + Holographic Effects (V3 Style)
- All text blocks wrapped in `.content-surface` with premium frosted-glass styling
- `backdrop-filter: blur(18-22px)` + semi-opaque background + subtle border/shadow
- Diagonal gradient sheen overlay via `::after` pseudo-element
- Dark theme: cool blue sheen (screen blend mode)
- Light theme: multi-color holographic (cyan/purple/white, soft-light blend)

### Improved Light Theme
- Premium holographic lab-glass aesthetic without harsh colors
- Background filter: `brightness(1.18) saturate(0.92) contrast(0.92)`
- Hero title shadow removed (`--hero-title-shadow: none`)
- Higher content surface sheen opacity (0.95 vs 0.65 dark)
- WG colors use calm lab palette (cyan/purple/green)

### Map Callouts Show Leadership Names
- Hover annotation displays leadership names + roles from `map-data.json`
- Click expands to frosted panel with per-WG member lists
- WG pills color-coded matching legend (cyan/purple/green)
- Smart positioning based on available space
- Biological annotation line draws with premium animation

### Logo + COST Link
- Logo size increased: `clamp(100px, 8vw, 140px)` for readability
- Centered in sidebar header
- COST link styled as subtle CTA button below logo

### Dyslexia Mode
- Accessible via settings panel (toggle)
- Increased line-height (1.8), letter-spacing (0.05em), word-spacing (0.12em)
- Slightly heavier font weight (450)
- Left-aligned text, no hyphenation
- Persists via localStorage

### Files Changed
- `index.html` - V3 layout with content surfaces
- `css/themes.css` - Premium theme tokens, holographic overlays
- `css/main.css` - Reading surfaces, background canvas, calm navigation
- `css/map.css` - Biological annotation callouts, WG pills
- `js/main.js` - Background canvas crossfade, accessibility settings
- `js/map.js` - Leadership names in callouts, expanded panels
- `content/map-data.json` - Leadership data with names/roles
- `content/settings.json` - Background canvas configuration
- `CHANGELOG.md`, `docs/TEST_CHECKLIST.md`

---

## Phase 14 (Style fixes)

### Readability / "V3" surfaces
- Added **reading surfaces** (`.content-surface`) to wrap long-form content
- Added a **section scrim gradient** behind content for stable contrast

### Background transitions
- Background canvas blends based on scroll progress (smooth interpolation)
- Reduced motion keeps transitions near-instant

### Light theme polish
- Light theme has **holographic / lab-glass** look via iridescent sheen overlays
- Removed the **ugly black title glow** in light theme

### Logo / Navigation
- Increased logo size responsively using `clamp()`
- Calmed hover effects by removing "lift" transforms

### Map callouts
- Callouts show **leadership names + roles** when present
- WG chips are color-coded using calm WG colors

---

## Phase 13 (Polish)

- **Continuous background canvas** (no section seams)
- **Premium light theme** (holographic/glass, calm palette)
- **Calmer navigation** (soft active indicator)
- **Map callout**: hover = small annotation; click = expanded frosted panel
- No runtime CDN dependencies
