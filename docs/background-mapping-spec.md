# 배경 이미지 매핑 스펙

## 개요
이벤트별 + 학년별 배경 이미지를 매핑하는 작업 스펙.
기존 `game/src/engine/backgrounds.ts`의 `getBackground()` 함수를 확장하고,
이벤트 시스템(`events.ts`)에 배경 필드를 추가해야 한다.

---

## 학년 → 학교급 매핑

| year | 학년 | 학교급 | 접미사 |
|------|------|--------|--------|
| 1 | 초6 | elementary | `_elementary` |
| 2 | 중1 | middle | `_middle` |
| 3 | 중2 | middle | `_middle` |
| 4 | 중3 | middle | `_middle` |
| 5 | 고1 | high | `_high` |
| 6 | 고2 | high | `_high` |
| 7 | 고3 | high | `_high` |

헬퍼 함수 필요:
```ts
function getSchoolLevel(year: number): 'elementary' | 'middle' | 'high' {
  if (year <= 1) return 'elementary';
  if (year <= 4) return 'middle';
  return 'high';
}
```

---

## 파일 경로

모든 이미지: `game/public/images/backgrounds/`
코드에서 참조: `/images/backgrounds/{filename}.png`

---

## 이미지 목록 (총 44장)

### 학교급별 (31장)

#### 교실 (12장)
| 파일명 | 용도 |
|--------|------|
| `classroom_elementary.png` | 초등 교실 기본 |
| `classroom_middle.png` | 중학 교실 기본 |
| `classroom_high.png` | 고등 교실 기본 |
| `classroom_elementary_afternoon.png` | 초등 교실 오후 (일반 주간 배경) |
| `classroom_middle_afternoon.png` | 중학 교실 오후 (일반 주간 배경) |
| `classroom_high_afternoon.png` | 고등 교실 오후 (일반 주간 배경) |
| `classroom_elementary_spring.png` | 초등 교실 봄 (벚꽃) |
| `classroom_middle_spring.png` | 중학 교실 봄 (벚꽃) |
| `classroom_high_spring.png` | 고등 교실 봄 (벚꽃) |
| `classroom_elementary_sunset.png` | 초등 빈 교실 방과후 |
| `classroom_middle_sunset.png` | 중학 빈 교실 방과후 |
| `classroom_high_sunset.png` | 고등 빈 교실 방과후 |

#### 도서관 (3장)
| 파일명 | 용도 |
|--------|------|
| `library_elementary.png` | 초등 도서관 |
| `library_middle.png` | 중학 도서관 |
| `library_high.png` | 고등 도서관 (자습실 겸용) |

#### 교문 (6장)
| 파일명 | 용도 |
|--------|------|
| `school_gate_elementary.png` | 초등 교문 |
| `school_gate_middle.png` | 중학 교문 |
| `school_gate_high.png` | 고등 교문 |
| `school_gate_elementary_rain.png` | 초등 교문 비 |
| `school_gate_middle_rain.png` | 중학 교문 비 |
| `school_gate_high_rain.png` | 고등 교문 비 |

#### 강당 (3장)
| 파일명 | 용도 |
|--------|------|
| `auditorium_elementary.png` | 초등 강당 |
| `auditorium_middle.png` | 중학 강당 |
| `auditorium_high.png` | 고등 강당 |

#### 복도 (3장)
| 파일명 | 용도 |
|--------|------|
| `hallway_elementary.png` | 초등 복도 |
| `hallway_middle.png` | 중학 복도 |
| `hallway_high.png` | 고등 복도 |

#### 학교 공용 (4장)
| 파일명 | 용도 | 비고 |
|--------|------|------|
| `rooftop.png` | 옥상 | 중/고 공용 (초등은 옥상 이벤트 없음) |
| `gymnasium.png` | 체육관 | 전학년 공용 |
| `music_room.png` | 음악실 | 전학년 공용 |
| `stairwell.png` | 계단 | 전학년 공용 |

### 외부 장소 (13장)

| 파일명 | 용도 | 비고 |
|--------|------|------|
| `home_evening.png` | 집 방 저녁 | **기존 유지** |
| `park_spring.png` | 공원 봄 | **기존 유지** |
| `sunset_walk.png` | 노을 하굣길 | |
| `night_sky_fireworks.png` | 새해 밤하늘 불꽃놀이 | |
| `clear_sky.png` | 맑은 하늘 (수능 후) | |
| `beach_summer.png` | 여름 바다 | |
| `cafe_study.png` | 스터디 카페 | |
| `bedroom_night.png` | 집 방 밤 (수능 전날 등) | |
| `dinner_table.png` | 저녁 식탁 | |
| `hagwon_front.png` | 학원 앞 | |
| `school_road_morning.png` | 등굣길 | |
| `festival_classroom.png` | 축제 교실 | |
| `party_room.png` | 생일파티 방 | |

---

