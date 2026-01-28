# PlantWallK Test Checklist — Phase 15 (Visual Polish)

## Setup

```bash
cd <project-root>
npm install
npm run setup
npm run serve
# Open http://localhost:8080
```

---

## 0. Seamless Background Transitions (No Seams)

- [ ] Scroll slowly from section to section: **no visible seam lines** between section boundaries
- [ ] Background changes feel like a **continuous crossfade**, not discrete blocks
- [ ] Top/bottom blend gradients prevent hard edges during transitions
- [ ] Readability stays stable while backgrounds transition (scrims/tokens keep contrast)

### Reduced Motion
- [ ] Enable OS "Reduce motion" or use the Accessibility panel
- [ ] Background transitions become instant or near-instant (no long crossfade)

---

## 1. Frosted Glass + Holographic Effects

- [ ] All long-form text blocks are wrapped in visible **frosted-glass reading surfaces**
- [ ] Reading surfaces show blur effect behind content
- [ ] Subtle border and shadow create depth
- [ ] Light theme surfaces show **holographic sheen** (cyan/purple gradient, subtle)
- [ ] Dark theme surfaces show **cool blue sheen** (subtle, not distracting)
- [ ] WG cards, grant cards, leader cards all have glass effect

---

## 2. Light Theme Quality

- [ ] Theme toggle switches dark ↔ light smoothly
- [ ] Light theme feels "lab / glass / holographic" (no aggressive colors)
- [ ] **No black glow/shadow** around hero title in light theme
- [ ] Text contrast remains WCAG-safe (check headings, paragraphs, buttons)
- [ ] Background images are slightly brightened/desaturated for readability
- [ ] Theme choice persists across refresh

---

## 3. Map Callout Shows Leadership Names

- [ ] Hover over a country with leadership (e.g., Czech Republic, France, Sweden)
- [ ] Callout shows **leadership names + roles** (e.g., "Kateřina Schwarzerová — Chair")
- [ ] Countries without leadership show member count only (no placeholder text)
- [ ] WG pills are color-coded: WG1=cyan, WG2=purple, WG3=green
- [ ] Click marker → expanded panel appears with WG sections

### Callout Positioning
- [ ] Callout appears on correct side (left/right based on marker position)
- [ ] Leader line draws smoothly from marker to callout
- [ ] Callout stays within map bounds

---

## 4. Logo + COST Link

- [ ] Logo is clearly visible and readable in sidebar
- [ ] Logo scales responsively (larger on wider screens)
- [ ] COST link appears below logo as subtle button
- [ ] COST link opens official COST page in new tab
- [ ] Mobile: logo visible in header, appropriately sized

---

## 5. Dyslexia Mode

- [ ] Open Accessibility panel (♿ button in sidebar or mobile)
- [ ] Toggle "Dyslexia-friendly mode" ON
- [ ] Text should show: increased line spacing, letter spacing, word spacing
- [ ] Font weight slightly heavier
- [ ] All text left-aligned
- [ ] Setting persists after page refresh
- [ ] Toggle OFF and verify text returns to normal

---

## 6. Keyboard Navigation + Focus States

- [ ] Tab through entire page: focus order is logical
- [ ] Focus rings are clearly visible (2px blue outline)
- [ ] Skip links work (visible on focus, navigate correctly)
- [ ] Map markers can be focused and activated with Enter/Space
- [ ] Escape closes expanded callout, accessibility panel, mobile menu
- [ ] Theme toggle, view toggle, zoom controls all keyboard accessible

---

## 7. Reduced Motion Behavior

- [ ] Enable "Reduce motion" in Accessibility panel
- [ ] All animations become instant or near-instant
- [ ] Counter animation disabled (shows final number immediately)
- [ ] Marker pulse animation disabled
- [ ] Callout appears without transition delay
- [ ] Background crossfade instant

---

## 8. Mobile Responsiveness

- [ ] At <1024px: sidebar hidden, mobile header visible
- [ ] Menu button shows "Menu" text (not hamburger icon)
- [ ] Mobile nav opens/closes smoothly
- [ ] All content readable at 320px width
- [ ] Touch targets at least 44×44px
- [ ] Map is usable with touch (pinch zoom)

---

## 9. Contrast & Readability

- [ ] Use browser dev tools or contrast checker
- [ ] All body text meets WCAG AA (4.5:1 contrast ratio)
- [ ] Large text (headings) meets WCAG AA (3:1 ratio)
- [ ] Links distinguishable from body text
- [ ] High contrast mode significantly increases contrast
- [ ] Text readable over all background images

---

## 10. No Console Errors

- [ ] Open browser dev console
- [ ] Navigate through all sections
- [ ] Interact with map, theme toggle, accessibility panel
- [ ] **No JavaScript errors in console**
- [ ] **No 404 errors for resources**
