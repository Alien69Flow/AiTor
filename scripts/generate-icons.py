#!/usr/bin/env python3
"""Genera todos los iconos de Ai Tor desde public/favicon.svg.

Requiere: pip install cairosvg (usa librsvg del sistema) + Pillow.

Salidas:
  public/favicon.ico            (16/32/48/64/128/256)
  public/icon-256.png
  public/icon-192.png
  public/icon-512.png
  public/apple-touch-icon.png   (180)
  src/assets/aitor-icon.png     (512, uso en la interfaz)
"""
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "public" / "favicon.svg"
SOURCE = SVG.read_text(encoding="utf-8")


def render(size: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=SOURCE.encode("utf-8"), output_width=size, output_height=size)
    return Image.open(BytesIO(png)).convert("RGBA")


def save(path: Path, size: int) -> None:
    out = render(size)
    assert out.size == (size, size)
    out.save(ROOT / path, "PNG", optimize=True)
    print(f"  {path} {size}x{size}")


save(Path("public/icon-192.png"), 192)
save(Path("public/icon-512.png"), 512)
save(Path("public/icon-256.png"), 256)
save(Path("public/apple-touch-icon.png"), 180)
save(Path("src/assets/aitor-icon.png"), 512)

# favicon.ico multi-tamaño con entradas PNG (formato aceptado por todos los navegadores)
ico = render(256)
ico_sizes = [16, 32, 48, 64, 128, 256]
ico.save(ROOT / "public/favicon.ico", format="ICO", sizes=[(s, s) for s in ico_sizes])
print(f"  public/favicon.ico tamaños={ico_sizes}")

check = Image.open(ROOT / "public/favicon.ico")
print(f"verificado: {check.format} sizes={sorted(check.info.get('sizes', []))}")