## 이벤트 → 배경 매핑

### 구현 방법
`GameEvent` 타입에 `background?: string` 필드 추가.
이벤트 정의에서 배경을 직접 지정. 학교급별인 경우 `{school}` 플레이스홀더 사용.

```ts
// types.ts 수정
export interface GameEvent {
  // ... 기존 필드
  background?: string; // 배경 이미지 키 (없으면 기본 배경 사용)
}
```

배경 해석 함수:
```ts
function resolveEventBackground(bgKey: string, year: number): string {
  const level = getSchoolLevel(year);
  return `/images/backgrounds/${bgKey.replace('{school}', level)}.png`;
}
```

### 이벤트별 배경 지정

#### 학기/진학 이벤트 (학교급별)
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `first-week` | `classroom_{school}` | 새 학기 첫날 교실 |
| `middle2-start` | `classroom_{school}_spring` | 중2 시작 (벚꽃) |
| `middle3-start` | `classroom_{school}` | 중3 시작 교실 |
| `high2-start` | `classroom_{school}` | 고2 시작 교실 |
| `high3-start` | `classroom_{school}` | 고3 시작 교실 |
| `elementary-graduation` | `auditorium_elementary` | 초등 졸업식 |
| `middle-school-entrance` | `school_gate_middle` | 중학 입학 교문 |
| `middle-school-graduation` | `auditorium_middle` | 중학 졸업식 |
| `high-school-entrance` | `school_gate_high` | 고등 입학 교문 |
| `high-school-graduation` | `auditorium_high` | 고등 졸업식 |

#### NPC 이벤트
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `jihun-call` | `home_evening` | 저녁 전화 (집) |
| `jihun-basketball` | `gymnasium` | 체육관 농구 |
| `jihun-secret` | `sunset_walk` | 하교 후 벤치 고민 |
| `jihun-fight` | `hallway_{school}` | 복도에서 다툼 |
| `jihun-support` | `gymnasium` | 농구 대회 |
| `jihun-promise` | `rooftop` | 옥상 졸업 약속 |
| `subin-academy` | `hagwon_front` | 학원 앞 |
| `subin-notes` | `classroom_{school}` | 교실 쉬는 시간 |
| `subin-cafe` | `cafe_study` | 카페 공부 |
| `subin-dream` | `cafe_study` | 카페에서 꿈 이야기 |
| `subin-exam-stress` | `library_{school}` | 도서관 스트레스 |
| `subin-farewell` | `hagwon_front` | 학원 앞 이별 |
| `minjae-party` | `party_room` | 생일파티 |
| `minjae-mask` | `hallway_{school}` | 복도 뒷면 |
| `minjae-family` | `stairwell` | 계단 이야기 |
| `minjae-real` | `rooftop` | 옥상 진심 |
| `minjae-future` | `rooftop` | 옥상 꿈 이야기 |
| `yuna-library` | `library_{school}` | 도서관 |
| `yuna-lunch` | `rooftop` | 옥상 점심 |
| `yuna-hobby` | `music_room` | 음악실 피아노 |
| `yuna-pressure` | `hallway_{school}` | 복도 떨림 |
| `yuna-smile` | `classroom_{school}_sunset` | 방과후 교실 |
| `haeun-sketchbook` | `classroom_{school}` | 교실 쉬는 시간 |
| `haeun-local-guide` | `school_gate_{school}` | 방과후 교문 앞 |
| `haeun-afterclass` | `classroom_{school}_sunset` | 방과후 빈 교실 |
| `haeun-specialty-awake` | `classroom_{school}` | 교실 |
| `haeun-winter` | `cafe_study` | 카페에서 제안 |
| `new-student` | `classroom_{school}` | 전학생 소개 |

#### 시험/학교 이벤트
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `midterm-1` | `classroom_{school}` | 중간고사 교실 |
| `sports-day` | `gymnasium` | 체육대회 |
| `school-festival` | `festival_classroom` | 축제 |
| `yuna-study` | `library_{school}` | 도서관 공부 |
| `final-exam-2` | `classroom_{school}` | 기말고사 교실 |
| `class-president` | `classroom_{school}` | 반장 선거 교실 |
| `class-president-win` | `classroom_{school}` | 선거 결과 교실 |
| `class-president-lose` | `classroom_{school}` | 선거 결과 교실 |
| `class-president-vice` | `classroom_{school}` | 교실 |
| `class-president-2` | `classroom_{school}` | 2학기 반장 선거 |
| `class-president-2-win` | `classroom_{school}` | 2학기 선거 결과 |
| `class-president-2-lose` | `classroom_{school}` | 2학기 선거 결과 |
| `class-president-nudge` | `classroom_{school}` | 민재 추천 교실 |
| `president-errand` | `hallway_{school}` | 복도 심부름 |
| `president-mediate` | `classroom_{school}` | 교실 중재 |
| `president-speech` | `classroom_{school}` | 조회 발표 |
| `watching-president` | `classroom_{school}` | 민재 관찰 교실 |
| `group-project` | `classroom_{school}` | 조별과제 교실 |
| `random-quiz` | `classroom_{school}` | 깜짝 퀴즈 교실 |
| `teacher-praise` | `classroom_{school}` | 칭찬 교실 |
| `cleaning-duty` | `classroom_{school}` | 청소 교실 |
| `dream-question` | `classroom_{school}` | 꿈 질문 교실 |

