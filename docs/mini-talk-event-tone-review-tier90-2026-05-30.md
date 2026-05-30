# tier90 톤 검증 발주 (2026-05-30)

대상: 친밀도 **90 단계(코어)** 미니 이벤트 시드 6개 (`game/src/engine/talkData.ts`, #203 머지본).
검증 흐름: **2~3개 AI 공통 교체추천 NPC만 실제 교체.** 본문 교체 후보가 없으면 메모리 메타/소품 수정만 검토.
※ tier90은 importance 5(엔딩 회상 최강 가중치)라 **tier70보다 엄격하게** — "통과권"이 아니라 "이 한 장면이 7년 후 그 NPC의 대표 기억으로 떠올라도 좋은가"가 기준.

---

## 게임 배경 (판단 기준)
- 한국 12세(초6)→18세(고3) 7년. NPC와 친밀도 0~100. 미니 이벤트 = "말 걸기" 시 발동, **선택지 없음**, NPC당 평생 1회.
- 30=가벼운 호의 / 50=둘만의 코드 / 70=속마음 한 조각(균열, 다시 일상) / **90=그 NPC를 "그 NPC답게" 만드는 결정적 전환점. 7년 후 엔딩 회상(importance 5)으로 떠오를 한 장면.**

## 검증 기준 (각 시드 통과/경계/교체추천 판정 + 근거)
1. **절제** — 90이라도 시끄럽지 않게. 멜로드라마·눈물 클라이맥스·장황한 독백 금지. 무게는 감정 폭발이 아니라 **행동/관계 인식의 변화**로.
2. **70 vs 90 차별화** — 70은 스스로 멈추는 균열, 90은 정체성·관계·미래가 걸린 전환점. 같은 갈등 반복이면 감점.
3. **회피 가드 준수** (위반 시 탈락):
   - minjae: **기대·성적·가족·공부 축 전면 금지** (30·50·70 누적).
   - junha: **부산·향수·정체성·사투리 주제·음식 축 전면 금지** (사투리 어조는 voice로만 OK).
   - haeun: 정지공간(자판기·창문·계단참) 금지, 다른 공간/구도. (Y6 졸업 시점 = 캐릭터 사실로 허용)
   - yuna: 음악/소리/연주 감각 축 **복귀 필수** (단 "칭찬 압박" 반복 금지).
4. **"너이기 때문에"** — 무리/세상엔 안 보이고 플레이어에게만 보여주는 결인가.
5. **캐릭터 일치** — 다른 NPC에 대입해도 무이질감이면 = 고유색 휘발 = ⚠️.
6. **메모리 메타 정합성** — `category`/`toneTag`가 장면과 맞는가. `recallText` 20~35자, **스탯 단어 금지**.
7. **시스템 제약** — 선택지 없음 / 게임에 없는 시스템(선물·사진) 가정 없음 / 학년종속 용어(야자·수능·대학) 없음.

### 유효값 (닫힌 타입 — 임의값 제안 금지)
- `category`: courage | betrayal | reconciliation | failure | discovery | growth | bypass | unspoken_debt
- `toneTag`: warm | regret | resolve | breakthrough | melancholy | burden
- `stats` 키: academic | social | talent | mental | health

### NPC별 기존 30/50/70 (이 결 반복은 감점)
- jihun: 운동(30)/떡볶이 식성(50)/사물함 "잘하고 싶다" 자기인식(70)
- subin: 문제풀이(30)/접힌 문장(50)/거실 불빛 가정사 암시(70)
- minjae: 노트(30)/오답 세모(50)/뒤집은 휴대폰 기대압박(70)
- yuna: 추천곡(30)/즉흥 멜로디(50)/분필가루 칭찬압박(70)
- haeun: 자판기 콜라(30)/복도 창문(50)/계단참 "아는 척의 피로"(70)
- junha: 주먹밥(30)/부산 바람(50)/식판 사투리=정체성(70)

---

## 검증 대상 시드 6개 (현재 머지본)

### 1) jihun — talk_jihun_90_bench (growth / warm)
- description: "넌 왜 힘들 때 더 실실 웃냐. 바보같이." / 매점 평상, 지훈이가 말없이 이온 음료를 네 이마에 대어 온다. "나한텐 힘든 척해도 돼. 내가 힘은 세니까, 대충 다 받아줄 수 있어." 앞만 보며 툭 던지는 목소리에 서툰 다정함이 묻어 있다.
- effects: intimacy +5, mental +2, fatigue -2
- message: 지훈이가 장난 대신 기댈 어깨를 내밀었다.
- recallText: 매점 평상에서 지훈이가 툭 내밀던 서툰 다정함.

### 2) subin — talk_subin_90_two_names (discovery / melancholy)
- description: "우리 집 문패엔 이름이 두 개면 돼. 엄마랑 나." / 수빈이는 웃는 얼굴을 조금 늦게 꺼낸다. "이상한 얘기처럼 안 듣는 사람이 필요했는데, 네가 그랬어."
- effects: intimacy +5, mental +1, social +1, fatigue -1
- message: 수빈이가 자기 집의 모양을 처음으로 보여줬다.
- recallText: 수빈이가 두 이름의 집을 말하던 순간.

### 3) minjae — talk_minjae_90_nocrown (reconciliation / breakthrough)  ⚠️회피가드: 기대·성적·가족·공부 금지
- description: "내가 너한테 이긴 척했던 날들... 사실은 지기 싫어서가 아니라, 들키기 싫어서였어." / 빈 강당 무대 아래, 민재가 네 쪽으로 고개를 조금 숙인다.
- effects: intimacy +5, social +2, mental +1
- message: 민재가 이긴 척의 이름을 내려놓았다.
- recallText: 민재가 이긴 척의 이름을 내려놓던 순간.

### 4) yuna — talk_yuna_90_wrong_note (growth / breakthrough)  ⚠️회피가드: 음악 축 복귀 필수
- description: "방금 음, 틀렸는데... 그냥 둘래." / 유나는 악보 위에 지우개를 올려두고도 쓰지 않는다. "이상하게 들려도, 지금 내 소리 같아서."
- effects: intimacy +5, talent +1, mental +2, fatigue +1
- message: 유나가 완벽한 음보다 자기 소리를 골랐다.
- recallText: 유나가 틀린 음을 지우지 않던 순간.

### 5) haeun — talk_haeun_90_empty_line (growth / resolve)  ⚠️회피가드: 정지공간 금지 / yearMin:6 졸업 시점
- description: "마지막 줄은 비워둘게. 네가 나중에 쓰면 돼." / 졸업을 앞둔 강당, 하은 선배가 짧은 쪽지를 접지 않은 채 건넨다. "내 말로 끝나면, 그건 네 얘기가 아니니까."
- effects: intimacy +5, mental +2, talent +1, fatigue -1
- message: 하은 선배가 답 대신 네가 채울 여백을 남겼다.
- recallText: 하은 선배가 마지막 줄을 비워두던 순간.

### 6) junha — talk_junha_90_umbrella (growth / warm)  ⚠️회피가드: 부산·향수·정체성·사투리주제·음식 금지
- description: "비 오면 그냥 뛰면 된다 했는데, 같이 있으니까 속도를 맞춰야 되더라." / 준하는 우산 손잡이를 네 쪽으로 조금 더 기울인다. "혼자 빨리 가는 거, 별로 멋있는 일 아이더라."
- effects: intimacy +5, social +1, mental +2, fatigue -1
- message: 준하가 혼자 앞서가는 대신 네 걸음에 속도를 맞췄다.
- recallText: 준하가 네 걸음에 속도를 맞추던 순간.

---

## 출력 요청
NPC 6명 각각에 대해:
1. **판정**: 통과 / 경계 / 교체추천 (셋 중 하나)
2. **근거**: 검증 기준 1~7 중 어디에 걸리는지 1~3줄.
3. (경계/교체추천이면) **구체 수정 방향** 1~2줄. 단 정답지를 베끼지 말고 방향만.
특히 **회피 가드 위반 여부**(minjae/yuna/haeun/junha)와 **메모리 메타 정합성**(category/toneTag가 장면과 맞나)을 반드시 짚어 주세요.
