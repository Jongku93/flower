# 효과음 출처와 쓰임

모든 소리 파일은 npm 패키지 **uisfx 0.4.0** (https://github.com/romainsimon/uisfx) 의 음원입니다.
음원 라이선스: **CC0 1.0 (퍼블릭 도메인)** — 상업적 이용·수정·배포 자유, 출처 표기 의무 없음.
(`public/assets/sfx/LICENSE-AUDIO.txt` 에 원문 보관. 패키지 코드는 MIT 지만 게임에는 소리 파일만 복사해 씀.)

| 파일 (`public/assets/sfx/`) | 원본 (묶음/소리) | 쓰는 때 |
|---|---|---|
| place.mp3 | soft/drop | 꽃 놓기 |
| bloom.mp3 | dreamy/success | 3송이 개화 |
| bloom-big.mp3 | dreamy/bonus | 4송이 이상 개화 |
| chain.mp3 | dreamy/streak | 2연쇄부터 (연쇄마다 2반음씩 높여 재생, 최대 +12) |
| sparkle.mp3 | glass/reaction | 꽃잎 흩날림 반짝 (작게) |
| levelup.mp3 | dreamy/level-up | 단계 올라감 |
| gameover.mp3 | dreamy/sleep | 정원이 가득 참 |
| undo.mp3 | soft/undo | 한 수 되돌리기 |
| blocked.mp3 | soft/blocked | 이미 꽃이 있는 칸을 누름 |
| open.mp3 / close.mp3 | soft/open, soft/close | 도움말·설정 창 |
| toggle-on.mp3 / toggle-off.mp3 | soft/toggle-on, soft/toggle-off | 설정 켜고 끄기 |
| start.mp3 | dreamy/start | 새 게임 |

- 고른 기준: 'dreamy'(꽃이 피는 부드러운 반짝임), 'soft'(펠트처럼 둥근 소리), 'glass'(반짝임) 묶음. 스펙트로그램으로 거친 잡음·날카로운 고음이 없는지 확인.
- 14개 합계 약 124KB, 서비스워커가 오프라인용으로 함께 저장.
- 파일을 못 불러오면 WebAudio 합성음으로 대신(`src/audio/sfx.ts`).
- **사람 귀로 들어 보지는 못했습니다.** 음량(`SOUND_FILES` 값)은 패키지 권장 음량을 바탕으로 정한 것이라 실제로 듣고 조정이 필요할 수 있습니다.
