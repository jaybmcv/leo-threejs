# Builds the viewer's WOFF2 web fonts from the OFL sources in src/fonts-src (run once when a font changes):
#   pip install fonttools brotli && python scripts/build-fonts.py
# Keeps every weight (the wght axis) and pins Archivo's unused width axis at 100 %. Subsets to Latin, Greek,
# punctuation, arrows, maths and geometric shapes, a generous superset of the characters the viewer uses.
from io import BytesIO
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

UNICODES = ('U+0000-017F,U+0391-03C9,U+2000-206F,U+2070-209F,U+20AC,U+2100-214F,'
            'U+2190-21FF,U+2200-22FF,U+2300-23FF,U+25A0-25FF')
FONTS = {'archivo': {'wdth': 100}, 'jetbrains': {}, 'sora': {}}

for name, pinned in FONTS.items():
    font = TTFont(f'src/fonts-src/{name}.ttf', lazy=False)
    if pinned:
        # Round-trip the instanced font so the subsetter sees fully compiled tables.
        buffer = BytesIO()
        instancer.instantiateVariableFont(font, pinned).save(buffer)
        buffer.seek(0)
        font = TTFont(buffer, lazy=False)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=subset.parse_unicodes(UNICODES))
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(f'src/brand/{name}.woff2')
    print(name, 'written')
