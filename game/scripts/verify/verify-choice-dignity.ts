// verify-choice-dignity.ts — 결과 문장이 플레이어의 선택을 **비꼬지 않게** 한다 (T65)
//
// 왜 필요한가: 튜토리얼은 "정답은 없어요"라고 말한다. 그런데 'mental-low'(혼자인 점심시간)에서
// "괜찮아, 혼자가 편해"를 고르면 결과가 "혼자만의 시간도 나쁘지 않다. ... 정말?"이었다 —
// 서술자가 플레이어의 자기결정을 되물어 깎는다. 그 순간 게임은 '정답 맞히기'가 된다.
//
// **보상 차이는 문제가 아니다.** 위기 이벤트에서 손을 내미는 쪽이 수치로 더 큰 건 설계일 수 있다.
// 잡는 건 문장이 한쪽 선택을 틀렸다고 암시하는 **언어 표지**뿐이다. 정서 극성은 수치 부호로
// 판정하지 않는다(정서 부정 선택지의 96%가 수치는 양수다) — 그래서 이 게이트는 숫자를 안 본다.
//
// 표지 넷 (전부 **서술** 층에서만 — 큰따옴표 안 대사는 뺀다. NPC의 "진짜?"는 반어가 아니다.
// 홑따옴표는 빼지 않는다: 한국어에서 '…'는 **속마음** 표기라 '같이 뛸 걸.'은 서술자의 후회 강요다):
//   R1 반어 꼬리   — 서술 문장 하나가 통째로 "정말?" / "진짜?" / "과연?" / "글쎄?" 인 것
//   R2 후회 강요   — "~ㄹ걸 (그랬나)" / "~할 걸." : 고른 직후 서술자가 다른 선택을 했어야 했다고 말함
//   R3 '핑계' 서술 — 서술자가 플레이어의 이유를 핑계라고 부름 (선택지 라벨에서 스스로 고른 말은 제외)
//   R4 라벨 폄하   — 선택지 라벨의 서술 부분이 그 선택을 깎는 동사("떠넘긴다")로 적힘
//                    (라벨 속 대사 "남에게 떠넘기지 않을게요."는 플레이어의 말이라 제외)
//
// **이건 '조롱 전수 판정기'가 아니다.** "좀 아쉬웠다"류의 감정 대가, 의도된 대가의 서사(무리한
// 갈아넣기·번아웃), 남에게 상처 주는 선택의 결과는 조롱이 아니고 여기서 잡지도 않는다.
// 경계 사례는 T65 PR 본문의 표에 사람이 판정해 두었다. 이 게이트는 **확실한 표지가 다시
// 들어오는 것**만 막는다.
//
// 코퍼스: GAME_EVENTS + SCHOOL_LIFE_EVENTS(선택 풀 별도) + 말걸기 미니이벤트 3풀의 choices.
// 선택지마다 기본·여성 판본(femaleChoices)·학교급 변이(schoolVariants, femaleText/femaleMessage)·
// 미니의 resultText까지 화면에 나갈 수 있는 문장을 전부 본다.
//
// 실행: cd game && npx tsx scripts/verify/verify-choice-dignity.ts

import { GAME_EVENTS } from '../../src/engine/events/data';
import { SCHOOL_LIFE_EVENTS } from '../../src/engine/events/school-life';
import { NPC_MINI_EVENTS, PARENT_MINI_EVENTS, PARENT_CLIMAX_EVENTS } from '../../src/engine/talkData';
import type { MiniTalkEvent } from '../../src/engine/talkData';
import type { GameEvent } from '../../src/engine/types';

// 기본은 **실패**다. 맨 아래 성공 블록(표지 0건일 때만 도는)만 0으로 내린다.
process.exitCode = 1;

// ── 코퍼스 펼치기 ─────────────────────────────────────────────────────────────

type TextKind = 'label' | 'result';
/** 펼치기 경로. 하한을 경로별로 거는 이유: 전체 합계 하나면 경로 하나(예: 미니 message 24개)가
 *  통째로 빠져도 합계 여유 안에서 통과한다(3자 검수 실측 — 결과 876 vs 하한 850). */
