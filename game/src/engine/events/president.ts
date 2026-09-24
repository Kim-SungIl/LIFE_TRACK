import { EventTextVariant, GameEvent, GameState, SchoolVariants } from '../types';

// 실제 반장(반장선거 당선) 여부 체크 — 반장 전용 이벤트 조건에 사용
// 현재 연도 기준 반장 여부 — 매년 선거가 새로 열리므로 같은 해 당선만 카운트
function isClassPresident(s: GameState): boolean {
  return s.events.some(e =>
    (e.id === 'class-president-win' || e.id === 'class-president-2-win')
    && e.year === s.year
    && e.resolvedChoice !== undefined
  );
}

// 반장/부반장 포함 학급 임원 여부 체크 — 같은 해 기준
function isClassOfficer(s: GameState): boolean {
  return isClassPresident(s)
    || s.events.some(e => e.id === 'class-president-nudge' && e.year === s.year && e.resolvedChoice === 0)
    || s.events.some(e => e.id === 'class-president-vice' && e.year === s.year && e.resolvedChoice === 0);
}

export const PRESIDENT_FOLLOWUP = [
  // ===== 반장 후속 이벤트 =====
  {
    id: 'class-president-nudge', title: '민재의 추천',
    description: '쉬는 시간에 민재가 다가온다.\n"야, 부반장 자리 아직 비었는데, 너가 하면 딱인데? 내가 추천할까?"',
    location: 'classroom',
    background: 'classroom_{school}',
    speakers: ['minjae'],
    choices: [
      { text: '"...해볼까?" — 민재 말에 용기를 낸다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '부반장이 됐다! 민재가 "내 눈은 틀리지 않지" 하며 웃었다.' },
      { text: '"아니야, 난 괜찮아" — 정중하게 거절한다', effects: { mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '"알겠어, 근데 너 진짜 잘할 수 있었을 텐데." 민재 말에 기분이 나쁘진 않았다.' },
    ],
    condition: (s) => {
      const electionEvent = s.events.find(e =>
        (e.id === 'class-president' || e.id === 'class-president-2') &&
        e.year === s.year &&
        e.resolvedChoice === 1 &&
        s.week - (e.week || 0) <= 4
      );
      const alreadyFiredThisYear = s.events.some(e => e.id === 'class-president-nudge' && e.year === s.year);
      return !!electionEvent && !alreadyFiredThisYear && s.stats.social >= 55;
    },
  },
] satisfies readonly GameEvent[];

export const PRESIDENT_ELECTION = [
  // ===== 반장 선거 이벤트 =====
  {
    id: 'class-president', title: '반장 선거',
    description: '반장 선거 시즌이다.\n선생님이 교탁 앞에 서서 말했다.\n"자, 반장 후보 나올 사람 있나요?"',
    week: 3,
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        message: '손을 들었다. 교실이 술렁인다. 이제 선거 연설을 해야 한다.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 조용히 손을 들었다. "아무도 안 하면 제가 할게요." 민재가 반장이 됐다. 의외로 차분하게 나서는 타입이다.' },
    ],
  },
  {
    id: 'class-president-speech', title: '선거 연설',
    description: '교탁 앞에 섰다.\n반 친구들의 시선이 모인다.\n무슨 말을 해야 할까?',
    // 같은 해 출마(c0) 후 + 연설/win/lose 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && !s.events.some(e => e.id === 'class-president-speech' && e.year === s.year)
      && !s.events.some(e => (e.id === 'class-president-win' || e.id === 'class-president-lose') && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '"열심히 하겠습니다!" — 진심을 담아 외친다', effects: { social: 3, mental: 1 }, fatigueEffect: 2,
        message: '떨리는 목소리지만 진심이 닿았다. 박수 소리가 들린다.' },
      { text: '"여러분의 의견을 듣겠습니다" — 차분하게 약속한다', effects: { social: 2, mental: 2 }, fatigueEffect: 2,
        message: '담담했지만 어른스러운 인상을 남겼다. 몇몇이 고개를 끄덕였다.' },
      { text: '"...잘 부탁드립니다" — 짧게 끝낸다', effects: { social: 1 }, fatigueEffect: 1,
        message: '짧게 마쳤다. 무난했지만 인상에 남지 않았다.' },
    ],
  },
  {
    id: 'class-president-win', title: '반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n반 친구들이 박수를 쳐준다.',
    // 매년 발동: 같은 해 출마(c0) + 같은 해에 -lose/-win 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social >= 40
      && !s.events.some(e => e.id === 'class-president-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-win' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '기쁘게 받아들인다', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        message: '당선됐다! 떨리지만 잘 해보자.' },
    ],
  },
  {
    id: 'class-president-lose', title: '반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n가슴이 조금 내려앉았다.',
    condition: (s) => s.events.some(e => e.id === 'class-president' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social < 40
      && !s.events.some(e => e.id === 'class-president-win' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-lose' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        message: '아깝게 졌다. 조금 씁쓸하지만 인정한다.' },
    ],
  },
  {
    id: 'class-president-vice', title: '부반장 제안',
    description: '쉬는 시간에 이번 반장이 된 민재가 다가온다.\n"야, 부반장 자리 아직 비었는데... 너 어때?"',
    condition: (s) => s.events.some(e => e.id === 'class-president-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-vice' && e.year === s.year),
    location: 'classroom', background: 'classroom_{school}', speakers: ['minjae'],
    choices: [
      { text: '"좋아, 해볼게" — 부반장을 맡는다', effects: { social: 4, mental: 2 }, fatigueEffect: 2,
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '부반장이 됐다! 민재가 "우리 잘 해보자!" 하며 주먹을 내밀었다.' },
      { text: '"아니, 괜찮아..." — 정중히 거절한다', effects: { mental: 1 },
        message: '다음에 기회가 있을 거다. 지금은 조용히 지내자.' },
    ],
  },
  {
    id: 'class-president-2', title: '2학기 반장 선거',
    description: '2학기가 시작됐다. 선생님이 교탁 앞에 서서 말했다.\n"이번 학기 반장, 나올 사람 있나요?"',
    week: 25, location: 'classroom', background: 'classroom_{school}',
    choices: [
      { text: '"제가 할게요!" — 손을 든다', effects: { social: 2, mental: 1 },
        message: '손을 들었다. 올해는 조금 더 자신 있게.' },
      { text: '가만히 있는다...', effects: { mental: 1 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 1 }],
        message: '민재가 다시 손을 들었다. "할 사람 없으면 제가 하죠." 2학기도 민재가 반장. 책임감이 대단하다.' },
    ],
  },
  {
    id: 'class-president-2-speech', title: '2학기 선거 연설',
    description: '다시 교탁 앞에 섰다.\n이번엔 조금 덜 떨린다. 어떤 말을 할까.',
    // 같은 해 2학기 출마(c0) 후 + 2학기 연설/win/lose 미발동
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && !s.events.some(e => e.id === 'class-president-2-speech' && e.year === s.year)
      && !s.events.some(e => (e.id === 'class-president-2-win' || e.id === 'class-president-2-lose') && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    // JIHUN_EVENTS가 PRESIDENT_ELECTION보다 배열 앞이라, 우선순위 없이는
    // Y1 W25에서 jihun-basketball이 연설을 삼킨다. DIRECT_SEQUEL은 같은 주에 이어져야 한다.
    //
    // **21인 이유(win/lose는 20)**: win/lose는 선거 c0만 요구하고 연설 선행을 조건에 걸지 않아,
    // 셋이 동시에 적격일 때 `pickByPriority`가 동점이면 GAME_EVENTS 배열 순서로만 갈렸다
    // (speech가 win보다 앞이라 우연히 맞았을 뿐). 연설을 한 칸 올려 순서를 데이터로 못박는다.
    // 조건에 "연설 선행"을 넣지 않는 이유: 연설이 밀리는 해에 결과 장면까지 통째로 사라진다.
    selectionPriority: 21,
    choices: [
      { text: '"이번 학기엔 더 잘 해보겠습니다" — 1학기 경험을 살려 다짐한다', effects: { social: 3, mental: 1 }, fatigueEffect: 2,
        message: '경험에서 우러난 말이라 무게가 달랐다. 호응이 좋았다.' },
      { text: '"새로운 계획을 준비했습니다" — 구체적인 약속을 한다', effects: { social: 2, mental: 2, academic: 1 }, fatigueEffect: 2,
        message: '준비한 만큼 차분하게 전했다. "오, 진심이네" 누군가가 작게 말했다.' },
      { text: '"잘 부탁드립니다" — 짧게 마무리한다', effects: { social: 1 }, fatigueEffect: 1,
        message: '담담히 끝냈다. 평이했다.' },
    ],
  },
  {
    id: 'class-president-2-win', title: '2학기 반장 당선!',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 불렸다!\n2학기 반장이다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social >= 50
      && !s.events.some(e => e.id === 'class-president-2-lose' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-2-win' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    selectionPriority: 20,
    choices: [
      { text: '이어서 맡기로 한다', effects: { social: 5, mental: 3 }, fatigueEffect: 2,
        message: '이번엔 더 잘 해내고 싶다. 반 친구들의 기대가 느껴진다.' },
    ],
  },
  {
    id: 'class-president-2-lose', title: '2학기 반장 선거 결과',
    description: '선생님이 교탁 위 종이를 펼친다.\n교실이 조용해졌다.\n"이번 학기 반장은..."\n내 이름이 아니다.\n이번에도 아깝게 졌다.',
    condition: (s) => s.events.some(e => e.id === 'class-president-2' && e.year === s.year && e.resolvedChoice === 0)
      && s.stats.social < 50
      && !s.events.some(e => e.id === 'class-president-2-win' && e.year === s.year)
      && !s.events.some(e => e.id === 'class-president-2-lose' && e.year === s.year),
    location: 'classroom',
    background: 'classroom_{school}',
    selectionPriority: 20,
    choices: [
      { text: '결과를 받아들인다', effects: { social: 1, mental: -1 },
        // class-president-2는 조건 없는 ANNUAL이라 Y7 2학기에도 발동한다. 그 해엔 "다음 학기"가
        // 존재하지 않으므로(고3 2학기가 마지막) 학년 무관하게 참인 위로로 바꾼다.
        message: '인기를 더 쌓아야겠다는 생각이 든다. 옆자리 친구가 "아깝다, 진짜" 하며 어깨를 두드렸다.' },
    ],
  },
] satisfies readonly GameEvent[];

// 반장 잡무 3종 — 발동 횟수·주차·효과는 그대로 두고 문장만 학교급×로테이션으로 갈린다.
// 배경은 이미 classroom_{school}을 따른다.
//
// **밴드당 개수(T37)**: 한 판에 3종이 각 ~21회, 합 63회 뜬다(24시드 실측). 횟수를 깎는 처방은
// 두 번 실측으로 기각됐다 — 조건부 후보 풀이 평균 1.24개고 학기 주의 70.9%가 잡무 외 후보 0개라
// 캡은 치환이 아니라 **삭제**가 된다(캡2 = 밀도 −11.4%, #422 실측 −10.7%). 그래서 밀도를 건드리지
// 않고 반복감만 줄이는 유일한 축이 문장 변이 개수다. 2개 → 4개로 늘리면 같은 밴드에서 동일 텍스트
// 노출이 **판당 4.02회 → 2.32회**(−42.3%), 최다 반복이 7.58회 → 5.29회로 떨어진다.
// 발동 좌표는 변이 개수와 무관하므로(변이 선택은 rngSeed를 안 건드린다) **밀도 낙폭은 0**이다 —
// 같은 24시드의 같은 발동 좌표 위에 L=2와 L=4를 각각 얹어 잰 A/B다(solo 1501발동 / social 1519발동).
//
// 로테이션은 (absWeek + 13·year) % length라 L=4에서 336좌표가 84/84/84/84로 정확히 균등하다
// (밴드별로도 초 12/12/12/12 · 중 36/36/36/36 · 고 36/36/36/36). `% length` 축은 계수가
// 나눠떨어지면 죽으므로(48 → 전멸, 49 = 7² → length 7에서 전멸) 구간 전체를 테스트가 잠근다.
export const PRESIDENT_CHORE_IDS = ['president-errand', 'president-mediate', 'president-speech'] as const;

// 밴드당 변이 수 하한. 테스트는 이 상수에서 파생한다 — 리터럴을 테스트에 박으면
// 변이를 지워도 "2개 이상"만 보던 옛 단언이 통과한다.
export const MIN_VARIANTS_PER_BAND = 4;

function choreVariant(
  description: string,
  c0: { text: string; message: string },
  c1: { text: string; message: string },
): EventTextVariant {
  return { description, choices: [c0, c1] };
}

const ERRAND_VARIANTS: SchoolVariants = {
  elementary: [
    choreVariant(
      '선생님이 부르신다.\n"반장, 교무실에서 유인물 좀 가져다줄래? 아, 그리고 다음 주 현장학습 인원 확인도 부탁해."',
      { text: '"네, 알겠습니다!" — 성실하게 처리한다',
        message: '바쁘지만 선생님이 "역시 믿음직하다" 하셨다. 뿌듯하다.' },
      { text: '"아... 네..." — 좀 귀찮지만 한다',
        message: '시킨 건 했지만 의욕은 없었다. 반장이 이렇게 피곤한 거였나.' },
    ),
    choreVariant(
      '종례 직전, 담임이 나를 남겼다.\n"우유 상자 교실로 옮기고, 내일 청소 당번 이름 칠판에 써 놓으렴."',
      { text: '상자를 두 팔로 안고 복도를 오간다',
        message: '우유 상자 모서리가 팔에 베겼다. 선생님이 지나가다 "고맙다" 하셨다.' },
      { text: '당번 이름만 대충 적고 상자는 미룬다',
        message: '칠판 글씨는 삐뚤고 상자는 복도에 남았다. 반장 일이 이렇게 자잘한 거였나.' },
    ),
    choreVariant(
      '알림장을 쓰는 시간, 담임이 손짓으로 나를 부른다.\n"반장, 옆 반에 가서 색종이 좀 빌려 오고, 알림장 안 쓴 애들도 챙겨 줄래?"',
      { text: '옆 반 문을 두드려 색종이를 받아 온다',
        message: '색종이를 품에 안고 돌아오니 담임이 "빠르네" 하셨다. 빈 알림장도 하나씩 채워 줬다.' },
      { text: '색종이만 받아 오고 알림장은 모른 척한다',
        message: '색종이는 교탁에 올려 뒀다. 빈 알림장이 그대로라는 게 하루 종일 걸렸다.' },
    ),
    choreVariant(
      '체육이 끝나고 운동장에 공이 흩어져 있다. 선생님이 구석 창고를 가리키신다.\n"반장, 피구공이랑 접시콘 세어서 넣어 두렴. 빠진 게 있으면 알려 주고."',
      { text: '공을 하나씩 세어 창고 선반에 올린다',
        message: '접시콘이 하나 모자라 화단에서 찾아냈다. 선생님이 "그런 것까지 봤네" 하셨다.' },
      { text: '창고에 몰아 넣고 문부터 닫는다',
        message: '공은 다 들어갔지만 몇 개인지는 모르겠다. 창고 문이 잘 안 닫혀서 한참 밀었다.' },
    ),
  ],
  middle: [
    choreVariant(
      '쉬는 시간, 선생님이 복도에서 부른다.\n"학급비 봉투 교무실에 갖다주고, 동아리 부실 열쇠는 학생회로 돌려주겠니."',
      { text: '봉투를 품 안에 넣고 계단을 두 칸씩 오른다',
        message: '열쇠를 돌려주고 오니 선생님 말씀이 "일은 빨리 끝나는 맛이지"였다.' },
      { text: '쉬는 시간이 끝나기 전에 대충 다녀온다',
        message: '할 일은 했지만 종소리가 등 뒤에서 울렸다. 발걸음이 무거웠다.' },
    ),
    choreVariant(
      '종례 종이 울리기 직전이다.\n"체험학습 동의서 아직 안 낸 애들 이름 적어서 가져오렴. 오늘 안에."',
      { text: '빈칸을 하나씩 메워 리스트를 채운다',
        message: '이름을 다 받아 교무실에 올렸다. 선생님이 종이 모서리를 접어 표시하셨다.' },
      { text: '몇 명은 빈칸으로 남기고 먼저 간다',
        message: '리스트 아래쪽이 허전하다. 나중에 혼날 일은 내일의 나다.' },
    ),
    choreVariant(
      '수업 사이 복도에서 담임이 서류철을 내민다.\n"교무실 복사기로 학급 수만큼 뽑아 오고, 방과 후 신청서 안 낸 애들한테 한 번씩 말해 줘."',
      { text: '복사기 앞에서 종이가 다 나올 때까지 기다린다',
        message: '따끈한 종이를 안고 교실로 왔다. 신청서 얘기까지 돌리고 나니 다음 수업 종이 울렸다.' },
      { text: '복사만 하고 신청서 얘기는 미룬다',
        message: '종이는 나눠 줬지만 신청서 얘기는 입 밖에 내지 않았다. 내일 누가 물어보면 그때 말하자.' },
    ),
    choreVariant(
      '청소가 끝나갈 무렵, 담임이 교실 뒤를 둘러보신다.\n"게시판 좀 정리하고, 학급문고에 안 돌아온 책 이름도 적어 두렴."',
      { text: '게시판 압정을 다시 꽂고 책장 빈칸을 훑는다',
        message: '빠진 책 제목을 적어 드렸더니 담임이 "이게 제일 오래 걸리는 일인데" 하셨다.' },
      { text: '게시판만 대충 펴 놓고 교실을 나선다',
        message: '삐뚤어진 종이는 손으로 눌러 뒀다. 책장은 다음 청소의 일로 미뤘다.' },
    ),
  ],
  high: [
    choreVariant(
      '야자 시작 전, 담임이 출석부를 내민다.\n"오늘 빠진 애들 확인하고, 자습실 앞 유인물은 네가 붙여."',
      { text: '출석부를 들고 복도를 한 바퀴 돈다',
        message: '유인물을 붙이고 돌아오니 담임이 고개만 끄덕였다. 이 나이 돼서도 이런 일이다.' },
      { text: '유인물만 붙이고 출석은 넘긴다',
        message: '복도 게시판만 채우고 자리로 돌아왔다. 반장 완장이 아직 남아 있다는 게 문득 싫었다.' },
    ),
    choreVariant(
      '점심시간, 교무실 앞이 붐빈다.\n"모의고사 감독 보조 명단이랑 분실물 함 열쇠, 반장이 받아 가."',
      { text: '명단을 받아 들고 분실물 함까지 확인한다',
        message: '열쇠를 챙기고 나오니 점심이 반이나 지나 있었다. 그래도 선생님은 편해 보이셨다.' },
      { text: '열쇠만 받아 급히 교실로 돌아온다',
        message: '명단은 나중에 보자고 접어 주머니에 넣었다. 밥은 식고 할 일은 남았다.' },
    ),
    choreVariant(
      '마지막 교시가 끝났다. 담임이 교탁에서 서류 뭉치를 든 채 나를 본다.\n"진학 상담 신청서 걷어서 번호순으로 묶고, 급식 잔반 당번표도 다시 짜 둬."',
      { text: '신청서를 번호순으로 맞추고 당번표를 새로 쓴다',
        message: '빠진 이름을 채우다 보니 교실에 나만 남았다. 담임은 이미 퇴근하신 뒤였다.' },
      { text: '신청서만 묶어 두고 당번표는 그대로 둔다',
        message: '당번표는 지난달 것이 그대로 붙어 있다. 누가 항의하면 그때 고치기로 했다.' },
    ),
    choreVariant(
      '주말 자습 신청을 받는다고 한다.\n"반장이 명단 돌리고, 교실 에어컨 리모컨이랑 창문 열쇠도 네가 챙겨."',
      { text: '명단을 돌리고 리모컨과 열쇠를 서랍에 넣는다',
        message: '열쇠 꾸러미가 주머니에서 달그락거렸다. 이걸 잃어버리면 안 된다는 생각만 남았다.' },
      { text: '명단만 돌리고 열쇠는 아무에게나 맡긴다',
        message: '누가 받아 갔는지 기억이 안 난다. 창문은 밤새 누가 닫았을까.' },
    ),
  ],
};

const MEDIATE_VARIANTS: SchoolVariants = {
  elementary: [
    choreVariant(
      '반 친구 둘이 크게 싸우고 있다.\n선생님이 자리를 비운 사이, 다들 반장인 나를 쳐다본다.\n"야, 너가 좀 말려봐..."',
      { text: '중간에서 양쪽 이야기를 듣는다',
        message: '쉽지 않았지만 결국 둘 다 진정시켰다. "고마워, 반장." 피곤하지만 보람 있다.' },
      { text: '"선생님 오실 때까지 기다리자" — 넘긴다',
        message: '결국 담임이 와서 해결했다. "반장이 좀 나섰어야지..." 누군가가 작게 말했다.' },
    ),
    choreVariant(
      '운동장에서 축구공이 얼굴을 맞았다. 누가 먼저 던졌는지 서로 우긴다.\n선생님은 아직 안 계시고, 애들이 "반장아, 너가 봐 봐" 한다.',
      { text: '공부터 집어 들고 양쪽 말을 듣는다',
        message: '공을 무릎에 올려 놓고 차례로 듣다 보니 목소리가 작아졌다. 누군가는 "반장이 알아서 해" 했다.' },
      { text: '보건실 가라는 말만 하고 한 발 빠진다',
        message: '다친 쪽은 보건실로 가고 남은 쪽은 서로를 노려본다. 내가 빠져서 편해진 건 나뿐이다.' },
    ),
    choreVariant(
      '자리 바꾸기로 교실이 시끄럽다. 짝이 싫다며 한 명이 책상을 끌어 옮겼다.\n선생님은 옆 반에 가 계시고, 애들 눈이 나한테로 온다.',
      { text: '끌려간 책상을 붙잡고 양쪽에 이유를 묻는다',
        message: '둘 다 한참 딴 데만 봤다. 책상은 제자리로 돌아왔지만 내 목이 다 쉬었다.' },
      { text: '한 발 물러나 다른 애들 틈에 서 있는다',
        message: '담임이 오셔서 금방 정리됐다. 그동안 교실은 계속 시끄러웠고 나는 서 있기만 했다.' },
    ),
    choreVariant(
      '빌려 간 준비물을 망가뜨렸다며 둘이 울먹인다.\n부러진 색연필이 책상 위에 놓여 있고, 교실이 조용해졌다.',
      { text: '부러진 색연필을 가운데 놓고 차례로 듣는다',
        message: '누가 먼저 잘못했는지는 끝내 안 정해졌다. 대신 둘이 같이 깎기로 했다. 나는 진이 빠졌다.' },
      { text: '"그냥 새로 사면 되잖아" 하고 자리로 간다',
        message: '울음은 그치지 않았다. 내가 한 말이 제일 쓸모없었다는 걸 뒤늦게 알았다.' },
    ),
  ],
  middle: [
    choreVariant(
      '단톡에 캡처가 올라왔다. 험담 한 줄이 반을 둘로 갈랐다.\n쉬는 시간, 양쪽이 나를 가운데 두고 눈을 피한다.',
      { text: '폰을 내려놓게 하고 따로 불러 듣는다',
        message: '복도 끝에서 번갈아 들었다. 끝난 뒤에도 단톡은 조용하지 않았지만, 그 자리의 목소리는 잦아들었다.' },
      { text: '"담임 선생님께 말해 보자" — 넘긴다',
        message: '종례 때 선생님이 양쪽을 남기셨다. 내가 먼저 말렸어야 했다는 눈길이 남았다.' },
    ),
    choreVariant(
      '급식 줄에서 새치기 다툼이 커졌다. 쟁반이 부딪히는 소리에 조리복 아주머니가 돌아보신다.\n"반장, 좀 말려." 뒤에서 누가 등을 밀었다.',
      { text: '둘 사이를 비집고 줄을 다시 세운다',
        message: '쟁반을 받아 줄을 되돌렸다. 아주머니가 "그래, 반장이 있으니 낫네" 하셨다. 귀는 뜨거웠다.' },
      { text: '급식실 선생님 오시길 기다린다',
        message: '선생님이 오시자 줄은 금방 잠잠해졌다. 그 사이에 나는 쟁반만 들고 서 있었다.' },
    ),
    choreVariant(
      '체육대회 반티 색을 놓고 반이 둘로 갈렸다. 투표를 다시 하자는 쪽과 이미 정해졌다는 쪽이 목소리를 높인다.\n"반장이 정해." 양쪽이 동시에 말했다.',
      { text: '칠판에 양쪽 주장을 적고 한 번씩 말하게 한다',
        message: '적어 놓고 보니 싸울 거리가 생각보다 작았다. 결정은 났지만 하루치 기운을 다 썼다.' },
      { text: '"알아서들 해" 하고 교실을 나간다',
        message: '복도까지 목소리가 따라왔다. 돌아가기도 뭣해서 한참 창밖만 봤다.' },
    ),
    choreVariant(
      '수학여행 방 배정에서 한 명이 빠졌다. 명단을 보던 애가 조용히 교실을 나갔다.\n남은 애들이 서로 눈치만 보다가 나를 본다.',
      { text: '복도로 따라 나가 이름을 부르고 명단을 고친다',
        message: '방 하나를 다시 짜느라 쉬는 시간이 다 갔다. 그 애는 아무 말도 안 했지만 명단엔 이름이 있었다.' },
      { text: '명단은 그대로 두고 교실 분위기만 살핀다',
        message: '누구도 그 이름을 다시 꺼내지 않았다. 종이 울리자 다들 아무 일 없던 얼굴이 됐다.' },
    ),
  ],
  high: [
    choreVariant(
      '수행평가 조 때문에 언성이 높아졌다. 자료 분담을 놓고 두 명이 복도에서 서로를 본다.\n지나가던 애들이 슬슬 속도를 늦춘다. 반장인 내가 보이자 한쪽이 턱짓으로 부른다.',
      { text: '조 단톡을 닫게 하고 할 일만 다시 나눈다',
        message: '누가 무엇을 할지 종이에 적게 했다. 목소리는 낮아졌지만, 끝난 뒤 복도에 남은 공기가 무거웠다.' },
      { text: '"발표 전까지 둘이 알아서 해" — 자리를 뜬다',
        message: '돌아서는 발소리 뒤로 또 말다툼이 이어졌다. 반장이 나섰어야지, 하는 기색이 등 뒤에 붙었다.' },
    ),
    choreVariant(
      '야자 자리를 놓고 실랑이다. 창가 자리를 누가 먼저 맡았는지, 가방이 두 개 겹쳐 있다.\n감독 선생님이 잠시 자리를 비운 사이, 시선이 나한테로 모인다.',
      { text: '가방을 하나씩 들게 하고 자리를 다시 정한다',
        message: '창가와 안쪽을 하루씩 바꾸자고 했다. 둘 다 만족하진 않았지만, 가방은 더 이상 겹치지 않았다.' },
      { text: '감독 선생님 오시면 말씀드리자고 한다',
        message: '감독이 오시자 창가 자리는 금세 정해졌다. 나는 그 전에 아무 말도 못 했다.' },
    ),
    choreVariant(
      '급식 후 교실, 뒷자리 둘이 밀린 청소 당번을 서로 미룬다. 빗자루가 바닥에 던져졌다.\n지나가던 애들이 못 본 척 걸음을 빨리한다.',
      { text: '빗자루를 주워 들고 두 사람을 앉혀 놓는다',
        message: '누가 며칠을 밀렸는지 따지다 보니 둘 다 할 말이 없어졌다. 교실은 치워졌고 나는 지쳤다.' },
      { text: '빗자루만 세워 두고 자리로 돌아온다',
        message: '바닥은 그대로다. 당번표를 볼 때마다 오늘이 떠오를 것 같다.' },
    ),
    choreVariant(
      '원서 얘기가 나오다 말싸움이 됐다. 누가 누구 성적을 입에 올렸다는 것이다.\n복도 창가에서 둘이 마주 서 있고, 지나가는 애들이 흘끔거린다.',
      { text: '둘을 떼어 놓고 한 명씩 빈 교실로 부른다',
        message: '들어 보니 둘 다 결국 자기 얘기를 하고 있었다. 화해까진 아니어도 복도는 조용해졌다. 속은 답답했다.' },
      { text: '못 들은 척 교실로 들어간다',
        message: '문을 닫아도 목소리는 들렸다. 반장이랍시고 앉아만 있는 게 무슨 의미인가 싶었다.' },
    ),
  ],
};

const SPEECH_VARIANTS: SchoolVariants = {
  elementary: [
    choreVariant(
      '월요일 조회. 담임이 "반장, 이번 주 공지사항 전달해" 한다.\n반 전체가 나를 본다. 긴장된다.',
      { text: '당당하게 발표한다',
        message: '떨렸지만 잘 해냈다! 끝나고 지훈이가 "야, 반장 제법인데?" 했다.' },
      { text: '후다닥 빨리 끝낸다',
        message: '우물우물 빨리 끝냈다. 아무도 뭐라 안 했지만... 좀 창피하다.' },
    ),
    choreVariant(
      '아침 조회. 선생님이 우유 당번이랑 청소 구역을 칠판에 쓰시더니 나를 보신다.\n"반장이 한 번 읽어 주렴."',
      { text: '칠판을 가리키며 또박또박 읽는다',
        message: '뒷자리까지 들렸는지, 선생님이 작게 고개를 끄덕이셨다. 가슴이 아직 두근거린다.' },
      { text: '앞줄만 보고 서둘러 자리에 앉는다',
        message: '당번 이름을 삼키듯 넘겼다. 누가 물어봐도 다시 읽어 줄 자신이 없다.' },
    ),
    choreVariant(
      '분필을 내려놓은 선생님이 알림장을 덮으신다.\n"반장이 앞에 나와서 오늘 알림을 한 번 더 말해 주렴."',
      { text: '교탁을 짚고 한 문장씩 천천히 말한다',
        message: '뒷자리에서 "다시요!" 소리가 나서 한 번 더 말했다. 두 번째는 덜 떨렸다.' },
      { text: '자리에서 일어나 그대로 앉는다',
        message: '앞줄만 듣고 끝났다. 알림을 놓친 애가 몇인지는 생각하고 싶지 않다.' },
    ),
    choreVariant(
      '내일 방과 후 교실이 바뀐다고 한다. 선생님이 칠판에 교실 이름을 쓰신다.\n"반장, 애들이 헷갈리지 않게 네가 알려 줘."',
      { text: '칠판을 손으로 짚으며 교실 이름을 두 번 말한다',
        message: '헷갈리던 애들이 고개를 끄덕였다. 자리로 돌아오는데 손바닥에 분필 가루가 묻어 있었다.' },
      { text: '"칠판에 있어요" 한마디만 하고 앉는다',
        message: '칠판을 안 보고 있던 애가 더 많았다. 내일 누가 엉뚱한 교실에 갈지도 모른다.' },
    ),
  ],
  middle: [
    choreVariant(
      '조회가 시작됐다. 이번 주 동아리 부실 사용 시간이랑 축제 부스 신청이 적힌 종이를 받았다.\n반이 아직 잠에서 덜 깬 눈으로 나를 본다.',
      { text: '종이를 펼쳐 항목마다 숨을 고르며 읽는다',
        message: '부스 신청 얘기를 하자 몇 명이 서로를 쳐다봤다. 끝나고 민재가 "전달은 확실하네" 했다.' },
      { text: '종이만 들어 보이고 대충 넘긴다',
        message: '신청 마감이 있는 줄은 거의 중얼거렸다. 나중에 누가 "그거 언제였어?" 물어도 대답이 안 나왔다.' },
    ),
    choreVariant(
      '종례 대신 조회가 길다. 체험학습 준비물이 적힌 종이를 들고 교탁 앞에 섰다.\n마이크는 없는데 뒷자리까지 들려야 한다.',
      { text: '준비물을 하나씩 손가락으로 짚어 가며 말한다',
        message: '뒷줄에서 "응, 들렸어" 하는 소리가 났다. 내려오니 손이 아직 종이를 움켜쥐고 있었다.' },
      { text: '종이를 흔들고 빨리 내려온다',
        message: '준비물 목록이 입으로 다 나오기 전에 자리에 앉았다. 칠판을 다시 보는 애들 얼굴이 떠오른다.' },
    ),
    choreVariant(
      '조회 시간, 학급 회의에서 정한 규칙을 다시 읽어야 한다.\n종이에는 우리 반 애들이 직접 쓴 문장이 그대로 적혀 있다.',
      { text: '규칙을 한 줄씩 읽고 반응을 기다린다',
        message: '자기가 쓴 문장이 나올 때마다 누군가 웃었다. 읽고 나니 규칙이 조금은 우리 것 같았다.' },
      { text: '종이를 그대로 게시판에 붙이고 만다',
        message: '읽지 않은 규칙은 아무도 안 봤다. 게시판 위에서 종이 끝이 말려 올라갔다.' },
    ),
    choreVariant(
      '수학여행 집합 장소랑 조 편성을 전달하라고 하신다.\n하필 아침부터 교실이 들떠 시끄럽다.',
      { text: '시끄러운 쪽이 잦아들 때까지 기다렸다가 말한다',
        message: '기다리는 동안 목덜미가 뜨거웠다. 조용해진 뒤에 말하니 한 번에 전달됐다.' },
      { text: '소란 위로 목소리를 얹어 빠르게 읽는다',
        message: '내 목소리가 웅성거림에 묻혔다. 앉자마자 옆에서 "뭐라고?" 하는 소리가 들렸다.' },
    ),
  ],
  high: [
    choreVariant(
      '아침이라기보다 종례에 가까운 시간이다. 야자 휴대폰 수거랑 자습실 이동을 공지하라고 하신다.\n조명이 아직 덜 켜진 교실, 가방 여는 소리가 먼저 난다.',
      { text: '수거 상자 위치를 분명히 말하고 이동 순서를 반복한다',
        message: '가방 소리가 잠깐 멈췄다. 끝나고 지훈이가 "너는 저런 것도 또박또박 하네" 했다.' },
      { text: '공지를 한 줄로 줄여 자리로 돌아온다',
        message: '휴대폰 수거만 중얼거리고 앉았다. 자습실 이동은 누가 다시 물어볼 일이다.' },
    ),
    choreVariant(
      '담임이 모의고사 고사장 이동 순서를 적어 주셨다. "반장이 읽어. 나는 출석 확인할게."\n뒷줄에서 누가 한숨 쉬는 소리가 들렸다.',
      { text: '이동 순서를 구역별로 나눠 천천히 읽는다',
        message: '한숨 쉬던 쪽도 종이를 보기 시작했다. 담임이 출석부를 덮으며 "됐어" 하셨다.' },
      { text: '종이를 들어 보이고 빨리 내려온다',
        message: '고사장 이름이 채 입 밖으로 나오기 전에 앉았다. 나중에 복도에서 다시 물을 자신이 있다.' },
    ),
    choreVariant(
      '담임이 상담 주간 일정표를 건네고 교무실로 가신다.\n"반장이 읽어 줘. 나는 자료 가지러 갔다 올게."\n교실은 이미 엎드린 애들로 조용하다.',
      { text: '엎드린 애들 이름을 부르고 일정을 또박또박 읽는다',
        message: '몇은 끝내 안 일어났지만 나머지는 수첩을 폈다. 돌아온 담임이 "잘했네" 하고 지나갔다.' },
      { text: '일정표를 교실 뒤에 붙여 두고 앉는다',
        message: '엎드린 등을 깨우진 않았다. 상담 날짜를 놓친 애가 나오면 내 탓일까 잠깐 생각했다.' },
    ),
    choreVariant(
      '급식 시간 변경이랑 동아리 발표회 공지가 한꺼번에 내려왔다.\n종이 두 장을 들고 교탁에 섰는데, 반은 이미 도시락을 꺼내고 있다.',
      { text: '종이를 번갈아 들어 보이며 끝까지 읽는다',
        message: '도시락 뚜껑 여는 소리 사이로 다 읽었다. 내려오니 앞자리 애가 "그걸 다 읽네" 하고 웃었다.' },
      { text: '급식 얘기만 하고 나머지는 접어 둔다',
        message: '발표회 공지는 주머니에 들어갔다. 나중에 동아리 애들이 나를 찾아올 것이다.' },
    ),
  ],
};

export const PRESIDENT_ONLY = [
  // ===== 반장 전용 이벤트 =====
  {
    id: 'president-errand', title: '반장의 심부름',
    description: ERRAND_VARIANTS.elementary[0].description,
    location: 'hallway', background: 'hallway_{school}',
    schoolVariants: ERRAND_VARIANTS,
    choices: [
      { text: ERRAND_VARIANTS.elementary[0].choices[0].text, effects: { social: 2, academic: 1 }, fatigueEffect: 3,
        message: ERRAND_VARIANTS.elementary[0].choices[0].message },
      { text: ERRAND_VARIANTS.elementary[0].choices[1].text, effects: { social: 1 }, fatigueEffect: 2,
        message: ERRAND_VARIANTS.elementary[0].choices[1].message },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation && s.week > 4,
  },
  {
    id: 'president-mediate', title: '반장의 중재',
    description: MEDIATE_VARIANTS.elementary[0].description,
    location: 'classroom', background: 'classroom_{school}_afternoon',
    schoolVariants: MEDIATE_VARIANTS,
    choices: [
      { text: MEDIATE_VARIANTS.elementary[0].choices[0].text, effects: { social: 4, mental: -2 }, fatigueEffect: 3,
        message: MEDIATE_VARIANTS.elementary[0].choices[0].message },
      { text: MEDIATE_VARIANTS.elementary[0].choices[1].text, effects: { social: -1, mental: 1 },
        message: MEDIATE_VARIANTS.elementary[0].choices[1].message },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation && s.stats.social >= 40,
  },
  {
    id: 'president-speech', title: '조회 시간 발표',
    description: SPEECH_VARIANTS.elementary[0].description,
    location: 'classroom', background: 'classroom_{school}',
    schoolVariants: SPEECH_VARIANTS,
    choices: [
      { text: SPEECH_VARIANTS.elementary[0].choices[0].text, effects: { social: 3, mental: 2 }, fatigueEffect: 2,
        message: SPEECH_VARIANTS.elementary[0].choices[0].message },
      { text: SPEECH_VARIANTS.elementary[0].choices[1].text, effects: { social: 1, mental: -1 },
        message: SPEECH_VARIANTS.elementary[0].choices[1].message },
    ],
    condition: (s) => isClassPresident(s) && !s.isVacation,
  },
] satisfies readonly GameEvent[];

export const PRESIDENT_NON = [
  // ===== 비반장: 반장을 지켜보는 이벤트 =====
  {
    id: 'watching-president', title: '민재가 지쳐 보인다',
    description: '요즘 반장 민재가 피곤해 보인다. 성적도 유지해야 하고, 반장 일도 해야 하고...\n쉬는 시간에 민재가 노트를 펴놓고 한숨을 쉬고 있다.\n"야... 시간이 안 된다 진짜..."',
    location: 'classroom', background: 'classroom_{school}_afternoon',
    speakers: ['minjae'],
    choices: [
      { text: '"괜찮아? 뭐 도와줄까?" — 다가간다', effects: { social: 3, mental: 2 },
        npcEffects: [{ npcId: 'minjae', intimacyChange: 3 }],
        message: '"진짜? 고마워..." 민재가 노트를 덮었다. 반장 일에 성적까지, 혼자 다 하려는 애다.' },
      { text: '조용히 지나간다', effects: { mental: 1 },
        message: '민재도 버거운 거구나. 전교 1등이 쉬운 게 아니라는 걸 처음 느꼈다.' },
    ],
    condition: (s) => !isClassOfficer(s) && !s.isVacation && s.week > 6 && s.stats.social >= 35,
  },

] satisfies readonly GameEvent[];
