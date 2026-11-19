"""
겹꽃(2겹) 그림 준비: 바깥 꽃 그림에서 '앞 꽃잎'만 따로 떼어 낸다.

화면에서는  [바깥 꽃 전체] → [안쪽 꽃(작게, 수술 자리에)] → [바깥 꽃의 앞 꽃잎]  순으로 겹쳐 그려
안쪽 꽃이 바깥 꽃의 컵 안에 실제로 들어앉은 것처럼 보이게 한다(동그란 테두리 없이).

방법
 1. 가운데(수술)에서 시작해 노란 수술 색인 픽셀을 채워 나간다(꽃잎 테두리선에서 멈춤) → 수술 영역
 2. 열마다 수술의 가장 아래 y 를 구해 부드럽게 다듬는다 → '컵 입구' 경계선
 3. 경계선 위쪽(수술 + 그 뒤의 꽃잎)은 안쪽 꽃이 보이는 창, 아래쪽은 앞 꽃잎
 4. 앞 꽃잎 = 원본 × (1 − 창), 가장자리는 살짝 흐리게
 5. 수술 중심·크기를 src/fx/nest.json 에 기록(안쪽 꽃 위치)

실행: python3 tools/make-nested.py   (Pillow 필요)  → 미리보기 tools/nested-preview.png
"""
import colorsys
import json
import os
from collections import deque

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FL = os.path.join(ROOT, 'public/assets/flowers')
OUT = os.path.join(FL, 'front')
COLORS = ['red', 'yellow', 'pink', 'orange', 'purple', 'blue']
S = 512


def hsv(p):
    r, g, b, a = p
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return h * 360, s, v, a


def is_stamen(p, color):
    h, s, v, a = hsv(p)
    if a < 200 or v < 0.8:
        return False
    if color == 'yellow':
        # 노랑 꽃: 꽃잎(44~50°, 채도 ~1)과 구별 — 수술은 더 밝고 연함(채도 낮음) 또는 테두리 안쪽
        return 48 <= h <= 62 and s < 0.9
    return 38 <= h <= 64 and s > 0.25


def stamen_mask(im, color):
    px = im.load()
    seen = [[False] * S for _ in range(S)]
    m = Image.new('L', (S, S), 0)
    mp = m.load()
    # 씨앗: 가운데 근처에서 수술 색인 점들
    q = deque()
    for y in range(205, 265, 4):
        for x in range(230, 284, 4):
            if is_stamen(px[x, y], color):
                q.append((x, y))
                seen[y][x] = True
    while q:
        x, y = q.popleft()
        mp[x, y] = 255
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 140 <= nx < 372 and 135 <= ny < 300 and not seen[ny][nx]:
                seen[ny][nx] = True
                if is_stamen(px[nx, ny], color):
                    q.append((nx, ny))
    # 수술 점·꽃술 사이 작은 구멍 메우기
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(7))
    return m


