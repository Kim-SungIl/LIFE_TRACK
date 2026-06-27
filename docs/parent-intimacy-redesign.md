# 부모 친밀도(parentIntimacy) 재설계 — 태그 기반 하이브리드 모델 (v2)

> 상태: **설계 제안 (코드 미적용)**. 2026-05-30. 4개 소스(codex·cursor·게임사례·디자인패턴) 설계 + 5개 검수(codex·cursor·밸런스·코드·디자인) 반영.
> v2 변경: 구간 감쇠 연속식·평균회귀 강화·배율 폭 확대·미니이벤트 인프라 분리·빈 셀 채움·연령 서사 비트 추가.
> 자문/검수 원본: `docs/smalltalk-out/parent-design-*.md`, `parent-review-*.md`.

## 0. 한 줄 요약

**부모 강점은 친밀도의 "자동 증감 방향"이 아니라 "플레이어 행동에 대한 반응 배율(0.6/1.0/1.4)"이다.**
strict 부모도 신뢰·성실·실패 만회로 따뜻해지고, emotional 부모도 계속 회피·방치하면 식는다. 친밀도는 선택·결과·생활 패턴의 누적으로 움직이며, 7년에 걸친 연령 서사 비트(사춘기·진로·입시·독립)로 관계 곡선을 그린다. 숫자는 숨기되 분위기 시그널과 엔딩 회고로 드러낸다.

---

## 1. 현재 구조의 문제 (코드 확인)

| # | 문제 | 위치 |
|---|---|---|
| P1 | **결정론**: emotional +0.1/주, strict −0.1/주 자동 드리프트. 플레이어 행동 무관. | `gameEngine.ts:597-600` |
| P2 | **하강 압력 부재**: 부모 미니이벤트 6종 전부 +1~+2. 게다가 강점당 1회만 발동(`talkEventsFired`)이라 반복 하강 경로가 없음. | `talkData.ts:199-234`, `talkSystem.ts:77` |
| P3 | **활동 미연결**: `study-with-parent`/`family-dinner`/`family-trip`이 parentIntimacy에 효과 0. | `activities.ts:169,177,271` |
| P4 | **부모 활동 게이트 편중**: `study-with-parent`·`family-dinner`는 `requires: emotional`. 비-emotional 가정은 부모 접점이 family-trip(방학·Y4+)뿐. | `activities.ts:175,183,293` |
| P5 | 결과적으로 친밀도가 50 근처 좁은 폭에 갇혀 **사실상 의미 없는 기능**. | — |

---

## 2. 핵심 공식

### 2.1 단일 진입점 — `applyParentIntimacyDelta`

**모든** 친밀도 변화(활동·미니이벤트·시험·이벤트 선택지)는 이 함수 하나만 통과한다. 기존 `store.ts:383`의 직접 가산도 이 함수로 통합한다.

```ts
// game/src/engine/parentIntimacy.ts (신규 SSOT)
export type ParentTag =
  | 'shareWorry' | 'hideProblem' | 'familyTime'
  | 'gradeImprove' | 'gradeDrop' | 'keepPromise' | 'breakPromise'
  | 'careerTalk' | 'ignoreAdvice' | 'overspend' | 'moneyRequest'
  | 'autonomyChoice' | 'recoveryAction';

export type ParentEffect = { baseDelta: number; tag: ParentTag };

export function applyParentIntimacyDelta(state: GameState, baseDelta: number, tag: ParentTag): number {
  let delta = baseDelta;

  // (1) 부모 강점 2개의 반응 배율 곱 (parents는 [ParentStrength, ParentStrength] 고정 튜플)
  for (const strength of state.parents) {
    delta *= reactionMultiplier(strength, tag);
  }

  // (2) 연속 구간 감쇠 — 천장/바닥에 가까울수록 부드럽게 감쇠 (계단 불연속 제거)
  const pi = state.parentIntimacy ?? 50;
  const factor = delta > 0 ? (100 - pi) / 50 : pi / 50; // pi=50→1.0, 70→0.6, 85→0.3
  delta *= Math.max(0.2, Math.min(1.0, factor));

  const next = Math.max(0, Math.min(100, pi + delta));
  state.parentIntimacy = next;
  return next - pi; // 실제 적용량(시그널/로그용)
}
```

