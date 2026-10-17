import type { GameState, SemesterGoalKind } from './types';
import { getSchoolLevel } from './backgrounds';
import { absWeek } from './weekMath';
import { josa } from './korean';
import { GOAL_TARGET_WEEKS, SEMESTER_BOUNDS, goalTitle, npcNameOf } from './semesterGoal';

type MomentStage = 'first' | 'habit' | 'achieved';
type SchoolLevel = ReturnType<typeof getSchoolLevel>;

export interface SemesterGoalMoment {
  title: string;
  stage: MomentStage;
  label: string;
  text: string;
}

const LABELS: Record<MomentStage, string> = {
  first: '마음먹은 대로 보낸 주말',
  habit: '조금씩 내 일상이 된다',
  achieved: '나와 한 약속을 지켰다',
};

// 실행한 활동의 세부 종류나 능력치 상승을 지어내지 않는다. 같은 계열 안에서도
// 산책/수영, 독서/독학, 코딩/미술이 가능하므로 장면은 주인공의 선택과 감각에 머문다.
// 같은 계열에 학원 수업·입시 실기 레슨도 들어가므로 "스스로"·"입시 사이에서도"처럼 활동의
// 동기나 처지를 단정하지 않는다. 고1(Y5)도 고교 문장을 읽으니 시점(성적표·결과 대기)도 걸지 않는다.
const LINES: Record<Exclude<SemesterGoalKind, 'friend'>, Record<SchoolLevel, Record<MomentStage, string>>> = {
  exercise: {
    elementary: {
      first: '몸을 움직이고 돌아왔다. 이번 주말엔 생각만 하지 않았다.',
      habit: '주말에 뭘 할지 생각하다가, 몸을 움직일 시간을 먼저 남겨 뒀다.',
      achieved: '처음엔 한 번 해 보자는 마음이었다. 돌아보니 여러 주말을 그렇게 보냈다.',
    },
    middle: {
      first: '주말 하루를 몸 쓰는 데 썼다. 해 보겠다고 정한 일이 진짜 하루가 됐다.',
      habit: '이번 주에도 몸을 움직였다. 따로 결심하지 않아도 주말 계획에 들어 있었다.',
      achieved: '거창한 기록은 없어도, 운동하러 시간을 낸 주말들이 남았다. 내가 지킨 약속이었다.',
    },
    high: {
      first: '주말에 몸을 움직일 시간을 냈다. 이 시간도 내 주말에 넣기로 했으니까.',
      habit: '이번 주말에도 몸을 움직이는 시간을 남겼다. 이제는 계획에서 쉽게 지우고 싶지 않다.',
      achieved: '몸을 움직이겠다는 약속을 여러 번 지켰다. 그 시간만큼은 내가 골랐다.',
    },
  },
  study: {
    elementary: {
      first: '주말에도 공부할 시간을 냈다. 학기 초에 내가 정했던 일이다.',
      habit: '주말 계획에 공부할 시간을 적었다. 처음 적었을 때보다는 덜 낯설다.',
      achieved: '해 보겠다고 정한 뒤로 여러 번 해냈다. 이번엔 내가 나를 조금 믿어도 될 것 같다.',
    },
    middle: {
      first: '주말에 공부할 시간을 냈다. 학기 초에 마음먹었던 일을 하나 시작했다.',
      habit: '주말 공부가 몇 번 쌓였다. 책상 앞에 앉는 일이 처음보다 익숙해졌다.',
      achieved: '얼마나 달라졌는지는 아직 모르겠다. 그래도 내가 정한 시간에 공부했던 주말들은 남았다.',
    },
    high: {
      first: '주말의 한 자리를 공부에 썼다. 이번 학기에 내가 정한 일이었다.',
      habit: '계획대로 공부한 주말이 쌓였다. 정해 둔 시간을 지키는 일이 조금 덜 어렵다.',
      achieved: '확실히 아는 게 하나 있다. 마음먹었던 공부 시간을 여러 번 지켰다는 것.',
    },
  },
  craft: {
    elementary: {
      first: '좋아하는 것에 주말 시간을 써 봤다. 잘했는지보다, 직접 해 봤다는 게 먼저 생각났다.',
      habit: '주말에 또 좋아하는 것을 했다. 다음에도 해 보고 싶다는 생각이 남았다.',
      achieved: '처음엔 그냥 좋아서 시작했다. 여러 번 시간을 쓰고 나니, 내 주말 이야기 하나가 됐다.',
    },
    middle: {
      first: '내가 좋아하는 일에 주말 한 칸을 썼다. 아직 보여 줄 게 없어도 시작은 했다.',
      habit: '이번 주에도 좋아하는 일에 시간을 썼다. 다음 주말이 조금 기다려진다.',
      achieved: '완성했다고 부르기엔 아직일지 모른다. 그래도 계속해 보겠다는 약속은 지켰다.',
    },
    high: {
      first: '이번 학기에 해 보기로 한 일에 주말 한 칸을 썼다. 정해 둔 일을 미루지 않았다.',
      habit: '정해 둔 일에 쓸 시간을 또 남겼다. 이 시간은 계속 지키고 싶다.',
      achieved: '하고 싶다고 정한 일에 시간을 쓴 주말들이 있었다. 이 학기를 그렇게도 기억하고 싶다.',
    },
  },
};

function friendLine(stage: MomentStage, npcId: string | undefined): string {
  const withName = josa(npcNameOf(npcId), '와/과');
  if (stage === 'first') return `${withName} 주말을 보냈다. 같이 시간을 보내겠다는 생각이, 이번엔 실제 약속이 됐다.`;
  if (stage === 'habit') return `${withName} 보낸 주말이 조금씩 쌓인다. 다음 주말 계획을 세울 때도 그 이름이 떠올랐다.`;
  return `${withName} 시간을 보내려고 여러 번 주말을 비워 뒀다. 함께한 시간만큼은 이번 학기에 분명히 남았다.`;
}

/**
 * 첫 실천·중간·달성한 주에만 읽는 짧은 장면. 기존 실행 기록에서 파생하므로 보상,
 * 난수, 세이브 형식은 바뀌지 않는다. 재접속해 같은 결산을 보면 같은 장면을 읽는다.
 * state.week은 이미 다음 주일 수 있으므로 반드시 weekLog의 좌표로 판정한다.
 * 학기 마지막 주는 기존 학기말 회고가 맡아 두 카드를 겹치지 않는다.
 */
export function goalMomentForWeekLog(
  state: Pick<GameState, 'weekLog' | 'semesterGoal'>,
): SemesterGoalMoment | null {
  const log = state.weekLog;
  const goal = state.semesterGoal;
  if (!log || log.year == null || log.week == null || !goal || goal.year !== log.year) return null;
  const bounds = SEMESTER_BOUNDS[goal.semester];
  if (log.week < bounds.start || log.week >= bounds.end) return null;
  const stamp = absWeek(log.year, log.week);
  if (!goal.markedWeeks.includes(stamp)) return null;
  const firstStamp = absWeek(goal.year, bounds.start);
  const count = new Set(goal.markedWeeks.filter(w => w >= firstStamp && w <= stamp)).size;
  const stage: MomentStage | null = count === GOAL_TARGET_WEEKS ? 'achieved'
    : count === Math.ceil(GOAL_TARGET_WEEKS / 2) ? 'habit'
    : count === 1 ? 'first' : null;
  if (!stage) return null;
  return {
    title: goalTitle(goal), stage, label: LABELS[stage],
    text: goal.kind === 'friend' ? friendLine(stage, goal.npcId)
      : LINES[goal.kind][getSchoolLevel(goal.year)][stage],
  };
}