def window_from(stamen):
    """안쪽 꽃이 보이는 창.
    - 수술 열들: 수술 아래 테두리(= 앞 꽃잎의 실제 윗선) 위쪽 전부
    - 수술 윗부분부터는 위로 갈수록 넓게 열림(뒤쪽 꽃잎 앞으로 안쪽 꽃이 나옴)
    - 그 사이 양옆은 수술 옆 테두리(= 옆 꽃잎의 실제 선)에서 잘림"""
    sp = stamen.load()
    cols = {}
    for x in range(S):
        ys = [y for y in range(S) if sp[x, y] > 128]
        if len(ys) >= 6:
            cols[x] = (min(ys), max(ys))
    xs = sorted(cols)
    x0, x1 = xs[0], xs[-1]
    bottom = {}
    for x in range(x0, x1 + 1):
        win = [cols[k][1] for k in range(x - 5, x + 6) if k in cols]
        bottom[x] = sorted(win)[len(win) // 2] if win else None
    top = min(v[0] for v in cols.values())
    bots = [b for b in bottom.values() if b]
    h = sum(bots) / len(bots) - top
    w = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(w)
    for x in range(x0, x1 + 1):
        if bottom[x]:
            d.line([(x, 0), (x, bottom[x] - 2)], fill=255)
    # 위로 넓어지는 입구: 기준선(수술 위쪽 40%)에서의 수술 좌우 끝
    yref = int(top + h * FLARE_AT)
    row = [x for x in range(S) if sp[x, yref] > 128]
    L0, R0 = (min(row), max(row)) if row else (x0, x1)
    d.polygon([(L0 - FLARE * yref, 0), (L0, yref), (R0, yref), (R0 + FLARE * yref, 0)], fill=255)
    w = w.filter(ImageFilter.GaussianBlur(1.3))
    cx = (x0 + x1) / 2
    cy = (top + sum(bots) / len(bots)) / 2
    B = {x: bottom[x] for x in bottom if bottom[x]}
    return w, B, dict(x0=x0, x1=x1, top=top, cx=cx, cy=cy, width=x1 - x0)


def rim_shadow(B, info, col, alpha):
    """앞 꽃잎이 안쪽 꽃 위에 드리우는 옅은 그림자 — 수술 폭 안, 꽃 그림 위에서만"""
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    for x, y in B.items():
        if info['x0'] + 8 <= x <= info['x1'] - 8:
            d.line([(x, y - 12), (x, y + 1)], fill=140)
    m = m.filter(ImageFilter.GaussianBlur(4))
    m = Image.composite(m, Image.new('L', (S, S), 0), alpha.point(lambda v: 255 if v > 200 else 0))
    sh = Image.new('RGBA', (S, S), col + (0,))
    sh.putalpha(m)
    return sh


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    imgs = {}
    for c in COLORS:
        im = Image.open(os.path.join(FL, f'flower_{c}.png')).convert('RGBA')
        imgs[c] = im
        st = stamen_mask(im, c)
        win, B, info = window_from(st)
        r, g, b, a = im.split()
        inv = Image.eval(win, lambda v: 255 - v)
        a2 = Image.composite(a, Image.new('L', (S, S), 0), inv)
        petals = Image.merge('RGBA', (r, g, b, a2))
        # 그림자(아래) + 앞 꽃잎(위)
        front = rim_shadow(B, info, SHADOW[c], a)
        front.alpha_composite(petals)
        front.save(os.path.join(OUT, f'flower_{c}_front.png'), optimize=True)
        meta[c] = {k: round(v, 1) for k, v in info.items()}
        meta[c]['innerScale'] = INNER_SCALE
        meta[c]['innerLift'] = INNER_LIFT
    with open(os.path.join(ROOT, 'src/fx/nest.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print(json.dumps(meta, indent=1))

    # 미리보기: 행 = 바깥 꽃, 열 = 안쪽 꽃
    cell = 160
    prev = Image.new('RGBA', (cell * 6, cell * 6), (190, 236, 222, 255))
    for i, o in enumerate(COLORS):
        for j, n in enumerate(COLORS):
            base = Image.new('RGBA', (S, S), (0, 0, 0, 0))
            base.alpha_composite(imgs[o])
            if o != n:
                info = meta[o]
                scale = INNER_SCALE
                sz = int(S * scale)
                inner = imgs[n].resize((sz, sz), Image.LANCZOS)
                # 안쪽 꽃의 시각 중심(그림의 수술 중심 ≈ (256, 236))을 바깥 수술 중심보다 조금 위에
                ox = int(info['cx'] - 256 * scale)
                oy = int(info['cy'] - INNER_LIFT * S - 236 * scale)
                sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
                shadow = Image.new('RGBA', (sz, sz), (60, 30, 10, 70))
                sh.paste(shadow, (ox, oy + 6), inner.split()[3])
                base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))
                base.alpha_composite(inner, (ox, oy))
                base.alpha_composite(Image.open(os.path.join(OUT, f'flower_{o}_front.png')))
            prev.alpha_composite(base.resize((cell, cell), Image.LANCZOS), (j * cell, i * cell))
    prev.save(os.path.join(ROOT, 'tools/nested-preview.png'))


INNER_SCALE = 0.64
INNER_LIFT = 0.09
FLARE = 1.1
FLARE_AT = 0.4
SHADOW = {'red': (90, 0, 0), 'yellow': (150, 80, 0), 'pink': (150, 40, 80), 'orange': (140, 50, 0), 'purple': (70, 20, 110), 'blue': (10, 50, 120)}

if __name__ == '__main__':
    main()
