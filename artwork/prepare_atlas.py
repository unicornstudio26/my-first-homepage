from pathlib import Path
from PIL import Image
import json

root = Path(__file__).resolve().parents[1]
source = Image.open(root / 'assets/source/breakout-atlas.png').convert('RGBA')
w, h = source.size
sheet = Image.new('RGBA', (1536, 1536))
names = ['brick-pink', 'brick-orange', 'brick-yellow', 'brick-cyan', 'brick-blue', 'brick-purple', 'paddle', 'ball', 'spark']
records = []
for i, name in enumerate(names):
    row, col = divmod(i, 3)
    # The generated paddle crosses a regular cell boundary. Slice by ownership
    # before repacking so its metal end cap is preserved in full.
    edges = [0, .37, 2 / 3, 1] if row == 2 else [0, 1 / 3, 2 / 3, 1]
    box = (round(w * edges[col]), round(h * row / 3), round(w * edges[col + 1]), round(h * (row + 1) / 3))
    cell = source.crop(box)
    bbox = cell.getchannel('A').getbbox()
    if not bbox:
        raise ValueError(f'Empty sprite: {name}')
    sprite = cell.crop(bbox)
    assert sprite.width < 500 and sprite.height < 500, name
    sheet.paste(sprite, (col * 512 + (512 - sprite.width) // 2, row * 512 + (512 - sprite.height) // 2))
    records.append({'name': name, 'ownership_box': box, 'alpha_bbox': bbox})
sheet.save(root / 'artwork/registered-atlas.png')
(root / 'artwork/ownership.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
print('Repacked nine complete sprites with safe margins.')
