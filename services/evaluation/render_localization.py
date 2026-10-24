"""Render local source-reference/prediction overlays into private storage only."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--predictions', type=Path, required=True)
    parser.add_argument('--private-dir', type=Path, required=True)
    args = parser.parse_args()
    target = args.private_dir.resolve()
    if target.is_relative_to(Path(__file__).resolve().parents[2]):
        raise ValueError('PATIENT_IMAGES_MUST_REMAIN_OUTSIDE_REPOSITORY')
    target.mkdir(parents=True, exist_ok=True, mode=0o700)
    manifest = json.loads(args.manifest.read_text())
    predictions = json.loads(args.predictions.read_text())
    for item in manifest['images']:
        path = Path(item['path'])
        if hashlib.file_digest(path.open('rb'), 'sha256').hexdigest() != item['sha256']:
            raise ValueError('FROZEN_IMAGE_HASH_MISMATCH')
        with Image.open(path) as original:
            original = original.convert('RGB')
            original.thumbnail((1000, 750))
            width, height = original.size
            board = Image.new('RGB', (width * 2, height + 70), 'white')
            board.paste(original, (0, 70)); board.paste(original, (width, 70))
        draw = ImageDraw.Draw(board)
        draw.text((8, 8), 'REFERENCE LABELS (LEFT) | RAW MODEL LABELS (RIGHT)', fill='black')
        draw.text((8, 28), 'RESEARCH ONLY: class-order contradiction unresolved; source patient independence unverified.', fill='black')
        draw.text((8, 48), 'Image SHA256 ' + item['sha256'], fill='black')
        for rows, offset, color, prediction in [(item['annotations'], 0, 'lime', False), (predictions[item['sha256']], width, 'red', True)]:
            for row in rows:
                if prediction and row['score'] < .25:
                    continue
                x1,y1,x2,y2=row['box']; box=[offset+x1*width,70+y1*height,offset+x2*width,70+y2*height]
                draw.rectangle(box, outline=color, width=3)
                label = manifest['class_names'][str(row['class_id'])]
                if prediction: label += f' {row["score"]:.3f}'
                draw.text((box[0]+3,box[1]+3),label,fill=color,stroke_fill='black',stroke_width=1)
        board.save(target / (item['sha256'] + '.png'))


if __name__ == '__main__':
    main()
