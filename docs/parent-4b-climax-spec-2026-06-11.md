# Phase 4B 구현 스펙 — 부모 "강점별 절정 순간"

5인 검토(codex·cursor·sub-agent 3) 합의 반영. 사용자 결정: **4B 풀도입 + 4A 연동**.

## 설계 원칙 (검토 합의)
- **강점당 평생 1회** (`parentClimaxFired: ParentStrength[]` 가드). 한 판 최대 2회(부모 2강점).
- **구제 발동창**: 고3(Y7) 수능 후(week≥36) 미발동 강점이 있고 친밀도 normal+(≥45)이면 누적 조건 무시하고 발동. distant는 발동 안 함(미발동 자체가 서사).
- **복합 트리거** (친밀도 단독 임계 금지): `친밀도 게이트(≥60) AND 해당 강점 긍정 태그 누적(≥2) AND 연령 창 AND 미발동`.
- **스탯 퍼주기 금지**: 절정은 회상 슬롯(importance 5) + 서사. strict만 기존 밸런스 유지로 멘탈 +2, 나머지 5축 스탯 0.
- **선택지 없는 단일 컷**(반복 미니이벤트와 톤 분리). 미니이벤트보다 우선 발동.
- **화자 SSOT**: 엄마 = emotional/info/resilience/freedom, 아빠 = wealth/strict.
- **4A 연동**(중복 해소): 절정 본 강점은 엔딩 warm 비트를 `warmSeen` 콜백으로 교체. 안 본 경우 기존 standalone warm(중복 소재 제거되도록 일부 재서술).

## 트리거 강점별 (triggerTag / yearMin)
| 강점 | triggerTag | yearMin | 멘탈 |
|---|---|---|---|
| emotional | shareWorry | 2 | 0 |
| resilience | recoveryAction | 3 | 0 |
| info | careerTalk | 4 | 0 |
| freedom | autonomyChoice | 4 | 0 |
| strict | gradeImprove | 4 | +2 |
| wealth | familyTime | 5 | 0 |

긍정 태그 누적: `applyParentIntimacyDelta`에서 baseDelta>0일 때 `parentPositiveTags[tag]++` (단일 진입점).

## 절정 씬 (단일 컷)
- **emotional(엄마)**: 밤 11시, 공부방 문이 5센티쯤 열렸다. 엄마는 아무것도 묻지 않았다. 핫초코 한 잔이 책상 모서리에 놓였다가, 문이 다시 조용히 닫혔다.
- **wealth(아빠)**: 아빠 서랍에서 내 이름으로 된 통장이 나왔다. 금액이 아니라, 개설일이 입학식 날인 걸 보고 한참 멈췄다. 아빠는 그걸 보더니 "밥은 먹었냐" 하고는 서랍을 닫았다.
- **info(엄마)**: 엄마가 자료 더미를 내려놨다. 맨 위에, 내가 흘리듯 한마디 했던 분야가 포스트잇으로 따로 붙어 있었다. "강제 아니야. 그냥, 네가 저번에 그랬잖아."
- **strict(아빠)**: 성적표를 한참 보던 아빠가, "잘했다" 대신 "…고생했네" 한마디만 남기고 먼저 돌아섰다. 결과가 아니라 과정을 본 건, 그때가 처음이었다.
- **resilience(엄마)**: 크게 주저앉은 날, 엄마는 손을 내밀지 않았다. 문 앞에 식은 밥상만 두고 갔다. "안 들어갈게. 배고프면 나와."
- **freedom(엄마)**: 온 가족이 말리는 선택 앞에서, 엄마만 아무 말이 없었다. 입을 열었다 다시 다물고는—"…그래. 네가 정했으면." 말리고 싶은 걸 삼킨 한순간이었다.

## 4A warm 비트 연동 (ending.ts)
절정 본 강점 → `warmSeen`(콜백). 안 본 강점 → `warm`(중복 소재 뺀 재서술). normal/distant 불변.

## 구현 파일
types.ts(state 필드) · parentIntimacy.ts(태그 카운터) · talkData.ts(PARENT_CLIMAX_EVENTS) · talkSystem.ts(getEligibleParentClimax) · store.ts(talkToHome 우선 분기) · ending.ts(warmSeen) · gameEngine.ts·stateMigration.ts(초기화) · verify-parent-climax.ts(신규).
