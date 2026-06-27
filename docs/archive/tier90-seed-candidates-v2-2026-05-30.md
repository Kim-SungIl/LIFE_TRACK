# tier90 시드 후보 v2 — NPC당 3안 (2026-05-30)

발주: `docs/tier90-prompt-v2-2026-05-30.md` (레스-프리스크립티브, NPC당 뻔1+의외2)
채택: 4자(codex/cursor/GPT/Gemini) × 3안 → NPC별 12후보 중 사용자 1개 채택

## ⚠️ 통합 시 수정 필요 (확정 결정 + 발견)
- **학년 게이팅**: MiniTalkEvent에 yearMin/condition 추가 — haeun=Y6(졸업), jihun 진로안 채택 시 Y5+
- **cursor 스탯 키 오류**: cursor v2가 courage/empathy/focus/creativity/resilience/wisdom 등 **존재하지 않는 Stats 키** 사용 → 채택 시 academic/social/talent/mental/health로 교정 필요. (codex는 유효 스탯)
- **cursor '해은' 오타** → '하은'

---

## 🔵 codex (OpenAI) — NPC당 3안
### jihun

```typescript
// 축/의외성: 뻔한 정답 - 운동 진로 앞에서 "뛰는 사람"보다 "곁에 남는 사람"을 고르는 장면.
{
  id: 'talk_jihun_90_courtline',
  npcId: 'jihun', intimacyMin: 90,
  description: '텅 빈 체육관 바닥에 지훈이 지원서 봉투를 놓는다. "나 이거 내긴 낼 건데, 네가 모르는 데까지 혼자 뛰진 않을 거야." 그는 공 대신 네 가방끈을 툭 정리한다.',
  effects: { intimacy: 5, stats: { health: 2, mental: 1 }, fatigue: 1 },
  message: '지훈은 앞만 보던 속도를 조금 늦췄다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'resolve',
    recallText: '지훈이 공 대신 내 가방끈을 고쳤다',
    npcIds: ['jihun'],
  },
}

// 축/의외성: 의외안 - 게임 리더십을 통해 "단순한 애"가 책임을 설계하는 사람으로 보이는 장면.
{
  id: 'talk_jihun_90_lastquest',
  npcId: 'jihun', intimacyMin: 90,
  description: 'PC방 화면 속 파티가 전멸 직전인데, 지훈은 마우스를 내려놓고 네 화면부터 본다. "이 판은 져도 돼. 근데 너 혼자 욕먹는 건 싫다."',
  effects: { intimacy: 5, stats: { social: 2, mental: 1 }, fatigue: -1 },
  message: '지훈의 장난스러운 손이 가장 먼저 방패가 됐다.',
  memorySlotDraft: {
    category: 'courage',
    importance: 5,
    toneTag: 'warm',
    recallText: '진 판보다 먼저 내 이름을 지켜줬다',
    npcIds: ['jihun'],
  },
}

// 축/의외성: 의외안 - 분식/운동이 아닌 생활 돌봄, 말보다 행동으로 관계를 확정하는 장면.
{
  id: 'talk_jihun_90_crosswalk',
  npcId: 'jihun', intimacyMin: 90,
  description: '비 오는 횡단보도 앞, 지훈이 자기 우산을 옆으로 기울인다. "나 원래 대충 사는데, 너 젖는 건 좀 계산하게 되더라." 초록불이 켜져도 그는 네 보폭에 맞춘다.',
  effects: { intimacy: 5, stats: { social: 1, mental: 2 }, fatigue: -1 },
  message: '지훈의 배려는 늘 한 박자 늦게, 정확히 도착했다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '초록불 앞에서 지훈이 보폭을 맞췄다',
    npcIds: ['jihun'],
  },
}
```

### subin