> **C1 수정**: 기존 `if pi>=70 … if pi>=85 …` 계단식은 87에서 0.6×0.35=0.21로 **중첩 버그**가 있었다. 연속식 `(100-pi)/50`(clamp 0.2~1.0)으로 대체 — 69→70 벽 제거 + 코드 단순화 + 의도(천장 근처 강한 감쇠)는 동일하게 재현.

### 2.2 반응 배율 테이블 — `reactionMultiplier(strength, tag)`

**값은 3단계**: 민감 `1.4` / 기본 `1.0` / 둔감 `0.6` (±40%). 곱 범위 0.36~1.96.
구현은 `Record<ParentStrength, Partial<Record<ParentTag, number>>>`, 미정의 셀은 기본 1.0.

| tag \ strength | emotional | strict | wealth | info | resilience | freedom |
|---|---|---|---|---|---|---|
| `shareWorry` (고민 공유) | **1.4** | 1.0 | 0.6 | 1.0 | 1.0 | 1.0 |
| `hideProblem` (문제 숨김, −) | **1.4** | 1.0 | 1.0 | **1.4** | 0.6 | 0.6 |
| `familyTime` (식사·여행·함께) | **1.4** | 0.6 | **1.4** | 1.0 | 1.0 | 0.6 |
| `gradeImprove` (성적 향상) | 0.6 | **1.4** | 1.0 | 1.0 | 1.0 | 0.6 |
| `gradeDrop` (성적 급락, −) | 0.6 | **1.4** | 1.0 | 1.0 | 0.6 | 1.0 |
| `keepPromise` (약속 이행) | 1.0 | **1.4** | 1.0 | 1.0 | 1.0 | **1.4** |
| `breakPromise` (약속 파기, −) | 1.0 | **1.4** | 1.0 | 1.0 | 0.6 | 1.0 |
| `careerTalk` (진로 상담) | 1.0 | 1.0 | **1.4** | **1.4** | 1.0 | 1.0 |
| `ignoreAdvice` (조언 무시, −) | 1.0 | 1.0 | 1.0 | **1.4** | 1.0 | 0.6 |
| `overspend` (과소비, −) | 1.0 | 1.0 | **1.4** | 1.0 | 1.0 | 1.0 |
| `moneyRequest` (용돈 요청) | 1.0 | 1.0 | 0.6 | 1.0 | 1.0 | 1.0 |
| `autonomyChoice` (자기주도 선택) | 1.0 | 0.6 | 1.0 | 1.0 | 1.0 | **1.4** |
| `recoveryAction` (실패 후 만회) | **1.4** | **1.4** | 1.0 | 1.0 | **1.4** | 1.0 |

**각 강점의 정체성** (C4 — 빈 셀 채움, 검수 반영):
- **emotional**: 정서·함께·만회에 1.4, 성적엔 0.6 → "성적보다 마음으로 움직이는 부모".
- **strict**: 성적·약속·만회에 1.4(만회 추가 = strict가 따뜻해지는 핵심 경로), 함께·자율엔 0.6 → "신뢰와 책임으로 가까워지는 부모".
- **wealth**: 함께(여행·식사)·진로·과소비에 1.4, 단순 용돈요구·감정공유엔 0.6 → "돈으로 표현하되 같이 보낸 시간을 귀히 여기는 부모".
- **info**: 진로·조언·문제공유(정보 차단 민감)에 1.4. 성적은 1.0으로 strict와 차별 → "성적보다 큰 그림(진로·정보)에 민감한 부모".
- **resilience**: 만회에 1.4, 성적급락·약속파기·문제숨김엔 0.6(하강 둔감) → "넘어져도 괜찮다고 기다려주는 안전한 부모".
- **freedom**: 자율·약속이행에 1.4, 함께·성적엔 0.6, 조언무시에 0.6(자유=자기책임이지 무관심 아님) → "간섭 안 하지만 약속은 지키라는 부모".

### 2.3 변화량 스케일 (baseDelta 가이드) — C5 반영해 하향

| 상황 | baseDelta |
|---|---|
| 평범한 좋은 행동(잡담 등) | +0.2 ~ +0.5 |
| 부모 상호작용 활동 | +0.4 ~ +0.8 |
| 작은 갈등 | −0.3 ~ −0.8 |
| 큰 갈등/이벤트 | −1.5 ~ −3 |
| 큰 화해/중요 이벤트 | +1.5 ~ +3 |

