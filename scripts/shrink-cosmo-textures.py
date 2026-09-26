# Re-encodes Cosmo's embedded textures in src/vendor/cosmo/DLCat.js and shortens its geometry numbers (run once;
# safe to re-run):  pip install pillow numpy && python scripts/shrink-cosmo-textures.py
# The supplied rig embeds nine 2048² PNGs (~2.8 MB, ~200 MB of GPU memory with mipmaps). Cosmo never covers more than a
# few hundred pixels, so 1024² keeps the on-screen detail. Normal and metal/roughness maps stay lossless (lossy WebP
# subsamples colour, which would blur their independent channels); colour and roughness maps take whichever of lossless
# or quality-90 WebP is smaller.
import base64
import io
import re
import numpy as np
from PIL import Image

PATH = 'src/vendor/cosmo/DLCat.js'
SIZE = 1024
IMAGE = re.compile(r'"name": "([^"]+)", "dataUri": "data:image/(\w+);base64,([^"]+)"')


def encode(image, lossless, quality=90):
    buffer = io.BytesIO()
    image.save(buffer, 'WEBP', lossless=lossless, quality=100 if lossless else quality, method=6)
    return buffer.getvalue()


def shrink(match):
    name, kind, data = match.groups()
    image = Image.open(io.BytesIO(base64.b64decode(data)))
    if kind == 'webp' and image.size == (SIZE, SIZE):
        return match.group(0)
    small = image.resize((SIZE, SIZE), Image.LANCZOS)
    candidates = [encode(small, True)]
    if 'Normal' not in name and 'Metallic' not in name:
        candidates.append(encode(small, False))
    best = min(candidates, key=len)
    print(f'{name}: {len(data) * 3 // 4 // 1024} KB png -> {len(best) // 1024} KB webp')
    return f'"name": "{name}", "dataUri": "data:image/webp;base64,{base64.b64encode(best).decode()}"'


# The rig's Float32Array literals print each float32 value with float64 digits (17 of them). The shortest string that
# parses back to the same float32 is about half as long and loads bit-identical geometry.
FLOATS = re.compile(r'new Float32Array\(\[([^\]]*)\]\)')


def shortest(text):
    value = np.float32(float(text))
    options = [np.format_float_positional(value, unique=True, trim='-'), np.format_float_scientific(value, unique=True, trim='-')]
    best = min((o.replace('e+', 'e') for o in options), key=len)
    best = best.replace('-0.', '-.') if best.startswith('-0.') else best[1:] if best.startswith('0.') else best
    assert np.float32(float(best)) == value, (text, best)
    return best


def shorten(match):
    return 'new Float32Array([' + ','.join(shortest(t) for t in match.group(1).split(',')) + '])'


source = open(PATH, encoding='utf-8').read()
open(PATH, 'w', encoding='utf-8', newline='').write(FLOATS.sub(shorten, IMAGE.sub(shrink, source)))