```typescript
// 축/의외성: 뻔한 정답 - 문장과 무대, 모두와 잘 지내는 수빈이 한 사람에게만 읽어주는 핵심 장면.
{
  id: 'talk_subin_90_emptyreading',
  npcId: 'subin', intimacyMin: 90,
  description: '비어 있는 발표실에서 수빈이 접지 않은 원고를 편다. "사람들 앞에서 읽을 건 많은데, 이건 너한테 먼저 읽어야 할 것 같아서." 목소리는 작지만 끝까지 흔들리지 않는다.',
  effects: { intimacy: 5, stats: { talent: 2, mental: 1 }, fatigue: 1 },
  message: '수빈의 문장은 처음으로 박수보다 한 사람을 향했다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '수빈이 접지 않은 원고를 내게 읽었다',
    npcIds: ['subin'],
  },
}

// 축/의외성: 의외안 - 외향성이 아니라 "빠지는 용기", 관계의 중심에서 물러나는 장면.
{
  id: 'talk_subin_90_unjoined',
  npcId: 'subin', intimacyMin: 90,
  description: '소란스러운 모임 문 앞에서 수빈이 손잡이를 잡고도 들어가지 않는다. "오늘은 내가 없으면 어떻게 되는지 보고 싶어. 대신 너랑 조용히 걷자."',
  effects: { intimacy: 5, stats: { mental: 2, social: 1 }, fatigue: -1 },
  message: '수빈은 모두의 가운데가 아닌 자기 자리에서 숨을 골랐다.',
  memorySlotDraft: {
    category: 'courage',
    importance: 5,
    toneTag: 'resolve',
    recallText: '수빈이 문 앞에서 자기 자리를 골랐다',
    npcIds: ['subin'],
  },
}

// 축/의외성: 의외안 - 말 많은 캐릭터가 빈칸을 인정하는 장면, 문장보다 침묵이 핵심.
{
  id: 'talk_subin_90_blankline',
  npcId: 'subin', intimacyMin: 90,
  description: '운동장 스탠드 끝에서 수빈이 공책 한쪽을 보여준다. 제목도 본문도 비어 있다. "오늘은 멋진 말 안 만들래. 네 옆에 빈칸으로 있어도 되지?"',
  effects: { intimacy: 5, stats: { mental: 2 }, fatigue: -2 },
  message: '수빈의 가장 솔직한 문장은 쓰이지 않았다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'melancholy',
    recallText: '수빈의 빈칸이 이상하게 선명했다',
    npcIds: ['subin'],
  },
}
```

### minjae

```typescript
// 축/의외성: 뻔한 정답 - 공부·성적 없이, 위악적 자랑 대신 자기 손의 실수를 받아들이는 장면.
{
  id: 'talk_minjae_90_brokenpot',
  npcId: 'minjae', intimacyMin: 90,
  description: '화단 앞에서 민재가 금 간 화분을 손바닥으로 받치고 있다. "내가 깨뜨렸어. 완벽하게 숨길 수도 있었는데, 오늘은 그냥 붙여 보려고."',
  effects: { intimacy: 5, stats: { mental: 2, social: 1 }, fatigue: 1 },
  message: '민재는 처음으로 망가진 것을 자기 이름으로 들었다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'resolve',
    recallText: '민재가 금 간 화분을 숨기지 않았다',
    npcIds: ['minjae'],
  },
}

// 축/의외성: 의외안 - 남을 이기는 사람이 아니라 길 잃은 것을 끝까지 기다리는 사람으로 전환.
{
  id: 'talk_minjae_90_lostkitten',
  npcId: 'minjae', intimacyMin: 90,
  description: '골목 배수구 옆에서 민재가 웅크린 채 손등을 내민다. "빨리 해결하는 건 잘하는데, 기다리는 건 못하거든. 그래서 지금 연습 중이야."',
  effects: { intimacy: 5, stats: { mental: 2 }, fatigue: 1 },
  message: '민재의 조급함이 처음으로 누군가의 속도에 맞춰졌다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '민재가 작은 숨 앞에서 오래 기다렸다',
    npcIds: ['minjae'],
  },
}

// 축/의외성: 의외안 - 자랑의 언어를 버리고 사과를 선택하는 관계 장면.
{
  id: 'talk_minjae_90_nocrown',
  npcId: 'minjae', intimacyMin: 90,
  description: '빈 강당 무대 아래, 민재가 네 쪽으로 고개를 조금 숙인다. "내가 너한테 이긴 척했던 날들, 사실은 지기 싫어서가 아니라 들키기 싫어서였어."',
  effects: { intimacy: 5, stats: { social: 2, mental: 1 }, fatigue: 0 },
  message: '민재의 말끝에서 처음으로 왕관이 내려왔다.',
  memorySlotDraft: {
    category: 'reconciliation',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '민재가 이긴 척의 이름을 내려놓았다',
    npcIds: ['minjae'],
  },
}
```

### yuna

