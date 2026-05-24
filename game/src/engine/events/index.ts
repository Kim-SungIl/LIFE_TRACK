// events/index.ts — barrel
// 외부 import 경로 `from './events'` 호환을 위해 모든 public API 를 re-export.
// 데이터(GAME_EVENTS)는 data.ts, 선택 로직은 selection.ts, ID 셋은 constants.ts 에서.

export { GAME_EVENTS } from './data';
export {
  FOLLOWUP_EVENT_IDS,
  DIRECT_SEQUEL_IDS,
  HARD_CRISIS_IDS,
  SOFT_CRISIS_IDS,
} from './constants';
export {
  getFollowupForWeek,
  getConditionalForWeek,
  getMilestoneForWeek,
  getEventForWeek,
} from './selection';
