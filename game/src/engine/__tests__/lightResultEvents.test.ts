// T46: 결과 화면을 생략하는 사건 집합(light-result.ts)의 **자격**을 카탈로그에서 파생해 잠근다.
// 편입 기준 4개(결산 도달 · 효과 소폭 · CG 없음 · followup 없음) 중 "결산 도달"은 store 경로라
// components/__tests__/lightEventResultSkip.test.tsx (d)가 렌더로 보고, 나머지 셋을 여기서 본다.
//
// 집합에 자격 없는 id를 넣으면(예: followup을 끄는 'class-president', CG가 있는 사건) 그 줄에서
// 빨강이 되도록 항목마다 메시지에 id를 박는다. 빈 집합도 빨강 — 판정 대상이 0건이면 검사가 공허하다.
import { describe, it, expect } from 'vitest';
import { GAME_EVENTS } from '../events';
import { LIGHT_RESULT_EVENT_IDS, LIGHT_RESULT_EFFECT_CAP } from '../events/light-result';
import { FOLLOWUP_EVENT_IDS, DIRECT_SEQUEL_IDS } from '../events/constants';
import { CG_MANIFEST } from '../../cg-manifest.generated';
import type { EventChoice, GameEvent } from '../types';

const byId = new Map(GAME_EVENTS.map(e => [e.id, e]));
const followupEvents = GAME_EVENTS.filter(e => FOLLOWUP_EVENT_IDS.has(e.id));

// followup 조건은 "어떤 이벤트를 어떻게 골랐나"를 id 리터럴로 읽는다(president.ts 등).
// 조건 함수의 소스에 그 id가 따옴표째 나오면 "이 id가 후속을 끈다"로 본다.
// 휴리스틱이므로 아래 양성 대조군(class-president)으로 탐지기 자체가 살아 있는지 먼저 확인한다.
function followupsTriggeredBy(id: string): string[] {
  const needle = new RegExp(`['"\`]${id.replace(/[-]/g, '\\-')}['"\`]`);
  return followupEvents
    .filter(e => e.condition && needle.test(e.condition.toString()))
    .map(e => e.id);
}

// 매니페스트 경로는 {dir}/{id}[_c{ci}][_{g}].png — 파일명이 id 자체거나 id 뒤에 '_'가 붙는 것만 그 사건의 CG다.
// ('president-speech'가 'class-president-speech_c0_m.png'에 걸리지 않게 파일명 앞부분을 정확히 본다.)
function cgFilesOf(id: string): string[] {
  return [...CG_MANIFEST].filter(rel => {
    const base = rel.slice(rel.lastIndexOf('/') + 1);
    return base === `${id}.png` || base.startsWith(`${id}_`);
  });
}

function allChoices(e: GameEvent): EventChoice[] {
  return [...e.choices, ...(e.femaleChoices ?? [])];
}

describe('LIGHT_RESULT_EVENT_IDS 자격 (카탈로그 파생)', () => {
  it('탐지기 양성 대조 — 선거(class-president)는 후속을 끌고, CG가 있는 사건이 카탈로그에 있다', () => {
    // 이 둘이 죽으면 아래의 "없다" 단언은 전부 공허하다(#437: 검사 0건에도 ✅).
    expect(followupsTriggeredBy('class-president'), 'followup 탐지기가 죽었다').not.toHaveLength(0);
    expect(GAME_EVENTS.some(e => cgFilesOf(e.id).length > 0), 'CG 탐지기가 죽었다').toBe(true);
  });

  it('집합이 비어 있지 않다', () => {
    expect(LIGHT_RESULT_EVENT_IDS.size).toBeGreaterThan(0);
  });

  it('모든 id가 카탈로그에 실재한다', () => {
    for (const id of LIGHT_RESULT_EVENT_IDS) {
      expect(byId.has(id), `${id}: 카탈로그에 없는 id`).toBe(true);
    }
  });

  it('기준 4 — followup을 끌지 않고, 자신도 followup/직접 후속이 아니다', () => {
    for (const id of LIGHT_RESULT_EVENT_IDS) {
      expect(FOLLOWUP_EVENT_IDS.has(id), `${id}: 자신이 followup이다`).toBe(false);
      expect(DIRECT_SEQUEL_IDS.has(id), `${id}: 자신이 직접 후속이다`).toBe(false);
      expect(followupsTriggeredBy(id), `${id}: 이 id를 조건으로 읽는 followup이 있다`).toEqual([]);
    }
  });

  it('기준 3 — 매니페스트 어느 경로에도 CG가 없다', () => {
    for (const id of LIGHT_RESULT_EVENT_IDS) {
      expect(cgFilesOf(id), `${id}: CG가 있다 — 결과 화면을 건너뛰면 그림을 볼 자리가 없다`).toEqual([]);
    }
  });

  it('기준 2 — 효과 소폭: 스탯·피로는 LIGHT_RESULT_EFFECT_CAP 이하, 그 밖의 효과는 없다', () => {
    let checked = 0;
    for (const id of LIGHT_RESULT_EVENT_IDS) {
      const ev = byId.get(id);
      if (!ev) continue; // 실재 단언은 위에서 따로 본다
      for (const [ci, c] of allChoices(ev).entries()) {
        const where = `${id} 선택지 ${ci}`;
        for (const [k, v] of Object.entries(c.effects)) {
          expect(Math.abs(v ?? 0), `${where}: ${k} ${v} — 상한 ±${LIGHT_RESULT_EFFECT_CAP.stat}`)
            .toBeLessThanOrEqual(LIGHT_RESULT_EFFECT_CAP.stat);
        }
        expect(Math.abs(c.fatigueEffect ?? 0), `${where}: 피로 ${c.fatigueEffect}`)
          .toBeLessThanOrEqual(LIGHT_RESULT_EFFECT_CAP.fatigue);
        expect(c.npcEffects ?? [], `${where}: 친밀도 효과`).toEqual([]);
        expect(c.moneyEffect ?? 0, `${where}: 돈`).toBe(0);
        expect(c.timeCost, `${where}: 시간 소모`).toBeUndefined();
        expect(c.trackSelect, `${where}: 진로 선택`).toBeUndefined();
        expect(c.addBuff, `${where}: 버프`).toBeUndefined();
        expect(c.parentEffect, `${where}: 부모 친밀도`).toBeUndefined();
        expect(c.memorySlotDraft, `${where}: 기억 슬롯`).toBeUndefined();
        checked++;
      }
    }
    // 루프가 좁아져 검사가 공허해지지 않게 — 사건마다 선택지가 둘 이상은 있어야 한다.
    expect(checked).toBeGreaterThanOrEqual(LIGHT_RESULT_EVENT_IDS.size * 2);
  });
});
