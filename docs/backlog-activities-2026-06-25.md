# 백로그 — 활동 정의 정합성 (2026-06-25)

> 출처: #278 코드리뷰 중 cursor가 부수적으로 지적한 **기존 코드** 이슈(전략 태그 #5/#278과 무관).
> 직접 확인해 #278 범위 밖으로 분리한 항목. 전부 LOW, 게임 파괴 없음. 우선순위 낮음.

## 1. 일부 유료 활동에 `requires` 잔액 가드 누락
- `hang-out`(cost 1), `family-trip`(cost 8), `intensive-academy`(cost 5), `sports-camp`(cost 5)에 `requires: (s) => s.money >= cost` 없음.
- 엔진이 `state.money < 0`을 0으로 클램프(`gameEngine.ts:309`)해 파괴는 없으나, 잔액 없이 선택 가능 → UI 표시 대비 실제 소비 불일치. `academy`·`gym` 등 다른 유료 활동과 일관성 어긋남.
- 조치안: 해당 활동에 money 가드 추가하거나, ActivityPicker가 이미 `canAfford`로 막는지 확인 후 정합.

## 2. parent 카테고리 `requires` 이중 체크
- `activities.ts:363` `if (a.category === 'parent' && a.requires && !a.requires(state)) return false;` 가 바로 아래 일반 `if (a.requires && !a.requires(state))`와 중복.
- 동작엔 문제 없으나 가독성 혼선. 조치안: 중복 제거.

## 3. `collapseActivityChoices` 중간 슬롯 unknown id 방어
- 3슬롯 활동 배열 `[trip, UNKNOWN, trip]` 형태면 첫 trip push → UNKNOWN continue → 마지막 trip이 새 인스턴스로 재push → **1회 활동이 2회 적용** 가능. 발생 경로 좁음(정상 UI에선 미발생).
- 조치안: 같은 활동 id가 이미 push됐는지 방어.

## 4. `part-time` vs `short-term-job` 가드 일관성
- `part-time`은 `requires` 없이 category 레벨(`work && year < 4`)로만 막음. `short-term-job`은 category + 명시적 `requires` 둘 다.
- 향후 category 조건 변경 시 `part-time`이 Y1~3에서 노출될 수 있음. 조치안: 둘 다 `requires`로 통일.

---
**참고**: cursor 리뷰 특성상 범위를 넘어 끌어온 지적이라(메모리 `feedback_cg_subagent_review_unreliable`), 착수 전 각 항목 실코드 재확인 필요. #5 전략 태그 작업과는 무관.
