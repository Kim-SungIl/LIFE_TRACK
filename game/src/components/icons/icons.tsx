import type { ReactNode } from 'react';
import type { StatKey } from '../../engine/types';
import type { SlotIconKind, ActivityCategory } from './iconKeys';

/**
 * 주간 화면의 선화 아이콘.
 *
 * **왜 이모지를 걷었나** — 능력치 5행·일과 슬롯 6칸·활동 카테고리 7줄은 매 주 같은 자리에
 * 같은 순서로 반복되는 **집합**이다. 컬러 이모지는 기기마다 그림이 다르고(애플·구글·삼성),
 * 굵기도 색도 팔레트와 무관해서, 이 게임의 warm plum 톤 위에서 그 세 집합만 다른 세계에서
 * 온 스티커처럼 떠 있었다. 선화는 `currentColor`를 타므로 팔레트를 따라간다.
 *
 * **경계**: 바꾼 것은 위 세 집합뿐이다. 일회성 라벨 이모지(📊 능력치 · 💬 가정 · 🚪 메뉴 ·
 * 📖 기록장 · 💰 · 부모 강점 칩)는 그대로 둔다. 이 리포의 원칙이 "UI 절제는 크롬에만"이고,
 * 저것들은 전부 크롬이다. 크롬까지 선화로 바꾸면 조용해야 할 층이 오히려 또렷해진다.
 * 부모 강점 칩은 집합이긴 하지만 크롬 행(💬 가정 · 🚪 메뉴 · 📖 기록장) 안에 섞여 살아서,
 * 칩만 선화로 바꾸면 한 줄 안에서 두 언어가 부딪힌다.
 *
 * **접근성**: 전부 `aria-hidden`이다. 세 집합 모두 바로 옆에 자기 이름이 글자로 있다
 * (학업/인기/… · 활동 이름 · 카테고리 이름). 여기에 `aria-label`을 달면 스크린리더가
 * "학업 학업"으로 두 번 읽는다. 대신 검사용 손잡이로 `data-icon`을 단다 —
 * 이모지를 걷어내면 `getByText(이모지)`류 단언이 **어느 상태에서도** 통과하는
 * 공허한 단언이 되므로(접힘/펼침 계약이 통째로 사라진다), 테스트가 잡을 자리가 필요하다.
 */

const VIEW = 24;

/** 선 굵기. 24 viewBox 기준 — 16px로 줄여 그리면 실효 1px다. */
export const ICON_STROKE = 1.5;

