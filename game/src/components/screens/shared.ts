import { StatKey, GameEvent, GameState, EXAM_TYPE_LABELS } from '../../engine/types';
import { getExamSchedule } from '../../engine/examSystem';

export const STAT_ICONS: Record<StatKey, string> = {
  academic: '📚', social: '⭐', talent: '💡', mental: '🍀', health: '⚡',
};

export const PARENT_ICONS: Record<string, string> = {
  emotional: '🫂', wealth: '🏠', info: '📱',
  strict: '📐', resilience: '⭐', freedom: '🌿',
};

// 이벤트 선택 결과 페이로드 — GameScreen 의 eventResultData state 와 EventResultScreen props 가 공유.
export type EventResultData = {
  message: string;
  effects: Record<string, string>[];
  event?: GameEvent;
  choiceIndex?: number;
  // 이벤트가 **발생한** 학년. 선택 시점(resolveEvent 이전)의 값을 담는다.
  //
  // 왜 필요한가: W48 이벤트는 resolveEventChain 안에서 학년 전환이 끝난 뒤에 결과 화면이 뜬다.
  // 그러니 결과 화면이 state.year를 그대로 읽으면 원리상 전환 후 학년으로 CG를 찾게 된다.
  //
  // **현재는 그 어긋남이 실제로 나지 않는다** — applyYearTransition은 Y1~Y6에서 phase만
  // 'year-end'로 바꾸고 학년은 올리지 않으며(year++는 advanceFromYearEnd, 그때는 이미 이
  // 화면이 닫혀 있다), 올리는 건 Y7→Y8뿐인데 둘 다 'high'라 학교급이 같다. 즉 이 필드는
  // 방어용이다. 그래도 두는 이유: "결과 화면의 CG는 발생 학년으로 해석한다"를 전환 구현에
  // 의존하지 않게 만든다. year++를 applyYearTransition으로 옮기는 리팩터가 오면 이게 없으면
  // 조용히 깨진다(증상은 "다른 그림"이 아니라 **그림 없음** — 같은 id가 두 학교급에 다 있는
  // 이벤트는 4개뿐이고 전부 고정주차라, 못 찾으면 후보 0개 → 그라데이션 폴백).
  // 그 전제는 engine 테스트가 잠근다(applyYearTransition이 학교급을 바꾸지 않는다).
  year?: number;
};

/**
 * 주간 결산 소리의 방향 — **가장 크게 변한 축**의 부호로 정한다(합이 아니다).
 *
 * 5축(학업·멘탈·사교·건강·재능)은 단위가 다른 이종 축이라 더할 근거가 없고, 무엇보다
 * 그 합계는 화면 어디에도 표시되지 않는다(축별 델타만 배지로 보인다). 합으로 방향을 내면
 * 소리가 **화면에 없는 판정**을 주장하게 된다. 최대 변화 축을 쓰면 귀가 말하는 것과
 * 눈에 가장 크게 보이는 배지가 일치한다.
 *
 * - 최대 변화가 ±0.5 미만이면 침묵(매주 울리면 신호가 아니라 소음이다).
 * - 최대치가 동률인데 부호가 엇갈리면(학업 +3 / 멘탈 -3) 방향이 없는 주이므로 침묵.
 */
export function pickStatDirection(statChanges: Partial<Record<string, number>>): 'up' | 'down' | null {
  const deltas = Object.values(statChanges).map(v => v ?? 0);
  const peak = Math.max(...deltas.map(Math.abs), 0);
  if (peak < 0.5) return null;
  const dirs = new Set(deltas.filter(v => Math.abs(v) === peak).map(v => Math.sign(v)));
  if (dirs.size !== 1) return null;
  return dirs.has(1) ? 'up' : 'down';
}

// 결과 메시지 자동 줄바꿈 — 문장 끝(`.` `?` `!`, 따옴표 포함) 다음 공백에서 줄바꿈.
// 말줄임표(`...`)는 문장 경계가 아니므로 앞이 `[.!?]`인 경우 분할 제외.
export function breakSentences(text: string): string {
  return text.replace(/(?<![.!?])([.!?]"?)\s+(?=\S)/g, '$1\n');
}

// 피로도 → 라벨/색. 메인 HUD 와 주간 결산이 동일 기준을 쓰도록 SSOT.
export function getFatigueDisplay(fatigue: number): { label: string; color: string } {
  const label = fatigue < 20 ? '좋음' : fatigue < 35 ? '경미' : fatigue < 50 ? '주의' : fatigue < 70 ? '위험' : '극한!';
  const color = fatigue < 20 ? 'var(--green)' : fatigue < 35 ? 'var(--yellow)' : fatigue < 50 ? 'orange' : 'var(--red)';
  return { label, color };
}

// 다가오는 이벤트 — 시험 스케줄 SSOT(getExamSchedule) + 방학 임박 안내.
// 메인 화면 배너와 주간 결산 미리보기가 공유.
// tone: 'warn' 은 컨디션 경고 등 주의 라인 — 배너에서 노란 톤으로 구분 렌더.
export type UpcomingEvent = { text: string; tone?: 'warn' };

export function getUpcomingEvents(state: GameState): UpcomingEvent[] {
  const upcoming: UpcomingEvent[] = [];
  for (const [weekStr, examType] of Object.entries(getExamSchedule(state.year))) {
    const diff = Number(weekStr) - state.week;
    if (diff > 0 && diff <= 4) {
      let text = `${EXAM_TYPE_LABELS[examType]}까지 ${diff}주`;
      // 스테이지 전환 첫 시험 — 평가 방식이 달라졌음을 사전 예고 (내부 수치는 비공개)
      if (state.year === 2 && Number(weekStr) === 8) text += ' — 이제 성적표에 등수가 나온다';
      if (state.year === 5 && Number(weekStr) === 12) text += ' — 첫 모의고사, 전국 기준 등급';
      upcoming.push({ text });
    }
  }
  // 중등+ 시험 임박 컨디션 경고 — 시험 멘탈 페널티(examSystem)의 사전 짝.
  // 사후 총평("컨디션이 최악이었다")만 있으면 이미 늦은 정보라, 쉬기/벼락치기 결정이 가능한 시점에 노출.
  if (state.year >= 2 && state.mentalState !== 'normal') {
    const nearExam = Object.keys(getExamSchedule(state.year))
      .some(w => { const d = Number(w) - state.week; return d > 0 && d <= 2; });
    if (nearExam) {
      upcoming.push({
        text: state.mentalState === 'burnout'
          ? '이 컨디션으로 시험을 보면 실력이 안 나온다'
          : '지친 채로 시험을 보면 아는 것도 놓친다',
        tone: 'warn',
      });
    }
  }
  if (state.week >= 18 && state.week < 20) upcoming.push({ text: '여름방학이 다가온다' });
  if (state.week >= 40 && state.week < 43) upcoming.push({ text: '겨울방학이 다가온다' });
  return upcoming;
}
