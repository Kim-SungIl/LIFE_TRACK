/**
 * sim·QA 스크립트 공용 — 사건 해결·말걸기는 **store와 같은 엔진 함수**(src/engine/eventResolution.ts)를 탄다.
 *
 * 예전엔 이 파일이 store.resolveEvent/talkToNpc를 손으로 베낀 사본이었고 조용히 어긋났다(2026-10-27 대조):
 * W48 사건을 닫아도 학년 전환을 안 했고(그 해의 milestone·성취 3축·Y7 진로 갈림길이 빠짐), 사건 효과를 주간
 * 로그에 접지 않았고, 말걸기는 지난달 적립 대화·보류분을 몰랐다. 이제 다른 점은 기록실 적립(브라우저 저장소
 * 쓰기)을 안 한다는 것 하나다 — 그건 store만 훅으로 얹는다.
 *
 * 이름은 호출부(scripts/sim 스크립트들·src/engine 테스트들 — `grep y1-sim-resolve`로 셀 것)를 그대로 두려고 유지한다. 해결하지 않는 경우엔 입력 상태를 그대로 돌려준다.
 */
import { resolveCurrentEvent, talkToNpcOutcome } from '../../src/engine/eventResolution';
import type { GameState } from '../../src/engine/types';

export function resolveEventLikeStore(state: GameState, choiceIndex: number): GameState {
  return resolveCurrentEvent(state, choiceIndex)?.state ?? state;
}

export function talkToNpcLikeStore(state: GameState, npcId: string): GameState {
  return talkToNpcOutcome(state, npcId).state ?? state;
}