const PATHS = [
  'base.label', 'base.result', 'female.label', 'female.result',
  'variant.label', 'variant.result', 'variant.femaleLabel', 'variant.femaleResult',
  'mini.label', 'mini.result', 'mini.resultText',
] as const;
type Path = (typeof PATHS)[number];
interface ChoiceText { where: string; kind: TextKind; path: Path; text: string }
interface Corpus { texts: ChoiceText[]; events: number }

function flatten(events: readonly GameEvent[], minis: readonly MiniTalkEvent[]): Corpus {
  const texts: ChoiceText[] = [];
  let nEvents = 0;
  const push = (where: string, path: Path, text: string | undefined) => {
    if (text) texts.push({ where, path, kind: path.endsWith('abel') ? 'label' : 'result', text });
  };
  for (const e of events) {
    nEvents++;
    e.choices.forEach((c, i) => { push(`${e.id}[${i}]`, 'base.label', c.text); push(`${e.id}[${i}]`, 'base.result', c.message); });
    e.femaleChoices?.forEach((c, i) => { push(`${e.id}[F${i}]`, 'female.label', c.text); push(`${e.id}[F${i}]`, 'female.result', c.message); });
    if (e.schoolVariants) {
      for (const [band, variants] of Object.entries(e.schoolVariants)) {
        variants.forEach((v, vi) => v.choices.forEach((c, i) => {
          const w = `${e.id}[${band}${vi}.${i}]`;
          push(w, 'variant.label', c.text); push(`${w}F`, 'variant.femaleLabel', c.femaleText);
          push(w, 'variant.result', c.message); push(`${w}F`, 'variant.femaleResult', c.femaleMessage);
        }));
      }
    }
  }
  for (const m of minis) {
    if (!m.choices) continue;
    nEvents++;
    m.choices.forEach((c, i) => {
      push(`${m.id}[${i}]`, 'mini.label', c.label);
      push(`${m.id}[${i}]`, 'mini.result', c.message);
      push(`${m.id}[${i}]R`, 'mini.resultText', c.resultText);
    });
  }
  return { texts, events: nEvents };
}

// ── 표지 ──────────────────────────────────────────────────────────────────────

/** 큰따옴표 안(대사)만 지운다. 홑따옴표는 속마음이라 서술로 남긴다(헤더 참고). */
export function narration(text: string): string {
  return text.replace(/"[^"]*"/g, ' ');
}

/** 한글 음절의 받침이 ㄹ인가 (할·뛸·고칠·받을 …) */
function hasRieulFinal(ch: string): boolean {
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8;
}

export type Rule = 'R1' | 'R2' | 'R3' | 'R4';

const R1_IRONY_TAIL = /(?:^|[.!?…~])\s*(?:정말|진짜|과연|글쎄)\s*\?+(?=\s|$)/;
const R4_SCORN_LABEL = /떠넘/;   // 떠넘긴다·떠넘기고·떠넘겨 — 음절이 활용마다 달라 어간 둘째 음절까지만

function regretForcing(s: string): boolean {
  for (let i = s.indexOf('걸'); i !== -1; i = s.indexOf('걸', i + 1)) {
    const after = s.slice(i + 1);
    if (!/^(?:\s*그랬|[,.!?…~]|\s*$)/.test(after)) continue;   // 걸었다·걸려 등은 통과
    let j = i - 1;
    if (s[j] === ' ') j--;
    if (j >= 0 && hasRieulFinal(s[j])) return true;
  }
  return false;
}

export function rulesHit(t: Pick<ChoiceText, 'kind' | 'text'>): Rule[] {
  const hits: Rule[] = [];
  const n = narration(t.text);
  if (t.kind === 'label') {
    if (R4_SCORN_LABEL.test(n)) hits.push('R4');
    return hits;
  }
  if (R1_IRONY_TAIL.test(n)) hits.push('R1');
  if (regretForcing(n)) hits.push('R2');
  if (n.includes('핑계')) hits.push('R3');
  return hits;
}

interface Problem { where: string; rule: Rule; text: string }

function audit(texts: readonly ChoiceText[]): Problem[] {
  const out: Problem[] = [];
  for (const t of texts) for (const rule of rulesHit(t)) out.push({ where: t.where, rule, text: t.text });
  return out;
}

