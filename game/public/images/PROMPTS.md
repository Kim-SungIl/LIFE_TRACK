# AI 일러스트 프롬프트 시트

> 이 문서의 프롬프트를 AI 이미지 생성 도구에 입력하여 캐릭터/배경을 생성합니다.
> 생성된 이미지는 해당 폴더에 지정된 파일명으로 저장하세요.

---

## 공통 스타일 앵커 (모든 프롬프트 끝에 추가)

```
korean manhwa style, soft cel-shading, clean lineart,
pastel color palette, school life theme, high quality,
detailed face, upper body portrait, simple gradient background,
digital illustration, consistent art style
```

## 네거티브 프롬프트 (공통)

```
3d, realistic, photo, blurry, low quality, deformed,
extra fingers, bad anatomy, watermark, text, signature,
nsfw, violent
```

---

## 1. 주인공 (player)

파일 위치: `characters/player_[표정].png` (512x640 권장)

### 기본 프롬프트
```
korean teenage student, 13 years old, gender neutral appearance,
short black hair, warm brown eyes, fair skin,
korean school uniform with navy blazer and white shirt,
[표정], looking at viewer,
[스타일 앵커]
```

### 표정 변형
| 파일명 | 표정 프롬프트 |
|--------|-------------|
| player_happy.png | bright smile, happy expression, sparkling eyes |
| player_neutral.png | calm expression, gentle eyes, slight smile |
| player_sad.png | looking down slightly, sad expression, melancholy eyes |
| player_tired.png | half-closed eyes, exhausted expression, droopy posture |
| player_burnout.png | empty eyes, blank stare, dark circles under eyes, desaturated colors |
| player_surprised.png | wide eyes, open mouth, surprised expression |
| player_angry.png | furrowed brows, frustrated expression, clenched jaw |
| player_shy.png | looking away, blushing cheeks, nervous smile |

---

## 2. 지훈 (#1 소꿉친구)

파일 위치: `characters/jihun_[표정].png`

### 기본 프롬프트
```
korean teenage boy, 13 years old, short messy black hair,
warm brown eyes, slightly tan skin, athletic build, bright personality,
korean school uniform with navy blazer and white shirt,
collar slightly loose, confident posture,
[표정], looking at viewer,
[스타일 앵커]
```

### 표정: happy, neutral, sad, angry, surprised (5종)

---

## 3. 수빈 (#2 동네친구)

파일 위치: `characters/subin_[표정].png`

### 기본 프롬프트
```
korean teenage girl, 13 years old, shoulder-length brown hair with bangs,
soft brown eyes, fair skin, gentle and calm appearance,
korean school uniform with navy blazer and white shirt,
neat and tidy, quiet demeanor,
[표정], looking at viewer,
[스타일 앵커]
```

### 표정: happy, neutral, sad, shy, surprised (5종)

---

## 4. 민재 (#3 같은 반 활발한 아이)

파일 위치: `characters/minjae_[표정].png`

### 기본 프롬프트
```
korean teenage boy, 13 years old, very short black hair almost buzz cut,
sharp eyes, medium skin tone, energetic and sporty appearance,
korean school uniform with navy blazer and white shirt,
sleeves slightly rolled up, dynamic posture,
[표정], looking at viewer,
[스타일 앵커]
```

### 표정: happy, neutral, angry, surprised (4종)

---

## 5. 유나 (#4 조용한 모범생)

파일 위치: `characters/yuna_[표정].png`

### 기본 프롬프트
```
korean teenage girl, 13 years old, long straight dark brown hair,
gentle dark eyes behind thin glasses, pale fair skin,
korean school uniform with navy blazer and white shirt,
perfectly neat uniform, book in hand, studious appearance,
[표정], looking at viewer,
[스타일 앵커]
```

### 표정: neutral, happy, shy, surprised (4종)

---

## 6. 배경

파일 위치: `backgrounds/[장소]_[시간].png` (960x540 권장)

### 교실
```
korean school classroom interior, empty wooden desks and chairs,
large windows with sunlight streaming in, chalkboard at front,
school supplies on desks, warm [시간대] lighting,
anime background style, no characters, detailed environment,
soft pastel colors, peaceful atmosphere
```

시간대 변형: `morning sunlight` / `afternoon golden hour` / `evening orange sunset` / `night with fluorescent lights`

### 복도
```
korean school hallway, long corridor with lockers,
window light casting shadows, shoe lockers visible,
clean tiled floor, [시간대] atmosphere,
anime background style, no characters, perspective view
```

### 학원
```
korean private academy (hagwon) classroom, small desks packed tightly,
whiteboard with math equations, fluorescent lighting,
cramped but organized space, evening atmosphere,
anime background style, no characters
```

### 집 (거실/식탁)
```
korean apartment living room with dining table,
warm family atmosphere, rice cooker and side dishes on table,
cozy lighting, TV in background, lived-in feeling,
anime background style, no characters, warm color palette
```

### 공원
```
korean neighborhood park, bench under cherry blossom trees,
walking path, playground in distance, [계절] atmosphere,
anime background style, no characters, peaceful scenery
```

계절: `spring with pink cherry blossoms` / `summer with lush green trees` / `autumn with orange falling leaves` / `winter with bare branches and light snow`

### 편의점
```
korean convenience store interior at night,
bright fluorescent lighting, snack shelves, drink cooler,
small eating counter by window, warm atmosphere outside dark,
anime background style, no characters
```

### 도서관
```
korean public library interior, tall bookshelves,
quiet study area with desk lamps, warm afternoon light from windows,
peaceful and studious atmosphere,
anime background style, no characters
```

---

## 7. UI 요소

파일 위치: `ui/[이름].png` (투명 배경 권장)

이것은 AI보다 Figma/직접 제작이 적합합니다. 참고용으로만 기록:

- `ui/card_study.png` — 공부 카테고리 아이콘
- `ui/card_exercise.png` — 운동 카테고리 아이콘
- `ui/card_social.png` — 관계 카테고리 아이콘
- `ui/card_talent.png` — 자기계발 아이콘
- `ui/card_rest.png` — 휴식 아이콘

---

## 생성 순서 (우선순위)

### 1차 (핵심, 즉시 필요)
1. player_neutral.png — 메인 화면 기본
2. player_happy.png — 좋은 결과
3. player_sad.png — 나쁜 결과
4. jihun_happy.png — 이벤트용
5. subin_neutral.png — 이벤트용
6. backgrounds/classroom_afternoon.png — 기본 배경

### 2차 (이벤트 보강)
7. player_tired.png, player_burnout.png
8. jihun_neutral.png, jihun_sad.png
9. minjae_happy.png, minjae_neutral.png
10. yuna_neutral.png, yuna_shy.png
11. backgrounds/park_spring.png
12. backgrounds/home_evening.png

### 3차 (완성도)
13. 나머지 캐릭터 표정 전부
14. 나머지 배경 전부
15. 계절/시간대 변형