> **목표 분포(밸런싱 기준, codex)**: 보통 플레이 **45~65** / 가족 투자 플레이 **70~85** / 갈등 누적 플레이 **25~40**. Phase 3 보상은 이 분포가 시뮬레이션으로 확인된 뒤 붙인다.

---

## 3. 입력원

### 3.1 활동 (P3·P4 해결)

`Activity`에 `parentEffect?: ParentEffect` 추가. `applyActivity`(`gameEngine.ts:167~`)의 **effects 루프 바깥**(끝부분 L306 직전)에서 raw baseDelta로 `applyParentIntimacyDelta` 호출.

> **C(코드) 주의**: 친밀도는 stat이 아니므로 `getDiminishingReturn × fatiguemod × routineBonus × efficiency`(L220) 감쇠를 **받지 않는다**. §2.1 구간 감쇠와 이중 적용 방지. 2슬롯 collapse는 루틴 경로에선 슬롯별 개별 호출이라 같은 부모 활동을 두 슬롯에 넣으면 2배 적용될 수 있어 → **`WeekLog.parentEffectAppliedIds`로 활동 id별 주 1회만 친밀도 적용**(Phase 1 구현 완료).

| 활동 | parentEffect | 게이트 | 비고 |
|---|---|---|---|
| `family-dinner` | `{ +0.5, 'familyTime' }` | **emotional 게이트 해제** | P4. emotional은 1.4배(+0.7) |
| `study-with-parent` | `{ +0.6, 'familyTime' }` | emotional 전용 유지 | emotional 강점 보존(결정) |
| `family-trip` | `{ +1.5, 'familyTime' }` | **`requires: year>=4` + 방학마다 1회** | 리뷰 반영: 2.0→1.5 (wealth+emotional 1.4×1.4 조합 시 +2.94로 상한 내) |

> **family-trip 사실 정정**: `vacationLimit:1`이지만 방학 카운터가 학기 진입 시 리셋 → 여름/겨울 각 1회 가능. Y4(중3)부터 접근. Y1~3 distant 가정은 family-trip 회복 수단 없음(family-dinner로 커버).
> **C5 체감 보상(소량, Phase 1 포함)**: family-dinner는 친밀도 60+ 시 멘탈 회복 미세 상향(+2→+2.5) — 숫자 비노출이어도 "뭔가 달라졌다"는 신호.

### 3.2 부모 미니이벤트 ±선택지화 (P2) — tradeoff 설계

좋은/회피 선택지로 분기하되 **도덕 퀴즈가 아니라 트레이드오프**로:
```ts
// 예: 성적 급락 후 부모 반응
choices: [
  { label: '"성적 떨어진 이유를 솔직히 말한다"', parentEffect: { baseDelta: +1.2, tag: 'shareWorry' }, effects: { mental: -1 } }, // 친밀도+/멘탈-
  { label: '"대충 둘러대고 방으로"',             parentEffect: { baseDelta: -1.2, tag: 'hideProblem' }, effects: { mental: +1 } }, // 멘탈보존/친밀도-
],
```
긍정 선택지는 회피 패널티보다 매력적이어야 "클릭할 이유"가 생긴다(부가 보상 병행).

> **Phase 1에서 선반영**: 리뷰(태그 오분류 P1)에 따라 `MiniTalkEvent.parentTag?: ParentTag`를 이미 추가하고 기존 6개 부모 미니이벤트에 주제별 태그를 달았다(strict→`gradeImprove`, freedom→`autonomyChoice`, info→`careerTalk`, resilience→`recoveryAction`, emotional→`shareWorry`, wealth→`familyTime`). store는 `ev.parentTag ?? 'familyTime'`로 호출. Phase 2A의 `choices`는 이 `parentTag`/`ParentEffect`를 그대로 재사용.

> **C3 — ±선택지화는 데이터 수정이 아니라 인프라 작업**(검수 핵심 발견). Phase 2A로 분리:
> 1. `MiniTalkEvent`에 `choices?: { label, parentEffect, effects?, message }[]` 추가.
> 2. **MiniTalkModal.tsx에 선택 버튼+콜백 추가**(현재 표시 전용).
> 3. store의 "클릭=즉시적용"을 "선택 후 적용"으로 분리(`talkToHome`/`talkToNpc`).
> 4. **반복 발동**: 현재 강점당 1회(`talkEventsFired`)면 ±선택지를 넣어도 평생 1회라 하강압력 없음. → `parentEventsFired`를 별도 키로 분리하고 쿨다운(예: 3~6주) 또는 학기말 리셋. 발동 사전결정(`parentEventPendingThisWeek`) 모델과는 "발동=사전결정, 선택=클릭 시"로 호환.

