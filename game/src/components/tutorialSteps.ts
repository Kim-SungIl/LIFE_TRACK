// 튜토리얼 스텝 데이터 — Tutorial.tsx에서 분리 (react-refresh/only-export-components:
// 컴포넌트 파일은 컴포넌트만 export해야 fast refresh가 동작).
export interface TutorialStep {
  target: string;
  title: string;
  desc: string;
  position: 'top' | 'bottom';
  interactive?: boolean;  // true면 하이라이트 영역 클릭 가능
  waitFor?: string;       // 이 data-tutorial-done 값이 나타나면 자동 진행
  doneDesc?: string;      // waitFor 충족 후 보여줄 메시지
}

// 스텝 순서는 화면 스택 순서(위→아래)와 일치 — 스크롤 되감김 방지.
// 신규 스텝(home/npc)은 비인터랙티브 고정: 탭 시 열리는 시트/모달(zIndex 100)이
// 튜토리얼 오버레이(zIndex 200) 아래에 깔리는 미검증 경로라 가리키기+설명만 한다.
// 앵커 존재는 TutorialAnchors.test가 검증.
export const STEPS: TutorialStep[] = [
  {
    target: 'hud',
    title: '내 상태',
    desc: '캐릭터, 날짜, 피로, 용돈이 표시돼요.',
    position: 'bottom',
  },
  {
    target: 'home',
    title: '가정',
    desc: '집에서의 시간도 함께 흘러요.\n가끔 이 버튼으로 부모님과 이야기해 보세요.',
    position: 'bottom',
  },
  {
    target: 'stats',
    title: '능력치',
    desc: '학업, 인기, 특기, 멘탈, 체력 5가지예요.\n눌러서 펼치면 상세 내용을 볼 수 있어요!',
    position: 'bottom',
    interactive: true,
  },
  {
    target: 'routine',
    title: '평일 일과',
    desc: '이게 이번 주 시간표예요!\n주중엔 학교가 끝나면 방과후·저녁 시간이 있어요.\n\n방과후 빈 칸을 터치해서 활동을 골라 보세요!',
    position: 'bottom',
    interactive: true,
    waitFor: 'routine-done',
    doneDesc: '잘했어요! 방과후 루틴은 매주 자동 반복돼요.\n바꾸고 싶으면 언제든 터치하면 돼요.',
  },
  {
    target: 'routine',
    title: '주말 활동',
    desc: '이번엔 주말이에요!\n토요일·일요일 빈 칸을 터치해서\n주말에 할 활동도 골라 보세요!',
    position: 'bottom',
    interactive: true,
  },
  {
    target: 'npc',
    title: '친구',
    desc: '아까 만난 지훈이, 여기 있어요.\n앞으로 알게 될 친구들도 이 카드에 모여요.\n말을 걸면 가끔 작은 이야기가 생겨요.',
    position: 'top',
  },
  {
    target: 'confirm',
    title: '한 주 보내기',
    desc: '시간표를 다 채웠으면 이 버튼을 눌러\n한 주를 보내세요!\n\n정답은 없어요. 자유롭게 플레이하세요!',
    position: 'top',
  },
];