```typescript
// 축/의외성: 뻔한 정답 - 피아노, 완성된 곡보다 자기 소리를 선택하는 핵심 장면.
{
  id: 'talk_yuna_90_openending',
  npcId: 'yuna', intimacyMin: 90,
  description: '음악실 피아노 앞에서 유나가 악보 마지막 줄을 치지 않는다. "여기부터는 내가 만들래." 잠깐의 쉼 뒤, 낯선 화음이 조용히 이어진다.',
  effects: { intimacy: 5, stats: { talent: 2, mental: 1 }, fatigue: 1 },
  message: '유나는 정답처럼 닫힌 마디를 자기 손으로 열었다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '유나가 마지막 줄 뒤를 직접 만들었다',
    npcIds: ['yuna'],
  },
}

// 축/의외성: 의외안 - 연주보다 조율, 들리지 않던 어긋남을 고치는 감각 장면.
{
  id: 'talk_yuna_90_tuningfork',
  npcId: 'yuna', intimacyMin: 90,
  description: '유나가 피아노 뚜껑을 열고 낮은 건반 하나를 반복해서 누른다. "삐끗한 소리도 계속 들으면 정들어. 그래도 오늘은 맞춰 주고 싶어."',
  effects: { intimacy: 5, stats: { talent: 2 }, fatigue: 0 },
  message: '유나는 빛나는 음보다 어긋난 울림을 먼저 들었다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '유나가 어긋난 한 음을 오래 들었다',
    npcIds: ['yuna'],
  },
}

// 축/의외성: 의외안 - 무대 밖 생활 소리를 음악으로 받아들이는 장면.
{
  id: 'talk_yuna_90_rainrhythm',
  npcId: 'yuna', intimacyMin: 90,
  description: '처마 밑 빗소리에 맞춰 유나가 손가락으로 난간을 두드린다. "이런 건 아무도 점수 안 매기잖아. 그래서 더 정확히 듣고 싶어."',
  effects: { intimacy: 5, stats: { talent: 1, mental: 2 }, fatigue: -1 },
  message: '유나의 음악은 건반 밖에서도 계속 숨 쉬었다.',
  memorySlotDraft: {
    category: 'courage',
    importance: 5,
    toneTag: 'resolve',
    recallText: '빗소리 위에서 유나의 박자가 생겼다',
    npcIds: ['yuna'],
  },
}
```

### haeun

```typescript
// 축/의외성: 뻔한 정답 - 졸업식, 정지공간이 아니라 사람들 사이를 통과하며 남기는 위로.
{
  id: 'talk_haeun_90_graduationgate',
  npcId: 'haeun', intimacyMin: 90,
  description: '졸업식 뒤 교문 앞, 하은이 북적이는 인파를 지나 네 옆에 선다. "괜찮다는 말, 이제 네가 네 목소리로 해도 돼." 리본 끝이 바람에 살짝 흔들린다.',
  effects: { intimacy: 5, stats: { mental: 2, social: 1 }, fatigue: -1 },
  message: '하은의 위로는 마지막까지 네 목소리를 남겼다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'melancholy',
    recallText: '교문 앞에서 하은이 내 목소리를 돌려줬다',
    npcIds: ['haeun'],
  },
}

// 축/의외성: 의외안 - 운동장 트랙을 함께 걷는 이동 구도, 위로가 방향 감각으로 바뀜.
{
  id: 'talk_haeun_90_trackwalk',
  npcId: 'haeun', intimacyMin: 90,
  description: '운동장 트랙을 한 바퀴 도는 동안 하은은 거의 말하지 않는다. 마지막 곡선에서만 낮게 말한다. "멈춘 줄 알았는데, 걷고 있었네. 너도."',
  effects: { intimacy: 5, stats: { health: 1, mental: 2 }, fatigue: -1 },
  message: '하은은 위로를 설명하지 않고 한 바퀴의 속도로 남겼다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '하은과 걷던 곡선이 오래 남았다',
    npcIds: ['haeun'],
  },
}

// 축/의외성: 의외안 - 버스 안의 이동과 이별감, 아는 척의 피로가 아니라 선택된 동행.
{
  id: 'talk_haeun_90_lastbus',
  npcId: 'haeun', intimacyMin: 90,
  description: '늦은 버스 맨 뒤, 하은이 창밖 대신 네 손목시계를 본다. "내릴 곳 지나치면 말해. 오늘은 내가 먼저 알아챌게." 정류장 불빛이 천천히 밀려온다.',
  effects: { intimacy: 5, stats: { mental: 2 }, fatigue: -2 },
  message: '하은은 조용히 누군가의 도착지를 살피는 사람이었다.',
  memorySlotDraft: {
    category: 'reconciliation',
    importance: 5,
    toneTag: 'melancholy',
    recallText: '하은이 내릴 곳을 먼저 보고 있었다',
    npcIds: ['haeun'],
  },
}
```

