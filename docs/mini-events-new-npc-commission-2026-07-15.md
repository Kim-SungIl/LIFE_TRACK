# 발주: 신규 NPC 3인(서아·시우·예린) 말걸기 미니 이벤트

> 배경: 캐스트 밸런스 검수(`docs/balance-review-cast-2026-07-14.md` ⑤)에서 신규 3인의 mini 이벤트가
> 0개로 확인 — 말걸기 경제·관계 신호에서 배제되는 구조 결함. 기존 NPC와 동일한 규격으로 집필 발주.

## 게임/시스템 맥락

- LIFE_TRACK: 7년제(초 Y1 / 중 Y2~4 / 고 Y5~7) 한국 학창시절 성장 시뮬. **관계는 전부 우정 기반, 연애 메커니즘 없음.**
- 말걸기 미니 이벤트: 주간 화면에서 NPC에게 말을 걸면 확률적으로 발동하는 **선택지 없는 단일 컷**.
  친밀도 임계(intimacyMin) 이상일 때 풀에 들어오고, **각 1회만 발동** 후 소진.
- 반드시 읽을 것 (등장인물의 목소리는 여기서만 가져올 것):
  - `game/src/engine/events/reachNew.ts` — 3인의 확정 아크 전문 (말투·소품·모티프의 SSOT)
  - `game/src/engine/talkData/miniEvents.ts` — 기존 39개 미니 이벤트 (규격·톤 레퍼런스)
  - `docs/reach-high-new-npcs.md` — 아크 설계 문서
  - `game/src/engine/gameEngine.ts`의 npcs 로스터 — greeting/personality 한 줄

## 캐릭터와 발주 슬롯 (총 12컷)

### 윤서아 (seoa) — 내성적 글쟁이. 중2(Y2) 데뷔, 고3(Y7)까지 연속
모티프: 한쪽 이어폰(=한 칸 열림), 사람 표정을 적는 노트, 끝을 미루는 글.
| id 규칙 | intimacyMin | 게이트 | 톤 |
|---|---|---|---|
| talk_seoa_30_* | 30 | (없음 — 중학 톤) | 일상 소품으로 반쯤 열림 |
| talk_seoa_50_* | 50 | (없음 — 중학 톤) | 노트/글의 존재를 공유 |
| talk_seoa_70_* | 70 | (없음 — 중학 톤) | 속마음 한 줄 + 회상 후보 |
| talk_seoa_h50_* | 50 | yearMin: 5 (고교 톤) | 입시 소음 속의 글 |
| talk_seoa_h65_* | 65 | yearMin: 5 | 읽어줄 사람이라는 존재 |
| talk_seoa_h80_* | 80 | yearMin: 5 | 끝을 향해 가는 글 + 회상 후보 |

### 한시우 (siwoo) — 건축 꿈꾸는 관찰자. 고1(Y5) 데뷔
모티프: 창밖·옥상·동선, 감정을 공간으로 번역하는 화법, 드라이 유머.
| id 규칙 | intimacyMin | 게이트 | 톤 |
|---|---|---|---|
| talk_siwoo_30_* | 30 | yearMin: 5 | "저거 봐" — 시선의 공유 |
| talk_siwoo_50_* | 50 | yearMin: 5 | 건축 꿈의 가장자리 |
| talk_siwoo_70_* | 70 | yearMin: 5 | 시선의 소실점이 사람이었다는 것 + 회상 후보 |

### 강예린 (yerin) — 입시 전략가. 고1(Y5) 데뷔
모티프: 단가표·등급·장부의 언어, 주인공만 "미산정", 전략 뒤의 외로움. 모럴 그레이 — 날은 서 있되 미워할 수 없게.
| id 규칙 | intimacyMin | 게이트 | 톤 |
|---|---|---|---|
| talk_yerin_30_* | 30 | yearMin: 5 | 계산의 언어로 건네는 호의 |
| talk_yerin_50_* | 50 | yearMin: 5 | 장부에 안 적히는 것의 등장 |
| talk_yerin_70_* | 70 | yearMin: 5 | 미산정의 의미 반쯤 시인 + 회상 후보 |

## 규격 (기존 풀과 동일 — 어길 시 반려)

```ts
{
  id: 'talk_seoa_30_earphone',          // talk_{npc}_{임계}_{영문슬러그}
  npcId: 'seoa', intimacyMin: 30,       // (+ 고교/데뷔 게이트면 yearMin: 5)
  description: '"대사"\n지문 한두 줄.',   // 2~4줄. 대사+지문. NPC 이름으로 3인칭 지문
  effects: { intimacy: 2, stats: { mental: 1 } },
  message: '서아의 ○○ — 멘탈 +1, 친밀도 +2',   // "…— 효과 나열, 친밀도 +N" 형식 고정
},
```

- **효과 수치 고정**: 임계 30 → `intimacy: 2` + 스탯 +1(합계 1~2) / 50·65 → `intimacy: 3` + 스탯 합계 2 /
  70·80 → `intimacy: 4` + `stats: { mental: 2 }` 중심. fatigue ±1~3, money는 특별한 이유 있을 때만.
- **70+ 컷은 memorySlotDraft 선택 부착 가능** (3인 중 컷당 최대 1개): `{ category, importance: 3, toneTag, recallText, npcIds: ['<npc>'] }`.
  category는 discovery/growth 위주, importance는 3 고정 (기존 미니톡 컨벤션 — 후회카드 편중 방지).
- **gender 필드는 쓰지 않는다** (3인 모두 성별 무관 우정).
- 금지: 연애 코드, 다른 NPC 등장(솔로 컷), 학년·연도 숫자 명시("고2 여름" 정도는 허용, "2025년" 금지),
  reachNew.ts 컷과 같은 장면 재탕 (모티프는 공유하되 사건은 새로).
- 분량: description 한국어 2~4줄. 기존 예문(talk_haeun_quiet, talk_subin_70_night_light)의 밀도.

## 산출 형식

컷마다 위 TS 오브젝트 형태 그대로 (주석 없이). 담당 범위 전부를 하나의 코드블록에.
컷마다 대안 버전 1개씩 추가 (총 담당량 × 2안) — A안/B안 표기.
