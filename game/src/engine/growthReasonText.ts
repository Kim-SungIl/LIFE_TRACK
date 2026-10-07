/**
 * T67: 성장 둔화 원인 → 생활 문장.
 *
 * 판정은 엔진이 한다(growthDrag.ts `pickGrowthReason`, 보일지 말지는 `visibleGrowthReason`). 이 파일은
 * 판정 결과를 **말로 바꾸기만** 한다 — 화면이 원인을 다시 추정하지 않는다.
 *
 * 규칙
 *   · 숫자·배율·퍼센트 금지(hide-numbers). 결산의 일기 목소리(1인칭·과거형)에 맞춘다.
 *   · 담임은 "덜 해라"라고 말하는 어른이고 주말 플래너도 "쉬는 것도 선택"이라고 말한다. 여기서도
 *     "더 해라"는 말하지 않는다.
 *   · **유료 전환을 암시하지 않는다**("배울 곳이 필요하다" 류 금지). 돈 축은 닫혀 있고 소프트캡
 *     효율 태그는 폐기된 처방이다 — 무료 소프트캡 문장은 "익숙한 방식으로는 더 늘지 않는다"는 사실만.
 *   · **"혼자·독학"이라고 말하지 않는다.** 무료 활동에는 스터디 그룹·부모와 공부·동아리 같은 단체
 *     활동이 섞여 있다 — 활동 성격에 중립인 문장만 쓴다.
 *   · 피로·마음·지형 문장은 **그 요인이 가장 많이 깎은 축**의 장면으로 말한다. 학업 손실이 없던 주에
 *     "책상 앞에 앉아 있어도"라고 하면 거짓이다.
 *   · 초등(Y1)은 따로 쓴다. 중·고는 같은 칸을 쓴다.
 *   · 문장 고르기는 `variant`(그 칸이 몇 번째로 나왔는지, 1씩 증가) — 계수 1 회전이라 퇴화하지 않는다.
 *     칸 단위 카운터는 엔진의 growthReasonCell이 정하고, 둘의 정합은 growthReasonText.test.ts가 잠근다.
 */
import { getSchoolLevel } from './backgrounds';
import { sanitizeGrowthReason, type GrowthAxis, type GrowthDragFactor } from './growthDrag';

type Band = 'elementary' | 'secondary';
type Lines = Record<Band, readonly string[]>;

/** 축과 무관한 요인 — 한 주에 같은 쪽을 몰아 한 사정이라 어느 축이든 같은 말이다. */
export const NEUTRAL_LINES: Record<'crowded' | 'weeklyCap', Lines> = {
  crowded: {
    elementary: [
      '같은 것만 계속 하니까 나중엔 지루해서 잘 안 됐다.',
      '한 가지만 내리 했더니 뒤로 갈수록 덜 남았다.',
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

/** 축마다 장면이 다른 요인 */
export const AXIS_LINES: Record<'fatigue' | 'mood' | 'freeCeiling' | 'familiar', Record<GrowthAxis, Lines>> = {
  fatigue: {
    academic: {
      elementary: ['너무 졸려서 책상 앞에 앉아 있어도 머리에 잘 안 들어왔다.'],
      secondary: [
        '너무 피곤해서 오래 앉아 있어도 집중하지 못했다.',
        '같은 페이지를 몇 번이고 다시 읽었다. 피곤하면 시간을 써도 남지 않는다.',
      ],
    },
    talent: {
      elementary: ['피곤해서 하다가 자꾸 멍해졌다.'],
      secondary: [
        '피곤하니 손끝이 무뎌서 연습이 몸에 남지 않았다.',
        '지친 채로 붙잡고 있으니 같은 데서 자꾸 막혔다.',
      ],
    },
    health: {
      elementary: ['피곤해서 뛰어도 금방 지쳐 버렸다.'],
      secondary: [
        '몸이 무거워서 운동을 해도 제대로 따라가지 못했다.',
        '지친 몸으로 움직이니 금방 숨이 찼고 남는 게 적었다.',
      ],
    },
    social: {
      elementary: ['졸려서 친구들이랑 놀아도 금방 기운이 빠졌다.'],
      secondary: [
        '피곤해서 사람들 사이에 있어도 이야기가 귀에 잘 안 들어왔다.',
        '지쳐 있으니 웃어도 마음까지는 잘 안 열렸다.',
      ],
    },
  },
  mood: {
    academic: {
      elementary: ['기분이 가라앉아서 공부가 하나도 재미없었다.'],
      secondary: [
        '마음이 지쳐 있으니 책을 펴도 글자가 눈에 안 들어왔다.',
        '하기 싫은 마음을 이기느라 힘을 다 써 버렸다.',
      ],
    },
    talent: {
      elementary: ['기분이 안 좋아서 좋아하는 것도 재미가 없었다.'],
      secondary: [
        '마음이 가라앉아 있으니 좋아하던 것도 손에 안 잡혔다.',
        '의욕이 없으니 연습이 그냥 시간만 보내는 일이 됐다.',
      ],
    },
    health: {
      elementary: ['마음이 무거우니까 뛰어놀 기운도 안 났다.'],
      secondary: [
        '마음이 무거우니 몸을 움직일 힘도 잘 안 났다.',
        '의욕이 바닥이라 운동이 버티기만 하는 시간이 됐다.',
      ],
    },
    social: {
      elementary: ['기분이 가라앉아서 친구들이랑 놀아도 재미가 덜했다.'],
      secondary: [
        '마음이 지쳐 있으니 사람들 틈에서도 겉돌았다.',
        '웃고 떠들어도 마음은 딴 데 가 있었다.',
      ],
    },
  },
  freeCeiling: {
    academic: {
      elementary: ['늘 하던 대로 공부해서는 더 늘지 않는 것 같다.'],
      secondary: [
        '늘 하던 방식의 공부로는 더 늘지 않는 단계에 왔다.',
        '익숙한 방법으로는 여기서 더 올라가지 않았다.',
      ],
    },
    talent: {
      elementary: ['늘 하던 대로 해서는 더 잘하게 되지 않았다.'],
      secondary: [
        '늘 하던 연습으로는 더 이상 늘지 않았다.',
        '익숙한 방식으로 다듬을 수 있는 건 다 다듬은 것 같다.',
      ],
    },
    health: {
      elementary: ['늘 하던 놀이로는 더 튼튼해지지 않는 것 같다.'],
      secondary: [
        '늘 하던 운동으로는 몸이 더 달라지지 않았다.',
        '익숙한 운동은 이제 몸이 먼저 안다. 더 늘지 않는다.',
      ],
    },
    social: {
      elementary: ['늘 놀던 대로 놀아서는 더 친해지지 않는 것 같다.'],
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
  if (factor === 'crowded' || factor === 'weeklyCap') return NEUTRAL_LINES[factor][band];
  return AXIS_LINES[factor][axis][band];
}

/** 판정 결과 → 결산에 낼 한 줄. 손상된 판정(모르는 요인·축·variant)이면 null — 렌더가 터지지 않게. */
export function growthReasonLine(reason: unknown, year: number): string | null {
  const r = sanitizeGrowthReason(reason);
  if (!r) return null;
  const lines = growthReasonLines(r.factor, r.axis, Number.isFinite(year) ? year : 2);
  return lines[r.variant % lines.length] ?? null;
}
