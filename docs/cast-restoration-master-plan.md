# 캐스트 복원 + 중·고 reach + 신호-2 마스터 플랜 v1

> 작성 2026-06-27. 신호-2 정밀판에서 출발 → 고교 빈약 발견 → **원래 설계 로스터에서 잘린
> NPC 3명(seoa·siwoo·yerin) 복원**으로 확장. scarcity(후회 테마) 회복이 근본 목표.
> 관련 문서: `reach-high-brief.md`(고교 reach 상세), `character-prompt-spec.md`(아트 SSOT).

---

## 0. 왜 — 근본 원인

원래 설계(`character-prompt-spec.md`)는 단계마다 새 얼굴을 들이는 캐스트였으나, 3명이 **스펙·아트
프롬프트까지 작성된 채 미구현으로 잘림**:

| 단계 | 설계 | 구현됨 | 잘림 |
|---|---|---|---|
| 중학교 | haeun + **seoa** | haeun | seoa |
| 고교 | junha + **siwoo** + **yerin** | junha | siwoo·yerin |

결과: 현역 친구 6명 → 집중 플레이어가 전원 절친 가능 → "미처 닿지 못한 것"(후회카드)이 안 생겨
핵심 테마 약화. **복원이 scarcity의 의도된 장치를 되살린다.**

## 1. 복원 캐릭터 아키타입 (스펙 기반)

| id | 이름 | 단계 | 아키타입 | 메우는 결 |
|---|---|---|---|---|
| **seoa** | 윤서아 | 중(Y2 데뷔) | 내성적 글쟁이·이어폰·몽환 | 내면형 또래 (yuna 밝음/haeun 선배와 대비) |
| **siwoo** | 한시우 | 고(Y5 데뷔) | 관찰자·건축 꿈·드라이 유머 | 시니컬 관찰자 (junha/jihun과 대비) |
| **yerin** | 강예린 | 고(Y5 데뷔) | 입시 전략가·계산적 사교형 | **"계산이 비치는 친구"** — 게임에 없던 복잡한 결 |

## 2. 트랙 구조 — 아트는 병렬, 콘텐츠는 선행 가능

게임은 staged 자산 없을 때 `_middle` → CSS 아바타 폴백(`Portrait.tsx`). 즉 **아트 없이도 NPC를
폴백으로 연결·집필·검증 가능**하고, 아트는 나중에 슬롯인. 콘텐츠가 아트를 기다리지 않는다.

- **Track A (아트 — 사장님/아티스트, 병렬)**: seoa(중·고?), siwoo(고), yerin(고) fullbody+portrait.
  기존 프롬프트(`character-prompt-spec.md` §5-4·5-5) 그대로 발주. `_f` 동반 변형은 정서 컷 필요 시.
- **Track B (콘텐츠·코드 — 나, 지금 착수 가능)**: 아래 Wave.

## 3. Wave 시퀀스 (의존성 순)

**Wave 1 — 기존 NPC 고교 reach (~23개, 아트 0)**  ← 즉시 착수 가능
- `reach-high-brief.md` 그대로. jihun 8(심장)·subin 4·minjae 4·yuna 3·junha 2·haeun 2.
- 기존 초상 재사용이라 아트 의존 없음. **jihun 갭이 가장 시급해 1순위.**

**Wave 2 — siwoo 복원 (고교 신규)**
- 로스터 등록(gameEngine 초기 npcs, intimacy 0/met false) + `characterAssets.ts` + Y5 intro(`siwoo-meet`) + Y5~7 reach 사다리(~6) + mini 이벤트(intimacyMin 30/50/70).
- 아크: 관찰자 → 건축 꿈을 들키는 과정 → 같이 도시를 다르게 보게 되는 결. 폴백 아트로 집필·검증.

**Wave 3 — yerin 복원 (고교 신규)**
- 동일 구조. 아크: 계산적 사교형의 가면 → 입시 경쟁 속 진짜 얼굴 → "전략 뒤의 외로움". 모럴 그레이 톤.

**Wave 4 — seoa 복원 (중학교 신규)**
- Y2 intro(`seoa-meet`) + Y2~4 reach + mini. 중학교 reach(reachMid) 페이싱에 끼워넣기.
- ⚠ **결정 필요**: seoa가 고교로 이어지는가? (아래 §5)

**Wave 5 — 신호-2 코드 (정밀판)**
- `relationshipSignals.ts`에 `nextIntimacyThreshold(npc, state)` — reach.tier(reach/reachMid/신규) + mini.intimacyMin을 학년·성별·talkEventsFired로 필터해 다음 임계 조회. `relationshipSignal(npc, state)`로 시그니처 변경, 컴포넌트 2개 전달.
- **반드시 Wave 1~4 이후** — 읽을 reach 데이터가 다 깔린 뒤라야 정직해짐.

각 Wave: 집필 → 검수 → `npm run check` + in-game 확인 → PR. 집필 규모 큰 Wave(1·2·3)는
reachMid 선례(5작가→10리뷰→codex/cursor→5재검수) 적용 검토.

## 4. 데뷔/퇴장 리듬 (복원 후)

| 단계 | 신규 | 퇴장 | 현역 수 |
|---|---|---|---|
| 초 (Y1) | jihun·subin·minjae·yuna·doyun (5) | — | 5 |
| 중 (Y2~4) | haeun·**seoa** (2) | doyun | ~6 |
| 고 (Y5~7) | junha·**siwoo**·**yerin** (3) | haeun 졸업 | ~7~8 |

→ scarcity 회복. 단계마다 새 얼굴 + 떠나는 얼굴이 또렷해져 시간성·후회 테마 강화.

## 5. 미결 결정

1. **seoa 고교 연속성** — (a) 중학교 전용(고교 진학 시 자연 페이드, doyun식 약한 드리프트 → 후회
   레이어 보강) / (b) 고교까지 이어짐(middle+high 아트 둘 다, 현역 캐스트 +1로 scarcity 강화).
   → **제 권장 (b)**: 글쟁이 내면형은 입시 클라이맥스에서 가장 빛나고, 현역 8명이 scarcity 의도에 부합.
   단 아트 1인분 추가. (a)면 아트 절약 + 또 하나의 "떠난 사람".
2. **yerin 톤 수위** — 계산적 친구의 "모럴 그레이"를 어디까지. 배신/이용 같은 날선 비트까지 갈지,
   "전략 뒤 외로움"의 따뜻한 착지로 갈지. 집필 톤 가이드 필요.
3. **집필 파이프라인** — Wave별 5작가 풀 검수 vs 내가 초안+검수만.

## 6. 권장 착수 순서

**Wave 1(기존 고교 reach)부터 즉시** — 아트 무관, jihun 갭이 가장 시급, 신호-2의 선행 데이터.
Track A(아트 발주)를 동시에 걸어두면 Wave 2~4 도달 시 siwoo/yerin/seoa 아트가 준비됨.
