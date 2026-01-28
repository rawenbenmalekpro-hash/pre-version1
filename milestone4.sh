#!/usr/bin/env bash
set -euo pipefail

# Run from repo root. Creates deterministic /images/*.webp and rewrites content/settings.json
# Idempotent: skips conversion if output exists.

ROOT="$(pwd)"
IMG_DIR="$ROOT/images"
SETTINGS="$ROOT/content/settings.json"

need() { command -v "$1" >/dev/null 2>&1; }

# --- helpers ---
lower() { tr '[:upper:]' '[:lower:]' <<<"$1"; }

# Find first matching source file by glob-like pattern (case-insensitive) under /images,
# excluding Zone.Identifier artifacts.
find_src() {
  local pat="$1"
  # Convert simple glob to find -iname pattern
  find "$IMG_DIR" -type f \
    \( -iname "$pat" \) \
    ! -iname "*:zone.identifier" \
    ! -iname "*.zone.identifier" \
    2>/dev/null | head -n 1
}

# Convert a source image to WebP using best available tool.
# Args: src_path out_path
convert_to_webp() {
  local src="$1"
  local out="$2"

  if [[ -f "$out" ]]; then
    echo "[skip] $(basename "$out") exists"
    return 0
  fi
  if [[ -z "$src" || ! -f "$src" ]]; then
    echo "[warn] source not found for $(basename "$out")"
    return 0
  fi

  mkdir -p "$(dirname "$out")"
  echo "[conv] $(basename "$src") -> $(basename "$out")"

  if need magick; then
    magick "$src" -auto-orient -strip -quality 82 -define webp:method=6 "$out"
    return 0
  fi

  if need ffmpeg; then
    # Use libwebp if present; most ffmpeg builds include it.
    ffmpeg -hide_banner -loglevel error -y -i "$src" -vf "scale='min(iw,2400)':-2" -q:v 60 "$out"
    return 0
  fi

  if need python3; then
    python3 - "$src" "$out" <<'PY'
import sys, os
src, out = sys.argv[1], sys.argv[2]
from PIL import Image, ImageOps
im = Image.open(src)
im = ImageOps.exif_transpose(im)
# Convert to RGB/RGBA as needed for webp
if im.mode not in ("RGB", "RGBA"):
  if "A" in im.getbands():
    im = im.convert("RGBA")
  else:
    im = im.convert("RGB")
os.makedirs(os.path.dirname(out), exist_ok=True)
im.save(out, "WEBP", quality=82, method=6)
PY
    return 0
  fi

  echo "[err] No converter found (magick/ffmpeg/python3+Pillow)."
  exit 1
}

# --- required outputs (exact snake_case names) ---
# Microscopy universe image (must exist; may already be present)
REQ_WEBP=(
  "asplenium_daucifolium_root_10x_upraveno.webp"
  "linum_stem_20x.webp"
  "sambucus_nigra_elderbery.webp"
  "toluidine_blue_cassava.webp"
  "pea_root_cap.webp"
  "micrasterias_cos_488_1_day_post_label.webp"
  "cover_art_pea_root_apex.webp"
  "arabidopsis_root_stained_with_pectin_probe.webp"
)

# --- locate sources with messy names ---
src_asplenium="$(find_src "*asplenium*root*10x*upraveno*.*")"
src_linum="$(find_src "*linum*stem*20x*.*")"
src_sambucus="$(find_src "*sambucus*nigra*elder*.*")"
src_toluidine="$(find_src "*toluidine*blue*cassava*.*")"
src_pea_cap="$(find_src "*pea*root*cap*.*")"
src_micrasterias="$(find_src "*micrasterias*cos*488*1*day*post*label*.*")"
src_cover_pea_apex="$(find_src "*cover*art*pea*root*apex*.*")"
src_arabidopsis="$(find_src "*arabidopsis*root*stained*pectin*probe*.*")"

