from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parents[1]
assets = root / 'assets'
names = ['brick-pink', 'brick-orange', 'brick-yellow', 'brick-cyan', 'brick-blue', 'brick-purple', 'paddle', 'ball', 'spark']
sizes = [(132, 40)] * 6 + [(240, 24), (32, 32), (24, 24)]
qa = []
for i, (name, size) in enumerate(zip(names, sizes), 1):
    sprite = Image.open(root / f'artwork/processed/sheet-{i}.png').convert('RGBA')
    sprite = sprite.crop(sprite.getchannel('A').getbbox())
    sprite = sprite.convert('RGBa').resize(size, Image.Resampling.LANCZOS).convert('RGBA')
    path = assets / f'{name}.png'
    sprite.save(path, optimize=True)
    alpha = sprite.getchannel('A')
    assert alpha.getextrema()[0] == 0 and alpha.getextrema()[1] == 255, name
    qa.append({'file': str(path.relative_to(root)), 'size': size, 'alpha_range': alpha.getextrema(), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
background = Image.open(assets / 'source/arena.png').convert('RGB').resize((800, 560), Image.Resampling.LANCZOS)
background.save(assets / 'arena.webp', quality=90, method=6)
preview = background.convert('RGBA')
for row in range(6):
    brick = Image.open(assets / f'{names[row]}.png').resize((66, 20), Image.Resampling.LANCZOS)
    for col in range(10):
        preview.alpha_composite(brick, (31 + col * 75, 62 + row * 30))
preview.alpha_composite(Image.open(assets / 'paddle.png').resize((120, 12), Image.Resampling.LANCZOS), (340, 520))
preview.alpha_composite(Image.open(assets / 'ball.png').resize((16, 16), Image.Resampling.LANCZOS), (392, 490))
preview.save(root / 'artwork/preview.png')
meta = json.loads((root / 'artwork/processed/pipeline-meta.json').read_text(encoding='utf-8'))
(root / 'artwork/sprite-processing.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
(assets / 'manifest.json').write_text(json.dumps({'art_source': 'host_image', 'route': 'Codex native image_gen', 'model': 'not exposed by tool', 'estimateUsd': None, 'finish': 'hd', 'runtime_assets': qa, 'background': 'assets/arena.webp', 'source_layout_fix': 'Repacked paddle ownership before slicing to preserve the full end cap.', 'qa': {'status': 'pass', 'sprite_count': 9, 'transparency_verified': True}}, indent=2), encoding='utf-8')
print('Exported nine transparent PNG sprites and 800x560 WebP arena; alpha and dimensions checked.')