### junha

```typescript
// 축/의외성: 뻔한 정답 - 전학생의 적응이 아니라, 낯선 상황에서 먼저 앞에 서는 장면.
{
  id: 'talk_junha_90_blackout',
  npcId: 'junha', intimacyMin: 90,
  description: '강당 조명이 꺼지자 주변이 술렁인다. 준하가 네 앞에 서서 휴대폰 불빛을 낮게 켠다. "괜찮다. 큰소리 낼 필요 없제. 천천히 나가면 된다."',
  effects: { intimacy: 5, stats: { social: 2, mental: 1 }, fatigue: 0 },
  message: '준하는 낯선 어둠 앞에서도 사람들의 길을 먼저 봤다.',
  memorySlotDraft: {
    category: 'courage',
    importance: 5,
    toneTag: 'resolve',
    recallText: '불 꺼진 강당에서 준하가 앞에 섰다',
    npcIds: ['junha'],
  },
}

// 축/의외성: 의외안 - 음식·향수 없이, 손재주와 집중으로 관계를 붙드는 장면.
{
  id: 'talk_junha_90_loosescrew',
  npcId: 'junha', intimacyMin: 90,
  description: '덜컹거리는 책상 다리를 준하가 동전으로 조인다. "새거 아니어도 된다 아이가. 흔들리는 거, 같이 잡으면 좀 낫다." 그는 네가 누르는 쪽을 기다린다.',
  effects: { intimacy: 5, stats: { mental: 1, social: 2 }, fatigue: -1 },
  message: '준하는 큰 약속 대신 흔들림 하나를 같이 붙잡았다.',
  memorySlotDraft: {
    category: 'reconciliation',
    importance: 5,
    toneTag: 'warm',
    recallText: '준하와 흔들리는 책상을 같이 눌렀다',
    npcIds: ['junha'],
  },
}

// 축/의외성: 의외안 - 말투는 유지하되 주제는 규칙과 공정함, 조용한 반항의 장면.
{
  id: 'talk_junha_90_chalkline',
  npcId: 'junha', intimacyMin: 90,
  description: '운동장에 흐릿한 출발선이 남아 있다. 준하가 분필로 선을 다시 긋는다. "누가 빠르든, 시작선은 똑같아야 안 되겠나." 그는 네 쪽 선까지 맞춘다.',
  effects: { intimacy: 5, stats: { health: 1, mental: 2 }, fatigue: 1 },
  message: '준하는 이기는 일보다 같은 선에 서는 일을 먼저 골랐다.',
  memorySlotDraft: {
    category: 'courage',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '준하가 흐린 출발선을 다시 그었다',
    npcIds: ['junha'],
  },
}
```

## 🟣 cursor (Claude sonnet) — NPC당 3안 (스탯키 오류 주의)
각 NPC별 3안 + 메모를 작성합니다.

---

## jihun

> **안 A — 뻔한 정답 | 축: 진로 결심 / 밤 체육관 / 긴장 속 신뢰**

```typescript
{
  id: 'talk_jihun_90_lastshot',
  npcId: 'jihun', intimacyMin: 90,
  description: '밤 체육관. 혼자 슛 연습을 하던 지훈이 발소리를 듣고 멈춘다. "특기생 지원서 냈어. 너한테만 말하는 거야." 공을 손에서 놓지 않은 채 말한다.',
  effects: { intimacy: 5, stats: { courage: 2 }, fatigue: 0 },
  message: '그 말이 여기까지 왔다는 뜻이다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'resolve',
    recallText: '밤 체육관, 지훈이 공을 쥔 채 처음으로 진짜 말을 건넸다.',
    npcIds: ['jihun'],
  },
}
```

---

> **안 B — 의외 | 축: 우정의 균열 인식 / 옥상 / 솔직한 혼란**
> 활발한 지훈이 "어색하다"는 말을 먼저 꺼내는 취약함 — 관계 전환점이 운동이 아닌 둘 사이에 있음.

