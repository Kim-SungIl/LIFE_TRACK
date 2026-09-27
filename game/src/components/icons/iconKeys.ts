// 선화 아이콘의 **키 목록**. 그림(JSX)과 분리돼 있다 — `react-refresh/only-export-components`가
// 컴포넌트 파일의 값 export를 막으므로, 커버리지 검사가 읽을 목록은 여기 둔다.
//
// 이 파일이 세 아이콘 집합의 SSOT다. 키를 늘리면 `icons.tsx`의 `Record<...>`가
// 타입 단계에서 빠진 그림을 잡고, `lineArtIcons.test.tsx`가 실제 렌더까지 잡는다.

/**
 * 일과 슬롯의 아이콘 축 — **시간대 × 채움 여부**다.
 *
 * 예전 이모지가 무엇을 말하고 있었는지 그대로 옮긴 것이다:
 *   방과후 📚/❓ · 저녁 🌙/🕊️ · 주말·방학 🌟/☀️ · 2칸 점유 💤 · 고정 수업 🏫
 * 슬롯이 "비었다/찼다"를 아이콘으로도 말하는 게 이 축의 요점이라,
 * `plan`/`empty`처럼 짝으로 묶여 있다. 한쪽만 바꾸면 그 대비가 사라진다.
 */
export const SLOT_ICON_KINDS = [
  'school',        // 🏫 고정 수업 (탭 불가)
  'plan',          // 📚 방과후 루틴 있음
  'empty',         // ❓ 방과후 비어 있음
  'evening',       // 🌙 저녁 활동 있음
  'free',          // 🕊️ 저녁 자유시간
  'weekend',       // ☀️ 주말·방학 비어 있음
  'weekendFilled', // 🌟 주말·방학 활동 있음
  'continued',     // 💤 앞 슬롯의 2칸 활동이 이어짐
] as const;
export type SlotIconKind = (typeof SLOT_ICON_KINDS)[number];

/**
 * 활동 카테고리 — **순서가 곧 화면의 세로 순서**다(ActivityPicker가 이 배열을 그대로 돈다).
 *
 * 예전엔 같은 7개가 `CAT_INFO`의 키와 `categories` 배열 두 곳에 각각 적혀 있었다.
 * 이 리포가 반복해서 데인 형태라(#441: 같은 사실을 두 곳이 각자 들고 있으면 양쪽 초록인 채 갈린다)
 * 배열 하나에서 파생시킨다.
 */
export const ACTIVITY_CATEGORIES = [
  'study', 'exercise', 'social', 'talent', 'rest', 'parent', 'work',
] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];
