// 한글 조사 자동 선택 — 앞 단어의 받침(종성)으로 이형태를 고른다.
// 이름·아이템명·학년 라벨 등 데이터 치환 시 "지훈와"·"세트을"·"중2이" 같은 오조사를 막는다.
// 의존 없는 순수 leaf 모듈(weekMath.ts 선례).

// 마지막 글자의 종성 상태.
//  'none'  — 받침 없음 (뒤 이형태: 를/는/가/와/야, 그리고 '로')
//  'rieul' — ㄹ 받침    (조사 대부분은 앞 이형태지만, '(으)로'만은 '로')
//  'other' — 그 외 받침  (앞 이형태: 을/은/이/과/아/으로)
// 한글 음절 + 숫자(한국어 발음 기준)를 지원하고, 그 외 문자는 'none'으로 본다.
function finality(word: string): 'none' | 'rieul' | 'other' {
  if (!word) return 'none';
  const ch = word[word.length - 1];
  const code = ch.charCodeAt(0);
  // 한글 음절: (code-0xAC00) % 28 = 종성 인덱스 (0=없음, 8=ㄹ)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    if (jong === 0) return 'none';
    return jong === 8 ? 'rieul' : 'other';
  }
  // 숫자: 한국어 발음 종성 (1 일=ㄹ / 2 이=없음 / 3 삼=ㅁ / 6 육=ㄱ / 7 칠·8 팔=ㄹ …)
  const digitFinality: Record<string, 'none' | 'rieul' | 'other'> = {
    '0': 'other', '1': 'rieul', '2': 'none', '3': 'other', '4': 'none',
    '5': 'none', '6': 'other', '7': 'rieul', '8': 'rieul', '9': 'none',
  };
  return digitFinality[ch] ?? 'none';
}

type JosaPair = '을/를' | '은/는' | '이/가' | '와/과' | '아/야' | '으로/로';

// 종성 상태별 이형태. none=받침없음 / other=ㄹ외 받침 / rieul=ㄹ 받침(대개 other와 같되 '(으)로'만 '로').
// 주의: '와/과'는 관용 표기 순서상 무받침형(와)이 앞이라 split에 의존하면 뒤집힌다 → 명시 매핑.
const FORMS: Record<JosaPair, { none: string; other: string; rieul: string }> = {
  '을/를': { none: '를', other: '을', rieul: '을' },
  '은/는': { none: '는', other: '은', rieul: '은' },
  '이/가': { none: '가', other: '이', rieul: '이' },
  '와/과': { none: '와', other: '과', rieul: '과' },
  '아/야': { none: '야', other: '아', rieul: '아' },
  '으로/로': { none: '로', other: '으로', rieul: '로' },
};

// 단어에 조사를 붙여 반환. 예: josa('지훈', '와/과') → '지훈과', josa('중2', '이/가') → '중2가'.
export function josa(word: string, pair: JosaPair): string {
  return word + FORMS[pair][finality(word)];
}
