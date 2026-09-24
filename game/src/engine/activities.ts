import { Activity, GameState } from './types';
import { getSchoolLevel } from './backgrounds';
import { getExamSchedule } from './examSystem';

/** 마지막 학년(고3). 이 게임은 초6~고3 7년이다.
 *  주의: 아직 SSOT가 아니다 — 같은 "7"이 `gameEngine`(학년 전환·졸업), `store`, `examSystem`,
 *  `talkSystem`, `relationshipSignals`에 리터럴로 남아 있다. 지금은 값이 같아 무해하지만,
 *  한쪽만 바뀌면 라벨이 거짓말한다(#441). 옮길 때 같이 옮길 것. */
export const FINAL_YEAR = 7;

/**
 * 수능 **다음** 주. 이 주부터 '수능 이후' 활동이 열린다.
 *
 * 하드코딩하지 않고 시험 일정 SSOT(`getExamSchedule`)에서 파생한다 — 수능 주를 옮기면
 * 활동 게이트가 따라와야 하고, 두 숫자가 따로 놀면 "수능 전에 열리는 수능 이후 활동"이나
 * 반대로 영영 안 열리는 활동이 조용히 생긴다.
 */
export const POST_SUNEUNG_WEEK: number = (() => {
  const week = Object.entries(getExamSchedule(FINAL_YEAR))
    .find(([, type]) => type === 'suneung')?.[0];
  if (week === undefined) {
    throw new Error(`Y${FINAL_YEAR} 시험 일정에 수능이 없다 — 수능 이후 활동의 기준점이 사라졌다`);
  }
  return Number(week) + 1;
})();

// 학년별 비용 차등 헬퍼 — 현실 고증 (초등 종합반 < 중등 입시 < 고등 단과)
// yearlyCost가 정의된 활동만 학년 차등, 그 외는 base moneyCost 그대로.
//
// 학교급 경계는 backgrounds.getSchoolLevel(기존 SSOT, 8개 모듈 공용)을 쓴다. 인라인 사본이었을 때는
// 수입 곡선(parentModifiers.getWeeklyIncome)과 경계가 어긋날 수 있었고, 비용과 수입이 서로 다른
// 지점에서 꺾이면 "학원비만 오르고 용돈은 그대로"인 구간이 생긴다(v8.1까지 실제로 그랬다).
export function getActivityCost(activity: Pick<Activity, 'moneyCost' | 'yearlyCost'>, year: number): number {
  if (!activity.yearlyCost) return activity.moneyCost;
  return activity.yearlyCost[getSchoolLevel(year)] ?? activity.moneyCost;
}

// NPC 동행 선택이 열리는 활동(선택 시 친밀도 +3 부여) — SlotEditPopup·activityHints 공용 SSOT.
// category와 무관: study-group은 category 'study'지만 동행 활동이고, 같은 social이라도 sns 등은 동행 아님.
export const NPC_COMPANION_ACTIVITIES: string[] = ['hang-out', 'club', 'study-group', 'overdue-meetup'];

