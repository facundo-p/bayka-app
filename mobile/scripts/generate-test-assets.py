#!/usr/bin/env python3
"""Genera los assets de la variante TEST (#253) a partir de los de produccion.

Superpone una franja diagonal roja con la leyenda "TEST" sobre el icono,
el foreground del adaptive icon (respetando la safe zone circular de Android)
y el splash. Correr desde mobile/:  python3 scripts/generate-test-assets.py
Los PNG resultantes se versionan en mobile/assets/ y los referencia
app.config.js cuando APP_VARIANT=test.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

MOBILE = Path(__file__).resolve().parent.parent
ASSETS = MOBILE / 'assets'
POPPINS = MOBILE / 'node_modules/@expo-google-fonts/poppins/800ExtraBold/Poppins_800ExtraBold.ttf'

BAND_COLOR = (211, 47, 47, 255)  # rojo bien visible; no es color de marca a proposito
TEXT_COLOR = (255, 255, 255, 255)
ANGLE_DEG = -30  # franja diagonal ascendente


def band_overlay(size, band_h, font_px, shift=0):
    """Capa RGBA size x size con la franja diagonal y "TEST" centrado.

    shift > 0 baja la franja respecto del centro (para no tapar el logo).
    """
    # Se dibuja horizontal en un lienzo 2x y se rota, para que la franja
    # cruce el canvas completo sin recortes en las esquinas.
    big = size * 2
    layer = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    cy = big // 2 + shift
    draw.rectangle([0, cy - band_h // 2, big, cy + band_h // 2], fill=BAND_COLOR)
    font = ImageFont.truetype(str(POPPINS), font_px)
    draw.text((big // 2, cy), 'TEST', font=font, fill=TEXT_COLOR, anchor='mm')
    layer = layer.rotate(ANGLE_DEG, resample=Image.BICUBIC, center=(big // 2, big // 2))
    offset = (big - size) // 2
    return layer.crop((offset, offset, offset + size, offset + size))


def apply(src, dst, band_ratio, font_ratio, shift_ratio=0.0):
    img = Image.open(ASSETS / src).convert('RGBA')
    size = img.width
    overlay = band_overlay(size, int(size * band_ratio), int(size * font_ratio),
                           int(size * shift_ratio))
    Image.alpha_composite(img, overlay).save(ASSETS / dst)
    print(f'{dst}: {size}x{size} OK')


# Icono app (iOS / launchers legacy): franja corrida hacia abajo para que el
# logo siga reconocible.
apply('icon-bayka.png', 'icon-bayka-test.png', 0.22, 0.14, 0.18)

# Adaptive icon foreground: el launcher enmascara a un circulo central de
# 66/108 del canvas (safe zone ~62.6% => ~640px de 1024). Franja centrada y
# texto mas chico para que "TEST" entre completo dentro de la safe zone.
apply('android-foreground-bayka.png', 'android-foreground-bayka-test.png', 0.17, 0.105)

# Splash: se muestra completo (resizeMode contain) — misma franja que el icono.
apply('splash-bayka.png', 'splash-bayka-test.png', 0.22, 0.14, 0.18)