### 3.3 시험 결과 (Phase 2B, 약하게 + strict 어드밴티지)

시험 정산(`gameEngine.ts:752~781`, mentalDelta 처리 직후)에 훅:
- 상위권/향상 → `{ +0.8, 'gradeImprove' }` (strict 1.4배 = +1.12 체감)
- 하위권/급락 → `{ −1.0, 'gradeDrop' }` (emotional 0.6 완충 / strict 1.4 증폭)

**strict + 성적 향상 추가 어드밴티지**(친밀도와 별개, 연 1~2회 가드): 소액 용돈/멘탈 버프 or "아빠가 처음으로 칭찬했다" 짧은 이벤트. `hardCrisisYears` 같은 연간 가드 패턴 차용 → GameState에 카운터 필드 + `stateMigration` 백필 1줄.

> **2B 구현 노트**: 분류는 `examParentEffect(ExamResult)` — (1) 직전 대비 석차 상승(중·고)이면 레벨 무관 `gradeImprove`, (2) 아니면 `mentalDelta` 부호(>0 상위권→gradeImprove / <0 하위권·급락→gradeDrop / 0 무난→null). 모의·수능은 `mockGrade` 기반 mentalDelta로 통일 처리. 정산 위치는 현재 `gameEngine.ts` step 10(시험 체크, mentalDelta 후처리 직후) — **평균회귀(5b)·플래그 리셋 이후**라 시험 훅은 `actedWithParentThisWeek`를 세팅하지 않는다(세팅 시 다음 주 회귀를 잘못 면제; 시험은 수동 신호라 면제 대상 아님). strict 어드밴티지 게이트 = strict + gradeImprove + 상위권(`rank≤5` / `mockGrade≤3` / 초등 `average≥85`) + 연 1회(`parentPraiseYears`) → 멘탈 +2.

---

## 4. 자연 변화 — 평균 회귀 (강화)

**P1 자동 드리프트 제거.** 대신 **부모 관련 행동이 없는 주에만** 50으로 회귀(C2 + 디자인 제안):

```ts
// gameEngine.ts:597-600 교체
if (!state.actedWithParentThisWeek) {            // 활동/미니이벤트/홈잡담 한 주는 면제
  const pi = state.parentIntimacy ?? 50;
  const k = pi < 50 ? 0.006 : 0.01;              // 저구간은 회복 더디게(비대칭)
  state.parentIntimacy = Math.max(0, Math.min(100, pi + (50 - pi) * k));
}
```

- **계수 0.01**: 반감기 ≈69주(≈1.4년). pi=70 방치 시 −0.20/주 → "한 학년 반쯤 지나면 눈에 띄게 식는다"(기존 0.003은 반감기 231주로 게임 내내 안 식음 = 의도 미작동).
- **무행동 주 한정**: "이번 주 안 챙겼더니 톤이 식었네"로 인과가 또렷. 챙긴 주의 노력이 회귀에 안 깎임.
- **비대칭(저구간 0.006)**: 한 번 식은 관계는 회복이 더디게 → "영구 단절 방지"는 유지하되 너무 쉽게 회복 안 됨.
- 50 미만은 §3의 명시적 마이너스 행동(갈등·성적급락·약속파기)으로만 깊이 내려간다 → 하강은 "사건"으로.

> **잡담 면제 정책 확정 = C(잡담도 면제 유지)**: "가정에 말 걸기"로 잡담만 떠도 그 주는 회귀 면제. 리뷰에서 "비용 0 잡담이 회귀를 무한 면제한다(1-A)"는 우려가 있었으나 — (1) 잡담은 친밀도를 *올리지* 않고 현 상태 *유지*만 하므로 "쉽게 퍼주기" 아님, (2) 잡담=연락=방치 안 함이라 안 식는 게 서사적으로 맞음, (3) 매주 클릭은 시뮬 아티팩트이고 실제 사람은 빠지는 주가 생겨 회귀가 자연 발동. 유일한 트레이드오프: 매주 빠짐없이 클릭하는 열성 플레이어는 클릭만으로 고친밀도를 유지 가능(단 *올리는* 건 여전히 활동/이벤트 필요). 수용 결정.

---

