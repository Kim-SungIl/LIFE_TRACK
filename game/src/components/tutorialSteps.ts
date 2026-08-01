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
    desc: '이게 이번 주 시간표예요!\n주중엔 학교가 끝나면 방과후·저녁 시간이 있어요.\n\n왼쪽 빈 칸을 터치해서 방과후 활동을 골라 보세요!',
    position: 'bottom',
    interactive: true,
    waitFor: 'routine-done',
    doneDesc: '잘했어요! 방과후 루틴은 매주 자동 반복돼요.\n바꾸고 싶으면 언제든 터치하면 돼요.',
  },
  {
    target: 'routine',
    title: '주말 활동',
    desc: '이번엔 주말이에요!\n오른쪽 토요일·일요일 빈 칸을 터치해서\n주말에 할 활동도 골라 보세요!',
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
