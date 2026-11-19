# 그림 소스 검사 기록

게임 그림 PNG 를 직접 열어 검사한 기록입니다(Pillow + 브라우저 E2E).

| 파일 | 크기 | 모드 | 모서리 알파 | 비고 |
|---|---|---|---|---|
| `public/assets/flowers/flower_red.png` | 512×512 | RGBA | 0 | 몸통 알파 253~255 (94%) |
| `public/assets/flowers/flower_yellow.png` | 512×512 | RGBA | 0 | 금빛 — 작게 보면 주황과 비슷 |
| `public/assets/flowers/flower_pink.png` | 512×512 | RGBA | 0 | |
| `public/assets/flowers/flower_orange.png` | 512×512 | RGBA | 0 | |
| `public/assets/flowers/flower_purple.png` | 512×512 | RGBA | 0 | |
| `public/assets/flowers/flower_blue.png` | 512×512 | RGBA | 0 | |
| `public/assets/effects/pop_01_bloom.png` | 512×512 | RGBA | 0 | 빛번짐이라 반투명 많음(정상). 가운데 분홍 꽃 그림 포함 |
| `public/assets/effects/pop_02_burst.png` | 512×512 | RGBA | 0 | 분홍 꽃잎 + 황금빛 |
| `public/assets/effects/pop_03_scatter.png` | 512×512 | RGBA | 0 | 분홍 꽃잎 + 초록 잎 |
| `public/assets/effects/pop_04_fade.png` | 512×512 | RGBA | 0 | 반짝임 위주 |

## 겹꽃(2겹) 그림 — `public/assets/flowers/front/flower_<색>_front.png`

새 그림을 생성하지 않고, 꽃 그림에서 **바깥 꽃의 앞 꽃잎**만 떼어 낸 6장입니다(`tools/make-nested.py`).

1. 가운데에서 노란 수술 색 픽셀을 채워 나가 수술 영역을 찾음(꽃잎 테두리선에서 멈춤, 노랑 꽃은 더 밝고 연한 픽셀로 구분)
2. 수술 아래 테두리 = 앞 꽃잎의 실제 윗선, 수술 옆 테두리 = 옆 꽃잎의 실제 선 → 그 안쪽을 '창'으로
3. 수술 윗부분부터는 창을 위로 넓게 열어 안쪽 꽃이 뒤쪽 꽃잎 앞으로 나오게
4. 앞 꽃잎 = 원본 − 창, 경계선 바로 위에 옅은 그림자(앞 꽃잎이 안쪽 꽃에 드리움)
5. 수술 중심과 안쪽 꽃 크기(0.64배)·높이(위로 9%)를 `src/fx/nest.json` 에 기록

화면에서는 [바깥 꽃] → [안쪽 꽃] → [앞 꽃잎] 순서로 겹쳐 그려, 안쪽 꽃이 바깥 꽃 컵 안에 앉은 것처럼 보입니다.
`tools/nested-preview.png` 에 6×6 조합 미리보기가 있습니다. 그림을 바꾸면 스크립트를 다시 돌리면 됩니다.

## 쓰는 방법

- 꽃 6장: 보드 칸·대기열·도움말·배경 장식·**팝 때 가운데 큰 꽃**·유령 꽃(모여드는 꽃)에 그대로 사용.
- 팝 4장: 분홍 계열 픽셀(색상 300~360°·0~22°, 채도 > 0.28)만 터진 꽃 색으로 바꿔 사용(`src/fx/assets.ts`).
  노란 빛·흰 반짝임·초록 잎은 그대로. 분홍 꽃이 터질 때만 원본 그대로.
- 꽃잎 파티클은 각 색의 밝은/기본/진한 3색으로 캔버스에서 직접 그림.
- 홈 화면 아이콘(`public/icons/*`)은 분홍 꽃 그림으로 만든 것.