function Glyph({ size, id, children }: { size: number; id: string; children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      // 옆에 이름이 글자로 있다 — 이름을 또 달면 두 번 읽힌다.
      aria-hidden="true"
      focusable="false"
      data-icon={id}
      style={{ display: 'block', flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

// ── 낱그림 ────────────────────────────────────────────────────────────────────
// 전부 24 viewBox · fill 없음 · currentColor. 획을 더 얹지 않는다 —
// 16px로 줄여 그리는 자리가 대부분이라 획이 셋을 넘으면 뭉친다.

const Book = (
  <>
    <path d="M12 6.5v13" />
    <path d="M12 6.5C10.5 5.2 8.4 4.5 5.5 4.5H3.5v13h2c2.9 0 5 .7 6.5 2" />
    <path d="M12 6.5c1.5-1.3 3.6-2 6.5-2h2v13h-2c-2.9 0-5 .7-6.5 2" />
  </>
);

const Star5 = <path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />;

const Bulb = (
  <>
    <path d="M12 3.5a5.5 5.5 0 0 0-3.2 9.97c.45.33.7.86.7 1.42v.61h5v-.61c0-.56.25-1.09.7-1.42A5.5 5.5 0 0 0 12 3.5Z" />
    <path d="M9.5 18h5" />
    <path d="M10.5 20.5h3" />
  </>
);

const Leaf = (
  <>
    <path d="M12 20.5V10" />
    <path d="M12 13c0-3.6 2.9-6.5 6.5-6.5C18.5 10.1 15.6 13 12 13Z" />
    <path d="M12 16.5c-2.8 0-5-2.2-5-5 2.8 0 5 2.2 5 5Z" />
  </>
);

const Bolt = <path d="M13 2.5 4.5 13.5h6l-1 8 9-11.5h-6z" />;

const School = (
  <>
    <path d="M3.5 20.5h17" />
    <path d="M5 20.5V10.5l7-4.5 7 4.5v10" />
    <path d="M10 20.5V15h4v5.5" />
    <path d="M12 6V2.5" />
    <path d="M12 3h3.2v2H12" />
  </>
);

// 방과후 슬롯의 짝. **같은 원, 다른 표시**라야 "정해짐 / 미정"이 그림으로 읽힌다.
// plan은 책이었다 — 그런데 방과후 루틴에는 운동·알바도 들어가서 뜻이 어긋났다(📚의 유산).
const CheckCircle = (
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="m8.2 12.2 2.6 2.6 5-5.4" />
  </>
);

const Question = (
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="M9.4 9.4a2.7 2.7 0 1 1 3.6 2.55c-.62.22-1 .82-1 1.48v.57" />
    <path d="M12 17.2h.01" />
  </>
);

const Moon = <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />;

// 저녁 자유시간. **깃털이었다** — 멘탈 축의 새싹과 나란히 놓으니 둘 다 잎사귀로 보였다.
// 같은 주간 화면에 함께 뜨는 그림이라 실사용 크기(14·18px)에서 구별이 안 됐다.
const Mug = (
  <>
    <path d="M4 9h12v6.5a4.5 4.5 0 0 1-4.5 4.5h-3A4.5 4.5 0 0 1 4 15.5z" />
    <path d="M16 11h1.25a2.75 2.75 0 0 1 0 5.5H16" />
    <path d="M8 6V3.8M12 6V3.8" />
  </>
);

const Sun = (
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.55 1.55M17.15 17.15l1.55 1.55M18.7 5.3l-1.55 1.55M6.85 17.15L5.3 18.7" />
  </>
);

const Sparkle = (
  <>
    <path d="M10.5 4.5c0 4 3.2 7.2 7.2 7.2-4 0-7.2 3.2-7.2 7.2 0-4-3.2-7.2-7.2-7.2 4 0 7.2-3.2 7.2-7.2Z" />
    <path d="M19 13.5c0 1.5 1.2 2.7 2.7 2.7-1.5 0-2.7 1.2-2.7 2.7 0-1.5-1.2-2.7-2.7-2.7 1.5 0 2.7-1.2 2.7-2.7Z" />
  </>
);

const Continued = (
  <>
    <path d="M8 3.5v11a4 4 0 0 0 4 4h4.5" />
    <path d="m14 16 2.5 2.5L14 21" />
  </>
);

const Dumbbell = (
  <>
    <path d="M3 9.5v5M6 7.5v9M18 7.5v9M21 9.5v5" />
    <path d="M6 12h12" />
  </>
);

const People = (
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.1a3.2 3.2 0 0 1 0 5.8" />
    <path d="M16.5 14.4a5.5 5.5 0 0 1 4 5.1" />
  </>
);

const Palette = (
  <>
    <path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.4-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h1.6a4.9 4.9 0 0 0 4.9-4.9c0-3-3.9-5.4-9.5-5.4Z" />
    <path d="M7.5 11.5h.01M10 7.6h.01M14.5 7.6h.01M17.5 11h.01" />
  </>
);

const Bed = (
  <>
    <path d="M2.5 20V9.5" />
    <path d="M2.5 14h19v6" />
    <circle cx="7" cy="10.6" r="2.2" />
    <path d="M11 14v-1.5a2 2 0 0 1 2-2h4.5a2 2 0 0 1 2 2V14" />
  </>
);

const Heart = <path d="M12 20.3 4.6 13a4.7 4.7 0 0 1 0-6.65 4.7 4.7 0 0 1 6.65 0L12 7.1l.75-.75a4.7 4.7 0 0 1 6.65 0 4.7 4.7 0 0 1 0 6.65z" />;

const Briefcase = (
  <>
    <rect x="2.5" y="7.5" width="19" height="12" rx="2" />
    <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
    <path d="M2.5 12.5h19" />
  </>
);

// ── 집합 ──────────────────────────────────────────────────────────────────────
// `Record<키, …>`라 키를 늘리면 타입이 빠진 그림을 먼저 잡는다.
// 그래도 렌더까지 보는 커버리지 단언을 따로 둔다 — 타입은 `as` 하나로 뚫린다.

const STAT_GLYPHS: Record<StatKey, ReactNode> = {
  academic: Book,
  social: Star5,
  talent: Bulb,
  mental: Leaf,
  health: Bolt,
};

const SLOT_GLYPHS: Record<SlotIconKind, ReactNode> = {
  school: School,
  plan: CheckCircle,
  empty: Question,
  evening: Moon,
  free: Mug,
  weekend: Sun,
  weekendFilled: Sparkle,
  continued: Continued,
};

const CATEGORY_GLYPHS: Record<ActivityCategory, ReactNode> = {
  study: Book,
  exercise: Dumbbell,
  social: People,
  talent: Palette,
  rest: Bed,
  parent: Heart,
  work: Briefcase,
};

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────
// **키 목록을 여기서 export하지 않는다** — `react-refresh/only-export-components`가
// 컴포넌트 파일의 배열·객체 export를 막는다(실측: `export const X = ["a","b"] as const`는
// 에러, 스칼라는 `allowConstantExport`로 통과 — 그래서 위 `ICON_STROKE`는 된다).
// 키 목록이 필요하면 `iconKeys.ts`를 읽을 것.

/** 능력치 축 아이콘. StatsPanel·주간 결산의 5행이 쓴다. */
export function StatIcon({ stat, size = 14 }: { stat: StatKey; size?: number }) {
  return <Glyph size={size} id={`stat:${stat}`}>{STAT_GLYPHS[stat]}</Glyph>;
}

/** 일과 슬롯 아이콘. 시간대 × 채움 여부. */
export function SlotIcon({ kind, size = 18 }: { kind: SlotIconKind; size?: number }) {
  return <Glyph size={size} id={`slot:${kind}`}>{SLOT_GLYPHS[kind]}</Glyph>;
}

/** 활동 카테고리 아이콘. ActivityPicker 헤더 7줄. */
export function CategoryIcon({ category, size = 20 }: { category: ActivityCategory; size?: number }) {
  return <Glyph size={size} id={`cat:${category}`}>{CATEGORY_GLYPHS[category]}</Glyph>;
}