## 5. 시그널 노출 (숨김 유지 + 정성 피드백)

숫자는 숨긴다. 단 변화 원인은 피드백으로(메모리: "변화는 또렷이, 조용함은 크롬에만").

- **구간 라벨(내부, 톤 함수와 동일 3구간으로 통일)**: distant(<30) / normal(30~70) / warm(70+). `getParentIntimacyTone`·회고 톤(`memorySystem.ts:462`)과 SSOT 공유. (이전 v1의 5단계 라벨은 폐기 — 톤 함수와 불일치했음.)
- **노출 채널**:
  1. 주간 결과 로그(큰 변화 시): "성적보다 먼저 말해준 걸 고마워하는 눈치였다." / **빗나감도 연출**: emotional 부모에 성적표만 들이밀면 "엄마는 성적표를 보더니 '밥은 먹었어?'라고만 했다" → 오답 신호로 인과 학습(디자인 제안).
  2. 홈 잡담 톤(§6).
  3. 임계 통과 1회성 로그: "요즘 엄마랑 좀 편해진 것 같다"(숨은 스탯의 마일스톤화).
  4. 학년말 회고 일기.
- 상시 게이지 바 없음. 매주 무음도 방지: 잡담 톤은 상시 미세 노출(크롬), 임계 통과·큰 사건만 또렷한 로그.

---

## 6. 부모 잡담 톤 티어 (원래 과제와의 연결)

재설계로 parentIntimacy가 실제로 구간을 넘나들게 되어 잡담 톤 분기가 의미를 갖는다.
- 경계: distant(<30)/normal(30~70)/warm(70+) — 톤 함수 재사용(상태 분기, 누적 아님).
- `getHomeSmalltalk`을 강점별 풀 + 톤 분기로 확장.
- **Phase 3 콘텐츠 발주 전 임시**: 기존 `PARENT_STATIC_DIALOGUES`(`talkData.ts:241`)를 warm/normal/distant 3그룹으로 재분류만 해둬도 기능이 살아있음(미완성 인상 방지). 정식 콘텐츠는 NPC와 동일 파이프라인(LLM 발주→큐레이션→QA).

---

## 7. 보상 연동 (스탯 퍼주기 ❌ → 위기 안전망/옵션 ⭕)

parentIntimacy는 직접 스탯이 아니라 **위기 안전망 + 해금 옵션**:
- **70 도달 시 영구 해금 옵션**(소비되지 않는 자산): 위기 이벤트에서 "부모에게 털어놓는다" 선택지 상시 등장 → 친밀도가 "보험금"이 아니라 "옵션 트리 확장 투자"가 되어 기회비용이 의미를 가짐(디자인 제안).
- 70+ : 큰 실패 시 멘탈 하락 일부 완화
- 60+ : 시험/진로 전 작은 버프 이벤트 확률↑
- 30− : 갈등 이벤트 확률↑, 회고 톤 변화
- 20− : 특정 선택지 비용↑ 또는 멘탈 회복 효율↓

> 친밀도 분포가 시뮬레이션으로 안정된 뒤 붙인다(너무 쉽게 상시 버프되지 않게).

---

## 8. 단계별 구현 계획 (검수 반영해 재분할)

| Phase | 내용 | 변경 파일 | 비고 |
|---|---|---|---|
| **1 ✅ 완료** (코어, 구 0+1 통합) | `parentIntimacy.ts`(ParentTag·reactionMultiplier·applyParentIntimacyDelta·평균회귀) + `Activity.parentEffect` + 활동 3종 연결 + family-dinner 게이트 해제 + 자동드리프트→평균회귀 교체 + store 통합 + `MiniTalkEvent.parentTag`(6개 이벤트 태그) + 2배 가드(`parentEffectAppliedIds`) | `types.ts`, `parentIntimacy.ts`(신규), `activities.ts`, `gameEngine.ts`, `store.ts`, `talkData.ts`, `verify-patch-batch5.ts` | 브랜치 `feat/parent-intimacy-phase1`. 3중 리뷰 반영 완료 |
> **2A 결정 — 회상 박제 = 이벤트당 최초 선택 1회 (검수 P2 합의)**: 같은 부모 이벤트가 쿨다운 후 재발동해 다른 선택을 해도, 회상 슬롯은 `sourceEventId` 1회 dedup으로 **최초 선택만 박제**된다(친밀도는 매 선택마다 변동). "그 이벤트의 첫 기억이 남는다"는 의도된 동작 — 재발동마다 회상이 덮어써지면 가벼운 반복이 무거운 첫 기억을 지운다. `choiceIndex`는 분석용으로 정확히 기록(F5).

