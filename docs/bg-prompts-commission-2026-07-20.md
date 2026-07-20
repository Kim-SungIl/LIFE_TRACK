# 발주: 미생성 배경 에셋 16종 — 이미지 생성 프롬프트 집필

> 배경: PR #325 조사 결과, 이벤트가 참조하는 배경 키 16종의 PNG가 미생성.
> 9종은 폴백조차 없어 그라데이션 단독 노출, 6종은 근사 폴백(복도→교무실 앞 등)으로 임시 동작 중.
> 이 발주는 **이미지를 만드는 게 아니라, 이미지 생성용 영문 프롬프트 문서를 집필**하는 작업.

## 산출물

`docs/cg-prompts-backgrounds-2026-07.md` 신규 작성. 배경 1종당:

1. **파일명**: `game/public/images/backgrounds/{키}.png`
2. **사용 이벤트**: 아래 표의 id 목록 (필요시 코드에서 재확인)
3. **장면 요구사항** (한국어 2~3줄): 사용 이벤트들의 description을 정독하고 공통 분모를 추출.
   장면 디테일의 SSOT는 **이벤트 본문**이다 — 임의 창작 금지.
4. **영문 생성 프롬프트**: 아래 스타일 규약 준수, 6~10줄.

## 반드시 읽을 것

- `docs/cg-prompts-high-y5-y7.md` §공통 스타일 가이드 — Art style(Anime-style illustration,
  soft pastel colors, gentle lighting) / Era(2010s~2020s Korean school) / Negative prompt를 상속
- `docs/background-mapping-spec.md` — 기존 배경 44종 인벤토리·파일명 규약·학교급 매핑 (톤 정합 참고)
- `docs/cg-prompts-high-reach-y5-y7.md` §배경 에셋 의존성 표 — 6종(night_bus, bus_stop_evening,
  counseling_hallway, school_bench, school_entrance_rain, music_room_middle)의 기존 장면 메모
- 각 사용 이벤트의 description: `game/src/engine/events/` (reach.ts, reachMid*.ts, reachHigh*.ts,
  reachNew.ts, npc/*.ts 등 — grep으로 id 검색)

## 배경 전용 규약 (CG 프롬프트와 다른 점 — 어길 시 반려)

- **인물 완전 배제**: `empty scene, no people, no characters, no figures, no silhouettes` 명시.
  EventScene이 캐릭터 스탠딩을 이 위에 합성하므로 배경은 빈 공간이어야 한다.
- **텍스트/간판 한글 금지**: `no readable text, no signage lettering` (AI 한글 붕괴 방지).
  게시판·포스터는 blurred/indistinct로.
- **해상도**: 1440x810 (16:9). 세로 구도 금지.
- **중앙 여백**: 화면 중앙 하단 1/3은 캐릭터가 서는 자리 — 시각적 중심 오브젝트를 중앙에 두지 말 것.
- **학교급 톤**: 아래 표의 "학교급" 칼럼 준수. 공용(shared)은 특정 학교급 티가 안 나게
  (교복 포스터·학급 게시물 같은 단서 배제).

## 대상 16종 (우선순위순)

### Tier 1 — 폴백 없음, 현재 그라데이션 단독 노출 (9종)

| 배경 키 | 참조 | 사용 이벤트 | 학교급 |
|---|---|---|---|
| cafeteria_middle | 5 | jihun-half-gimbap, jihun-ramen-bet, subin-cafeteria-line, subin-runs-without-me, minjae-three-minute-math | 중학 급식실 |
| bus_stop_evening | 3 | subin-name-or-school, jihun-hs-firstgap, siwoo-last-signal | 공용(저녁 정류장·횡단보도) |
| night_bus | 2 | subin-cant-leave-chat, jihun-hs-latenight | 공용(밤 시내버스 실내) |
| school_bench | 1 | haeun-brothers-book | 공용(교정 벤치) (검수 갱신: jihun-hs-injury는 보건실 장면이라 분리) |
| infirmary | 1 | jihun-hs-injury | 공용(보건실 — 검수에서 추가, 17종째) |
| school_entrance_rain | 1 | siwoo-demolished-ground | 빗속 철거 골목 (검수 갱신: yuna 컷은 기존 school_gate_{school}_rain 재지정) |
| snack_bar | 1 | jihun-mirror-height | 공용(학교 앞 분식집) |
| bus_stop_morning | 1 | subin-hundred-chats | 공용(아침 정류장) |
| hagwon_shuttle | 1 | subin-mom-namecard | 공용(학원 셔틀 앞/내부) |
| alley_night | 1 | subin-two-of-us-home | 공용(밤 주택가 골목) |

### Tier 2 — 근사 폴백 동작 중 (복도/교실/도서관 대체 노출), 전용 에셋으로 승격 (6종)

| 배경 키 | 참조 | 사용 이벤트 | 학교급 |
|---|---|---|---|
| faculty_hallway | 5 | jihun-different-path, minjae-point-one, minjae-good-on-his-own, yuna-teacher-comment, haeun-before-application | 공용(교무실 앞 복도) |
| locker_hallway | 4 | jihun-locker-code, jihun-six-years-photos, minjae-locker-timetable, yuna-clearing-locker | 공용(사물함 복도) |
| counseling_hallway | 4 | minjae-displayed-model, jihun-hs-track, minjae-hs-choice, siwoo-hobby-seat | 공용(진로·상담실 앞 — 진학 게시판) |
| club_room | 2 | subin-applause-stage, haeun-handover-note | 공용(동아리방) |
| study_room_night | 2 | minjae-red-pen, haeun-highlighter-overdraw | 공용(밤 자습실) |
| broadcast_room | 1 | haeun-broadcast-mic | 공용(방송실) |

### Tier 3 — 선택 (범용 music_room.png가 폴백으로 이미 동작, 중학 전용 톤 원할 때만)

| 배경 키 | 참조 | 사용 이벤트 | 학교급 |
|---|---|---|---|
| music_room_middle | 7 | seoa-meet, yuna-metronome, yuna-song-pick, yuna-wet-score, yuna-last-recital (+yuna-hs 2컷은 high라 별도 판단) | 중학 음악실 |

## 산출 형식 예시

```markdown
### cafeteria_middle — 중학 급식실
**파일**: `game/public/images/backgrounds/cafeteria_middle.png` · 1440x810
**사용**: jihun-half-gimbap, jihun-ramen-bet, subin-cafeteria-line, subin-runs-without-me, minjae-three-minute-math
**장면**: 점심시간 직전/직후의 중학교 급식실. 스테인리스 식판·긴 테이블. (이벤트 본문 근거 요약)

​```
Anime-style illustration, soft pastel colors, gentle lighting.
A Korean middle school cafeteria interior, ... (장면 묘사) ...
Empty scene, no people, no characters, no figures.
No readable text, no signage lettering; posters blurred.
Wide 16:9 composition, lower-center third kept visually open.
​```
```
