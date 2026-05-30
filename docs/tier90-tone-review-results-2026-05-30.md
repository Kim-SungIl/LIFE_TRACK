# tier90 톤 검증 — 결과 수집 (2026-05-30)

발주 문서: `docs/mini-talk-event-tone-review-tier90-2026-05-30.md`
대상: NPC 6명 친밀도 90 코어 시드 (jihun/subin/minjae/yuna/haeun/junha, #203 머지본)
검증 흐름: **2~3개 AI 공통 교체추천 NPC만 실제 교체.** importance 5(엔딩 회상 최강 가중치)라 tier70보다 엄격하게.

---

## 4자 종합 매트릭스

| NPC | codex (gpt-5.5) | cursor (sonnet) | GPT | Gemini | **4자 종합** |
|---|---|---|---|---|---|
| jihun  | 경계 | 경계 | 경계 | 통과 | **경계 3 / 통과 1** |
| subin  | 통과 | 통과 | 통과 | 경계 | **통과 3 / 경계 1** |
| minjae | **교체추천** | 경계 | 경계 | **교체추천** | **교체추천 2 / 경계 2** ⚠️ |
| yuna   | 통과 | 통과 | 통과 | 통과 | **만장일치 통과** |
| haeun  | 통과 | 통과 | 통과 | 경계 | **통과 3 / 경계 1** |
| junha  | 경계 | 경계 | 통과 | 통과 | **경계 2 / 통과 2** |

> **본문 교체 트리거(2~3 공통 교체추천) 충족: minjae 단 1건** (codex+Gemini 교체추천, cursor+GPT 경계 = 4자 전부 경계 이상).

---

## NPC별 판정 근거 요약

### minjae — 교체 확정 (4자 전부 경계 이상)
- **회피 가드 근접**: "이긴 척 / 지기 싫어서 / 들키기 싫어서"가 30·50·70(노트·오답·기대압박) 학업·경쟁 잔향과 붙음. codex/cursor/Gemini 강하게 지적, GPT는 "잔향 위험"으로 경계.
- **고유색 약함**: 다른 NPC에 대입 가능(Gemini).
- **메타 불일치**: `category: reconciliation`은 화해할 명시적 갈등이 없는 자기폭로라 부정확 → `growth`/`discovery` (codex/cursor/GPT 3자 공통).

### junha — 현행 유지 (2:2 분열, 컨센서스 없음)
- codex/cursor "우산·걸음 속도가 범용 다정함, 고유색 약함, 90 무게 부족" vs GPT/Gemini "주제 가드 완벽 준수 + 절제 호평". tier70 junha와 동일한 2:2 패턴 → 규칙상 현행 유지.

### jihun — 현행 유지 (경계 3, 교체추천 0)
- codex/GPT "보편적 보호자 장면" vs Gemini "관계 변화 우수, 통과". cursor는 본문 OK·`category growth→courage` 메타만 제안(1자, 미달). 교체추천 0이라 본문·메타 모두 유지.

### subin / yuna / haeun — 통과
- yuna 만장일치 통과(음악 축 복귀 + 자기 소리 선택, 6개 중 최강).
- subin 통과 3 / Gemini 단독 `melancholy→breakthrough` 제안(미달; 가정사 공개라 melancholy가 오히려 정합 — 나머지 3자 호평).
- haeun 통과 3 / Gemini 단독 경계는 **오판**: recallText "순간"을 스탯 단어로 지목했으나 "순간"은 일반어(스탯어 = academic/social/talent/mental/health). tier90 recallText 다수가 "~던 순간" 형식이라 정상.

---

## 결정 및 처리 결과

- [x] **minjae 본문 교체** — `talk_minjae_90_nocrown` → `talk_minjae_90_unmasked`
  - 경쟁·승패·성취 어휘 전면 제거, **감정적 위악("괜찮은 척") 해제**로 전환. 70(기대압박)과 축 분리.
  - description: `"나... 사실 다 괜찮은 척하느라 좀 지쳤나 봐." / 방과후 빈 교실, 민재가 늘 날 서 있던 표정을 슬쩍 푼다. "근데 너 앞에선 안 괜찮아도 되더라. 그게 좀, 이상하게 편해."`
  - effects: `{ intimacy: 5, mental: 2, social: 1 }`
  - message: `민재가 늘 쓰던 '괜찮은 척'을 처음 벗었다.`
  - **메타 수정**: `category: reconciliation→discovery`, `toneTag: breakthrough→warm`, recallText `민재가 안 괜찮아도 된다던, 그 빈 교실.`(24자)
  - 검증 스크립트 id 참조 갱신(`verify-tier90-mini-events.ts`).
- [x] **junha 현행 유지** — 2:2 분열(컨센서스 없음). tier70 junha와 동일.
- [x] **jihun 현행 유지** — 경계 3 but 교체추천 0, 메타 courage도 1자뿐(미달).
- [x] **subin/yuna/haeun 현행 유지** — 통과. Gemini 단독 경계는 미달/오판.
- 검증: `verify-tier90-mini-events.ts` 114/114 pass · `npm run build`(tsc -b + vite) 통과.
- 반영 브랜치: `review/tier90-tone`

---

## 교차 분석 (핵심 발견)

1. **minjae = importance 5에서 가장 위험했던 시드** — tier70 검수 때 이미 "90에서 기대/성적 축 선점 주의"로 3/4 경계였던 NPC. tier90에서도 경쟁 잔향으로 4자 전부 경계 이상 → 가드가 예측대로 작동. 본문 교체로 해소.
2. **2자동 ↔ 수동 교차** — codex/Gemini(교체추천)가 더 보수적, cursor/GPT(경계)가 관대. 같은 근거(경쟁 잔향)를 강도만 다르게 읽음. category 불일치는 깊이 본 codex/cursor/GPT가 공통 지적(tier70 메타 패턴 재현).
3. **junha 2:2 재현** — tier70·tier90 모두 codex/cursor "고유색/반복 피로" ↔ GPT/Gemini "영리하게 회피". LLM 패밀리별 일관된 시각차. 컨센서스 없음 → 유지가 타당.
4. **Gemini 오판(haeun "순간")** — importance만 빠르게 보면 일반어를 제약어로 오인할 수 있음. 닫힌 타입/스탯어 목록을 발주서에 명시했어도 발생 → 단독 지적은 교차 확인 필수.