> **2A 리뷰 반영 (4자 검수: codex/cursor/sub-agent×2, 2026-06-07)**: F1 부정 선택 회상의 모달 톤 분기(친밀도↓엔 "관계 깊어졌어요" 미표시, 회한 톤 + `resultText`) / F2 지배전략 교정(wealth 회피 💰+5→+3·−0.5→−1.2, freedom 회피 −0.6→−1.5) / F3 strict 긍정 멘탈−1 제거 / F4 `resolveParentTalkChoice` 가용성 가드 / F5 `choiceIndex` 기록. P1 런타임 버그 0건.

| **2A ✅ 완료 (미니토크 선택지 인프라 + 6개 전환 + 메모리)** | `MiniTalkEvent.choices`(±트레이드오프) + MiniTalkModal 2단계 선택 UI + store 선택-후-적용(`resolveParentTalkChoice`) + 반복발동(`parentEventsFired`/쿨다운 4주/least-recently-fired 로테이션) + 기존 6개 ±선택지 전환 + **부모 이벤트 메모리 슬롯화**(선택별 `memorySlotDraft`, 기존 카테고리 매핑) | `talkData.ts`, `MiniTalkModal.tsx`, `store.ts`, `talkSystem.ts`, `types.ts`, `gameEngine.ts`, `stateMigration.ts`, `GameScreen.tsx`, `MainWeekScreen.tsx`, `verify-parent-phase2a.ts` | C3. 브랜치 `feat/parent-intimacy-phase2a`. 메모리 슬롯은 사용자 요청(학년말 회상)으로 2A에 포함 |
> **2B 리뷰 반영 (4자 검수: codex/cursor/sub-agent×2, 2026-06-08)**: G1 `getAvailableHomeEvents`에 yearMin/yearMax 필터(부모 이벤트도 학년 게이트 — info_2 진학 이벤트가 초등 발동하던 누락 수정) / G2 `examParentEffect` 초등 average 분류(≥75 향상·<45 급락 — 초등 strict 칭찬 dead code 활성화) / G3 wealth_2 회피 💰4→3·긍정 💰+1(지배전략 방지) / G4 strict 어드밴티지 mock 게이트 ≤3→≤2 / G5 freedom_2 부정 피로−1(트레이드오프) / G6 resilience_2 부정 −0.8→−1.0(freedom 조합 임계) / G7 strict_2 통금 "10시"→"정한 시간"(톤) / G8 verify 추가. P1 버그 0건.

| **2B ✅ 완료 (입력 콘텐츠)** | B1 시험 약연동(`examParentEffect`: 향상/상위권→gradeImprove +0.8, 급락/하위권→gradeDrop −1.0, 정산 직후 단일 진입점 적용) + B2 strict 성적향상 어드밴티지(연 1회 가드 `parentPraiseYears`, 상위권+향상 시 멘탈+2 + "아빠가 드물게 칭찬") + B3 강점별 이벤트 1개씩 추가(6→12, ±선택지·일부 회상, 단조로움 해소) | `parentIntimacy.ts`, `gameEngine.ts`, `talkData.ts`, `types.ts`, `stateMigration.ts`, `verify-parent-phase2b.ts` | 브랜치 `feat/parent-intimacy-phase2b`. 6개 전환은 2A로 선반영. verify 2A 197 / 2B 15 통과 |
| **3 (시그널·잡담·보상)** | 주간 로그 피드백(오답 신호 포함) + 부모 잡담 톤 티어(임시 재분류→발주) + 위기 안전망·해금 옵션 + **고친밀도 진로 안전망**(번아웃 완충 등) | `memorySystem.ts`, `talkData.ts`, `EventScene`/이벤트, 잡담 발주, `gameEngine.ts` | §5·§6·§7 |
| **4 (연령 서사 비트 + 엔딩/진로 영향)** | 사춘기·진로갈등·입시·독립 연령 게이트 이벤트 + 강점별 절정 순간 + **`ending.ts` 부모 챕터 분기 + 진로/타이틀 보정** | 이벤트 데이터, `memorySystem.ts`, `ending.ts` | §10. 친밀도가 진로·엔딩에 남는 장기 영향(사용자 요청 확정) |