```typescript
{
  id: 'talk_jihun_90_distance',
  npcId: 'jihun', intimacyMin: 90,
  description: '옥상 난간에 기대 지훈이 불쑥 묻는다. "우리 요즘 어색하지 않아?" 대답을 기다리지 않고 "나만 그런가." 하고 웃는다.',
  effects: { intimacy: 5, stats: { empathy: 2 }, fatigue: -1 },
  message: '어색하다고 말할 수 있는 사이라는 것.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'melancholy',
    recallText: '지훈이 어색하다고 먼저 말한 날, 옥상 하늘이 흐렸다.',
    npcIds: ['jihun'],
  },
}
```

---

> **안 C — 의외 | 축: 포기/선택(게임→운동) / PC방 / 담담한 전환**
> 화려한 선언 없이 일상 공간에서 진로가 결정되는 절제 — 말의 무게가 행간에 있음.

```typescript
{
  id: 'talk_jihun_90_quitgame',
  npcId: 'jihun', intimacyMin: 90,
  description: 'PC방. 지훈이 화면을 끄고 일어선다. "나 이거 재미없어졌어." 덧붙이지 않는다. 둘 다 그 말이 무슨 뜻인지 안다.',
  effects: { intimacy: 5, stats: { focus: 1 }, fatigue: -2 },
  message: '무언가를 그만두는 것도 선택이다.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'resolve',
    recallText: 'PC방 모니터가 꺼지던 순간, 지훈이 뭔가를 정한 얼굴이었다.',
    npcIds: ['jihun'],
  },
}
```

---

## subin

> **안 A — 뻔한 정답 | 축: 숨겨진 글쓰기 공개 / 텅 빈 교실 / 조용한 신뢰**

```typescript
{
  id: 'talk_subin_90_sharedpage',
  npcId: 'subin', intimacyMin: 90,
  description: '텅 빈 교실. 수빈이 노트 한 페이지를 찢어 건넨다. "이거 아무한테도 안 보여줬어." 설명 없이. 읽으라는 건지 모르라는 건지 모를 얼굴이다.',
  effects: { intimacy: 5, stats: { empathy: 2 }, fatigue: -1 },
  message: '건네는 것 자체가 말이었다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '수빈이 노트 한 장을 건넸다, 아무런 설명도 없이.',
    npcIds: ['subin'],
  },
}
```

---

> **안 B — 의외 | 축: 외향형의 선택적 고독 / 복도 / 능동적 선택**
> 어디서든 어울리는 수빈이 처음으로 무리를 두고 "너만"을 고르는 — 사교성이 선택임을 드러내는 전환점.

```typescript
{
  id: 'talk_subin_90_chooseyou',
  npcId: 'subin', intimacyMin: 90,
  description: '수빈이 무리와 함께 가다가 멈춰 선다. "나 오늘 그냥 너랑만 있을래." 아무한테도 설명 안 하고 돌아선다.',
  effects: { intimacy: 5, stats: { resilience: 1 }, fatigue: -2 },
  message: '어울리는 사람이 혼자를 고를 때.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'warm',
    recallText: '수빈이 무리를 두고 그냥 옆에 남아 있었다.',
    npcIds: ['subin'],
  },
}
```

---

> **안 C — 의외 | 축: 이사 예고/변화 / 버스 / 절제된 불안**
> 70에서 거실 불빛으로 암시됐던 가정 사정이 실질적 변화로 드러남 — 공간도 이동 중이라 "흔들림" 자체가 장면.

```typescript
{
  id: 'talk_subin_90_moving',
  npcId: 'subin', intimacyMin: 90,
  description: '방과 후 버스 안. 수빈이 창밖을 보다가 말한다. "엄마가 이사 얘기 꺼냈어." 더 말하지 않는다. 창에 비친 얼굴은 아직 결정되지 않은 표정이다.',
  effects: { intimacy: 5, stats: { resilience: 1 }, fatigue: 1 },
  message: '말하지 않은 부분이 더 크다는 걸 알았다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'melancholy',
    recallText: '버스 창에 비친 수빈 얼굴, 이사 얘기를 꺼내던 날.',
    npcIds: ['subin'],
  },
}
```

---

## minjae

*(기대·성적·가족·공부 축 전면 회피)*

> **안 A — 뻔한 정답 | 축: 위악 뒤 배려 들킴 / 복도 / 역설적 따뜻함**

