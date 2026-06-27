# 리팩토링/버그 리뷰 검증 요청 (2026-06-22)

게임 코드(`game/src`)에 대한 제3자 리뷰가 들어왔는데, 일부가 stale/과장일 수 있어 **현행 코드 기준 재검증**을 요청합니다.
아래 각 주장을 실제 코드로 직접 확인하고 **(맞음 / 틀림 / 부분적)** + 한 줄 근거(파일:라인)로만 답해 주세요. 수정은 하지 말고 결과만 한국어로.

## 검증 대상 주장

1. **NPC 대사 결정론 불일치** — `game/src/engine/dialogues.ts`의 `getNpcDialogue`/`getCharacterDialogue`/`getActivityReaction`이 `Math.random()`을 쓰고, `game/src/engine/talkSystem.ts`의 smalltalk는 `seededRandom`을 쓴다. 이게 실제 버그(리플레이 비결정성)인가, 아니면 영향 없는 cosmetic인가? 게임 진행(이벤트 선택/스탯/엔딩) 결정론에는 영향이 있나?

2. **죽은 코드** — 아래가 정말 어디서도 read/호출되지 않는가?
   - `WeekLog.milestone` 필드 (`game/src/engine/types.ts`, `gameEngine.ts`)
   - `getParentStaticDialogue()` + `PARENT_STATIC_DIALOGUES` (`talkSystem.ts`, `talkData.ts`)
   반대로 `state.milestones[]` 배열은 dedup guard로 **아직 필요한가**?

3. **피로 라벨 이중 SSOT** — `getFatigueDisplay()`(`game/src/components/screens/shared.ts`, 임계 20/35/50/70)와 `getFatigueLabel()`(`game/src/engine/dialogues.ts`, 임계 30/50/70)이 임계값·문구가 다르다. `getFatigueDisplay` 주석은 "HUD와 주간결산이 동일 SSOT를 쓴다"고 하는데, 실제 `WeeklyResultScreen.tsx`는 `getFatigueLabel`을 쓴다 — 주석-코드 불일치 + UX 라벨 불일치 맞나?

4. **store.ts 효과 적용 중복** — `game/src/engine/store.ts`에 `applyChoiceOutcome`/`applyVisibleTalkEffects` 외에 `talkToNpc`라는 **별도의 거의 동일한 inline 효과 적용 코드가 또 한 벌** 있는가? (원 리뷰 주장) 아니면 `applyVisibleTalkEffects`를 3곳에서 호출하는 것뿐인가?

5. **god file 분할 타당성** — `gameEngine.ts`(~997줄, `processWeek`)와 `store.ts`(~550줄)를 분할할 때 **회귀 위험 없이** 떼어낼 수 있는 안전한 경계는 어디인가? (mental/milestone/exam/event scaling 등)

6. **놓친 버그** — 위 목록 외에, 현행 `game/src/engine` 및 `game/src/store(=engine/store.ts)`에서 **correctness 회귀 위험**이 있는 부분이 있으면 지적.

## 참고 (내가 이미 확인한 것 — 재확인 불필요)
- `game/scripts/lib/y1-sim-resolve.ts`는 이미 존재하고 6개 sim 스크립트가 사용 중 (원 리뷰의 "깨진 import"는 stale, 무시).
- verify-patch-batch4.ts의 `gene` 사용은 마이그레이션 테스트용으로 의도된 것 (stale 아님).
