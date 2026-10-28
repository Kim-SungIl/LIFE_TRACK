// main 6cccad4에서 생성한 기준. 의도적인 연애 선택 없이 동일한 입력으로 7년을 완주한다.
// runs는 #511(good-grade 방학 가드)에서 재생성했다 — 원인 귀속: 그 가드 한 줄만 되돌리면 8판이
// 6cccad4 기준과 바이트 동일했고(변이 계절 필터·watching-president 변이는 영향 0), 바뀐 몫은
// 방학 주(W24·W48) good-grade 발동(판당 2~8회 → 0)이 빠진 것이다. 연애 분기와 무관한 의도된 변화.
// 앵커 도달형 예약(2026-10)에서 다시 재생성했다 — 원인 귀속: 앵커(reach.anchorWeek)만 떼면 8판이 직전 기준과
// 바이트 동일했다. 8판 모두 하은 졸업식이 Y6 W1 → W46, 수빈 합격 후가 Y7 W29~31 → W42로 옮겨(효과 수치 불변)
// Y6 W1부터 사건 열이 갈린 몫이다. 연애 분기와 무관한 의도된 변화.
// 연쇄 판정 좌표 통일(2026-10, 연쇄를 week++ 뒤가 아니라 발생주 좌표로)에서 다시 재생성했다 — 원인 귀속: 8판 모두
// Y1 W14에서 갈린다. 예전엔 W14 연쇄가 W15 좌표로 평가돼 `s.week === 15` 조건(parent-pressure)이 W14에 떴고(기준선
// 6판에서 parent-pressure 31회 중 13회·good-grade 36회 중 13회가 조건 주보다 한 주 일찍 기록), 이제 W15에 뜬다.
// 여름방학 이월 장치를 꺼도 8판 값이 같다(이월 몫 0). 연애 분기와 무관한 의도된 변화.
// 지훈 졸업식 앵커(2026-10, `jihun-hs-graduation`에 reach.anchorWeek 46)에서는 runs가 **그대로였다** — 8판 모두
// 지훈 친밀도가 97에 안 닿아 그 컷이 한 번도 안 떴다. 대신 scenes의 그 컷 `reach`에 `anchorWeek: 46` 한 칸을 넣었다
// (본문·선택지는 그대로 — 표시 시점 메타만 바뀐 의도된 변경, 같은 장면을 romance.test.ts가 스냅샷으로 비교한다).
// 하네스 교정(2026-10-27, sim 미러 → 엔진 eventResolution)에서 다시 재생성했다 — 원인 귀속: 옛 미러는 W48 사건을
// 닫아도 학년 전환을 안 해서, 그 해엔 processWeek이 W49에 한 번 더(판당 337~340회, 제품은 늘 336회) 돌았다.
// 미러에 그 한 줄(week > 48 → applyYearTransition)만 넣으면 8판 실패가 새 엔진 경로와 바이트 동일했다 — 다른
// 드리프트(로그 접기·vacationText·지나친다 안전망) 몫은 0. 제품(store) 쪽은 주간 골든이 바이트 불변이다.
// 재생성 절차: 이 하네스를 그대로 돌려 stats·endingHash만 갈아 끼운다(scenes·closures는 손대지 않는다).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialState, processWeek } from '../gameEngine';
import { calculateEnding } from '../ending';
import { resolveEventLikeStore } from '../../../scripts/lib/y1-sim-resolve';
import type { Gender, Stats } from '../types';

const baseline = JSON.parse(readFileSync(new URL('./romance-main-baseline.json', import.meta.url), 'utf8')) as {
  sourceCommit: string;
  runs: { gender: Gender; plan: string; seed: number; stats: Stats; endingHash: string }[];
};

describe('비연애 완주 결과 — main 바이트 불변', () => {
  for (const expected of baseline.runs) {
    it(`${expected.gender}/${expected.plan}/seed${expected.seed}`, { timeout: 30_000 }, () => {
      let s = createInitialState(expected.gender, ['wealth', 'freedom'], { rngSeed: expected.seed });
      [s.routineSlot2, s.routineSlot3] = expected.plan === 'paid' ? ['academy', 'gym'] : ['self-study', 'light-exercise'];
      for (let w = 0; w < 420; w++) {
        s.weekendChoices = ['self-study', 'club'];
        s.vacationChoices = ['self-study', 'creative', 'rest'];
        s = processWeek(s, undefined);
        let guard = 0;
        while (s.currentEvent && guard++ < 20) {
          const choices = s.gender === 'female' && s.currentEvent.femaleChoices ? s.currentEvent.femaleChoices : s.currentEvent.choices;
          s = resolveEventLikeStore(s, choices.findIndex(c => !c.relationshipSelect && !c.romanceConversation));
        }
        if (s.phase === 'year-end') { s.week = 1; s.year++; s.phase = 'weekday'; }
        if (s.phase === 'ending') break;
      }
      expect(s.phase).toBe('ending');
      expect(s.relationship).toBeUndefined();
      expect(s.stats).toEqual(expected.stats);
      expect(createHash('sha256').update(JSON.stringify(calculateEnding(s))).digest('hex')).toBe(expected.endingHash);
    });
  }
});