```typescript
{
  id: 'talk_minjae_90_caughtcaring',
  npcId: 'minjae', intimacyMin: 90,
  description: '복도. 민재가 딴청 피우며 지나가다가 돌아선다. "아까 그 새끼한테 왜 아무 말 못 했어." 화난 척인데 목소리가 낮다.',
  effects: { intimacy: 5, stats: { courage: 1 }, fatigue: -1 },
  message: '위악도 쌓이면 진심이 보인다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '민재가 화난 척으로 걱정을 말한 날, 복도.',
    npcIds: ['minjae'],
  },
}
```

---

> **안 B — 의외 | 축: 약자 보호/선 긋기 / 교실 / 냉정한 용기**
> 성적·공부와 전혀 무관한 맥락에서 드러나는 민재의 선함 — 위악이 실은 선명한 기준 위에 있다는 것.

```typescript
{
  id: 'talk_minjae_90_hardline',
  npcId: 'minjae', intimacyMin: 90,
  description: '교실. 누군가가 반 아이를 놀리는 상황. 민재가 교과서도 안 내려놓은 채 "그만 해."라고 한마디 한다. 아무도 이유를 묻지 않는다.',
  effects: { intimacy: 5, stats: { courage: 2 }, fatigue: 1 },
  message: '선을 긋는 사람이 있다는 것.',
  memorySlotDraft: {
    category: 'courage',
    importance: 5,
    toneTag: 'resolve',
    recallText: '민재가 "그만 해" 한마디를 한 날, 아무도 이유를 몰랐다.',
    npcIds: ['minjae'],
  },
}
```

---

> **안 C — 의외 | 축: 먼저 사과 / 방과 후 교실 / 위악 균열**
> 70에서 뒤집혀 있던 폰이 화면을 위로 향한 채 등장 — 상징의 역전. 위악형이 먼저 손을 내미는 유일한 장면.

```typescript
{
  id: 'talk_minjae_90_apologize',
  npcId: 'minjae', intimacyMin: 90,
  description: '방과 후 교실에 민재 혼자. "어제 말 심하게 했어." 짧게 말하고 다시 책을 펼친다. 책상 위 폰이 화면을 위로 향해 있다.',
  effects: { intimacy: 5, stats: { empathy: 2 }, fatigue: -1 },
  message: '사과를 먼저 한다는 것의 무게.',
  memorySlotDraft: {
    category: 'reconciliation',
    importance: 5,
    toneTag: 'regret',
    recallText: '민재가 먼저 사과하던 날, 폰 화면이 위를 보고 있었다.',
    npcIds: ['minjae'],
  },
}
```

---

## yuna

*(90은 음악/소리/연주 감각 축 복귀 — 칭찬 압박 반복 금지)*

> **안 A — 뻔한 정답 | 축: 관객 없는 연주 / 음악실 / 해방**

```typescript
{
  id: 'talk_yuna_90_justplaying',
  npcId: 'yuna', intimacyMin: 90,
  description: '음악실. 유나가 아무도 없는 줄 알고 치다가 플레이어를 발견한다. 멈추지 않는다. 악보 없이 치는 손. 관객을 위한 게 아닌 연주다.',
  effects: { intimacy: 5, stats: { creativity: 2 }, fatigue: -2 },
  message: '들키고도 계속 치는 사람.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '유나가 들켜도 멈추지 않고 계속 치던 날.',
    npcIds: ['yuna'],
  },
}
```

---

> **안 B — 의외 | 축: 일상 소리에서 음악 듣기 / 급식실 창가 / 감각적 충만**
> 악기도 악보도 없이 드러나는 음악적 감각 — 연주가 아닌 "듣는 능력"이 유나의 본질임을 보여줌.

```typescript
{
  id: 'talk_yuna_90_everydaysound',
  npcId: 'yuna', intimacyMin: 90,
  description: '급식실 창 밖. 유나가 빗소리를 세고 있다. "4박자야." 피아노도 없고 악보도 없는데 손가락이 무릎을 두드린다.',
  effects: { intimacy: 5, stats: { creativity: 1, focus: 1 }, fatigue: -1 },
  message: '어디서나 음악을 듣는 사람과 있다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '유나가 빗소리에서 박자를 셌다, 손가락이 무릎을 두드렸다.',
    npcIds: ['yuna'],
  },
}
```

---

> **안 C — 의외 | 축: 실수 수용/연주의 흐름 / 음악실·복도 / 해방적 수용**
> 완벽주의 유나가 틀린 음표를 그냥 흘려보내는 — 압박이 아닌 음악 안에서 이루어지는 성장.

