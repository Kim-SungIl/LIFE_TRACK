// 이벤트 CG 파일 탐색 — eventId + choiceIndex + gender + year 로 매니페스트에 존재하는 후보 경로/URL을 만든다.
// EventResultScreen(결과 화면)과 YearEndScreen(학년말 회고 썸네일)이 공유한다.
//
// 폴백 체인 (학교급 우선, 없으면 학교급-무관 common):
//   {schoolLevel}/{id}_c{ci}_{g} → {sl}/{id}_{g} → {sl}/{id}_c{ci} → {sl}/{id}
//   → common/{id}_c{ci}_{g} → common/{id}_{g} → common/{id}_c{ci} → common/{id}
// 자산 의도 SSOT는 docs/event-cg-prompts-y1.md 의 [🧭 CG 폴백 정책] 표 참조.
import { Gender } from './types';
import { getSchoolLevel } from './backgrounds';
import { CG_MANIFEST } from '../cg-manifest.generated';

// 매니페스트에 실제로 존재하는 후보들의 상대경로(예: 'elementary/foo_c0_m.png') 배열. 우선순위 순.
export function resolveEventCgRelPaths(
  eventId: string,
  choiceIndex: number,
  gender: Gender,
  year: number,
): string[] {
  // 첫 고백과 재고백은 장소를 특정하지 않는 같은 수락 CG를 공유한다.
  // 결과·회고·기록실 모두 이 경로를 사용하므로 중복 수집 없이 같은 그림을 가리킨다.
  // 보류/거절에는 매핑하지 않는다. 일반 이벤트의 기존 폴백 순서는 유지한다.
  if (choiceIndex === 0 && year >= 6 && year <= 7) {
    if (eventId === 'subin-romance-revisit' && gender === 'male') {
      eventId = 'subin-hs-confess';
    } else if (eventId === 'jihun-romance-revisit' && gender === 'female') {
      eventId = 'jihun-hs-unsaid';
      choiceIndex = 3;
    }
  }
  const g = gender === 'male' ? 'm' : 'f';
  const sl = getSchoolLevel(year);
  // 두 소비처(결과화면/학년말)가 동일 정책을 쓰도록 choiceIndex 정규화를 resolver 안에 둔다.
  const ci = Number.isInteger(choiceIndex) ? choiceIndex : 0;
  const build = (dir: string): string[] => [
    `${dir}/${eventId}_c${ci}_${g}.png`,
    `${dir}/${eventId}_${g}.png`,
    `${dir}/${eventId}_c${ci}.png`,
    `${dir}/${eventId}.png`,
  ];
  return [...build(sl), ...build('common')].filter(rel => CG_MANIFEST.has(rel));
}

// 매니페스트 매칭되는 첫 CG의 완성 URL (없으면 null). 썸네일/단일 이미지용.
export function resolveEventCgUrl(
  eventId: string | undefined,
  choiceIndex: number,
  gender: Gender,
  year: number,
): string | null {
  if (!eventId) return null;
  const rel = resolveEventCgRelPaths(eventId, choiceIndex, gender, year);
  if (rel.length === 0) return null;
  return `${import.meta.env.BASE_URL}images/events/${rel[0]}`;
}