각 Phase 독립 PR. Phase 1이 결정론 탈피의 핵심. Phase 2A는 인프라라 2B 전에 필수.

---

## 9. 결정 완료 (2026-05-30)

1. ✅ 평균 회귀 채택 + **0.01로 강화 + 무행동 주 한정 + 저구간 비대칭(0.006)**.
2. ✅ family-dinner만 게이트 해제, study-with-parent emotional 전용 유지.
3. ✅ 시험 약연동 + strict 성적 어드밴티지.
4. ✅ 반응 배율 **0.6/1.0/1.4** 3단계.
5. ✅ 구간 감쇠 **연속식**(중첩 버그 수정).
6. ✅ **연령 서사 비트 포함**(Phase 4 신설).
7. ✅ Phase 0→1 흡수, Phase 2→2A/2B 분할.
8. ✅ **잡담 면제 = C**(잡담도 회귀 면제 유지, §4).
9. ✅ (리뷰) 미니이벤트 `parentTag`로 태그 오분류 수정 + family-dinner 2배 가드 + family-trip 2.0→1.5.

---

## 10. 연령 서사 비트 (Phase 4) — 관계 곡선 + 장기 영향

> **사용자 요청 확정 (2026-06-07)**: 부모 관계는 두 가지로 "남아야" 한다 —
> 1. **학년말 회상**: 부모 이벤트도 매 학년 끝에 메모리 슬롯에서 보인다. → **Phase 2A에서 구현 완료**(선택별 `memorySlotDraft` → 학년말 milestone + 엔딩 `memorialHighlights`/`yearClosings`에 자동 등장). 전용 엔딩 분기 전에도 부모가 엔딩 회상 레이어에 이미 나타난다.
> 2. **진로·엔딩 장기 영향**: 친밀도가 진로/엔딩에 영향을 끼친다. → **Phase 3/4**. `ending.ts`는 현재 `parentIntimacy`를 전혀 안 보므로 신규 훅 필요. 친밀도가 실제로 움직이는 2A/2B 이후라야 의미가 생겨 순서상 뒤에 둔다.
>    - **엔딩(Phase 4)**: `parentIntimacy` 임계값(distant <30 / warm ≥70)으로 엔딩 회고 부모 챕터 + 타이틀/서술 변주(아래 "독립 직전" 비트).
>    - **진로 안전망(Phase 3, §7)**: 고친밀도 → 위기(번아웃 등) 완충·정서적 지지. 스탯 직접 가산이 아니라 안전망/옵션으로(스탯 퍼주기 ❌ 원칙 유지).

7년 게임인데 부모 관계만 "시간축 없는 평형계"라는 지적 반영. 학창시절 부모 서사의 굴곡을 연령 게이트 이벤트로(메모리 `연령 게이트는 의도된 설계`와 정합 — 한 판에 다 보는 게 아님).

- **사춘기 골짜기(중2~3, Y3~4)**: 한시적으로 familyTime/shareWorry 배율이 전 부모 0.75로 하락, "방문 쾅" 류 마이너스 선택지 등장. 이 시기 하락은 정상. 후에 회복하면 "그땐 미안했어" 화해 비트 해금. → 관계의 골짜기·회복 곡선.
- **진로 갈등(고1~2, Y5~6)**: info/strict 부모와 "원하는 진로 vs 부모 기대" 선택. `ignoreAdvice`/`autonomyChoice` 태그가 비로소 자주 발동하는 무대.
- **입시 압박/화해(고3, Y7)**: strict/info는 gradeDrop 배율 일시↑(압박 고조), emotional은 recoveryAction 비중↑. 입시 후 부모별 1회성 클로징.
- **독립 직전(Y7 말)**: 친밀도 구간에 따라 **엔딩 회고 일기의 부모 챕터 분기**. warm="기차역에서 손 흔들던 엄마", distant="끝내 못 한 말". → §7 안전망보다 강한 "쌓을 이유"(보상이 스탯이 아니라 내 이야기의 결말).
- **강점별 절정 순간 1종씩**(strict 어드밴티지를 6축으로 일반화): wealth "말없이 통장을 만들어뒀더라", freedom "끝까지 안 말렸다", resilience "일으키지 않고 기다려준", info "내 진로를 같이 찾아줬다" 등. 6축 모두 "이 부모라서 좋은 순간"을 가져야 캐릭터성 완성 + wealth/freedom 평면성 해소.
