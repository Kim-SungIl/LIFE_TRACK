// ===== T66: 진로 갈림길 장면 =====
//
// 두 갈래(특기 / 수능·학업)가 **실제로 열린 판에서만** 졸업 직전에 한 번 묻는다.
// 어느 갈래가 열렸는지는 ending.ts `careerBranchesOf` 하나가 정한다 — 이 파일은 그 값을
// 장면으로 옮길 뿐 판정을 다시 하지 않는다(두 층이 각자 계산하면 갈린다, #441).
//
// **왜 Y7 학년 전환 직전인가.** 진로는 졸업 시점 라이브 스탯을 읽는 설계다(ending.ts determineCareer).
// 수능 직후(W36)나 졸업식(W46)에 물으면 그 뒤 몇 주의 활동·사건이 스탯을 움직여, 장면이 보여 준
// 갈래와 엔딩이 읽는 갈래가 어긋날 수 있다. 그래서 **엔딩 전환이 일어나는 바로 그 지점**
// (gameEngine.applyYearTransition, Y7)에서 열고, 닫히면 곧장 엔딩으로 간다 — 이 장면 뒤에는
// 스탯을 바꾸는 단계가 하나도 없다(체인 픽도 건너뛴다, store.resolveEvent).
//
// **왜 카탈로그(GAME_EVENTS) 밖인가.** 선택지 문장이 그 판의 실제 진로 이름("의대 합격" 등)을
// 담아야 정직한 선택이 된다 — 정적 카탈로그로는 못 쓴다. 또 일반 선택 풀에 들어가면 다른 주에
// 뽑히거나 체인으로 끼어들 수 있다. 저장/로드 시 함수 필드 복원은 stateMigration이 여기
// `buildCareerChoiceEvent`로 다시 굽는다(카탈로그 조회와 같은 자리).
import type { CareerBranch, GameEvent, GameState } from './types';
import { careerBranchesOf, isCareerBranch } from './ending';

export const CAREER_CHOICE_EVENT_ID = 'career-crossroads';

/**
 * 지금 갈림길 장면을 열어야 하나. Y7 끝(엔딩 전환 직전)에서만 참이 될 수 있다.
 *
 * 한 판에 한 번: 이미 본 판(state.events에 기록)은 다시 열지 않는다. 선택이 기록되지 않는
 * 경로(모든 선택지가 잠긴 sentinel -1 등)에서도 장면이 무한히 돌지 않게 하는 가드이기도 하다.
 */
export function careerChoicePending(state: GameState): boolean {
  if (state.year < 7) return false;
  // 유효한 갈래 값일 때만 "이미 골랐다" — 손상값('foo'·null)은 엔딩도 무시하므로 장면은 다시 연다.
  if (isCareerBranch(state.careerChoice)) return false;
  if (state.events.some(e => e.id === CAREER_CHOICE_EVENT_ID)) return false;
  return careerBranchesOf(state).open.length >= 2;
}

const CHOICE_COPY: Record<CareerBranch, { lead: string; message: string }> = {
  general: {
    lead: '공부로 쌓아 온 길',
    message: '성적표를 한 번 더 펼쳐 봤다. 7년 동안 책상 앞에서 버틴 시간이 거기 적혀 있었다. 이 길로 가기로 했다.',
  },
  specialist: {
    lead: '좋아하는 일로 가는 길',
    message: '오래 붙잡아 온 것을 내려놓지 않기로 했다. 처음 그걸 좋아하게 됐던 날이 생각났다.',
  },
};

/**
 * 갈림길 장면. 갈래가 하나뿐인 판이면 null(장면을 만들지 않는다).
 *
 * 선택지 순서 = `careerBranchesOf().open` 순서 = **자동 판정이 먼저**. 선택지를 효과로 고르는
 * 하네스(sim pickChoice: 동점이면 첫 번째)가 이 장면을 지나도 예전 자동 판정을 그대로 받는다.
 * 효과는 비워 둔다 — 이 장면이 스탯을 움직이면 열린 갈래가 장면 직후에 바뀔 수 있다.
 */
export function buildCareerChoiceEvent(state: GameState): GameEvent | null {
  const b = careerBranchesOf(state);
  if (b.open.length < 2) return null;
  return {
    id: CAREER_CHOICE_EVENT_ID,
    title: '두 갈래 길',
    description: '등록 마감이 코앞이다.\n책상 위에 서류 두 묶음이 나란히 놓여 있다.\n'
      + '하나는 7년 동안 쌓아 온 공부로 가는 길, 하나는 7년 동안 놓지 않은 좋아하는 일로 가는 길.\n\n'
      + '어느 쪽도 틀리지 않았다. 다만, 하나만 고를 수 있다.',
    location: 'home',
    background: 'bedroom_night',
    choices: b.open.map(branch => ({
      text: `${CHOICE_COPY[branch].lead} — ${b.outcomes[branch]!.path}`,
      effects: {},
      careerSelect: branch,
      message: CHOICE_COPY[branch].message,
    })),
  };
}