// ── 월 단위 계획(기본값) ────────────────────────────────────────────────────────────────
// 새 판의 첫 계획 화면이 월 계획 화면이라 주간 화면 튜토리얼(STEPS)은 뜰 자리가 없다. 같은 코치마크(Tutorial)에
// 월 계획 화면의 앵커를 준다 — 예산 → 방과후 한 달 등록 → (초대) → 주말 → 이번 달 시작.
// 초대·방과후 스텝은 그 달 화면에 그 칸이 있을 때만 끼운다(monthPlanSteps) — 앵커가 없으면 가운데 카드가 엉뚱한 설명을 띄운다
// (방학 달엔 방과후 칸이 없다 — 새 판은 3월이라 늘 있지만, 플래그가 켜지기 전 세이브는 아무 달에서나 처음 이 화면을 본다).
export const MONTH_PLAN_STEPS: TutorialStep[] = [
  {
    target: 'month-budget',
    title: '이번 달 용돈',
    desc: '용돈은 달 초에 한 달치가 들어와요.\n학원비와 주말에 쓸 돈을 떼어 두고\n남은 게 이만큼이에요.',
    position: 'bottom',
  },
  {
    target: 'month-routine',
    title: '방과후 일과',
    desc: '학교가 끝난 뒤 매일 할 일이에요.\n학원은 한 달치를 미리 내요.\n\n빈 칸을 터치해서 활동을 골라 보세요!',
    position: 'bottom',
    interactive: true,
    waitFor: 'routine-done',
    doneDesc: '잘했어요! 이 일과는 한 달 내내 반복돼요.\n다음 달 계획 때 바꿀 수 있어요.',
  },
  {
    target: 'month-invite',
    title: '친구의 초대',
    desc: '친구가 이번 달 주말에 같이 놀자고 해요.\n좋다고 하면 그날 칸이 약속으로 고정돼요.\n거절하면 조금 서운해할 거예요.',
    position: 'bottom',
  },
  {
    target: 'month-weeks',
    title: '주말 계획',
    desc: '주마다 토요일·일요일에 할 일을 골라요.\n주를 눌러 펼치고 칸을 터치해 보세요.\n「모든 주 똑같이」로 한 번에 채울 수도 있어요.',
    // 아래쪽 — 이 칸은 길고(머리 + 4주) 누를 것(첫 주 칸·「모든 주 똑같이」)이 위에 있다. 위에 두면 말풍선이 그걸 덮는다.
    position: 'bottom',
    interactive: true,
  },
  {
    target: 'month-start',
    title: '한 달 보내기',
    desc: '다 짰으면 이 버튼을 눌러요.\n4주가 저절로 흘러가고, 일이 생기면\n그 자리에서 장면이 나와요.\n\n흘러가는 동안에도 💬 버튼으로\n친구·가족과 이야기할 수 있어요!',
    position: 'top',
  },
];

/** 그 달 화면에 맞춘 월 계획 스텝 — 화면에 없는 칸(초대·방과후)의 스텝은 뺀다. */
export function monthPlanSteps(screen: { hasInvites: boolean; hasRoutine: boolean }): TutorialStep[] {
  return MONTH_PLAN_STEPS.filter(s =>
    (s.target !== 'month-invite' || screen.hasInvites) && (s.target !== 'month-routine' || screen.hasRoutine));
}

// 월 단위 판에서 주간 화면(재생이 멈췄을 때 뜬다)을 처음 볼 때 — 계획 스텝(루틴·주말·확정)은 월 계획 화면이 이미 가르쳤으니
// 화면을 읽는 스텝만 남긴다. 주간 판 튜토리얼과 같은 문장을 쓴다(한 곳에서 고치면 둘 다 바뀐다).
const INFO_TARGETS = new Set(['hud', 'home', 'stats', 'npc']);
export const MAIN_INFO_STEPS: TutorialStep[] = STEPS.filter(s => INFO_TARGETS.has(s.target));

/** 튜토리얼 영속 키. ever_seen은 새 게임에도 남는다(주간 판 튜토리얼 — MainWeekScreen). */
export const TUTORIAL_KEYS = {
  done: 'lifetrack_tutorial_done',
  everSeen: 'lifetrack_tutorial_ever_seen',
  /** 월 계획 화면 튜토리얼을 본 적 있다(영속) — 주간 판 튜토리얼을 본 플레이어도 월 계획 화면은 처음이라 따로 둔다. */
  monthSeen: 'lifetrack_month_tutorial_seen',
  /** 월 계획 튜토리얼을 마쳤고 주간 화면 읽는 법(MAIN_INFO_STEPS)이 남았다 — 주간 판 튜토리얼을 본 적 없는 플레이어만. */
  infoPending: 'lifetrack_tutorial_info_pending',
} as const;
