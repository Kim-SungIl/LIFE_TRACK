// events/npc/index.ts — NPC 체인 일괄 re-export
// events/index.ts에서 GAME_EVENTS 조립 시 각 NPC array를 spread

export { HAEUN_EVENTS } from './haeun';
export { JIHUN_EVENTS } from './jihun';
export { SUBIN_EVENTS } from './subin';
export { MINJAE_EVENTS } from './minjae';
export { YUNA_EVENTS } from './yuna';
export { JUNHA_EVENTS } from './junha';
export {
  DOYUN_FIRST_MEET_M,
  DOYUN_FIRST_MEET_F,
  DOYUN_DAILY,
  DOYUN_GRADUATION,
  DOYUN_SCHOOL_SPLIT,
} from './doyun';