// v6.2: 활동 기본값 전면 하향 — 7년 장기 레이스에 맞는 Y1 성장 속도
// 목표: 일반 플레이어 Y1 종료 시 주력 스탯 50~60, 집중형 65~75
export const ACTIVITIES: Activity[] = [
  // === 공부 계열 ===
  {
    id: 'self-study', name: '독학', slots: 1, fatigue: 5,
    effects: { academic: 1.5 }, moneyCost: 0, category: 'study',
    description: '혼자서 묵묵히 공부한다.',
    flavor: '조용히 책상에 앉아 진도를 뺀다. 집중이 잘 되는 날도 있고, 아닌 날도 있다.',
    tags: ['집중', '혼자', '꾸준함'],
  },
  {
    // T28: 피로 7 → 4. 유료 상위 규약("효율↑ 피로↓를 돈으로 산다" — 독서실 2.0/f4 vs 독학 1.5/f5)을
    // 학업 축의 유료 짝이 정면으로 어기고 있었다. 학원은 인강(academic 1.5/f4/1만)과 **학업이 같은데**
    // 피로가 +3이고 값은 3배라, 상위가 아니라 완전 열위였다. 유일한 플러스인 social 0.4는
    // 피로 +3이 다른 축에서 빼앗아 가는 양보다 작았다.
    //
    // 값(1.5)·가격(3만)은 건드리지 않는다. 주당 축 상한(+2)이 물려 있어 학업 값 인상은 눌린
    // 구간에서만 먹히고(T24 실측), 가격은 "고등 루틴 고정비 5만 = 수입 5만" 등식을 깬다.
    // **실효 지렛대는 피로다** — 피로는 getFatigueModifier로 그 주의 *모든* 양수 성장에 곱해지고,
    // tired/burnout 게이트(mental<20 || (mental<25 && fatigue>70))로 배율 0.75·0.35를 부른다.
    //
    // 7년 96시드 격리 실측(슬롯3=가벼운운동 고정, 슬롯2만 교체 · 주말 독학+동아리):
    //   인강(f4)   수능점수 89.51 · 등급 2.27 · SKY  9/96 · 지침  0.0% · 관계 87.6 · 잔액 1282만
    //   학원 f7    수능점수 85.23 · 등급 2.91 · SKY  0/96 · 지침 16.9% · 관계 90.3 · 잔액  800만
    //   학원 f5    수능점수 88.65 · 등급 2.45 · SKY  3/96 · 지침  0.3%
    //   학원 f4    수능점수 89.21 · 등급 2.30 · SKY 11/96 · 지침  0.0% · 관계 91.1
    //   학원 f3    수능점수 90.48 · 등급 1.97 · SKY 20/96 · 지침  0.0%
    // f7은 482만을 더 쓰고 수능이 0.64등급 떨어지고 SKY가 9 → 0이었다. f5로도 회복되지 않는다.
    //
    // 4인 이유는 "대안과 같은 칸"이 이 짝의 최소 조건이기 때문이다. 48주 단일시드 대조에서
    // 학원 f4는 인강과 학업·체력·멘탈·특기가 **소수점까지 동일**하고 관계만 24.4 → 28.2로 앞선다.
    // 즉 f4에서 비로소 "같은 피로로 social을 더 받는" 상위가 된다.
    // f4의 잔여 −0.30점(89.21 vs 89.51)은 배치 차이가 아니라 시드 노이즈다 — **같은 배치를
    // 다른 시드 블록(201~296)으로 다시 재면** 무료 대안이 89.33 · SKY 12/96, 학원 f4가
    // 89.35 · SKY 9/96로 부호가 뒤집힌다. f3은 더 앞서지만 필요 이상의 변경이다.
    id: 'academy', name: '학원 수업', slots: 1, fatigue: 4,
    // 학원에서 친구들과 어울리는 부수효과 — 비싼 만큼 social 보너스
    effects: { academic: 1.5, social: 0.4 }, moneyCost: 3, category: 'study',
    // 초등 종합반 2만 / 중등 입시 3만 / 고등 단과 3만.
    // 고등만 현실 고증(4만)을 깎았다 — 4만이면 `gym`(2만)과 묶어 쓰는 기본 루틴이 6만이 되어
    // 고등 수입 5만을 넘고, 주 −1만 적자로 Y5~Y7 루틴이 48주 중 26~29주 실패했다(sim 실측).
    // 루틴은 매주 반복되는 슬롯이라 그 실패가 곧 "설정한 일과의 절반이 안 돌아감"이다.
    // 3만이면 루틴 고정비 5만 = 수입 5만으로 **학기 중** 잉여 0이다. 재량 예산은 루틴이 아예
    // 안 도는 방학 11주에서 나온다(applyRoutineActivities의 `if (!state.isVacation)`) — 그게
    // 상점을 쓸 돈이다. 4만일 때 이 빌드의 7년 총 잔액은 8만이었고 상점은 17종·66.5만이라
    // 사실상 장식이었다. 적자를 없애는 것과 재량을 만드는 것이 같은 조정이다.
    yearlyCost: { elementary: 2, middle: 3, high: 3 },
    description: '학원에서 체계적으로 배운다.',
    vacationDescription: '학원에서 방학 단기특강을 듣는다.',
    flavor: '학원 셔틀을 타고 간다. 같은 반 친구들이랑 떡볶이 먹고 가는 길도 즐겁다.',
    tags: ['체계적', '비용 있음', '고효율', '친구'],
    // 비용 리터럴이 위 yearlyCost와 중복 — 둘이 어긋나면 게이트와 실제 차감이 달라진다.
    requires: (s) => s.money >= getActivityCost({ moneyCost: 3, yearlyCost: { elementary: 2, middle: 3, high: 3 } }, s.year),
  },
  {
    id: 'study-group', name: '스터디 그룹', slots: 1, fatigue: 4,
    effects: { academic: 1.5, social: 0.5 }, moneyCost: 0, category: 'study',
    description: '친구들과 함께 공부한다.',
    flavor: '카페에 모여 각자 공부하다가, 모르는 거 있으면 물어본다. 은근 효율적.',
    tags: ['친구', '협동', '변수 있음'],
  },
  {
    id: 'internet-lecture', name: '인강 시청', slots: 1, fatigue: 4,
    effects: { academic: 1.5 }, moneyCost: 1, category: 'study',
    description: '인터넷 강의를 듣는다.',
    flavor: '이어폰 끼고 인강을 튼다. 1.5배속으로 들으면 시간이 절약되지만, 졸릴 때도 있다.',
    tags: ['효율적', '저렴', '졸릴 수 있음'],
    requires: (s) => s.money >= 1,
  },
  {
    // QA C7-A: 고비용 학업 활동 — 돈 sink. 누적된 용돈을 학업 효율로 환원.
    // 유료라 applyActivity 의 "무료활동 80+ ×0.1" 캡을 면제받아 고구간에서 독학보다 효과적이되,
    // getDiminishingReturn·effectiveAcademic 소프트캡은 그대로 적용 → 돈으로 효율을 사는 것이지
    // 캡(수능 천장)을 우회하지 않음. wealth 부모(넉넉한 용돈)가 비로소 실질 어드밴티지가 됨.
    // QA C7-B: 고1(Y5)부터로 확대 + 비용 15→28. 이전엔 돈이 너무 흔해(791 적립) 비-wealth도 다 사서
    //   wealth 차별성이 없었다. 비용을 올려 고3 과외를 wealth만 매주 감당 → 돈 드레인 + 학업 격차 발생.
    id: 'private-tutoring', name: '집중 과외', slots: 1, fatigue: 9,
    effects: { academic: 2.5 }, moneyCost: 28, category: 'study',
    requires: (s) => s.year >= 5 && s.money >= 28,
    unlockYear: 5,
    description: '입시 전문 과외 선생님과 1:1로 약점을 짚는다.',
    flavor: '시간당 비싸지만 밀도가 다르다. 모르는 걸 그 자리에서 메운다. 다만 통장은 빠르게 가벼워진다.',
    tags: ['고3', '학업', '고효율', '고비용'],
  },
  {
    id: 'reading', name: '독서', slots: 1, fatigue: 2,
    effects: { academic: 0.5, talent: 0.5, mental: 1 }, moneyCost: 0, category: 'study',
    description: '책을 읽으며 여유를 즐긴다.',
    flavor: '좋아하는 책에 빠져든다. 공부는 아니지만, 뭔가 머릿속이 넓어지는 기분.',
    tags: ['여유', '멘탈 회복', '다재다능'],
  },
  {
    id: 'library', name: '도서관 자습', slots: 1, fatigue: 3,
    effects: { academic: 1, mental: 0.5 }, moneyCost: 0, category: 'study',
    description: '조용한 도서관에서 공부한다.',
    flavor: '도서관 자습실에 앉았다. 옆 사람이 열심히 하는 걸 보면 나도 집중이 된다.',
    tags: ['무료', '집중', '안정적'],
  },
  // === 운동 계열 ===
  {
    id: 'light-exercise', name: '가벼운 운동', slots: 1, fatigue: 2,
    effects: { health: 1.5, mental: 1 }, moneyCost: 0, category: 'exercise',
    description: '산책, 조깅 등으로 기분 전환.',
    flavor: '동네 한 바퀴를 뛴다. 바람이 시원하다. 머리가 맑아지는 느낌.',
    tags: ['가벼움', '기분 전환', '멘탈 회복'],
  },
  {
    id: 'school-sports', name: '학교 체육부', slots: 1, fatigue: 9,
    effects: { health: 2.5, talent: 1, social: 0.5 }, moneyCost: 0, category: 'exercise',
    description: '방과후 체육부 활동.',
    flavor: '운동장에서 땀을 흘린다. 힘들지만, 같이 뛰는 애들이 있으니 버틸 만하다.',
    tags: ['고효율', '고피로', '친구', '활동적'],
  },
  {
    // T28: 피로 7 → 3. 가벼운 운동(health 1.5 + mental 1 / f2 / 무료)의 유료 상위인데 **효과 합이
    // 2.5로 같고**(무게만 체력 쪽으로 옮겨감) 피로가 3.5배였다. 2만을 내고 체력 몇 점을 사는 대신
    // 그 주의 모든 성장에 곱해지는 피로 배율을 잃는 거래라, 1차 결과에서 무료가 이겼다.
    //
    // 7년 96시드 격리 실측(슬롯2=인강 고정, 슬롯3만 교체 · 주말 독학+동아리):
    //   가벼운 운동(f2)  수능점수 89.51 · 등급 2.27 · SKY 9/96 · 지침  0.0% · 체력 79.5 · 잔액 1282만
    //   헬스 f7          수능점수 84.16 · 등급 2.97 · SKY 0/96 · 지침 20.8% · 체력 81.2 · 잔액  812만
    //   헬스 f5          수능점수 88.27 · 등급 2.46 · SKY 5/96 · 지침  4.7% · 체력 81.6
    //   헬스 f4          수능점수 88.63 · 등급 2.46 · SKY 5/96 · 지침  0.2% · 체력 82.1
    //   헬스 f3          수능점수 89.67 · 등급 2.24 · SKY 9/96 · 지침  0.0% · 체력 82.9
    // f7은 470만을 더 쓰고 체력 1.7을 얻는 대가로 수능이 0.7등급 떨어지고 SKY가 9 → 0이었다.
    //
    // 3인 이유(4가 아니라): f4는 7년 96시드에서 아직 수능점수 −0.88 · SKY 5 vs 9로 열위이고,
    // 48주 단일시드 대조에서도 학업이 무료와 **동률**(84.4)에 그치며 관계·멘탈·특기가 전부
    // 아래였다(합 306.5 vs 310.1). f3에서 처음으로 1차 결과가 대등해지고(89.67/2.24/9-9)
    // 무관한 축까지 앞선다(48주 학업 84.6 · 체력 78.0 vs 71.9 · 합 312.6).
    // 2로 더 내리지 않는 것은 가벼운 운동(f2)보다
    // "PT가 더 고되다"는 결을 남기기 위해서다 — T24가 예체능 레슨에 쓴 것과 같은 술어로,
    // 유료의 피로 프리미엄은 **1칸까지**다.
    id: 'gym', name: '헬스/PT', slots: 1, fatigue: 3,
    effects: { health: 2, mental: 0.5 }, moneyCost: 2, category: 'exercise',
    description: '체계적으로 운동한다.',
    flavor: '트레이너가 자세를 잡아준다. 근육이 아프지만 뿌듯하다.',
    tags: ['체계적', '비용 있음', '성장 확실'],
    requires: (s) => s.money >= 2,
  },
  // === 관계 계열 ===
  {
    id: 'hang-out', name: '친구와 놀기', slots: 1, fatigue: 3,
    effects: { social: 2, mental: 2 }, moneyCost: 1, category: 'social',
    description: '친구와 즐거운 시간을 보낸다.',
    flavor: '같이 웃고 떠들다 보면 시간이 훌쩍 간다. 이런 시간이 필요했어.',
    tags: ['즐거움', '멘탈 회복', '추억'],
  },
  {
    id: 'sns-activity', name: 'SNS 활동', slots: 1, fatigue: 2,
    effects: { social: 1, mental: -1 }, moneyCost: 0, category: 'social',
    description: '온라인에서 친구들과 소통한다.',
    flavor: '피드를 넘기다 보니 한 시간이 지났다. 재밌긴 한데... 좀 허무하다.',
    tags: ['간편', '인기 상승', '멘탈 주의'],
  },
  {
    id: 'club', name: '동아리 활동', slots: 1, fatigue: 4,
    effects: { social: 1, talent: 1, mental: 0.5 }, moneyCost: 0, category: 'social',
    description: '동아리에서 활동한다.',
    flavor: '같은 취미를 가진 사람들과 함께하는 시간. 학교에서 가장 좋아하는 시간.',
    tags: ['취미', '친구', '특기 성장'],
  },
  // === 자기계발 계열 ===
  {
    // T24: 피로 6 → 4. 유료 상위 활동의 설계 규약("효율↑ 피로↓를 돈으로 산다" — 독서실 2.0/f4
    // vs 독학 1.5/f5)을 특기 축만 어기고 있었다. 창작 활동(1.5/f3/무료)의 유료 상위인데 피로가
    // 오히려 2배라, 18주를 돌리면 **무료가 이겼다**(2칸 배치: 유료 52.6 vs 무료 54.9).
    //
    // 값(2.0)은 안 올린다. 주당 축 상한(+2)이 이미 물려 있어 특기 25~45·피로 0 구간에서는
    // 2.0이든 3.0이든 결과가 똑같이 2.00이다 — 값 인상은 눌린 상태에서만 먹힌다.
    //
    // **실효 지렛대는 번아웃 게이트다.** 게이트 조건은
    // `mental < 20 || (mental < 25 && fatigue > 70)`이고, 번아웃에 걸리면 성장 배율이 0.35로
    // 떨어진다(tired는 0.75). 2칸 배치 주차별 추적:
    //   피로 6 → 12주차에 burnout 진입, 4주간 주당 증가가 +1.5에서 +0.7로 반토막
    //   피로 4 → burnout 0주, tired로 버티며 매주 +1.5~1.9 유지
    // 즉 역전은 "피로가 조금 줄어서"가 아니라 **번아웃을 안 밟아서** 풀린다. 그리고 그 함정의
    // 가장 날카로운 형태가 이것이었다 — 돈을 내는 쪽만 번아웃을 밟고, 무료 창작 2칸은 지침 0주였다.
    //
    // 5가 아니라 4인 이유는 게이트 여유다. 2칸 배치 최저 멘탈이 피로 5에서 27(게이트 25에 **2점**
    // 차), 4에서 37(**12점**)이다. 5는 다른 활동의 피로가 조금만 올라가도 이득이 증발한다.
    //
    // 실측(부유·초6·18주): 1칸 43.3 vs 무료 40.1 · 2칸 58.4 vs 무료 54.9.
    // 피로 계단에서 4는 동아리·봉사·자유학기·독서실이 쓰는 칸이고, 무료 창작(3)보다는 여전히
    // 위라 "전문 레슨은 더 고되다"는 결이 남는다.
    // Y6 상위 활동과의 순서도 그대로다(입시 실기 74.2 > 예체능 71.5 > 창작 67.4).
    id: 'art-lesson', name: '예체능 레슨', slots: 1, fatigue: 4,
    effects: { talent: 2.0 }, moneyCost: 2, category: 'talent',
    description: '음악/미술/체육 레슨을 받는다.',
    flavor: '선생님의 지도를 받으며 실력을 갈고닦는다. 느리지만 확실히 늘고 있다.',
    tags: ['전문적', '비용 있음', '특기 집중'],
    requires: (s) => s.money >= 2,
  },
  {
    id: 'creative', name: '창작 활동', slots: 1, fatigue: 3,
    effects: { talent: 1.5, mental: 1 }, moneyCost: 0, category: 'talent',
    description: '글쓰기, 그림, 작곡 등에 몰두한다.',
    flavor: '좋아하는 것에 빠져들면 시간 가는 줄 모른다. 이게 나만의 세계.',
    tags: ['자유', '멘탈 회복', '표현'],
  },
  {
    id: 'coding', name: '코딩 독학', slots: 1, fatigue: 5,
    effects: { academic: 0.5, talent: 1.5 }, moneyCost: 0, category: 'talent',
    description: '프로그래밍을 독학한다.',
    flavor: '코드가 돌아가는 순간의 쾌감. 에러가 나면 답답하지만, 그것도 배움이다.',
    tags: ['미래형', '논리적', '성취감'],
  },
  {
    id: 'volunteer', name: '봉사 활동', slots: 1, fatigue: 4,
    effects: { social: 1.5, mental: 1 }, moneyCost: 0, category: 'social',
    description: '봉사활동에 참여한다.',
    flavor: '누군가를 돕고 나면 마음이 따뜻해진다. 생기부에도 좋다.',
    tags: ['따뜻함', '생기부', '보람'],
  },
  // === 휴식 계열 ===
  {
    id: 'rest', name: '휴식', slots: 1, fatigue: -10,
    effects: { mental: 2, health: 1 }, moneyCost: 0, category: 'rest',
    description: '아무것도 안 하고 푹 쉰다.',
    flavor: '이불 속에서 뒹굴거린다. 아무 생각 없이. 가끔은 이런 시간이 필요해.',
    tags: ['회복', '피로 해소', '여유'],
  },
  {
    id: 'deep-rest', name: '푹 쉬기', slots: 2, fatigue: -22,
    effects: { mental: 5, health: 2 }, moneyCost: 0, category: 'rest',
    description: '푹 쉬어 완전히 회복한다.',
    flavor: '방해 없이 온전히 쉴 수 있는 시간. 평소엔 짓눌리던 게 풀린다.',
    tags: ['완전 회복', '2슬롯', '리셋'],
  },
  {
    id: 'gaming', name: '게임/영상', slots: 1, fatigue: -5,
    effects: { mental: 1 }, moneyCost: 0, category: 'rest',
    description: '게임하거나 영상을 본다.',
    flavor: '좋아하는 게임을 하거나 유튜브를 본다. 생산적이진 않지만... 행복하다.',
    tags: ['가벼운 휴식', '즐거움'],
  },
  {
    id: 'park-walk', name: '공원 산책', slots: 1, fatigue: -1,
    effects: { mental: 1.5, health: 0.5 }, moneyCost: 0, category: 'rest',
    description: '공원에서 여유롭게 산책한다.',
    flavor: '벤치에 앉아 하늘을 올려다본다. 바람이 좋다. 생각이 정리되는 느낌.',
    tags: ['산책', '여유', '체력 미세 회복'],
  },
  // === 부모 전용 ===
  {
    id: 'study-with-parent', name: '부모와 같이 공부', slots: 1, fatigue: 3,
    effects: { academic: 1.5, mental: 0.5 }, moneyCost: 0, category: 'parent',
    parentEffect: { baseDelta: 0.6, tag: 'familyTime' },
    description: '부모님과 함께 공부한다.',
    flavor: '"이거 이렇게 풀면 되지 않아?" 엄마가 옆에서 알려준다. 느리지만 든든하다.',
    tags: ['안정적', '무료', '따뜻함'],
    requires: (s) => s.parents.includes('emotional'),
  },
  {
    id: 'family-dinner', name: '가족 저녁시간', slots: 1, fatigue: -2,
    effects: { mental: 2 }, moneyCost: 0, category: 'parent',
    parentEffect: { baseDelta: 0.5, tag: 'familyTime' },
    description: '가족과 따뜻한 저녁 시간을 보낸다.',
    flavor: '"오늘 학교 어땠어?" 밥을 먹으며 이야기한다. 별거 아닌데 마음이 편해진다.',
    tags: ['피로 회복', '가족', '멘탈 회복'],
    // 게이트 해제 — 비-emotional 가정도 부모와 시간을 보낼 수 있어야 함 (emotional은 familyTime 1.4배)
  },
  // === 알바 ===
  {
    id: 'part-time', name: '편의점 알바', slots: 1, fatigue: 9,
    effects: { social: 0.5, mental: -1 }, moneyCost: -3,
    // 학년 올라갈수록 시급 인상 (Y4 중3 -3만, Y5~7 고등 -4만 — 약 33% 인상)
    yearlyCost: { middle: -3, high: -4 },
    // Phase 4B: "자립"은 자기주도(autonomyChoice) 신호 — freedom 1.4배(환영)·strict 0.6배(못마땅)로 강점별 반응이 갈린다.
    //           freedom 절정의 일반 트리거 도달 경로를 미니이벤트 외에 하나 더 확보(게임체크 항목4).
    parentEffect: { baseDelta: 0.4, tag: 'autonomyChoice' },
    category: 'work',
    requires: (s) => s.year >= 4, // short-term-job과 일관 — 현재 category 게이트(year<4)와 이중이나, 향후 category 조건 변경 시 Y1~3 노출 방어
    unlockYear: 4,
    description: '편의점에서 일하며 돈을 번다.',
    flavor: '"어서오세요~" 반복되는 인사. 힘들지만 통장 잔고가 올라가는 건 뿌듯하다.',
    tags: ['수입', '고피로', '자립'],
  },

  // === 학년 해금 계열 ===
  {
    id: 'free-semester', name: '자유학기 진로체험', slots: 1, fatigue: 4,
    // 자유학기제는 중1 — 시험이 없는 해에 진로탐색·주제선택·예술체육을 한다. 학업 축이 아니다.
    effects: { talent: 1.5, social: 1 }, moneyCost: 0, category: 'talent',
    requires: (s) => s.year >= 2,
    unlockYear: 2,
    description: '자유학기 프로그램으로 이것저것 해본다.',
    flavor: '시험이 없는 학기. 뭘 해도 성적표에 안 남는다는 게 이상하게 홀가분하다.',
    tags: ['중학', '진로', '시험 없음'],
  },
  {
    id: 'study-room', name: '독서실 정기권', slots: 1, fatigue: 4,
    // 독학(1.5/f5/무료)의 유료 상위 — 환경을 사서 효율↑ 피로↓. 유료라 80+ 캡을 면제받는다.
    effects: { academic: 2 }, moneyCost: 3, category: 'study',
    requires: (s) => s.year >= 3 && s.money >= 3,
    unlockYear: 3,
    description: '독서실에 자리를 끊고 다닌다.',
    flavor: '내 이름이 붙은 칸막이 자리. 앉으면 딴짓할 구실이 없어진다.',
    tags: ['집중', '비용 있음', '내 자리'],
  },
  {
    id: 'supplementary-class', name: '보충수업', slots: 1, fatigue: 5,
    // 고등학교 방과후 보충 — 자율학습과 세트. 유료라 학업 80+ 캡을 면제받는다(무료 자율학습과의 대비).
    effects: { academic: 1.8, social: 0.3 }, moneyCost: 2, category: 'study',
    requires: (s) => s.year >= 5 && s.money >= 2,
    unlockYear: 5,
    description: '방과후 보충수업을 신청해 듣는다.',
    flavor: '7교시가 끝나고 8교시가 시작된다. 창밖은 벌써 어둡다.',
    tags: ['고등', '학교', '비용 있음'],
  },
  {
    // id는 세이브 호환(routineSlot/weekendChoice에 id가 저장됨) 때문에 'night-study' 유지.
    // 표시명은 '야간자율학습'이 아니라 '학교 자율학습' — 2칸 활동은 SlotEditPopup의 루틴 필터
    // (slots === 1)에 걸려 주말·방학 슬롯에만 뜬다. 평일 야자를 뜻하는 이름이면 배치 위치와 어긋난다.
    // (평일 야자 자체는 이벤트·잡담 텍스트에 서사로 남아 있다.)
    id: 'night-study', name: '학교 자율학습', slots: 2, fatigue: 12,
    // 2칸 무료 — 시간으로 값을 치른다. 학업은 80+에서 ×0.1 캡에 걸리지만 캡은 스탯별이라
    // 사회성 쪽은 후반에도 살아남는다(같이 자습하는 친구). 유료 보충수업과 무료/유료 대비를 이룬다.
    effects: { academic: 2, social: 1, mental: -1 }, moneyCost: 0, category: 'study',
    requires: (s) => s.year >= 5,
    unlockYear: 5,
    description: '자습실에 남아 하루를 통째로 쓴다.',
    flavor: '문 여는 시간에 들어가 문 닫는 시간에 나온다. 매점 불빛만 유난히 밝다.',
    tags: ['고등', '장시간', '무료'],
  },
  {
    id: 'practical-lesson', name: '입시 실기 레슨', slots: 1, fatigue: 7,
    // 예체능 입시 — art-lesson(2.0/2만)의 상위. 특기 빌드의 80+ 통로.
    effects: { talent: 2.8 }, moneyCost: 4, category: 'talent',
    requires: (s) => s.year >= 6 && s.money >= 4,
    unlockYear: 6,
    description: '입시 실기를 전문 레슨으로 준비한다.',
    flavor: '선생님이 시험장 기준으로 다시 잡아준다. 취미로 하던 것과는 다른 종류의 피로.',
    tags: ['입시', '고비용', '특기 집중'],
  },
  {
    id: 'mentoring', name: '후배 멘토링', slots: 1, fatigue: 4,
    effects: { social: 1.2, academic: 0.8, mental: 0.5 }, moneyCost: 0, category: 'social',
    requires: (s) => s.year >= 6,
    unlockYear: 6,
    description: '후배들의 공부를 봐준다.',
    flavor: '설명하다 막히는 데가 내가 모르는 데였다. 가르치면서 내가 배운다.',
    tags: ['고등', '관계', '가르치며 배움'],
  },

  // ===== Y7 수능 이후 3종 =====
  // 수능은 Y7 W35에 끝나는데 학년은 W48까지 간다 — **13주가 남는데 그동안 열리는 게 하나도 없었다.**
  // (Y6은 2종, Y5는 3종이 열린다. Y7만 0이었다.)
  //
  // **수능 점수는 W35에 확정된다** — 직전 모의 2회와 내신으로 계산되고
  // (`examSystem.generateSuneungResult`) Y7 일정에 수능은 W35 하나뿐이라 재계산이 없다.
  //
  // **그렇다고 진로 갈래까지 확정된 건 아니다.** `ending.determineCareer`는 mockGrade 말고
  // 졸업 시점의 라이브 스탯도 읽는다 — talent 85/90 · academic 70/80/85/88 · mental 15/30/40이
  // 절벽이다. 그러니 이 13주의 스탯도 진로를 바꿀 수 있다. **다만 그건 이 3종이 연 통로가 아니다** —
  // 수능 이후에도 학업 13종·특기 8종이 그대로 열려 있고 전부 신규보다 세다(실측: talent 절벽 85를
  // `art-lesson`은 루틴 2칸으로 넘는데 `license-course`는 4칸을 다 써야 겨우 닿는다. academic도
  // 기존 2종이 +1.4/주인데 `admission-prep`을 섞으면 +1.3/주로 오히려 내려간다). **신규가 그 통로를
  // 넓히지 않는 것**이 아래 수치의 제약 조건이다.
  //
  // 무게를 두는 곳은 따로 있다. **행복 궤적은 48주 전부를 표본으로 삼으므로**
  // (`ending.HAPPINESS_WEEKS_PER_YEAR`) 이 13주가 Y7 행복의 27%다. 그래서 세 활동의 무게를
  // **mental·social**에 둔다. mental은 주당 +2 축 상한에서 면제된 유일한 축이라(`applyActivity`)
  // 이 구간에서 실효 지렛대고, social은 `determineCareer`가 읽지 않는 유일한 축이다.
  //
  // 셋 다 `slots: 1` · 비-rest라 **루틴 슬롯에도 들어간다**(SlotEditPopup의 후보 필터 조건).
  // 단 루틴에 박으면 동행이 안 붙는다 — `companionEligible`이 routine1/2를 제외하므로
  // `overdue-meetup`의 NPC 선택과 친밀도 +3은 주말/방학 슬롯에서만 붙는다(`hang-out`과 같은 규칙).
  // 학기(W36~42)와 겨울방학(W43~48) 양쪽에서 열려야 하므로 seasonGate는 두지 않는다.
  {
    id: 'license-course', name: '운전면허 학원', slots: 1, fatigue: 5,
    effects: { mental: 2, talent: 0.5 }, moneyCost: 4, category: 'talent',
    requires: (s) => s.year === FINAL_YEAR && s.week >= POST_SUNEUNG_WEEK && s.money >= 4,
    unlockYear: FINAL_YEAR,
    description: '수능이 끝나고 처음으로 학교 밖의 자격을 딴다.',
    flavor: '핸들을 처음 잡았다. 배우는 것 중에 시험이 아닌 게 12년 만이었다.',
    tags: ['고등', '수능 이후', '어른의 문턱'],
  },
  {
    id: 'admission-prep', name: '원서·면접 준비', slots: 1, fatigue: 6,
    effects: { academic: 1, social: 1, mental: -1 }, moneyCost: 0, category: 'study',
    requires: (s) => s.year === FINAL_YEAR && s.week >= POST_SUNEUNG_WEEK,
    unlockYear: FINAL_YEAR,
    description: '자소서를 고치고 면접을 연습한다. 결과는 이미 정해졌는데도 손이 떨린다.',
    flavor: '같은 문장을 스무 번 고쳤다. 고칠수록 내 얘기가 아닌 것 같았다.',
    tags: ['고등', '수능 이후', '불안'],
  },
  {
    id: 'overdue-meetup', name: '밀린 약속', slots: 1, fatigue: 3,
    effects: { social: 1.5, mental: 2.5 }, moneyCost: 1, category: 'social',
    requires: (s) => s.year === FINAL_YEAR && s.week >= POST_SUNEUNG_WEEK && s.money >= 1,
    unlockYear: FINAL_YEAR,
    description: '"수능 끝나고 보자"고 미뤄둔 사람을 만난다.',
    flavor: '그 말을 몇 번이나 했는지 모른다. 이번엔 진짜로 만났다.',
    tags: ['고등', '수능 이후', '관계'],
  },

  // ===== Phase 1: 방학 전용 활동 9종 =====
  // 무료 4개 (가난한 가정 보장)
  {
    id: 'vacation-library',
    name: '방학 도서관 몰입', slots: 2, fatigue: 3,
    effects: { academic: 3, mental: 1 }, moneyCost: 0,
    category: 'study',
    seasonGate: 'vacation-only',
    catchupBonus: { targetStat: 'academic', threshold: 50, bonus: 0.5 },
    description: '도서관에서 종일 자습한다.',
    flavor: '에어컨 시원한 자리, 교재 한 권. 방학에만 가능한 호흡.',
    tags: ['방학', '학업', '무료'],
  },
  {
    id: 'creative-project',
    name: '장기 창작 프로젝트', slots: 2, fatigue: 5,
    effects: { talent: 3, mental: 1 }, moneyCost: 0,
    category: 'talent',
    seasonGate: 'vacation-only',
    catchupBonus: { targetStat: 'talent', threshold: 50, bonus: 0.5 },
    description: '시간이 필요한 작품을 끝까지 밀어붙인다.',
    flavor: '학기 중에는 시작도 못 하던 일. 방학에만 가능한 깊이.',
    tags: ['방학', '재능', '몰입', '무료'],
  },
  {
    id: 'countryside',
    name: '시골/할머니댁', slots: 3, fatigue: -15,
    effects: { mental: 5, health: 3 }, moneyCost: 0,
    category: 'rest',
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    description: '시골 친척집에서 며칠을 보낸다.',
    flavor: '평상에 누우면 바람 소리만 들린다. 도시에서 잊고 있던 박자.',
    tags: ['방학', '회복', '추억', '무료', '1회'],
  },

  // 저비용 사회성 1개
  {
    id: 'neighborhood-hangout',
    name: '동네 친구와 보내는 방학', slots: 1, fatigue: 3,
    effects: { social: 2, mental: 1 }, moneyCost: 0,
    category: 'social',
    seasonGate: 'vacation-only',
    catchupBonus: { targetStat: 'social', threshold: 50, bonus: 0.5 },
    description: '동네에서 친구들과 시간을 보낸다.',
    flavor: '특별한 일 없이도, 방학이라 보낼 수 있는 시간.',
    tags: ['방학', '관계', '무료'],
  },

  // 유료 3개
  {
    id: 'intensive-academy',
    name: '학원 단기특강', slots: 2, fatigue: 12,
    effects: { academic: 4 }, moneyCost: 5,
    category: 'study',
    seasonGate: 'vacation-only',
    vacationLimit: 2,
    catchupBonus: { targetStat: 'academic', threshold: 50, bonus: 0.5 },
    description: '방학 한정 단기특강에 집중 등록한다.',
    flavor: '하루 8시간 강의실. 학기 학원과는 다른 밀도.',
    tags: ['방학', '학업', '집중', '유료'],
  },
  {
    id: 'sports-camp',
    name: '스포츠 캠프', slots: 3, fatigue: 8,
    effects: { health: 5, talent: 2, social: 2 }, moneyCost: 5,
    category: 'exercise',
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    catchupBonus: { targetStat: 'health', threshold: 50, bonus: 0.5 },
    description: '며칠간 합숙 스포츠 캠프에 참가한다.',
    flavor: '아침 구보, 낮 훈련, 저녁 라면. 캠프 끝나면 다리가 후들거린다.',
    tags: ['방학', '체력', '관계', '유료', '1회'],
  },
  {
    id: 'family-trip',
    name: '가족 여행', slots: 3, fatigue: -8,
    effects: { mental: 6, social: 2, health: 1 }, moneyCost: 8,
    parentEffect: { baseDelta: 1.5, tag: 'familyTime' },
    category: 'parent',
    seasonGate: 'vacation-only',
    vacationLimit: 1,
    description: '가족과 함께 여행을 다녀온다.',
    flavor: '낯선 도시의 호텔 침대. 평소엔 안 하던 대화가 자연스러워진다.',
    tags: ['방학', '가족', '추억', '유료', '1회'],
  },

  // 알바 1개 (Y4+)
  // moneyCost 컨벤션: 양수 = 비용 / 음수 = 수입 (gameEngine.ts:281 state.money - cost)
  // 따라서 +8만 수입을 표현하려면 moneyCost: -8
  {
    id: 'short-term-job',
    name: '방학 단기 일손 돕기', slots: 2, fatigue: 12,
    effects: { social: 1 }, moneyCost: -8,
    yearlyCost: { middle: -6, high: -8 },
    category: 'work',
    seasonGate: 'vacation-only',
    vacationLimit: 2,
    requires: (s) => s.year >= 4,
    unlockYear: 4,
    description: '며칠짜리 단기 일자리. 손에 쥐는 돈은 평소보다 크다.',
    flavor: '어른들 사이에서 종일 일했다. 시급은 짜지만 그래도 내 손으로 번 돈.',
    tags: ['방학', '수입', '자립', 'Y4+'],
  },
];

