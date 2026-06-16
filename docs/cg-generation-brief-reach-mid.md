# CG 생성 실행 브리프 — 중학 도달형(reach) 42컷

> GPT 이미지 생성 + 파일 저장 작업 지시서. 아래를 그대로 따르면 게임에 자동 연결된다.

## 0. 작업 위치 (중요)
- 코드·프롬프트가 있는 브랜치: **`feat/reach-mid-events`** (워크트리 **`/tmp/lt-qw`**).
- 이미지는 반드시 이 워크트리 안에 저장한다. (메인 체크아웃 `/Users/user/Projects/LIFE_TRACK`은 다른 브랜치라 거기 저장하면 안 됨.)
- 작업 루트: `/tmp/lt-qw/game`

## 1. 입력 문서 (읽을 것)
- 프롬프트(컷별): `docs/cg-prompts-reach-mid-Y2.md` (15컷) · `docs/cg-prompts-reach-mid-Y3.md` (15컷) · `docs/cg-prompts-reach-mid-Y4.md` (12컷)
- 공통 스타일·교복·Negative·파일명 규칙(정본): `docs/cg-prompts-middle-y2-y4.md`
- 캐릭터 외형 마커 SSOT: `docs/character-prompt-spec.md` (인라인 마커와 충돌 시 spec 우선)
- 캐릭터/배경 레퍼런스 시트 이미지를 프롬프트와 **함께** 입력해 일관성 유지(특히 단체씬 혼동 방지: jihun↔player_m, yuna↔subin, minjae↔haeun 안경).

## 2. 할 일
위 3개 문서의 **42개 컷 각각**에 대해, 해당 프롬프트 블록(`### {eventId} …`)대로 CG 1장을 생성한다.
- Art style / 시대 / 교복 / Negative prompt는 `cg-prompts-middle-y2-y4.md`의 「🎨 공통 스타일 가이드」를 모든 컷에 공통 적용.
- **해상도**: 각 컷 프롬프트 끝에 표기됨 — `16:9` → **1440x810**, `3:4 portrait` → **1080x1440**.

## 3. 저장 경로 / 파일명 (정확히)
- 디렉토리: `/tmp/lt-qw/game/public/images/events/middle/` (없으면 생성: `mkdir -p`)
- 파일명: **`{eventId}.png`** — 프롬프트 블록의 `파일: middle/{eventId}.png`와 정확히 일치(소문자 kebab, 오타 금지).
- 즉 최종 경로 예: `/tmp/lt-qw/game/public/images/events/middle/jihun-locker-code.png`
- 도달형은 전부 choice·gender 무관 **단일 컷**이라 접미사 없음(`_c0`/`_m` 등 붙이지 말 것).

## 4. 생성 후 처리 (반드시)
```
cd /tmp/lt-qw/game
node scripts/generate-cg-manifest.mjs   # public/images/events/ 스캔 → src/cg-manifest.generated.ts 갱신
npm run build                            # 빌드 통과 확인(prebuild가 매니페스트도 재생성)
```
- 매니페스트가 `middle/{eventId}.png` 키로 인덱싱하면 리졸버(`src/engine/eventCg.ts`)가 자동으로 결과화면·학년말 회고 썸네일에 연결한다. **코드 수정 불필요.**
- `node scripts/generate-cg-manifest.mjs` 실행 로그의 indexed 파일 수가 42(이상) 늘었는지 확인.

## 5. 완료 체크리스트 (42 파일명)
**Y2 (15):** jihun-locker-code · jihun-mirror-height · jihun-relay-baton · subin-cafeteria-line · subin-hundred-chats · subin-always-photographer · minjae-three-minute-math · minjae-locker-timetable · minjae-point-one · yuna-metronome · yuna-song-pick · yuna-light-booth · haeun-lost-and-found · haeun-handover-note · haeun-broadcast-mic

**Y3 (15):** jihun-half-gimbap · jihun-new-shoes · jihun-six-years-photos · subin-applause-stage · subin-name-or-school · subin-runs-without-me · minjae-dawn-on-hand · minjae-displayed-model · minjae-stolen-five-minutes · yuna-rank-board · yuna-teacher-comment · yuna-transfer-rumor · haeun-brothers-book · haeun-highlighter-overdraw · haeun-before-application

**Y4 (12):** jihun-ramen-bet · jihun-same-sunset · jihun-different-path · subin-cant-leave-chat · subin-mom-namecard · subin-two-of-us-home · minjae-red-pen · minjae-good-on-his-own · minjae-name-in-blank · yuna-wet-score · yuna-clearing-locker · yuna-last-recital

## 6. 주의
- eventId 철자 1글자라도 틀리면 매니페스트 키 불일치 → 게임에서 CG 안 뜸. 위 체크리스트와 대조.
- 교복은 **navy blazer + 흰 셔츠, 넥타이 없음**(중학 단계). 초등 사복·고등 넥타이 금지.
- 민감 소재(수빈 한부모/민재 부모압박/하은 오빠) 컷은 신파·과장 없이 절제된 한 컷으로(프롬프트의 Mood 준수).