# --- convert ---
convert_to_webp "$src_asplenium"    "$IMG_DIR/asplenium_daucifolium_root_10x_upraveno.webp"
convert_to_webp "$src_linum"        "$IMG_DIR/linum_stem_20x.webp"
convert_to_webp "$src_sambucus"     "$IMG_DIR/sambucus_nigra_elderbery.webp"
convert_to_webp "$src_toluidine"    "$IMG_DIR/toluidine_blue_cassava.webp"
convert_to_webp "$src_pea_cap"      "$IMG_DIR/pea_root_cap.webp"
convert_to_webp "$src_micrasterias" "$IMG_DIR/micrasterias_cos_488_1_day_post_label.webp"
convert_to_webp "$src_cover_pea_apex" "$IMG_DIR/cover_art_pea_root_apex.webp"
convert_to_webp "$src_arabidopsis"  "$IMG_DIR/arabidopsis_root_stained_with_pectin_probe.webp"

# --- rewrite content/settings.json (theme-aware), preserve other keys ---
if [[ ! -f "$SETTINGS" ]]; then
  echo "[err] $SETTINGS not found"
  exit 1
fi

if ! need python3; then
  echo "[err] python3 required to update settings.json"
  exit 1
fi

python3 - "$SETTINGS" <<'PY'
import json, sys, copy
path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
  data = json.load(f)

# Ensure backgrounds object exists and is theme-aware
bg = data.get("backgrounds")
if not isinstance(bg, dict):
  bg = {}

legacy_flat = None
if "dark" not in bg and "light" not in bg:
  # legacy flat map: keep it under _legacyFlat
  if isinstance(bg, dict) and bg:
    legacy_flat = copy.deepcopy(bg)
  bg = {}
else:
  # preserve existing _legacyFlat if present
  if isinstance(bg.get("_legacyFlat"), dict):
    legacy_flat = bg.get("_legacyFlat")

bg.setdefault("_comment", "Theme-aware background map. Keys are section IDs resolved via backgroundCanvas.sections and section data-bg fallback.")
bg.setdefault("dark", {})
bg.setdefault("light", {})
if legacy_flat is not None:
  bg["_legacyFlat"] = legacy_flat
else:
  bg.setdefault("_legacyFlat", {})

# Section ids to fill (contract)
sections = ["intro","about","working-groups","leadership","participating","grants","join"]

light_order = [
  "/images/linum_stem_20x.webp",
  "/images/sambucus_nigra_elderbery.webp",
  "/images/toluidine_blue_cassava.webp",
]
dark_order = [
  "/images/pea_root_cap.webp",
  "/images/micrasterias_cos_488_1_day_post_label.webp",
  "/images/cover_art_pea_root_apex.webp",
  "/images/arabidopsis_root_stained_with_pectin_probe.webp",
]

def assign_cycle(keys, order):
  out = {}
  for i,k in enumerate(keys):
    out[k] = order[i % len(order)]
  return out

# Overwrite only the section-id keys required; leave any extra legacy keys intact
dark_map = bg["dark"] if isinstance(bg["dark"], dict) else {}
light_map = bg["light"] if isinstance(bg["light"], dict) else {}

dark_map.update(assign_cycle(sections, dark_order))
light_map.update(assign_cycle(sections, light_order))

# keep a sensible default for "hero" if present elsewhere; set to first in cycle as fallback
dark_map.setdefault("hero", dark_order[0])
light_map.setdefault("hero", light_order[0])

bg["dark"] = dark_map
bg["light"] = light_map
data["backgrounds"] = bg

# Ensure backgroundCanvas.sections maps section IDs to keys (prefer identity)
bc = data.get("backgroundCanvas")
if not isinstance(bc, dict):
  bc = {}
bc.setdefault("_comment", "Maps section IDs to a background key from backgrounds.*. If missing, fallback is section[data-bg] then 'hero'. Prefer keys that match the section ID.")
secmap = bc.get("sections")
if not isinstance(secmap, dict):
  secmap = {}
for s in sections:
  secmap.setdefault(s, s)
bc["sections"] = secmap
data["backgroundCanvas"] = bc

with open(path, "w", encoding="utf-8") as f:
  json.dump(data, f, ensure_ascii=False, indent=2)
  f.write("\n")

print("[ok] updated content/settings.json")
PY

echo "[done] Milestone 4 conversions + settings.json update complete"

