# 리뷰 의뢰 — 지훈(jihun) 전체 이벤트 성별-인지 톤 점검

## 게임 맥락
한국 인생 시뮬레이션 게임 LIFE_TRACK. 주인공 성별은 **남/여 선택 가능**. 지훈은 **남성 NPC**(소꿉친구).

## 점검 기준 (확정된 방향성)
NPC 친밀도 이벤트는 **성별 인지 분기** 정책을 따른다:
- **동성 쌍**(남 주인공 + 남자 지훈) = **깊은 우정/브로맨스**. 연애 암시 없어야 함.
- **이성 쌍**(여 주인공 + 남자 지훈) = **로맨스 코드 허용**.

엔진은 이를 이미 지원한다:
- `description` / `choices` = **기본값**. 남 주인공이 보는 텍스트(+여성 오버라이드 없을 때 fallback).
- `femaleDescription` / `femaleChoices` = **여 주인공 전용 오버라이드**.

→ 따라서 지훈 이벤트는 **`description`/`choices`(기본=남주가 봄)가 우정 코드여야** 하고, 로맨스 코드는 `femaleDescription`/`femaleChoices`로 분리돼야 한다.

**문제 정의**: 현재 다수 이벤트가 로맨스 코드를 `description`/`choices`에 그대로 두어, **남 주인공이 플레이하면 동성 연애처럼 읽힌다.**

## 로맨스-코드 신호 체크리스트 (이게 기본 텍스트에 있으면 동성 주인공에서 문제)
- 호감/설렘 암시: 귀 빨개짐, 말끝 흐림, 두근거림, 시선 회피성 부끄러움
- "둘만의 특별함" 강조: 비번을 네 생일로, 네가 나온 사진만 모음, 너 없는 걸 상상 못 함
- 따라다님/소유: "너 가는 데 나도", 질투
- 신체 접촉의 로맨스적 연출
- 고백 직전 뉘앙스

(주의: 의리·챙김·취약함 위로·작별의 아쉬움 등은 **우정으로도 자연스러움** → 과교정 금지. 깊은 우정의 따뜻함은 유지.)

## 점검 대상 — 지훈 전체 이벤트 17개 (소스 직접 읽고 판정할 것)
파일은 `game/src/engine/events/` 기준. 각 이벤트의 `description`, `choices[].text`, `choices[].message`, 그리고 기존 `femaleDescription`/`femaleChoices` 유무까지 본다.

- `birthday.ts`: jihun-birthday
- `reachMid.ts`: jihun-locker-code, jihun-mirror-height, jihun-relay-baton, jihun-half-gimbap, jihun-new-shoes, jihun-six-years-photos, jihun-ramen-bet, jihun-same-sunset, jihun-different-path
- `school.ts`: jihun-call
- `crisis.ts`: jihun-envy
- `npc/jihun.ts`: jihun-basketball, jihun-secret, jihun-fight, jihun-support, jihun-promise

## 출력 형식 (이벤트 17개 각각)
```
[이벤트id] 판정: OK(우정) | 수정필요(로맨스코드) | 이미분기됨
- 문제 신호: (기본 텍스트의 어떤 문장이 동성에서 로맨스로 읽히나, 구체적 인용)
- 제안: (우정 버전으로 바꿀 방향 / femaleDescription에 로맨스 이전 여부)
```
마지막에 **수정필요 이벤트 목록 + 우선순위(상/중/하)** 한 줄 요약.

파일은 절대 수정하지 말 것. 판정만.
