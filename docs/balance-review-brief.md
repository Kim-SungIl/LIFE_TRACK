# 검수 의뢰 — 전체 캐릭터 밸런스 (기존 7 + 신규 3)

LIFE_TRACK(7년제 한국 성장 인생 시뮬, 친밀도 우정 기반, 연애 메커니즘 없음). 신규 NPC 3인(seoa·siwoo·yerin)을
복원해 캐스트를 확장하려 한다. **개별 글 품질은 이미 작가 검수 완료** — 이 검수는 **전체 캐스트의 밸런스**만 본다.

## 읽을 것
- `docs/reach-high-new-npcs.md` — 신규 3인 최종 아크(학년·tier·컷·회상)
- `docs/reach-high-brief.md` — 기존 NPC 고교(Y5~7) reach 사다리 계획
- `docs/cast-restoration-master-plan.md` — 복원 전체 플랜·데뷔/퇴장 리듬
- `game/src/engine/events/reach.ts` (Y1 tier), `game/src/engine/events/reachMid.ts` (Y2~4 tier)
- `game/src/engine/gameEngine.ts` — 초기 NPC 로스터(intimacy 시작값·met), 친밀도 감쇠(applyNpcDecay), 주간 슬롯
- `game/src/engine/talkData/miniEvents.ts` — mini 이벤트 intimacyMin
- `game/src/engine/memorySystem.ts` — selectRegretHighlights(후회카드 선별·드리프트 가산)

## 학년/캐스트 맥락
- Y1=초 / Y2~4=중 / Y5~7=고. 신규: seoa(중2 데뷔, Y2~4 + 고 연속), siwoo·yerin(고1 데뷔, Y5~7).
- 복원 후 현역: 초 5명 / 중 6명 / 고 7~8명.
- reach: 친밀도 tier 도달 시 그 학년 발동, 주당 reach 픽 1개 + 동일 이벤트 쿨다운. 친밀도 매주 감쇠.

## 밸런스 점검 항목 (이것만 봐줘)
1. **tier 사다리 정합성**: 신규 티어(siwoo 30~75, yerin 25~60, seoa 40~90)가 기존 NPC(reach.ts/reachMid.ts) 곡선과 어울리나? 학년별 도달 난이도 균형, 너무 쉽거나/불가능한 tier 없나.
2. **scarcity(후회 테마 핵심)**: 복원 후 현역 ~8~10명을 주당 슬롯 + 감쇠 하에서 **다 친해질 수 있나?** 전원 절친 가능하면 "미처 닿지 못한 것"이 안 생겨 테마가 붕괴. 못 닿는 압박이 적정한지 수치로 따져봐.
3. **학년별 이벤트 슬롯 부하 / starvation**: 주당 reach 1픽인데 한 학년에 NPC가 몰리면(특히 고교 7~8명) 특정 캐릭터 reach가 영영 안 뜨는 굶주림이 생기나? 학년별 reach 총량 vs 주 수(48주, 학기 외 제외).
4. **회상/후회카드 밸런스**: 신규들의 memorySlotDraft importance(5~8)·toneTag 분포가 후회카드 풀(memorySystem)을 특정 캐릭터로 쏠리게 하나? 드리프트 가산(저친밀도 +1.5)과의 상호작용.
5. **데뷔 타이밍/시작 친밀도**: 신규 데뷔 학년·시작 intimacy(0 가정)가 그 학년 tier 사다리를 따라잡기에 합리적인가? (고1 데뷔 siwoo/yerin이 Y5에 tier 30~40 도달이 현실적인지 등)
6. **역할 쏠림**: 밸런스 관점에서 특정 학년/성별/아키타입이 과밀하거나 빈 곳.

결과는 한국어로, 항목별 간결하게. 치명적 불균형 → 권고 수치까지.
