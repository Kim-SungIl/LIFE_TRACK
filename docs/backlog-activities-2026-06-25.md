# 백로그 — 활동 정의 정합성 (2026-06-25)

> 출처: #278 코드리뷰 중 cursor가 부수적으로 지적한 **기존 코드** 이슈(전략 태그 #5/#278과 무관).
> 직접 확인해 #278 범위 밖으로 분리한 항목. 전부 LOW, 게임 파괴 없음. 우선순위 낮음.

## 1. 일부 유료 활동에 `requires` 잔액 가드 누락
- `hang-out`(cost 1), `family-trip`(cost 8), `intensive-academy`(cost 5), `sports-camp`(cost 5)에 `requires: (s) => s.money >= cost` 없음.
- 엔진이 `state.money < 0`을 0으로 클램프(`gameEngine.ts:309`)해 파괴는 없으나, 잔액 없이 선택 가능 → UI 표시 대비 실제 소비 불일치. `academy`·`gym` 등 다른 유료 활동과 일관성 어긋남.
- 조치안: 해당 활동에 money 가드 추가하거나, ActivityPicker가 이미 `canAfford`로 막는지 확인 후 정합.
- **✅ 검수 결론(2026-06-30, codex·sub-agent×2): 과판정 — 수정 불필요.** `applyActivity` 호출부는 코드 전체 3곳뿐(grep 전수)이고 전부 효과 적용 전 cost를 검사한다: 주말/방학 `gameEngine.ts:826`(`money<actCost`면 스킵+로그), 루틴 슬롯2 `:790`, 슬롯3 `:800`. UI도 `ActivityPicker.tsx:127` `canAfford`로 막음. **잔액 없이 효과가 적용되는 경로 0개**, "실제 소비 불일치" 미실재. 유일한 차이는 UX 표현(money requires 있는 academy류는 목록서 제거 / 없는 hang-out류는 disabled+"💰부족" 배지로 잔류) — 오히려 disabled 쪽이 더 친절. 버그 아님.

## 2. parent 카테고리 `requires` 이중 체크
- `activities.ts:363` `if (a.category === 'parent' && a.requires && !a.requires(state)) return false;` 가 바로 아래 일반 `if (a.requires && !a.requires(state))`와 중복.
- 동작엔 문제 없으나 가독성 혼선. 조치안: 중복 제거.
- **✅ 처리(2026-06-30): 363 삭제 완료.** parent 활동은 3개(`study-with-parent`만 `requires: emotional`, seasonGate 없음 / `family-dinner`·`family-trip`은 requires 없음). 363↔369 사이 분기(364 work, 366/367 seasonGate)가 study-with-parent에 전부 미해당이라 363은 369의 완전 부분집합 = 데드코드. 삭제 동작 불변.

## 3. `collapseActivityChoices` 중간 슬롯 unknown id 방어
- 3슬롯 활동 배열 `[trip, UNKNOWN, trip]` 형태면 첫 trip push → UNKNOWN continue → 마지막 trip이 새 인스턴스로 재push → **1회 활동이 2회 적용** 가능. 발생 경로 좁음(정상 UI에선 미발생).
- 조치안: 같은 활동 id가 이미 push됐는지 방어.
- **⚠️ 검수 결론(2026-06-30, sub-agent): 보류 — 적용하면 안 됨.** 멀티슬롯 writer(`SlotEditPopup.tsx:123-127`)는 항상 연속 인덱스에 동일 id를 기록하고, 마이그레이션도 갭을 끼우지 않아 `[trip, UNKNOWN, trip]` 패턴을 만드는 경로가 없다(빈 슬롯 falsy는 `:341 if(!id) continue`로 i 미진행이라 skip 무영향). 제안한 "같은 id 이미 push 방어"는 `intensive-academy` 등 **의도된 다(多)인스턴스**(`[intensive×4]`→2인스턴스, `activities.ts:334` 주석)를 1인스턴스로 뭉개 정상 동작을 깨뜨림. 현행 유지.

## 4. `part-time` vs `short-term-job` 가드 일관성
- `part-time`은 `requires` 없이 category 레벨(`work && year < 4`)로만 막음. `short-term-job`은 category + 명시적 `requires` 둘 다.
- 향후 category 조건 변경 시 `part-time`이 Y1~3에서 노출될 수 있음. 조치안: 둘 다 `requires`로 통일.
- **✅ 처리(2026-06-30): part-time에 `requires: (s) => s.year >= 4` 추가.** `getAvailableActivities:364`(work&&year<4)와 이중 게이트라 현재 동작은 불변, short-term-job과 패턴 통일 + category 조건 변경 대비 방어.

---
**참고**: cursor 리뷰 특성상 범위를 넘어 끌어온 지적이라(메모리 `feedback_cg_subagent_review_unreliable`), 착수 전 각 항목 실코드 재확인 필요. #5 전략 태그 작업과는 무관.
