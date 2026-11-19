# 꽃정원

광고·회원가입 없이 스마트폰에서 즐기는 꽃 퍼즐 PWA.
빈 자리를 눌러 꽃을 놓고, 같은 색 꽃 3송이 이상을 가로·세로로 이으면 커다란 꽃이 피며 사라집니다.
겹꽃은 바깥 꽃만 사라지고 안쪽 꽃이 남으며, 남은 꽃이 또 이어지면 연쇄로 피어납니다.

React + TypeScript + Vite, 백엔드 없음, 오프라인 동작(서비스워커).

## 바로 실행

```bash
npm install
npm run dev        # 개발 서버 → 출력된 주소(http://localhost:5173)를 엽니다. 같은 와이파이의 휴대폰은 Network 주소로
```

배포용 빌드와 미리보기:

```bash
npm run build      # dist/ 생성 (서비스워커·매니페스트 포함)
npm run preview    # http://localhost:4173
```

## 시험

```bash
npm test                         # 엔진·저장 단위 시험 (vitest, 27개)
npm run build && npm run preview # (다른 창에서 띄워 둔 채로)
npm run e2e                      # 휴대폰 화면 시험 (Playwright Chromium, 61개 항목)
node tests/e2e/shot.mjs          # 팝 장면 스크린샷 → tests/e2e/shots/
npx vite-node tools/balance-sim.ts  # 난이도 점검(자동 플레이 600판)
```

E2E 는 `require('playwright')` 로 이미 설치된 Playwright 를 씁니다. 없다면 `npm i -D playwright && npx playwright install chromium`.

## 폴더

```text
src/game/   순수 규칙 (화면과 무관)
  types.ts    상태 타입 — layers 는 0~2 (3겹 금지)
  levels.ts   13칸·21칸 마스크, 단계별 색·2겹 확률·목표
  config.ts   조정 가능한 규칙과 연출 타이밍 (TUNING.md)
  rng.ts      시드 RNG (상태 저장)
  engine.ts   배치 → 판정 → 표면만 제거 → 연쇄 → 점수 → 단계
  save.ts     자동 저장·백업·엄격한 복원 검사
src/fx/     팝 연출 캔버스, 그림 불러오기·팝 이미지 색 바꾸기
src/audio/  효과음 재생 (CC0 음원 14개, 실패 시 합성음) — SOUNDS.md
src/ui/     보드·꽃(2겹 표시)·대기열·대화상자
public/assets/  받은 그림 10장(그대로) + 겹꽃용 앞 꽃잎 6장(front/) + 효과음(sfx/)
tools/      make-nested.py(겹꽃 그림 만들기), balance-sim.ts(난이도 점검)
tests/unit/ tests/e2e/
```

## 설계 핵심: 판정과 연출 분리

꽃을 놓는 순간 엔진이 턴 전체(소거·연쇄·점수·단계)를 끝까지 계산하고 **그 결과를 바로 저장**합니다.
화면은 계산된 단계(steps)를 차례로 재생만 합니다. 그래서
- 연출과 점수가 어긋나지 않고,
- 팝 도중 새로고침·앱 종료·전화가 와도 계산이 끝난 상태로 이어지며,
- 화면을 떠나면 남은 연출은 건너뜁니다.

재생 중에는 입력이 잠깁니다(같은 순간 여러 번 눌러도 한 송이만).

## 휴대폰 확인 절차 (아직 실제 기기로는 안 해 봄)

1. `npm run build` 후 HTTPS 주소에 올리기 (서비스워커는 HTTPS 또는 localhost 에서만 동작).
2. 삼성 휴대폰 Chrome 과 Samsung Internet 에서 각각 열기.
3. 확인: 13칸만 눌리는지 / 겹꽃의 안쪽 꽃이 잘 보이는지 / 빨강은 빨강, 노랑은 노랑으로 터지는지 / 소리 켜고 끄기 / 효과 줄이기.
4. 메뉴 → 「홈 화면에 추가」 → 아이콘으로 열면 주소창 없이 열리는지.
5. 몇 수 둔 뒤 앱을 완전히 닫았다가 다시 열기 → 그대로 이어지는지.
6. 비행기 모드 켜고 홈 화면 아이콘으로 열기 → 열리고 기록이 이어지는지.
7. 팝 도중 화면 끄기·전화 받기 → 돌아왔을 때 판이 깨지지 않는지.

## 배포

**주소: https://jongku93.github.io/flower/** (GitHub Pages)

`main` 에 올리면 `.github/workflows/pages.yml` 이 단위 시험 → 빌드 → `gh-pages` 가지에 올립니다(1~2분 뒤 반영).
저장소 Settings → Pages 의 Source 가 `Deploy from a branch` / `gh-pages` / `/(root)` 이어야 합니다.

다른 곳에 올리려면:

`dist/` 는 어떤 정적 호스팅에도 올릴 수 있습니다(`base: './'` 라 하위 경로도 됨).
Firebase Hosting 등을 쓴다면 이 게임 전용 새 프로젝트를 만드세요.

## 쓰지 않은 것

광고·추적·통계 SDK·로그인·결제 없음. 외부 서버로 나가는 요청 없음(E2E 로 확인).
그림은 이 프로젝트용으로 직접 만든 것이고, 효과음은 CC0(퍼블릭 도메인) 음원입니다(`ASSETS.md`, `SOUNDS.md`).