#### 계절/날씨 이벤트
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `summer-start` | `school_gate_{school}` | 방학 시작 교문 |
| `summer-trip` | `beach_summer` | 바다 여행 |
| `winter-start` | `school_road_morning` | 겨울방학 거리 |
| `rain-day` | `school_gate_{school}_rain` | 비 오는 교문 |
| `sunset-walk` | `sunset_walk` | 노을 하굣길 |

#### 감정/상태 이벤트
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `fatigue-warning` | `bedroom_night` | 아침 방 |
| `mental-low` | `classroom_{school}` | 혼자 점심 교실 |
| `burnout-event` | `bedroom_night` | 방에서 무기력 |
| `good-grade` | `classroom_{school}` | 성적 상승 교실 |
| `parent-pressure` | `dinner_table` | 저녁 식탁 |
| `sick-day` | `bedroom_night` | 아픈 날 방 |

#### 일상 이벤트
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `friend-snack` | `classroom_{school}` | 간식 교실 |
| `class-prank` | `classroom_{school}` | 장난 교실 |
| `lost-eraser` | `classroom_{school}` | 지우개 교실 |
| `found-money` | `school_road_morning` | 등굣길 |
| `birthday-friend` | `classroom_{school}` | 생일 교실 |
| `pe-class-hero` | `gymnasium` | 체육 |
| `study-cafe` | `cafe_study` | 스터디 카페 |
| `social-media-drama` | `classroom_{school}` | SNS 소동 교실 |
| `music-discovery` | `bedroom_night` | 방에서 음악 |
| `late-to-school` | `school_road_morning` | 등굣길 전력질주 |

#### 수능/졸업 이벤트
| 이벤트 ID | 배경 키 | 설명 |
|-----------|---------|------|
| `suneung-eve` | `bedroom_night` | 수능 전날 밤 방 |
| `suneung-done` | `clear_sky` | 수능 후 맑은 하늘 |
| `year-end-reflection` | `night_sky_fireworks` | 새해 전날 밤하늘 |

---

## backgrounds.ts 수정 사항

### 1. 기존 `getBackground()` 수정
week 기반 기본 배경도 학교급별로 분기:

```ts
export function getBackground(week: number, year: number, isVacation: boolean, mentalState: string): BgInfo {
  const level = getSchoolLevel(year);
  
  // 기본 교실 배경을 학교급별로
  const classroomBg = `/images/backgrounds/classroom_${level}_afternoon.png`;
  const libraryBg = `/images/backgrounds/library_${level}.png`;
  // ... 기존 로직에서 image 필드만 교체
}
```

### 2. 이벤트 배경 해석 함수 추가

```ts
export function getEventBackground(bgKey: string | undefined, year: number): string | undefined {
  if (!bgKey) return undefined;
  const level = getSchoolLevel(year);
  return `/images/backgrounds/${bgKey.replace('{school}', level)}.png`;
}
```

### 3. GameScreen.tsx 수정
이벤트 표시 시 `currentEvent.background`가 있으면 해당 배경 사용:

```tsx
const eventBg = state.currentEvent?.background
  ? getEventBackground(state.currentEvent.background, state.year)
  : undefined;
```

---

## 기존 파일 처리

| 기존 파일 | 처리 |
|-----------|------|
| `classroom_afternoon.png` | 삭제 (학교급별 3장으로 교체) |
| `library_afternoon.png` | 삭제 (학교급별 3장으로 교체) |
| `home_evening.png` | 유지 |
| `park_spring.png` | 유지 |

---

## 체크리스트

- [ ] `types.ts`: `GameEvent`에 `background?: string` 필드 추가
- [ ] `backgrounds.ts`: `getSchoolLevel()` 헬퍼 추가
- [ ] `backgrounds.ts`: `getBackground()` 시그니처에 `year` 파라미터 추가, 학교급별 분기
- [ ] `backgrounds.ts`: `getEventBackground()` 함수 추가
- [ ] `events.ts`: 모든 이벤트에 `background` 필드 추가 (위 매핑 테이블 참조)
- [ ] `GameScreen.tsx`: 이벤트 렌더링 시 이벤트 배경 적용
- [ ] `GameScreen.tsx`: `getBackground()` 호출부에 `year` 전달
- [ ] 기존 `classroom_afternoon.png`, `library_afternoon.png` 삭제
- [ ] 이미지 44장 배치 확인