/**
 * 2슬롯 이상 활동이 같은 id로 인접 슬롯에 중복 저장된 배열을, 한 인스턴스 = 한 항목으로 collapse.
 *
 * UI(슬롯 인덱스 = 배열 인덱스)와 엔진(applyActivity 인스턴스당 1회) 사이의 변환 레이어.
 * 사용 안 하면 가족 여행(2칸 -8만원)이 -16만원으로 차감되는 등 데이터 표기와 실제가 어긋남.
 *
 * 꼬리 잘림(timeCost로 2칸 활동의 마지막 칸이 잘린 케이스)은 push만 하고 skip 없음 → 1회만 적용.
 *
 * 예시:
 *   [countryside, countryside, study-group] → [countryside, study-group]
 *   [intensive, intensive, intensive, intensive] → [intensive, intensive] (인스턴스 2개)
 *   [trip, trip] timeCost=1 후 [trip] → [trip] (꼬리 잘림 1회만)
 */
export function collapseActivityChoices(ids: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (!id) continue;
    const act = ACTIVITIES.find(a => a.id === id);
    if (!act) continue;
    result.push(id);
    if (act.slots >= 2) {
      let skip = 0;
      for (let k = 1; k < act.slots && ids[i + k] === id; k++) skip++;
      i += skip;
    }
  }
  return result;
}

