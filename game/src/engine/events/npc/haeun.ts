import { GameEvent } from '../../types';

export const HAEUN_EVENTS = [
  // ===== 하은 이벤트 체인 (중학교 선배 멘토) =====
  {
    id: 'haeun-meet',
    title: '도서관의 선배',
    description: '점심시간에 도서관에 갔다.\n창가 자리에 교복 위에 가디건을 걸친 선배가 앉아 있다.\n책을 읽다가 이쪽을 봤다.\n"1학년이지? 여기 자주 와?"',
    // M5 Phase 3: FOLLOWUP_EVENT라 조건 통과 시 즉시 발동 — week 설정은 무의미
    location: 'library',
    background: 'library_{school}',
    speakers: ['haeun'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return s.year === 2 && !haeun?.met && !s.isVacation;
    },
    choices: [
      // M5 Phase 3: 첫 만남 intimacyChange 5→10 / 7→12 — decay 상쇄 + 후속 이벤트 진입 문턱 보장
      { text: '"네, 가끔요..." — 어색하게 대답한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 8 }],
        message: '"야, 존댓말 하지 마. 어색해." 선배가 웃었다. "나 하은이야. 2학년." 무섭지 않은 선배다.' },
      { text: '"선배는 여기 자주 오세요?" — 말을 건다', effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 10 }],
        message: '"시끄러운 데보다 여기가 좋아서." 선배가 자리를 가리켰다. "앉아. 나 하은이야." 편한 선배다.' },
    ],
  },
  {
    id: 'haeun-advice',
    title: '선배의 조언',
    description: '시험이 다가오는데 정리가 안 된다.\n도서관에서 머리를 잡고 있는데 하은 선배가 옆에 앉았다.\n"어디 막혔어? 보여봐."',
    location: 'library',
    background: 'library_{school}',
    speakers: ['haeun'],
    // M5 Phase 3: intimacy 15→8, 발동 주차 확대 ([6,7,15,16] → [6,7,10,15,16,25,30])
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 8 && s.year === 2 && !s.isVacation
        && [6, 7, 10, 15, 16, 25, 30].includes(s.week);
    },
    choices: [
      { text: '"이거 어떻게 정리해요?" — 노트를 보여준다', effects: { academic: 2, mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 4 }],
        message: '하은 선배가 노트를 쓱 훑더니 "이거 이렇게 묶으면 외우기 쉬워" 하고 정리해줬다. 확실히 1년 먼저 산 사람이다.' },
      { text: '"괜찮아요, 혼자 해볼게요" — 사양한다', effects: { mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 1 }],
        message: '"그래? 막히면 말해." 선배가 자기 자리로 돌아갔다. 도움 받을걸 그랬나.' },
    ],
  },
  {
    id: 'haeun-vending',
    title: '자판기 앞에서',
    description: '방과후 복도. 자판기 앞에서 하은 선배가 동전을 넣고 있다.\n"아, 후배~ 뭐 마실래? 내가 살게."\n별일 아닌 것처럼 웃는다.',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['haeun'],
    // M5 Phase 3: intimacy 25→15 완화
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 15 && (s.year === 2 || s.year === 3) && !s.isVacation;
    },
    choices: [
      { text: '"감사합니다— 아니, 고마워!" — 받아 마신다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }],
        message: '자판기 옆에 기대서 같이 음료를 마셨다. 별 대화는 아닌데, 이 시간이 편하다. "시험 끝나면 뭐 할 거야?" "몰라요." "나도 몰라." 웃었다.' },
      { text: '"제가— 내가 살게!" — 먼저 산다', effects: { social: 1, mental: 2 }, moneyEffect: -1,
        npcEffects: [{ npcId: 'haeun', intimacyChange: 4 }],
        message: '"어? 후배가 선배한테?" 하은이가 놀란 척했다. "고마워. 다음엔 내가 살게." 자판기 앞에서 웃으며 수다를 떨었다.' },
    ],
  },
  {
    id: 'haeun-brother',
    title: '오빠 이야기',
    description: '밤에 카톡이 왔다. 하은 선배다.\n"너 아직 안 잤지?"\n"오빠가 수능 망했거든."\n"그 뒤로 집이 장례식장 같았어."',
    location: 'home',
    background: 'bedroom_night',
    speakers: ['haeun'],
    // M5 Phase 3: intimacy 40→25 완화
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 25 && (s.year === 2 || s.year === 3) && s.week >= 25 && !s.isVacation;
    },
    choices: [
      { text: '"힘들었겠다..." — 들어준다', effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 6 }],
        message: '"오빠가 방에서 안 나오더라. 몇 달째." 한참 뒤에 메시지가 왔다. "너한테 처음 말했다. 고마워."' },
      { text: '"선배 오빠도 다시 괜찮아질 거예요" — 위로한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 4 }],
        message: '"...그랬으면 좋겠다." 마지막 메시지 뒤로 한참 동안 답이 없었다. 나중에 "잘 자" 한 마디가 왔다.' },
      { text: '화제를 돌린다', effects: { social: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 1 }],
        message: '하은이가 "갑자기 무거운 얘기해서 미안" 하고 이모티콘을 보냈다. 웃는 이모티콘인데 왠지 씁쓸했다.' },
    ],
  },
  {
    id: 'haeun-counselor',
    title: '하은이의 꿈',
    description: '점심시간에 하은 선배가 옥상으로 불렀다.\n바람을 맞으며 하은이가 말한다.\n"나 상담사 되고 싶어.\n오빠한테 누가 얘기 들어줬으면 달랐을까... 그런 생각이 들어서."',
    location: 'rooftop',
    background: 'rooftop',
    speakers: ['haeun'],
    // M5 Phase 3: intimacy 50→35 완화
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return !!haeun?.met && haeun.intimacy >= 35 && s.year === 3 && s.week >= 10 && !s.isVacation;
    },
    choices: [
      { text: '"선배한테 딱 맞는 것 같아" — 응원한다', effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 6 }],
        message: '하은이가 웃었다. "진짜? 엄마는 뭔 상담사냐고 했는데..." "선배가 저한테 그랬잖아요. 들어주는 것만으로도 다르다고." 하은이 눈이 살짝 젖었다.' },
      { text: '"밥은 되는 거야?" — 현실적으로 묻는다', effects: { mental: -1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 1 }],
        message: '하은이가 잠깐 멈칫했다. "...부모님이랑 똑같은 말 하네." 웃었지만 좀 쓸쓸해 보였다.' },
      { text: '"같이 고민해보자" — 진지하게 말한다', effects: { social: 1, mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 5 }],
        message: '"너한테 이런 얘기 하는 거 보면 나도 나이 먹었나 봐." 하은이가 바람을 맞으며 웃었다. "고마워. 진짜로."' },
    ],
  },
  {
    id: 'haeun-graduation',
    title: '선배의 졸업',
    description: '졸업식 날.\n강당에서 나오는 하은 선배를 찾았다.\n교복 위에 가디건을 걸친 모습이 처음 만났을 때랑 똑같다.\n"야, 왔어?"',
    week: 46,
    location: 'auditorium',
    background: 'auditorium_middle',
    speakers: ['haeun'],
    // M5 Phase 3-Y: intimacy 20→5 완화 (만난 적만 있으면 졸업식에서 만남)
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return s.year === 3 && !!haeun?.met && haeun.intimacy >= 5;
    },
    choices: [
      { text: '"졸업 축하해요... 아니, 축하해" — 인사한다', effects: { social: 2, mental: 3 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 6 }],
        message: '"고등학교 가면 처음엔 다 낯설어. 근데 한 달만 버텨. 그럼 괜찮아져." 하은이가 웃었다. "네가 걱정돼서 그래." 도서관에서 처음 만났을 때와 같은 웃음이다. 근데 왜 이렇게 아쉽지.' },
      { text: '"선배 없으면 누가 조언해줘요" — 솔직하게 말한다', effects: { mental: 4 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 8 }],
        message: '하은이가 잠깐 말을 잃었다. "...야, 그런 말 하지 마. 울 것 같잖아." 웃으면서 눈을 비볐다. "카톡은 계속 하자. 약속이다." 멘토가 떠나는 건, 생각보다 많이 아프다.' },
    ],
  },
  {
    id: 'haeun-reunion',
    title: '재회',
    description: '고등학교 입학 후 며칠이 지났다.\n복도를 걷는데 낯익은 가디건이 보인다.\n"...어? 너 여기 왔어?!"\n하은 선배가 눈을 크게 뜨고 달려왔다.',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['haeun'],
    // M5 Phase 3: intimacy 30→15 완화
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      return s.year === 5 && !!haeun?.met && haeun.intimacy >= 15 && s.week >= 2 && s.week <= 6;
    },
    choices: [
      { text: '"선배! 같은 학교였어?!" — 반갑게 인사한다', effects: { social: 3, mental: 4 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 6 }],
        message: '"야, 반말해! 이제 같은 학교잖아." 하은이가 웃었다. 1년 만인데 하나도 안 변했다. 아니, 좀 더 어른스러워졌나. 멘토가 아니라 동료가 된 기분이다.' },
      { text: '"어, 안녕..." — 어색하게 인사한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }],
        message: '"뭐야, 1년 만에 보는 건데 그렇게 시큰둥해?" 하은이가 어깨를 쳤다. "점심 같이 먹자. 급식 맛있는 거 알려줄게." 여전히 선배다.' },
    ],
  },
  {
    // 학업 소프트캡(effectiveAcademic: 고교 academic 80 초과분 0.5배)의 "말로 하는" 가시화.
    // 중학교 상위권 스탯도 고교에선 석차가 내려앉는 체감을 하은이 설명한다. 수치·공식은 비노출(질감만).
    // FOLLOWUP_EVENT_IDS 등록(constants.ts) — reunion과 동일하게 윈도우 내 조건 충족 시 100% 확정 발동.
    //   (미등록 시 조건부 랜덤 경로로 빠져 reach 후순위·50%가 됨 — 3자 검수 지적 반영.)
    // 조건: Y5 1학기 첫 중간고사(W8) 직후(W9~16), academic>=80인데 석차가 상위 3위 밖(기대 미달)일 때.
    // 자기노출 수위는 rooftop(t28)/leaving보다 얕게 유지 — "챙기되 자기은폐" 아크 순서 보존.
    id: 'haeun-hs-curve',
    title: '여기 온 애들 절반은',
    description: '고1 첫 시험 성적표를 받아 든 복도. 등수가 생각만큼 안 나왔다. 그 표정을 읽었는지 하은 선배가 옆에 와 선다.\n"중학교 땐 늘 앞이었지?" 옅게 웃는다. "여기 온 애들, 절반이 중학교 때 1등이었어. 나도 그랬고."',
    location: 'hallway',
    background: 'hallway_{school}',
    speakers: ['haeun'],
    condition: (s) => {
      const haeun = s.npcs.find(n => n.id === 'haeun');
      if (!haeun?.met || haeun.intimacy < 26 || s.year !== 5 || s.isVacation) return false;
      if (s.week < 9 || s.week > 16) return false;
      if (s.stats.academic < 80) return false;
      // Y5 첫 중간고사(W8)만 대상 — 윈도우(W9~16)엔 기말(W17)이 아직 없어 midterm으로 충분·의도 명확.
      const exam = s.examResults.find(e => e.year === 5 && e.examType === 'midterm');
      return !!exam && exam.rank !== null && exam.rank > 3;
    },
    choices: [
      { text: '"그럼 여기선 어떻게 해야 해요?"', effects: { academic: 1, mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 4 }],
        message: '"똑같이 해선 똑같은 데 머물러. 여긴 다들 그 똑같이는 하니까." 하은이 어깨를 툭 친다. "근데 그걸 안다는 것부터가 시작이야. 넌 오늘 알았고."',
        memorySlotDraft: { category: 'growth', importance: 5, toneTag: 'breakthrough', recallText: '고1 첫 시험, 여기 절반이 1등이었다던 선배.', npcIds: ['haeun'] } },
      { text: '"…좀 무섭네요, 솔직히"', effects: { mental: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 4 }],
        message: '"무서운 거 정상이야." 하은이 잠깐 말이 없다. "…그게 여기서 제일 정직한 대답이거든." 더는 말하지 않는다.' },
      { text: '"선배도 그랬어요?"', effects: { social: 1 },
        npcEffects: [{ npcId: 'haeun', intimacyChange: 3 }],
        message: '"당연하지. 안 그런 사람이 이상한 거야." 별거 아니라는 듯 어깨를 으쓱한다.' },
    ],
  },
] satisfies readonly GameEvent[];
