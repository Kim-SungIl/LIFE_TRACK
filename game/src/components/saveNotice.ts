// 세이브를 못 열 때 타이틀이 하는 말. (T36)
//
// 화면은 **하나다** — TitleScreen의 ConfirmDialog("이 저장을 열 수 없어요",
// corruptSaveNotice.test.tsx가 잠근다). 여기 있는 건 그 다이얼로그의 첫 문단뿐이고,
// 사유마다 처방이 다르기 때문에 갈린다.
//
// 파일을 따로 두는 이유는 fast-refresh 규칙(react-refresh/only-export-components)이다 —
// 컴포넌트 파일에서 상수를 export하면 lint가 막는다. 표를 테스트에 한 번 더 적는 것은
// 더 나쁘다(같은 표가 두 층에 박히면 한쪽만 늙는다).
import type { SaveUnreadableReason } from '../engine/store';

/**
 * 못 연 사유. `'structure'`만 **눌러 봐야** 알 수 있고(loadSavedGame이 false를 준다),
 * 나머지 셋은 읽는 순간 알 수 있어 이어하기 버튼조차 안 그려지는 자리다 —
 * 그래서 저 셋은 타이틀이 뜨자마자 말해야 한다(안 그러면 버튼이 조용히 사라진 것으로만 보인다).
 */
export type SaveNoticeKind = SaveUnreadableReason | 'structure';

/**
 * 사유별 첫 문단. 사유가 늘면 `Record`가 여기서 타입 에러를 낸다 —
 * 빠진 사유가 조용히 침묵으로 돌아가지 않게.
 *
 * **미래 버전만 처방이 다르다.** 그 저장은 손상되지 않았다 — 최신 빌드에서 열면 그대로 이어진다.
 * 그래서 "지우는 것 말고는 방법이 없다"고 말하면 거짓이고, 자동으로 지우면 남의 판을 지우는 것이다.
 */
export const SAVE_NOTICE_MESSAGE: Record<SaveNoticeKind, string> = {
  structure: '저장된 데이터가 손상돼 이어서 할 수 없어요.\n지우고 새로 시작하는 것 말고는 방법이 없어요.',
  truncated: '저장 데이터가 잘려 있어요.\n저장하던 중에 창이 닫히면 이렇게 됩니다.\n지우고 새로 시작하는 것 말고는 방법이 없어요.',
  'no-state': '저장 데이터에 진행 내용이 없어요.\n지우고 새로 시작하는 것 말고는 방법이 없어요.',
  'future-version': '더 새로운 버전의 저장이에요.\n지금 이 버전에서는 열 수 없어요. 앱을 최신 버전으로 열면 그대로 이어서 할 수 있어요.\n여기서 지우면 되돌릴 수 없어요.',
};
