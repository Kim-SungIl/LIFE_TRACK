/**
 * T67: 성장 둔화 원인 → 생활 문장.
 *
 * 판정은 엔진이 한다(growthDrag.ts `pickGrowthReason`). 이 파일은 판정 결과를 **말로 바꾸기만**
 * 한다 — 화면이 원인을 다시 추정하지 않는다.
 *
 * 규칙
 *   · 숫자·배율·퍼센트 금지(hide-numbers). 결산의 일기 목소리(1인칭·과거형)에 맞춘다.
 *   · 담임은 "덜 해라"라고 말하는 어른이고 주말 플래너도 "쉬는 것도 선택"이라고 말한다. 여기서도
 *     "더 해라"는 말하지 않는다 — 피로·몰아하기 문장은 쉬거나 섞으라는 쪽이다.
 *   · 초등(Y1)은 따로 쓴다. 중·고는 같은 칸을 쓴다.
 *   · 문장 고르기는 `variant`(그 칸이 몇 번째로 나왔는지, 1씩 증가) — 길이로 나눈 나머지지만 **계수가
 *     1이라 퇴화하지 않는다**(모든 문장이 차례로 나온다). 칸 단위 카운터는 엔진의 growthReasonCell이
 *     정한다. 둘이 어긋나면 칸 하나가 첫 문장만 내니 growthReasonText.test.ts가 칸 전수로 잠근다.
 */
import { getSchoolLevel } from './backgrounds';
import type { GrowthAxis, GrowthDragFactor, GrowthReason } from './growthDrag';

type Band = 'elementary' | 'secondary';
type Lines = Record<Band, readonly string[]>;

/** 축과 무관한 요인(날씨) */
export const SITUATIONAL_LINES: Record<'fatigue' | 'mood' | 'crowded' | 'weeklyCap', Lines> = {
  fatigue: {
    elementary: [
      '너무 졸려서 책상 앞에 앉아 있어도 머리에 잘 안 들어왔다.',
      '몸이 피곤하니까 뭘 해도 금방 멍해졌다.',
    ],
    secondary: [
      '너무 피곤해서 오래 앉아 있어도 집중하지 못했다.',
      '몸이 무거우니 같은 시간을 써도 남는 게 적었다.',
      '같은 페이지를 몇 번이고 다시 읽었다. 피곤하면 시간을 써도 남지 않는다.',
    ],
  },
  mood: {
    elementary: [
      '기분이 가라앉아서 뭘 해도 재미가 없었다.',
      '마음이 무거우니까 손이 잘 안 움직였다.',
    ],
    secondary: [
      '마음이 지쳐 있어서 뭘 해도 손에 잡히지 않았다.',
      '하기 싫은 마음을 이기느라 힘을 다 써 버렸다.',
      '책을 펴도 글자가 눈에 안 들어왔다. 마음부터 챙겨야 할 것 같다.',
    ],
  },
  crowded: {
    elementary: [
      '같은 것만 계속 하니까 나중엔 지루해서 잘 안 됐다.',
      '한 가지만 내리 했더니 뒤로 갈수록 머리에 안 남았다.',
    ],
    secondary: [
      '한 주에 같은 쪽만 몰아서 하니 뒤로 갈수록 덜 남았다.',
      '같은 걸 연달아 하니 두 번째부터는 잘 붙지 않았다. 섞어서 해 볼까.',
    ],
  },
  weeklyCap: {
    elementary: [
      '이번 주는 벌써 많이 해서 더 해도 잘 안 들어갔다.',
      '한꺼번에 너무 많이 하니까 머리가 꽉 찼다.',
    ],
    secondary: [
      '한 주에 몸에 붙일 수 있는 데는 한계가 있었다. 더 몰아넣어도 그만큼 남지 않는다.',
      '이번 주는 이미 꽉 찼다. 더 한 만큼은 그냥 흘러가 버렸다.',
    ],
  },
};

