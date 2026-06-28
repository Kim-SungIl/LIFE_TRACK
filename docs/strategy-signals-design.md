# 전략 신호 UI 설계 v2 — 활동 전략 태그(#5) + 관계 신호(#4)

> 작성 2026-06-25. **v2: codex·cursor·sub-agent 3인 교차검증 반영(11건 정밀화, 전부 실코드 확인).**
> 목적: **밸런스는 이미 갈렸는데 플레이어가 화면에서 못 느끼는 갭**을 메운다.
> 번아웃·실패엔딩·health 게이트(#266)는 *결과*엔 작동하지만 플레이어는 엔딩에서야 안다.
> 선택의 무게를 **선택하는 순간**에 노출한다. **수치 밸런스는 건드리지 않는다 — 표시 레이어만.**

---

## 공통 원칙

1. **밸런스 불변**: 효과 수치·감쇠율·게이트 전부 그대로. 이미 있는 메커닉을 *해석해서 라벨로* 노출만.
2. **맥락 의존**: 같은 카드라도 *현재 상태*에 따라 다른 태그. 학업 80인 플레이어에게만 "효율 낮음"이 뜬다.
3. **숫자는 숨겨도 신호는 준다**: "친밀도 47"보다 "요즘 뜸하다"가 비용을 더 잘 전달.
4. **절제**: 카드당 전략 태그 최대 2개, 관계 신호 1줄.
5. **결정론 불변(v2)**: 신호 산정은 **순수 파생만** — `seededRandom` 절대 호출 금지(processWeek RNG는 gameEngine.ts:688-689 2회뿐, 순서가 곧 밸런스). 휴리스틱은 결정론이라 안전.

---

# #5 — 활동 카드 전략 태그

**범위: 순수 UI. 상태·엔진·밸런스 변경 0건.** `ActivityPicker.tsx` + 신규 순수 함수 유틸.

## 현행
카드는 이미 단기 효과를 서술형 태그로 보여준다(`describeEffect`, `describeFatigue`). **전부 그 주(週) 한정.** 반복했을 때 뭐가 닫히는지는 안 보인다.

## 추가 — "장기 신호" 태그 (앰버 톤, 효과 태그와 시각적으로 구분)

별도 행. 수치 토글과 무관하게 항상 표시.

| 태그 | 발동 조건 (v2 — 실코드 검증) | 근거 |
|---|---|---|
| `⚠ 지금 피로 위험` | `a.fatigue > 0` & **실제 tired 게이트 근접**: `(s.stats.mental < 40 && s.fatigue > 45) \|\| s.fatigue >= 85` | tired 진입 게이트 gameEngine.ts:482-484 (strict `>`, mental 동반 필요) |
| `📉 고구간 효율 낮음` | **`academic` 효과가 있는** 활동 & `getActivityCost(a,year)===0` & 해당 stat ≥ 80 | 무료활동 소프트캡 ×0.1은 **전 스탯** 적용 gameEngine.ts:234 (study 전용 아님 — 문구를 "고구간"으로) |
| `🎯 유료라 효율 유지` | `academic` 효과 & `getActivityCost(a,year) > 0` & academic ≥ 80 | 유료는 소프트캡 면제 gameEngine.ts:234. **단 주당+2 성장캡(line 240권역)으로 절대 이득은 작을 수 있음 → "돌파" 아닌 "유지" 톤** |
| `💸 돈 부담 큼` | `getActivityCost(a,year) >= weeklyIncome*2` (wealth 부모는 소득↑라 고정 15 부적합) | weeklyIncome 3/5 parentModifiers.ts:55 |
| `🌙 지금 필요함` (초록) | rest 활동 & (`s.mentalState !== 'normal'` 또는 `s.fatigue >= 60`) | 회복 휴리스틱(엄밀 게이트 아님, 넛지) |
| `💛 관계 유지` (초록) | social 활동 & npcEffects 보유 | 동행 +3 gameEngine.ts:671 |

### v2 정밀화 핵심
- **유료/무료 판정은 `getActivityCost(a, s.year)`** (학년 차등). `a.moneyCost` 원시값 금지 — `yearlyCost` 활동과 어긋남.
- **소프트캡은 전 스탯**이라 "이 성적대"가 아니라 "고구간 효율 낮음". `academic` 효과 활동에만 노출해 의미 한정.
- **피로 경고는 실제 게이트**와 맞춤: `mental≥40`인데 fatigue만 높은 구간은 tired 안 오므로 오경보 방지.
- 우선순위(slice 2): **피로 > 돈 > 휴식 > 효율/유료 > 관계**.

## 구현 — 순수 함수 분리 (`game/src/engine/activityHints.ts`, 신규)
```ts
export type ActivityHint = { text: string; tone: 'warn' | 'good' };
export function activityHints(a: Activity, s: GameState, weeklyIncome: number): ActivityHint[] {
  const hints: ActivityHint[] = [];
  const cost = getActivityCost(a, s.year);
  const hasAcademic = (a.effects.academic ?? 0) > 0;
  if (a.fatigue > 0 && ((s.stats.mental < 40 && s.fatigue > 45) || s.fatigue >= 85))
    hints.push({ text: '⚠ 지금 피로 위험', tone: 'warn' });
  if (cost >= weeklyIncome * 2) hints.push({ text: '💸 돈 부담 큼', tone: 'warn' });
  if (a.category === 'rest' && (s.mentalState !== 'normal' || s.fatigue >= 60))
    hints.push({ text: '🌙 지금 필요함', tone: 'good' });
  if (hasAcademic && s.stats.academic >= 80)
    hints.push(cost > 0 ? { text: '🎯 유료라 효율 유지', tone: 'good' } : { text: '📉 고구간 효율 낮음', tone: 'warn' });
  if (a.category === 'social' && a.tags) hints.push({ text: '💛 관계 유지', tone: 'good' });
  return hints.slice(0, 2);
}
```
순수 함수라 단위 테스트 가능. `ActivityPicker`는 호출만. 리스크: 최저(읽기 전용).

---

# #4 — 관계 UI 신호

**범위: 상태 필드 1개 + 마이그레이션 + 쓰기 4지점 + 패널/모달 props + 렌더.** 밸런스 불변(결정론 안전 확인).

## 현행
`NpcRelationPanel.tsx` = 친밀도 바 + 라벨. 관계 *온도*와 *방치*가 안 보인다.

## 신호 3종

### 신호 1 — 최근성/방치 `🍂 요즘 뜸하다` / `💛 최근 함께함`
**신규 상태: `NpcState.lastInteractionWeek?: number`** (절대주차 = `(year-1)*48 + week`, SSOT 헬퍼).

- **쓰기 4지점**(친밀도 바뀌는 *모든* 양(+) 상호작용 — v2: 잡담은 친밀도 0변화라 "양수 변화"만 보면 누락 → **모든 상호작용 시 갱신**):
  1. 동행 `applyNpcActivitySelection` gameEngine.ts:671
  2. 미니토크/잡담 `talkToNpc` store.ts:387 (잡담도 갱신)
  3. 이벤트 npcEffects `applyChoiceOutcome` store.ts:132 — **적용 delta > 0일 때만**(음수=관계 악화엔 "최근 함께함" 금지)
  4. **상점 선물** `buyItem` case `npc_intimacy` shopSystem.ts:236 (+5~15, v1 설계 누락분)
- **마이그레이션**(stateMigration.ts): `undefined` 백필 시 구세이브 전원 즉시 `🍂` 대량 노출 → **현재 절대주차로 시딩**(방금 만난 중립 상태). met NPC만 대상.
- **신호 산정**(순수, RNG 금지): `weeksSince = nowAbs - last`. `>=8 && intimacy>20` → `🍂 요즘 뜸하다`(식는 중) / `<=2` → `💛 최근 함께함` / 그 외 무표시.
- **정직성(v2)**: 감쇠 하한 20 + **0.15/주(일반)·0.2/주(>80)**. "잃는다" 금지, **"멀어지는 중"** 톤 — 넛지지 공포 아님.

### 신호 2 — 기대/임박 `✨ 곧 더 가까워질 듯`
- **v2 결론**: 30/50/70 휴리스틱은 smalltalk엔 맞지만 **reach 임계는 비균일**(reachMid jihun 45/55/65/70/76/82…). → **(a) smalltalk 깊이 해금 임박만** 표시(30/50/70 ±5)로 의미 한정하거나, **(b) 해당 NPC의 다음 미발동 `intimacyMin`/`reach.tier` 중 최근값** 계산(정확판).
- **v1 채택: (a) smalltalk 전용** + `talkEventsFired`에 해당 reach 있으면 제외(노이즈 방지). 정확판(b)은 후속.

### 신호 3 — 온도 시각화(선택)
방치+감쇠 중 라벨 옆 작은 `❄` 정도. 과하면 생략.

## 패널/모달 표시
바 아래 신호 1줄(우선순위: 임박 > 방치 > 최근). 숫자 비노출.

## 구현 스코프 (v2 — 7파일, props 추가 반영)
1. `types.ts` — `NpcState.lastInteractionWeek?: number`
2. `gameEngine.ts` — 헬퍼 `absWeek(s)` + 쓰기 1지점(671)
3. `store.ts` — 쓰기 2지점(387 잡담포함, 132 delta>0 가드)
4. `shopSystem.ts` — 쓰기 1지점(236)
5. `stateMigration.ts` — 현재 주차 시딩 백필
6. `NpcRelationPanel.tsx` — **`week` prop 추가** + 신호 렌더 / 호출부 MainWeekScreen.tsx:262 `week={state.week}`
7. `NpcDetailModal.tsx` — **`week` prop 추가**(모달 실재) + 신호 1줄 / 호출부 MainWeekScreen.tsx:277

리스크: 중하. 쓰기 지점 누락 시 "항상 뜸하다" → 구현 후 인게임 확인 필수.

---

# 권장 순서
1. **#5 먼저** — 상태 변경 0, 리스크 최저. 1 PR.
2. **#4** — 필드+쓰기 4지점+props, 신호1+2(a). 신호2(b) 정확판은 후속. 1 PR.

두 PR 모두 **밸런스 수치 불변** — check 게이트로 회귀 없음 확인.