// ── 자기검사 ──────────────────────────────────────────────────────────────────
// 실데이터는 표지 0건이라, 이게 없으면 규칙을 통째로 지워도 초록이다. 합성 픽스처는
// **펼치기 경로까지** 지나가게 만든다 — 규칙이 멀쩡해도 변이·여성 판본·resultText를 안 펼치면
// 그 문장들은 영영 검사 밖이다. 실패는 process.exit이 아니라 throw(exit 줄을 지워도 산다) —
// **콘텐츠 실패도 같다**(맨 아래). 전엔 콘텐츠 실패가 `process.exit(exitCodeFor(...))` 한 줄에만
// 걸려 있어서, 그 줄을 지우면 "❌ FAIL"을 찍고도 rc=0이었다(3자 검수 실측, run-chain은 rc만 본다).
const fx = (id: string, choices: GameEvent['choices'], extra: Partial<GameEvent> = {}): GameEvent =>
  ({ id, title: id, description: '', choices, ...extra });
const C = (text: string, message: string) => ({ text, message, effects: {} });

const SELF_EVENTS: GameEvent[] = [
  // 양성 — 규칙마다, 그리고 펼치기 경로마다 하나씩
  fx('__r1_base', [C('혼자 먹는다', '혼자도 나쁘지 않다. ... 정말?')]),
  fx('__r2_innerthought', [C('a', "'같이 뛸 걸.' 하고 운동장을 봤다.")]),   // 홑따옴표 속마음
  fx('__r4_base_label', [C('"몰라." 떠넘긴다', '괜찮다.')], { femaleChoices: [C('결정을 떠넘겨 버린다', '괜찮다.')] }),
  fx('__r1_female', [C('a', '괜찮다.')], { femaleChoices: [C('a', '괜찮다. …진짜?')] }),
  fx('__r2_variant', [C('a', '괜찮다.')], {
    schoolVariants: {
      elementary: [{ description: '', choices: [{ text: 'a', message: '괜찮다.' }] }],
      middle: [{ description: '', choices: [{ text: 'a', message: '괜찮다.', femaleMessage: '도움 받을걸 그랬나.' }] }],
      high: [{ description: '', choices: [{ text: 'a', message: '같이 뛸 걸, 좀 아쉬웠다.' }] }],
    },
  }),
  fx('__r3_base', [C('쉰다', '늦잠을 핑계로 하루를 비웠다.')]),
  fx('__r4_variant_female_label', [C('a', '괜찮다.')], {
    schoolVariants: {
      elementary: [{ description: '', choices: [{ text: 'a', femaleText: '"몰라요." 떠넘긴다', message: '괜찮다.' }] }],
      middle: [], high: [],
    },
  }),
  // 음성 — 대사 속 "진짜?"·"할걸", 걸었다/그걸, 라벨 속 '핑계', 의문문 꼬리, 받침 없는 '그걸,', 라벨 대사 속 '떠넘'
  fx('__neg', [
    C('체육대회를 핑계로 쉰다', '"진짜? 고마워..." 민재가 웃었다.'),
    C('b', '"…진짜?" 유나가 처음으로 눈을 마주친다. "다 응원할걸."'),
    C('c', '한참을 걸었다. 그걸 보니 마음이 놓였다. 내가 할 걸 알았다.'),
    C('d', '의지를 다졌다. 과연 지킬 수 있을까?'),
    C('e', '남은 건 그걸, 이제 안다.'),   // ㄹ받침 판정이 무너지면 '그걸,'이 걸린다
    C('"남에게 떠넘기지 않을게요." 스스로 정한다', '괜찮다.'),   // 라벨 속 대사의 '떠넘'은 플레이어의 말
  ]),
];
const SELF_MINIS: MiniTalkEvent[] = [{
  id: '__mini', description: '', effects: {}, message: '',
  choices: [
    { label: '"그만할래요." 마음을 접는다', message: '잠시 손을 놓았다', resultText: '엄마는 웃었다. 그래도 될까... 정말?' },
    { label: '"모르겠어요." 떠넘긴다', message: '결정을 미뤘다' },
  ],
}];
const SELF_EXPECT = [
  '__mini[0]R:R1', '__mini[1]:R4',
  '__r1_base[0]:R1', '__r1_female[F0]:R1',
  '__r2_variant[high0.0]:R2', '__r2_variant[middle0.0]F:R2',
  '__r2_innerthought[0]:R2', '__r4_base_label[0]:R4', '__r4_base_label[F0]:R4',
  '__r3_base[0]:R3', '__r4_variant_female_label[elementary0.0]F:R4',
].sort();