/** 축마다 말이 다른 요인(지형) */
export const AXIS_LINES: Record<'freeCeiling' | 'familiar', Record<GrowthAxis, Lines>> = {
  freeCeiling: {
    academic: {
      elementary: ['혼자 하는 공부로는 이제 잘 모르는 걸 물어볼 데가 없었다.'],
      secondary: [
        '혼자 하는 공부로는 여기서 더 올라가기 어려워졌다. 제대로 짚어 줄 사람이 필요하다.',
        '독학으로 갈 수 있는 데까지는 온 것 같다. 방법을 바꿔 볼 때다.',
      ],
    },
    talent: {
      elementary: ['혼자 연습해서는 더 잘하는 방법을 모르겠다.'],
      secondary: [
        '혼자 연습해서는 더 늘지 않는 단계가 왔다. 제대로 배울 곳이 필요하다.',
        '독학으로 다듬을 수 있는 건 다 다듬었다. 다음 걸음은 혼자선 안 보인다.',
      ],
    },
    health: {
      elementary: ['혼자 뛰어노는 것만으로는 더 튼튼해지지 않는 것 같다.'],
      secondary: [
        '혼자 하는 운동으로는 더 이상 몸이 달라지지 않았다.',
        '늘 하던 운동은 이제 몸이 먼저 안다. 제대로 배워야 다음이 있다.',
      ],
    },
    social: {
      elementary: ['늘 노는 친구들하고만 놀아서는 더 넓어지지 않는다.'],
      secondary: [
        '늘 하던 대로 어울려서는 더 넓어지지 않는 느낌이다.',
        '익숙한 자리에서는 새로운 사람을 만나기 어렵다.',
      ],
    },
  },
  familiar: {
    academic: {
      elementary: ['아는 문제가 많아져서 새로 배운 건 별로 없었다.'],
      secondary: [
        '이미 익숙한 내용이 많아서 새로 남는 건 적었다.',
        '쉬운 건 이제 다 안다. 여기서부터는 한 걸음이 무겁다.',
      ],
    },
    talent: {
      elementary: ['이제 꽤 잘하게 돼서 예전처럼 쑥쑥 늘지는 않는다.'],
      secondary: [
        '손에 익은 만큼, 새로 느는 건 조금씩이다.',
        '웬만한 건 이제 된다. 여기서부터는 천천히 는다.',
      ],
    },
    health: {
      elementary: ['달리기가 익숙해져서 예전만큼 확 늘진 않았다.'],
      secondary: [
        '몸이 이미 익숙해져서 같은 운동으론 크게 달라지지 않았다.',
        '체력이 붙은 만큼, 더 붙는 건 더디다.',
      ],
    },
    social: {
      elementary: ['친구들이랑은 이미 친해서 크게 달라진 건 없었다.'],
      secondary: [
        '아는 얼굴이 많아지니 새로 생기는 인연은 드물다.',
        '이미 가까운 사이들이라, 더 가까워지는 건 천천히다.',
      ],
    },
  },
};

function bandOf(year: number): Band {
  return getSchoolLevel(year) === 'elementary' ? 'elementary' : 'secondary';
}

/** 그 칸의 문장 목록 — 테스트가 칸 전수로 쓴다. */
export function growthReasonLines(factor: GrowthDragFactor, axis: GrowthAxis, year: number): readonly string[] {
  const band = bandOf(year);
  if (factor === 'freeCeiling' || factor === 'familiar') return AXIS_LINES[factor][axis][band];
  return SITUATIONAL_LINES[factor][band];
}

/** 판정 결과 → 결산에 낼 한 줄. */
export function growthReasonLine(reason: GrowthReason, year: number): string {
  const lines = growthReasonLines(reason.factor, reason.axis, year);
  const i = ((reason.variant % lines.length) + lines.length) % lines.length;
  return lines[i];
}