// 활동의 vacationLimit 도달 여부
// pendingUse: 이번 주 계획에 이미 배치된 인스턴스 수 — UI(슬롯 편집)에서 같은 주 중복 배치가
// 엔진 스킵으로 이어지지 않도록 합산 판정. 엔진 경로(canApplyActivity)는 적용마다 카운트가
// 갱신되므로 0 그대로.
export function isVacationLimitReached(activity: Activity, state: GameState, pendingUse = 0): boolean {
  if (!activity.vacationLimit || !state.isVacation) return false;
  const used = (state.vacationActivityCounts?.[activity.id] ?? 0) + pendingUse;
  return used >= activity.vacationLimit;
}

// 활동 게이트 공통 판정 — UI 목록(getAvailableActivities)과 엔진 검증(canApplyActivity)이 공유하는 SSOT.
function passesActivityGates(a: Activity, state: GameState): boolean {
  if (a.category === 'work' && state.year < 4) return false;
  // Phase 1: 학기/방학 게이팅
  if (a.seasonGate === 'vacation-only' && !state.isVacation) return false;
  if (a.seasonGate === 'semester-only' && state.isVacation) return false;
  // requires 함수 (방학 알바 등 추가 조건)
  if (a.requires && !a.requires(state)) return false;
  return true;
}

export function getAvailableActivities(state: GameState): Activity[] {
  return ACTIVITIES.filter(a => passesActivityGates(a, state));
}

// 엔진 진입점 단일 검증 — UI를 안 거치는 호출자(sim 하니스, 세이브 변조, 스테일 루틴,
// 향후 다른 UI)가 학년/학기/방학횟수 게이트를 우회해 활동을 적용하는 것을 막는다.
// 밸런스 수치 무변경 — 판정만. (vacationLimit은 UI에선 목록에 남겨 비활성 표시하므로
// getAvailableActivities가 아니라 여기서만 합산 판정한다)
export function canApplyActivity(state: GameState, activityId: string): boolean {
  const a = ACTIVITIES.find(x => x.id === activityId);
  if (!a) return false;
  return passesActivityGates(a, state) && !isVacationLimitReached(a, state);
}