```typescript
{
  id: 'talk_yuna_90_wrongnote',
  npcId: 'yuna', intimacyMin: 90,
  description: '음악실 복도. 유나가 틀린 부분을 다시 치지 않는다. "그냥 계속 가는 거야." 멈추지 않는 연주 소리가 복도까지 들린다.',
  effects: { intimacy: 5, stats: { resilience: 2 }, fatigue: -1 },
  message: '틀려도 이어지는 것.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '틀린 음표 앞에서 유나가 멈추지 않던 날.',
    npcIds: ['yuna'],
  },
}
```

---

## haeun

*(90은 자판기·창문·계단참 이외 공간 — 정지 구도 탈피)*

> **안 A — 뻔한 정답 | 축: 졸업 전 학교 밖 첫 만남 / 버스 정류장 / 절제된 작별**

```typescript
{
  id: 'talk_haeun_90_lastmeet',
  npcId: 'haeun', intimacyMin: 90,
  description: '버스 정류장. 해은 선배가 큰 가방을 들고 서 있다. "졸업하면 멀어지는 거 당연한데." 말하다가 멈춘다. 그리고 덧붙인다. "가끔은 아니겠지."',
  effects: { intimacy: 5, stats: { resilience: 2 }, fatigue: 1 },
  message: '멀어진다고 말하면서 남기는 것.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'melancholy',
    recallText: '해은 선배가 버스 정류장에서 "가끔은 아니겠지"라고 했다.',
    npcIds: ['haeun'],
  },
}
```

---

> **안 B — 의외 | 축: 침묵의 언어/오브젝트 전달 / 도서관 / 따뜻한 절제**
> 말 없이 건네는 책 한 권 — 침묵형 선배의 소통 방식 그 자체가 90단계다운 결.

```typescript
{
  id: 'talk_haeun_90_silentgift',
  npcId: 'haeun', intimacyMin: 90,
  description: '도서관 구석. 해은 선배가 다가와 책 한 권을 책상 위에 놓고 간다. 표시된 페이지 하나. 제목도 설명도 없다.',
  effects: { intimacy: 5, stats: { wisdom: 2 }, fatigue: -2 },
  message: '말없이 건넨 것들이 오래 남는다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'warm',
    recallText: '도서관 책상 위, 해은 선배가 놓고 간 표시된 페이지.',
    npcIds: ['haeun'],
  },
}
```

---

> **안 C — 의외 | 축: 멘토의 불확실성/취약함 / 운동장 벤치 / 처음 보는 불안**
> 항상 위로를 건네던 선배가 처음으로 답을 모르는 사람으로 드러남 — 역할이 뒤집히는 전환점.

```typescript
{
  id: 'talk_haeun_90_uncertain',
  npcId: 'haeun', intimacyMin: 90,
  description: '운동장 구석 벤치. 해은 선배가 "나 졸업하면 뭐 될 것 같아?" 묻는다. 진지한 얼굴. 답을 원하는 게 아니라 질문을 꺼낸 사람이 처음 보이는 얼굴이다.',
  effects: { intimacy: 5, stats: { empathy: 2 }, fatigue: 0 },
  message: '강해 보이는 사람이 처음으로 모른다고 하는 날.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'burden',
    recallText: '해은 선배가 "뭐 될 것 같아?"라고 물은 날, 운동장 벤치.',
    npcIds: ['haeun'],
  },
}
```

---

## junha

*(부산·향수·정체성·사투리·음식 주제 전면 회피 — 사투리는 대사 어조로만)*

> **안 A — 뻔한 정답 | 축: 무언의 동행/위로 / 빈 교실 / 따뜻한 존재감**

```typescript
{
  id: 'talk_junha_90_staywithyou',
  npcId: 'junha', intimacyMin: 90,
  description: '빈 교실. 플레이어가 멍하니 있을 때 준하가 들어온다. 아무 말 없이 옆 자리에 앉는다. "그냥 있을게예." 그게 전부다.',
  effects: { intimacy: 5, stats: { resilience: 2 }, fatigue: -2 },
  message: '곁에 있는 게 답이 될 때.',
  memorySlotDraft: {
    category: 'growth',
    importance: 5,
    toneTag: 'warm',
    recallText: '준하가 아무 말 없이 옆자리에 앉은 날.',
    npcIds: ['junha'],
  },
}
```

