# PR #269 리뷰 요청 — 리팩토링/버그수정 검증

브랜치 `refactor/review-cleanup-2026-06-23`의 변경(`git diff main..refactor/review-cleanup-2026-06-23`)을 **회귀/정합성 위주로** 검토해 주세요.
diff는 `/private/tmp/claude-501/-Users-user-Projects-LIFE-TRACK/97c7c85e-d36e-4f7e-a707-200c9c628d69/scratchpad/pr269.diff` 에 있고, 변경 파일은 아래 5개 영역입니다. 수정은 하지 말고 결과만 한국어로, 항목별 **(문제없음 / 문제있음 + 근거 파일:라인)** 형식으로.

## 변경 내용과 검증 포인트

1. **`game/src/components/GameScreen.tsx`** — 이벤트 onChoice에 `if (!choice)` 가드 추가. 모든 선택지가 비용부족으로 잠겨 `EventScene`이 `-1`을 보낼 때 `choices[-1]=undefined` 크래시를 막고 `store.resolveEvent(-1)`에 위임.
   - 검증: 이 가드가 **정상 선택(index≥0)** 흐름을 바꾸지 않는가? `-1`일 때 `setEventResultData(message:'잠시 머뭇거리다…', effects:[], choiceIndex:-1)` 후 `resolveEvent(-1)` 위임이 soft-lock 없이 다음 주로 진행되는가? `choiceIndex:-1`이 EventResultScreen의 CG 조회(`?? 0`)에서 문제를 일으키지 않는가?

2. **`game/src/engine/store.ts`** — `talkToNpc`의 인라인 효과적용(stats/fatigue/money 클램핑)을 `applyVisibleTalkEffects(newState, ev.effects)` 호출로 치환. intimacy 블록은 남김.
   - 검증: 치환 전 인라인 코드와 `applyVisibleTalkEffects`가 **완전히 동일 동작**인가(클램프 범위·money 반올림·0 하한)? intimacy 처리 누락 없는가? `talkToHome`의 기존 사용과 일관적인가?

3. **`game/src/components/screens/WeeklyResultScreen.tsx` + `game/src/engine/dialogues.ts`** — 주간 결산 피로 라벨을 `getFatigueLabel`(삭제) → `getFatigueDisplay().label`로 교체. import 정리.
   - 검증: `getFatigueLabel` 잔존 호출처 없는가? label만 바뀌고 color(prop 주입)는 영향 없는가?

4. **`game/src/engine/talkSystem.ts` + `game/src/engine/talkData.ts`** — `getParentStaticDialogue`/`PARENT_STATIC_DIALOGUES` 및 미사용 import(`ParentStrength`) 삭제.
   - 검증: 삭제된 심볼의 잔존 참조 없는가? `ParentStrength`가 talkSystem 다른 곳/talkData에서 여전히 필요한데 잘못 지우진 않았는가?

5. **`game/src/engine/types.ts` + `game/src/engine/gameEngine.ts`** — `WeekLog.milestone`(deprecated) 필드 및 그 쓰기/초기화 2곳 삭제.
   - 검증: `WeekLog`를 객체 리터럴로 만드는 다른 곳에서 `milestone` 누락으로 타입 에러 안 나는가? `.milestone`(단수) 읽기 잔존 없는가? 구세이브 로드 시 문제 없는가?

6. **놓친 회귀** — 위 외에 이 diff가 유발할 수 있는 correctness 회귀가 있으면 지적.