const selfCorpus = flatten(SELF_EVENTS, SELF_MINIS);
const selfGot = audit(selfCorpus.texts).map(p => `${p.where}:${p.rule}`).sort();
if (selfGot.join('|') !== SELF_EXPECT.join('|')) {
  throw new Error(`게이트 자기검사 실패 — 기대 [${SELF_EXPECT.join(', ')}] / 실제 [${selfGot.join(', ')}]`);
}

// ── 실행 ──────────────────────────────────────────────────────────────────────
const corpus = flatten(
  [...GAME_EVENTS, ...SCHOOL_LIFE_EVENTS],
  [...NPC_MINI_EVENTS, ...PARENT_MINI_EVENTS, ...PARENT_CLIMAX_EVENTS],
);
const problems = audit(corpus.texts);
const byPath = Object.fromEntries(PATHS.map(p => [p, 0])) as Record<Path, number>;
for (const t of corpus.texts) byPath[t.path]++;
const resultTexts = corpus.texts.filter(t => t.kind === 'result').length;
const labelTexts = corpus.texts.length - resultTexts;

console.log('선택지 존엄 검증 — 결과 문장이 고른 선택을 비꼬지 않는가 (반어 꼬리·후회 강요·핑계 서술·라벨 폄하)');
console.log(`  이벤트 ${corpus.events}개 · 검사 문장: 결과 ${resultTexts} · 라벨 ${labelTexts}`);
console.log(`  경로별: ${PATHS.map(p => `${p} ${byPath[p]}`).join(' · ')}`);
console.log(`  자기검사 통과 — 합성 표지 ${SELF_EXPECT.length}종(4규칙 × 기본·여성·변이·미니 경로 + 홑따옴표 속마음)을 전부 잡고 음성 대조 6건은 통과`);

// 커버리지 하한 — **경로별**로, 실측 바로 아래에 건다. 줄어드는 쪽만 막는다(콘텐츠는 늘어나는 리포).
// 경로 하나가 통째로 빠지면(펼치기 누락) 그 경로만 0이 되어 반드시 걸린다. 실측은 출력의 '경로별' 줄.
// 2026-10-07 실측: base 634/634 · female 68/68 · variant 144/144 · variant.female* 0/0 · mini 24/24 · resultText 6.
// variant.female*는 현 코퍼스에 0건이라 하한도 0이다 — 그 경로는 자기검사 양성(__r2_variant·__r4_variant_female_label)만 잠근다.
const FLOOR: Record<Path, number> = {
  'base.label': 625, 'base.result': 625, 'female.label': 66, 'female.result': 66,
  'variant.label': 140, 'variant.result': 140, 'variant.femaleLabel': 0, 'variant.femaleResult': 0,
  'mini.label': 23, 'mini.result': 23, 'mini.resultText': 6,
};
const FLOOR_EVENTS = 240;
const short = PATHS.filter(p => byPath[p] < FLOOR[p]).map(p => `${p} ${byPath[p]}/${FLOOR[p]}`);
if (corpus.events < FLOOR_EVENTS) short.push(`events ${corpus.events}/${FLOOR_EVENTS}`);
if (short.length > 0) {
  throw new Error(`커버리지 하한 미달 — ${short.join(', ')}. 펼치기가 좁아졌거나 풀이 사라졌다.`);
}

// 실패를 삼키려면 **두 군데**를 고쳐야 하게 짠다. throw 한 줄만 지우면 아래 성공 블록이
// 조건(problems.length === 0)에 막혀 안 돌고, 맨 위의 기본값 exitCode=1이 그대로 남는다.
// (throw만 둔 초판은 throw 줄 삭제 + 표지 주입에 "✅ PASS"·rc=0이었다 — 뮤테이션 실측.)
if (problems.length > 0) {
  for (const p of problems) console.log(`  [${p.rule}] ${p.where}: ${p.text}`);
  throw new Error(`❌ FAIL — 표지 ${problems.length}건. 고른 선택이 지키는 가치를 말하게 고칠 것(수치는 건드리지 말 것)`);
}
if (problems.length === 0) {
  console.log(`\n✅ PASS — 표지 0건 (결과 문장 ${resultTexts} · 라벨 ${labelTexts})`);
  process.exitCode = 0;
}