---

> **안 B — 의외 | 축: 처음으로 꺼내는 꿈 / 옥상 / 설레는 돌파구**
> 음식·고향 없이 드러나는 준하의 새로운 욕망 — 밝음 뒤에 있던 자기 욕구가 처음 표면으로.

```typescript
{
  id: 'talk_junha_90_futuredream',
  npcId: 'junha', intimacyMin: 90,
  description: '옥상. 준하가 "나 사실 하고 싶은 게 생겼는데예." 말하다가 웃는다. 그게 무엇인지 바로 말하지 않는다. 밝음 뒤에 있던 무언가가 처음 나온 얼굴이다.',
  effects: { intimacy: 5, stats: { courage: 1, creativity: 1 }, fatigue: 0 },
  message: '밝은 사람에게도 처음 꺼내는 말이 있다.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'breakthrough',
    recallText: '옥상에서 준하가 처음으로 하고 싶은 걸 말했다.',
    npcIds: ['junha'],
  },
}
```

---

> **안 C — 의외 | 축: 밝음이 선택이었다는 고백 / 체육관 처마(비) / 조용한 자기 인식**
> 타고난 밝음이 아닌 "선택된 밝음"이라는 반전 — 준하의 의지가 처음으로 보이는 장면.

```typescript
{
  id: 'talk_junha_90_chosenbright',
  npcId: 'junha', intimacyMin: 90,
  description: '비 오는 체육관 처마 밑. 준하가 "나 원래 이렇게 밝은 사람 아니었는데예." 아무렇지 않게 말한다. 지금 밝은 건 타고난 게 아니라 선택이다.',
  effects: { intimacy: 5, stats: { wisdom: 2 }, fatigue: 1 },
  message: '밝음도 연습이라는 걸.',
  memorySlotDraft: {
    category: 'discovery',
    importance: 5,
    toneTag: 'resolve',
    recallText: '체육관 처마 밑, 준하가 밝음을 선택했다고 했다.',
    npcIds: ['junha'],
  },
}
```

---

## 전체 요약표

| NPC | 안 | 축 | 장소 | toneTag | 의외성 포인트 |
|---|---|---|---|---|---|
| jihun | A (뻔) | 진로 결심 | 밤 체육관 | resolve | — |
| jihun | B | 우정 균열 인식 | 옥상 | melancholy | 활발한 애가 "어색하다" 먼저 말함 |
| jihun | C | 게임 포기/선택 | PC방 | resolve | 일상 공간에서 말 없이 전환 |
| subin | A (뻔) | 숨긴 글 공개 | 텅 빈 교실 | warm | — |
| subin | B | 외향형의 선택 | 복도 | warm | 사교형이 무리를 두고 "너만" |
| subin | C | 이사 예고 | 버스 | melancholy | 이동 중 공간 + 70 암시의 현실화 |
| minjae | A (뻔) | 위악 뒤 배려 | 복도 | warm | — |
| minjae | B | 약자 보호 | 교실 | resolve | 성적 无, 선함이 기준에서 나옴 |
| minjae | C | 먼저 사과 | 방과 후 교실 | regret | 폰 상징 역전 (70 모티프 반전) |
| yuna | A (뻔) | 관객 없는 연주 | 음악실 | breakthrough | — |
| yuna | B | 일상 소리 감지 | 급식실 창가 | warm | 악기 없이 드러나는 음악 본능 |
| yuna | C | 실수 수용 | 음악실/복도 | breakthrough | 완벽주의가 흐름을 택하는 순간 |
| haeun | A (뻔) | 졸업 전 작별 | 버스 정류장 | melancholy | — |
| haeun | B | 침묵의 오브젝트 | 도서관 | warm | 말 없이 건네는 표시된 페이지 |
| haeun | C | 멘토의 취약함 | 운동장 벤치 | burden | 위로하던 선배가 처음으로 묻는 쪽 |
| junha | A (뻔) | 무언의 동행 | 빈 교실 | warm | — |
| junha | B | 처음 꺼내는 꿈 | 옥상 | breakthrough | 음식/고향 없이 드러나는 욕망 |
| junha | C | 밝음이 선택임 | 체육관 처마 | resolve | 타고난 게 아닌 의지가 보임 |

## 🟢 GPT (수동 v2) — 붙여넣기
_대기_

## 🔴 Gemini (수동 v2) — 붙여넣기
_대기_
