// @vitest-environment jsdom
// EventScene — 이벤트 화면의 계약 검증:
// 선택지 노출 규칙(조건/원본 인덱스/돈 게이팅/지나친다), 페이지 분할, 성별 분기, 화자 라벨.
// 이미지 로드는 jsdom에서 발화하지 않으므로(리소스 미로딩) 폴백 체인은 여기서 다루지 않는다.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EventScene } from '../EventScene';
import { GAME_EVENTS } from '../../engine/events';
import { makeState, makeEvent, makeChoice } from '../../test/fixtures';

function renderScene(overrides?: Partial<Parameters<typeof EventScene>[0]>) {
  const onChoice = vi.fn();
  const props = {
    event: makeEvent(),
    gender: 'male' as const,
    year: 1,
    onChoice,
    ...overrides,
  };
  const utils = render(<EventScene {...props} />);
  return { ...utils, onChoice };
}

describe('EventScene 기본 렌더', () => {
  it('제목·본문·선택지를 렌더하고 선택 시 onChoice(원본 인덱스)를 호출한다', () => {
    const { onChoice } = renderScene({
      event: makeEvent({
        title: '방과후 초대',
        description: '지훈이 손을 흔든다.',
        choices: [makeChoice({ text: '같이 간다' }), makeChoice({ text: '다음에 간다' })],
      }),
    });
    expect(screen.getByText('방과후 초대')).toBeInTheDocument();
    expect(screen.getByText('지훈이 손을 흔든다.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('다음에 간다'));
    expect(onChoice).toHaveBeenCalledWith(1);
  });

  it('condition 불만족 선택지는 숨기되 onChoice에는 원본 인덱스를 전달한다', () => {
    const { onChoice } = renderScene({
      state: makeState(),
      event: makeEvent({
        choices: [
          makeChoice({ text: '숨겨질 선택지', condition: () => false }),
          makeChoice({ text: '보이는 A' }),
          makeChoice({ text: '보이는 B' }),
        ],
      }),
    });
    expect(screen.queryByText('숨겨질 선택지')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('보이는 B'));
    // 배열 필터 후에도 인덱스는 원본(2) — 부모의 choices[index] 해석과 어긋나면 안 된다
    expect(onChoice).toHaveBeenCalledWith(2);
  });
});

describe('EventScene 돈 게이팅', () => {
  it('잔액 부족 선택지는 잠그고 부족 안내를 보여준다', () => {
    renderScene({
      state: makeState({ money: 10 }),
      event: makeEvent({
        choices: [
          makeChoice({ text: '한턱 쏜다', moneyEffect: -50 }),
          makeChoice({ text: '구경만 한다' }),
        ],
      }),
    });
    const locked = screen.getByText('한턱 쏜다').closest('button');
    expect(locked).toBeDisabled();
    expect(screen.getByText(/돈이 부족합니다/)).toBeInTheDocument();
    expect(screen.getByText('구경만 한다').closest('button')).toBeEnabled();
  });

  it('감당 가능한 유료 선택지에는 비용을 사전 표시한다', () => {
    renderScene({
      state: makeState({ money: 100 }),
      event: makeEvent({ choices: [makeChoice({ text: '선물을 산다', moneyEffect: -30 })] }),
    });
    expect(screen.getByText(/비용 30만원/)).toBeInTheDocument();
    expect(screen.getByText('선물을 산다').closest('button')).toBeEnabled();
  });

  it('보이는 선택지가 전부 잠기면 "지나친다" 안전망이 나타나고 onChoice(-1)을 보낸다', () => {
    const { onChoice } = renderScene({
      state: makeState({ money: 0 }),
      event: makeEvent({
        choices: [
          makeChoice({ text: '비싼 선택 A', moneyEffect: -50 }),
          makeChoice({ text: '비싼 선택 B', moneyEffect: -30 }),
        ],
      }),
    });
    fireEvent.click(screen.getByText('지나친다'));
    expect(onChoice).toHaveBeenCalledWith(-1);
  });

  it('condition으로 모든 선택지가 숨겨져도 "지나친다"로 진행할 수 있다', () => {
    const { onChoice } = renderScene({
      state: makeState(),
      event: makeEvent({ choices: [makeChoice({ text: '숨김', condition: () => false })] }),
    });
    fireEvent.click(screen.getByText('지나친다'));
    expect(onChoice).toHaveBeenCalledWith(-1);
  });
});

describe('EventScene 성별 분기', () => {
  const event = makeEvent({
    description: '남주 본문',
    choices: [makeChoice({ text: '남주 선택지' })],
    femaleDescription: '여주 본문',
    femaleChoices: [makeChoice({ text: '여주 선택지 0' }), makeChoice({ text: '여주 선택지 1' })],
  });

  it('여성 플레이어는 femaleDescription/femaleChoices를 본다', () => {
    const { onChoice } = renderScene({ event, gender: 'female' });
    expect(screen.getByText('여주 본문')).toBeInTheDocument();
    expect(screen.queryByText('남주 본문')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('여주 선택지 1'));
    expect(onChoice).toHaveBeenCalledWith(1);
  });

  it('남성 플레이어는 기본 description/choices를 본다', () => {
    renderScene({ event, gender: 'male' });
    expect(screen.getByText('남주 본문')).toBeInTheDocument();
    expect(screen.queryByText('여주 선택지 0')).not.toBeInTheDocument();
  });
});

describe('EventScene 페이지 분할', () => {
  // jsdom 기본 viewport(1024px) = 데스크탑 → maxVisualLines 3.
  // 짧은 줄 4개면 3+1로 2페이지가 된다(줄당 visual line 1).
  const longEvent = makeEvent({
    description: '첫째 줄이다.\n둘째 줄이다.\n셋째 줄이다.\n넷째 줄이다.',
    choices: [makeChoice({ text: '마지막 선택지' })],
  });

  it('마지막 페이지 전에는 선택지를 숨기고, 도달하면 노출한다', () => {
    renderScene({ event: longEvent });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText('셋째 줄이다.')).toBeInTheDocument();
    expect(screen.getByText('마지막 선택지')).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByText('넷째 줄이다.')).toBeInTheDocument();
    expect(screen.getByText('마지막 선택지')).toBeVisible();
  });

  it('끝까지 읽은 뒤 이전 페이지로 돌아가도 선택지는 유지된다', () => {
    renderScene({ event: longEvent });
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    fireEvent.click(screen.getByRole('button', { name: '이전 페이지' }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    // 재읽기 중 선택지가 사라지면 사용자는 "선택지가 없어졌다"고 느낀다 — 영구 노출 계약
    expect(screen.getByText('마지막 선택지')).toBeVisible();
  });

  // 첫 장면 회귀 앵커: 첫 줄 `…뒤에서 "야!" 하는 소리.`는 지문과 대사 사이에 <br />이 들어가 화면에서 두 줄이다.
  // 한 줄로 세면 1쪽이 실제 4줄이 돼 6em 상자 밑으로 지훈의 셋째 줄이 숨었다(스크롤 표시 없음).
  it('first_week_page_one_fits: 첫 장면 1쪽은 지문 뒤 대사 줄을 두 줄로 세서 셋째 줄을 2쪽으로 넘긴다', () => {
    const firstWeek = GAME_EVENTS.find(e => e.id === 'first-week');
    if (!firstWeek) throw new Error('first-week 전제 붕괴');
    renderScene({ event: firstWeek, npcs: [{ id: 'jihun', name: '지훈', met: true }] });
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByText(/돌아보니 지훈이가/)).toBeInTheDocument();
    expect(screen.queryByText(/우리 또 같은 반이다/), 'first_week_page_one_fits').not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(screen.getByText(/우리 또 같은 반이다/)).toBeInTheDocument();
  });

  // 데스크탑 charsPerLine = floor((1024 - 48) / 16) = 61. 대사 57자 + 따옴표 = 59자라 이름 없이는 한 줄,
  // `지훈 : `(5자)이 붙으면 64자로 두 줄이다. 같은 본문을 화자 없이 그리면 한 쪽 — 이름을 세는지만 가른다.
  it('speaker_label_counted: 화자 이름까지 글자로 세서 줄을 나눈다', () => {
    const spoken = `"${'가'.repeat(57)}"`;
    const event = makeEvent({ description: `첫째 줄이다.\n둘째 줄이다.\n${spoken}`, speakers: ['jihun'] });
    const { unmount } = renderScene({ event, npcs: [{ id: 'jihun', name: '지훈', met: true }] });
    expect(screen.getByText('1 / 2'), 'speaker_label_counted').toBeInTheDocument();
    unmount();

    renderScene({ event: { ...event, speakers: [] } });
    expect(screen.queryByRole('button', { name: '다음 페이지' })).not.toBeInTheDocument();
  });

  // 실측 고리 — jsdom은 높이가 0이라 상자 기하를 심는다. 줄 하나 31px(1.7em+4px), 상자는 평소 90px이고
  // 선택지가 뜨면 65px로 눌린다(1280·1024px 실측값). 짐작(데스크탑 3줄)은 둘 다 넘친다.
  describe('넘침 실측', () => {
    const box = (el: HTMLElement) => el.style.maxHeight !== '' && el.style.overflowY === 'auto';
    const choicesShown = () => {
      const b = [...document.querySelectorAll('button')].find(x => x.textContent?.includes('마지막 선택지'));
      return !!b && b.closest('[style*="display: none"]') === null;
    };
    let restore: (() => void) | undefined;
    beforeEach(() => {
      const proto = HTMLElement.prototype;
      const saved = (['scrollHeight', 'clientHeight'] as const).map(k => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
      Object.defineProperty(proto, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return box(this) ? 31 * this.children.length : 0; } });
      Object.defineProperty(proto, 'clientHeight', { configurable: true, get(this: HTMLElement) { return box(this) ? (choicesShown() ? 65 : 90) : 0; } });
      restore = () => { for (const [k, d] of saved) { if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k]; } };
    });
    afterEach(() => restore?.());

    it('fit_cut_body: 선택지 전 쪽이 넘치면 한도를 깎아 셋째 줄을 다음 쪽으로 넘긴다', () => {
      renderScene({ event: longEvent });
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.queryByText('셋째 줄이다.'), 'fit_cut_body').not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText('셋째 줄이다.')).toBeInTheDocument();
      expect(screen.getByText('넷째 줄이다.')).toBeInTheDocument();
      expect(screen.getByText('마지막 선택지')).toBeVisible();
    });

    it('fit_cut_last: 선택지에 눌린 마지막 쪽이 넘치면 그 쪽만 다시 나눈다', () => {
      renderScene({
        event: makeEvent({ description: '첫째 줄이다.\n둘째 줄이다.\n셋째 줄이다.', choices: [makeChoice({ text: '마지막 선택지' })] }),
      });
      expect(screen.getByText('1 / 2'), 'fit_cut_last').toBeInTheDocument();
      expect(screen.getByText('마지막 선택지')).not.toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText('셋째 줄이다.')).toBeInTheDocument();
      expect(screen.getByText('마지막 선택지')).toBeVisible();
    });
  });

  // 원문 한 줄이 한도(데스크탑 짐작 3줄 × 61자)보다 길면 그 줄을 쪼갠다 — 쪽은 `\n`에서만 갈려
  // 한도를 아무리 깎아도 긴 줄은 통째로 한 쪽에 남아 밑이 숨었다(실측 651건, 1280×720 66종·320px 14종).
  describe('긴 한 줄 쪼개기', () => {
    const descBox = () => [...document.querySelectorAll<HTMLElement>('div')].find(d => d.style.overflowY === 'auto' && d.style.maxHeight !== '');
    const jihun = [{ id: 'jihun', name: '지훈', met: true }];

    it('long_paragraph_split: 문단 한 줄은 문장 끝에서 나눠 다음 쪽으로 넘긴다', () => {
      const s = (tag: string) => `${tag}${'가'.repeat(42)}.`;
      renderScene({ event: makeEvent({ description: [s('첫 문장'), s('둘 문장'), s('셋 문장'), s('넷 문장')].join(' ') }) });
      expect(screen.getByText('1 / 2'), 'long_paragraph_split').toBeInTheDocument();
      expect(screen.getByText(/^첫 문장.*셋 문장가+\.$/)).toBeInTheDocument();
      expect(screen.queryByText(/넷 문장/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText(/^넷 문장가+\.$/)).toBeInTheDocument();
    });

    it('narration_quote_split: 지문 뒤 대사가 붙은 긴 줄은 지문·대사 사이에서 나누고, 대사 쪽에 화자 이름이 붙는다', () => {
      const before = `${'나'.repeat(70)}하자`;
      const dialogue = '다'.repeat(100);
      renderScene({ event: makeEvent({ description: `${before} "${dialogue}"`, speakers: ['jihun'] }), npcs: jihun });
      expect(screen.getByText('1 / 2'), 'narration_quote_split').toBeInTheDocument();
      expect(screen.getByText(before)).toBeInTheDocument();
      expect(screen.queryByText(`"${dialogue}"`)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText(`"${dialogue}"`)).toBeInTheDocument();
      expect(within(descBox()!).getByText('지훈')).toBeInTheDocument();
    });

    // 대사 둘이 한 줄에 있으면 두 대사 **사이**에서만 자른다. 첫 대사 안의 `. `에서 자르면 따옴표 짝이 깨진다.
    it('quotes_stay_paired: 대사 둘이 붙은 줄은 따옴표 밖에서만 자른다', () => {
      const first = `${'라'.repeat(40)}. ${'라'.repeat(45)}?`;
      const second = `${'마'.repeat(90)}.`;
      renderScene({ event: makeEvent({ description: `"${first}" 옅게 웃는다. "${second}"`, speakers: ['jihun'] }), npcs: jihun });
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
      expect(screen.getByText(`"${first}"`), 'quotes_stay_paired').toBeInTheDocument();
      expect(descBox()?.textContent).toContain('옅게 웃는다.');
      expect(descBox()?.textContent).not.toContain('마');
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText(`"${second}"`)).toBeInTheDocument();
    });

    it('long_dialogue_rewrap: 긴 대사 하나는 대사 안 문장 끝에서 나누고 조각마다 따옴표·화자 이름을 단다', () => {
      const a = `${'바'.repeat(80)}.`, b = `${'사'.repeat(80)}.`, c = `${'아'.repeat(40)}.`;
      renderScene({ event: makeEvent({ description: `"${a} ${b} ${c}"`, speakers: ['jihun'] }), npcs: jihun });
      expect(screen.getByText('1 / 2'), 'long_dialogue_rewrap').toBeInTheDocument();
      expect(screen.getByText(`"${a} ${b}"`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText(`"${c}"`)).toBeInTheDocument();
      expect(within(descBox()!).getByText('지훈')).toBeInTheDocument();
    });

    it('short_line_untouched: 한도 안의 줄은 문장이 여럿이어도 한 줄 그대로다', () => {
      const { unmount } = renderScene({ event: makeEvent({ description: '짧은 문장. 또 짧은 문장.' }) });
      expect(descBox()?.children.length, 'short_line_untouched').toBe(1);
      expect(screen.getByText('짧은 문장. 또 짧은 문장.')).toBeInTheDocument();
      unmount();
      // 지문·대사 사이도 한도 안이면 안 가른다 — 갈리면 줄 사이에 여백(4px)이 끼어 모양이 바뀐다.
      renderScene({ event: makeEvent({ description: '짧은 지문 "짧은 대사."', speakers: ['jihun'] }), npcs: jihun });
      expect(descBox()?.children.length, 'short_line_untouched').toBe(1);
    });

    // 쪽마다 상자 글자를 모은다.
    const pageTexts = () => {
      const texts: string[] = [];
      for (let i = 0; i < 8; i++) {
        texts.push((descBox()?.textContent ?? '').trim());
        const next = screen.queryByRole('button', { name: '다음 페이지' });
        if (!next || (next as HTMLButtonElement).disabled) break;
        fireEvent.click(next);
      }
      return texts;
    };
    const siwoo = [{ id: 'siwoo', name: '시우', met: true }];

    // 3자 검수: `시우: "…"`를 지문·대사 사이에서 가르면 `시우:`만 쪽 끝에 홀로 남았다(siwoo-meet).
    it('prefix_stays_with_quote: 이름표 `시우:`는 대사와 떨어지지 않는다', () => {
      const s = (ch: string) => `${ch.repeat(48)}.`;
      renderScene({ event: makeEvent({ description: `${'가'.repeat(100)}.\n시우: "${s('나')} ${s('다')} ${s('라')}"`, speakers: ['siwoo'] }), npcs: siwoo });
      const texts = pageTexts();
      expect(texts.length).toBeGreaterThan(1);
      expect(texts.some(t => t.endsWith('시우:')), 'prefix_stays_with_quote').toBe(false);
      expect(texts.find(t => t.includes('시우:'))).toContain('나나');
    });

    // 3자 검수: 대사가 닫힌 뒤 인용 조사(했을)로 문장이 이어지는데 대사 뒤에서 쪽이 갈렸다(jihun-relay-baton).
    it('embedded_quote_kept: 지문 속 인용 뒤 `했을 애가`로 이어지는 문장은 인용 뒤에서 자르지 않는다', () => {
      const proto = HTMLElement.prototype;
      const saved = Object.getOwnPropertyDescriptor(proto, 'offsetWidth');
      Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.style.maxHeight !== '' && this.style.overflowY === 'auto' ? 544 : 0; } });
      try {
        const baton = GAME_EVENTS.find(e => e.id === 'jihun-relay-baton');
        if (!baton) throw new Error('jihun-relay-baton 전제 붕괴');
        renderScene({ event: baton, npcs: jihun });
        const texts = pageTexts();
        expect(texts.length).toBeGreaterThan(1);
        expect(texts.some(t => t.endsWith('"에이 다음에!"')), 'embedded_quote_kept').toBe(false);
        expect(texts.some(t => /^지훈\s*:\s*"에이 다음에!"/.test(t))).toBe(false);
      } finally {
        if (saved) Object.defineProperty(proto, 'offsetWidth', saved); else delete (proto as unknown as Record<string, unknown>).offsetWidth;
      }
    });

    // 3자 검수: 대사만으론 한도 안인데 앞 지문까지 그리면 넘친다 — 첫 조각에 앞 지문 몫을 안 세면 한 덩어리로 묶여
    // 마지막 수단(지문·대사 사이)으로 떨어지고 `나를 발견하자`만 한 쪽에 남았다(subin-academy).
    it('first_piece_counts_before: 대사를 나눌 때 첫 조각은 앞 지문 몫까지 센다', () => {
      const a = `${'가'.repeat(54)}?`, b = `${'나'.repeat(54)}?`, c = `${'다'.repeat(54)}~`;
      renderScene({ event: makeEvent({ description: `나를 발견하자 "${a} ${b} ${c}"`, speakers: ['jihun'] }), npcs: jihun });
      const texts = pageTexts();
      expect(texts[0], 'first_piece_counts_before').toContain('나를 발견하자');
      expect(texts[0]).toContain(a);
    });

    // 대사 뒤 지문(`하며 손을 든다.`)도 세야 한다 — 안 세면 같은 이유로 `수빈이가`만 남았다(school-festival).
    it('after_counted: 대사를 나눌 때 대사 뒤 지문 몫도 센다', () => {
      const a = `${'가'.repeat(54)}!`, b = `${'나'.repeat(54)}~`;
      renderScene({ event: makeEvent({ description: `수빈이가 "${a} ${b}" 하며 ${'다'.repeat(50)} 든다.`, speakers: ['jihun'] }), npcs: jihun });
      const texts = pageTexts();
      expect(texts[0], 'after_counted').toContain('수빈이가');
      expect(texts[0]).toContain(a);
    });

    // 3자 검수: 대사 속 괄호 지문이 쉼표에서 갈려 괄호 짝이 깨진 채 따옴표가 씌워졌다(seoa-name-blank).
    it('paren_not_cut: 괄호 안의 쉼표에서는 자르지 않는다', () => {
      // 괄호 하나가 한도(3줄)를 넘을 만큼 길어야 괄호 안 쉼표에서 갈린 조각이 다시 안 붙는다.
      const dialogue = `(${'가'.repeat(90)}, ${'나'.repeat(90)}) ${'다'.repeat(60)}, ${'라'.repeat(60)}.`;
      renderScene({ event: makeEvent({ description: `"${dialogue}"`, speakers: ['jihun'] }), npcs: jihun });
      const spans: string[] = [];
      for (let i = 0; i < 6; i++) {
        spans.push(...[...(descBox()?.querySelectorAll('span') ?? [])].map(s => s.textContent ?? '').filter(t => t.startsWith('"')));
        const next = screen.queryByRole('button', { name: '다음 페이지' });
        if (!next || (next as HTMLButtonElement).disabled) break;
        fireEvent.click(next);
      }
      expect(spans.length).toBeGreaterThan(1);
      for (const s of spans) expect((s.match(/\(/g) ?? []).length, `paren_not_cut: ${s}`).toBe((s.match(/\)/g) ?? []).length);
    });

    // 대사 안에 따옴표가 또 있으면 조각마다 따옴표를 다시 씌우지 않는다 — 짝이 어긋난다.
    it('inner_quote_guard: 대사 속 따옴표가 있으면 대사 안에서 다시 씌우지 않는다', () => {
      renderScene({ event: makeEvent({ description: `"${'가'.repeat(60)}. 그래서 "${'나'.repeat(20)}" 라고 ${'다'.repeat(150)}."`, speakers: ['jihun'] }), npcs: jihun });
      expect(screen.queryByRole('button', { name: '다음 페이지' }), 'inner_quote_guard').not.toBeInTheDocument();
    });

    it('clause_split: 마침표 없이 긴 문장은 쉼표에서 나눈다', () => {
      const a = `${'가'.repeat(70)},`, b = `${'나'.repeat(70)},`, c = `${'다'.repeat(60)}`;
      renderScene({ event: makeEvent({ description: `${a} ${b} ${c}` }) });
      expect(screen.getByText('1 / 2'), 'clause_split').toBeInTheDocument();
      expect(screen.getByText(`${a} ${b}`)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
      expect(screen.getByText(c)).toBeInTheDocument();
    });

    // 대사 사이에서 갈린 뒤에도 뒤 대사 하나가 한도보다 길면 그 대사를 다시 나눈다(minjae-hs-doubt 자리).
    it('piece_resplit: 갈린 조각이 아직 넘치면 그 조각을 다시 나눈다', () => {
      const long1 = `${'마'.repeat(100)}.`, long2 = `${'바'.repeat(100)}.`;
      // 뒤에 줄을 하나 더 둔다 — 긴 조각이 마지막 쪽이면 끝쪽 재분할이 대신 나눠 이 갈래를 가린다.
      renderScene({ event: makeEvent({ description: `"${'라'.repeat(20)}." 웃는다. "${long1} ${long2}"\n마지막 지문.`, speakers: ['jihun'] }), npcs: jihun });
      // 쪽마다 대사 칸(따옴표 span)을 모은다 — 다시 나눴으면 두 대사가 각자 한 칸이다.
      const spans: string[] = [];
      for (let i = 0; i < 5; i++) {
        spans.push(...[...(descBox()?.querySelectorAll('span') ?? [])].map(s => s.textContent ?? ''));
        const next = screen.queryByRole('button', { name: '다음 페이지' });
        if (!next || (next as HTMLButtonElement).disabled) break;
        fireEvent.click(next);
      }
      expect(spans, 'piece_resplit').toContain(`"${long1}"`);
      expect(spans).toContain(`"${long2}"`);
    });

    describe('그려진 상자 기하', () => {
      let restore: (() => void) | undefined;
      const stub = (geo: { offsetWidth?: number; perLineChars?: number; boxH?: number }) => {
        const proto = HTMLElement.prototype;
        const keys = ['scrollHeight', 'clientHeight', 'offsetWidth'] as const;
        const saved = keys.map(k => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
        const isBox = (el: HTMLElement) => el.style.maxHeight !== '' && el.style.overflowY === 'auto';
        if (geo.perLineChars) {
          // 상자가 실제로 30자마다 줄을 바꾼다고 친다(짐작 61자의 절반) — 줄 하나 31px, 상자 90px.
          const per = geo.perLineChars;
          Object.defineProperty(proto, 'scrollHeight', { configurable: true, get(this: HTMLElement) {
            return isBox(this) ? [...this.children].reduce((h, c) => h + 31 * Math.ceil((c.textContent ?? '').length / per), 0) : 0;
          } });
          const boxH = geo.boxH ?? 90;
          Object.defineProperty(proto, 'clientHeight', { configurable: true, get(this: HTMLElement) { return isBox(this) ? boxH : 0; } });
        }
        if (geo.offsetWidth) {
          const w = geo.offsetWidth;
          Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isBox(this) ? w : 0; } });
        }
        restore = () => { for (const [k, d] of saved) { if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k]; } };
      };
      afterEach(() => { restore?.(); restore = undefined; });

      // 짐작(61자)으로는 두 줄이라 안 나눠지는데, 그려 보니 세 줄이라 넘친다. 원문 줄은 하나뿐이다 —
      // 예전 고리는 `\n`이 없으면 손을 뗐다. 문장이 여럿이면 아직 나눌 자리가 있다.
      it('fit_cut_single_line: 넘친 쪽이 원문 한 줄이어도 문장이 여럿이면 실측 고리가 나눈다', () => {
        stub({ perLineChars: 30 });
        const s = (n: number) => `${'가'.repeat(23)}${n}.`;
        renderScene({ event: makeEvent({ description: `${s(1)} ${s(2)} ${s(3)}` }) });
        expect(screen.getByText('1 / 2'), 'fit_cut_single_line').toBeInTheDocument();
      });

      // 문단 사이 빈 줄이 쪽 끝에 걸리면 빈 줄만 든 쪽이 생겼다(suneung-done, 1280×720 실측 — 빈 화면에 2 / 3).
      it('no_blank_page: 빈 줄만 든 쪽은 만들지 않는다', () => {
        stub({ perLineChars: 30, boxH: 40 });
        renderScene({ event: makeEvent({ description: '첫 문단이다.\n둘째 줄이다.\n\n끝 문단이다.' }) });
        const texts: string[] = [];
        for (let i = 0; i < 6; i++) {
          texts.push((descBox()?.textContent ?? '').trim());
          const next = screen.queryByRole('button', { name: '다음 페이지' });
          if (!next || (next as HTMLButtonElement).disabled) break;
          fireEvent.click(next);
        }
        expect(texts.length).toBeGreaterThan(1);
        expect(texts, 'no_blank_page').not.toContain('');
        expect(texts.join(' ')).toContain('끝 문단이다.');
      });

      // 3자 검수: 원문 끝 빈 줄이 끝쪽이 되면 끝쪽 한도가 빈 줄에만 걸려 본문이 안 나뉘었다 — 빈 줄을 먼저 버린다.
      it('trailing_blank_last_limit: 원문이 빈 줄로 끝나도 끝쪽 한도가 본문에 걸린다', () => {
        stub({ offsetWidth: 480, perLineChars: 30, boxH: 40 });
        const s = (n: number) => `${'가'.repeat(23)}${n}.`;
        renderScene({ event: makeEvent({ description: `${s(1)} ${s(2)}\n\n\n\n` }) });
        expect(screen.getByText('1 / 2'), 'trailing_blank_last_limit').toBeInTheDocument();
      });

      // 3자 검수: 사건 도중 창 크기가 바뀌면 폭 재기는 다시 안 돌고 고리는 '폭이 다르다'에서 매번 멈췄다.
      it('resize_refits: 사건 도중 상자 폭이 바뀌어도 넘친 쪽을 다시 나눈다', () => {
        const proto = HTMLElement.prototype;
        const keys = ['scrollHeight', 'clientHeight', 'offsetWidth'] as const;
        const saved = keys.map(k => [k, Object.getOwnPropertyDescriptor(proto, k)] as const);
        const isBox = (el: HTMLElement) => el.style.maxHeight !== '' && el.style.overflowY === 'auto';
        let geo = { w: 976, per: 61, h: 200 };
        Object.defineProperty(proto, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isBox(this) ? geo.w : 0; } });
        Object.defineProperty(proto, 'scrollHeight', { configurable: true, get(this: HTMLElement) {
          return isBox(this) ? [...this.children].reduce((h, c) => h + 31 * Math.ceil((c.textContent ?? '').length / geo.per), 0) : 0;
        } });
        Object.defineProperty(proto, 'clientHeight', { configurable: true, get(this: HTMLElement) { return isBox(this) ? geo.h : 0; } });
        restore = () => { for (const [k, d] of saved) { if (d) Object.defineProperty(proto, k, d); else delete (proto as unknown as Record<string, unknown>)[k]; } };
        const desc = ['가', '나', '다', '라', '마', '바'].map((ch, i) => `${ch.repeat(40)}${i + 1}.`).join('\n');
        renderScene({ event: makeEvent({ description: desc }) });
        expect(screen.getByText('1 / 2')).toBeInTheDocument();
        // 창이 좁아져 상자가 480px(30자)·90px이 됐다 — 한 줄 42자가 두 줄이라 3줄 쪽은 넘친다.
        geo = { w: 480, per: 30, h: 90 };
        fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
        expect(screen.queryByText('2 / 2'), 'resize_refits').not.toBeInTheDocument();
      });

      // 데스크탑 짐작 폭은 뷰포트−48(976px)인데 실측은 552px였다. 잰 폭이 있으면 그걸로 센다.
      it('measured_width_counts: 그려진 상자 폭(320px → 20자)으로 줄을 센다', () => {
        stub({ offsetWidth: 320 });
        const s = (n: number) => `${'가'.repeat(32)}${n}.`;
        renderScene({ event: makeEvent({ description: `${s(1)} ${s(2)}` }) });
        expect(screen.getByText('1 / 2'), 'measured_width_counts').toBeInTheDocument();
      });

      // 첫 그림은 짐작(61자)으로 나뉜다. 그 쪽이 넘친다고 바로 깎으면, 폭을 잰 뒤엔 넘치지 않을 쪽에서
      // 한 줄을 괜히 잃는다 — 짐작 [a b c][d]가 넘쳐 깎이면 잰 뒤 [a][b c][d](3쪽), 기다리면 [a b][c d](2쪽).
      it('measure_before_cut: 폭을 재기 전의 짐작 쪽이 넘쳐도 한도를 깎지 않는다', () => {
        stub({ offsetWidth: 320, perLineChars: 20, boxH: 100 });
        const a = `${'가'.repeat(39)}.`, line = (ch: string) => `${ch.repeat(19)}.`;
        renderScene({ event: makeEvent({ description: [a, line('나'), line('다'), line('라')].join('\n') }) });
        expect(screen.getByText('1 / 2'), 'measure_before_cut').toBeInTheDocument();
      });
    });
  });

  it('단일 페이지 이벤트는 네비게이션 없이 선택지를 바로 보여준다', () => {
    renderScene({ event: makeEvent({ description: '짧은 본문.', choices: [makeChoice({ text: '바로 선택' })] }) });
    expect(screen.queryByRole('button', { name: '다음 페이지' })).not.toBeInTheDocument();
    expect(screen.getByText('바로 선택')).toBeVisible();
  });
});

describe('EventScene 화자 라벨', () => {
  const npcs = [{ id: 'jihun', name: '지훈', met: false }];
  const event = makeEvent({
    description: '"야, 같이 갈래?"',
    speakers: ['jihun'],
  });

  it('아직 만나지 않은 화자는 ??? 로 표시한다', () => {
    renderScene({ event, npcs });
    expect(screen.getAllByText('???').length).toBeGreaterThan(0);
    expect(screen.queryByText('지훈')).not.toBeInTheDocument();
  });

  it('만난 화자는 이름으로 표시한다', () => {
    renderScene({ event, npcs: [{ id: 'jihun', name: '지훈', met: true }] });
    expect(screen.getAllByText('지훈').length).toBeGreaterThan(0);
    expect(screen.queryByText('???')).not.toBeInTheDocument();
  });
});

describe('EventScene 학교급 변이 소비', () => {
  // 카탈로그 원본(미구움)을 넘긴다 — 대입 경로가 구워 줘도, 여기 분기를 빼면 화면은 원래 description만 본다.
  const errand = GAME_EVENTS.find(e => e.id === 'president-errand');
  if (!errand?.schoolVariants) throw new Error('president-errand schoolVariants 전제 붕괴');

  // 아래 두 테스트의 문장은 **리터럴 정답 앵커**다 — pickVariantIndex를 테스트에서 다시 계산하면
  // 제품과 같은 함수를 공유해(공유 오라클) 그 함수가 틀려도 양쪽이 함께 틀린 채 통과한다.
  // 좌표: Y1 W6 → elementary[3]("접시콘"), Y6 W6 → high[0]("야자"), Y1 W5 → elementary[2]("손짓으로").
  // (T37에서 밴드당 변이가 2 → 4가 되면서 초등 좌표가 [1]·[0] → [3]·[2]로 옮겨갔다.)
  // 로테이션 공식을 바꾸면 이 값을 손으로 다시 뽑아 넣을 것(공식을 여기 옮겨 적지 말 것).
  it('eventScene_renders_school_band_body: 초등과 고등이 다른 본문을 그린다', () => {
    const { unmount } = renderScene({
      event: { ...errand, week: 6 },
      year: 1,
      gender: 'male',
    });
    expect(screen.getByText(/접시콘/, { exact: false }), 'eventScene_renders_school_band_body').toBeInTheDocument();
    expect(screen.queryByText(/야자 시작 전/)).not.toBeInTheDocument();
    unmount();

    renderScene({ event: { ...errand, week: 6 }, year: 6, gender: 'male' });
    expect(screen.getByText(/야자 시작 전/, { exact: false }), 'eventScene_renders_school_band_body').toBeInTheDocument();
    expect(screen.queryByText(/접시콘/)).not.toBeInTheDocument();
  });

  it('eventScene_same_state_rerender_stable: 리마운트해도 같은 본문이다', () => {
    const props = { event: { ...errand, week: 5 }, year: 1 as const, gender: 'male' as const };
    const { unmount } = renderScene(props);
    expect(screen.getByText(/손짓으로/, { exact: false })).toBeInTheDocument();
    unmount();
    renderScene(props);
    expect(screen.getByText(/손짓으로/, { exact: false })).toBeInTheDocument();
  });
});


describe('연애 선택 표시', () => {
  for (const [gender, npcId, id, label] of [
    ['male', 'subin', 'subin-hs-studyboard', '우리 사이에 대해서도'],
    ['female', 'jihun', 'jihun-hs-unsaid', '나도 너 좋아해. 우리 사귈까?'],
  ] as const) {
    it(`${npcId}: 기존 선택 뒤의 네 번째 선택을 원래 인덱스로 보낸다`, () => {
      const state = makeState({ gender, year: 6, week: 10 });
      const original = GAME_EVENTS.find(e => e.id === id)!;
      const { onChoice } = renderScene({ event: original, gender, year: 6, state });
      for (let i = 0; i < 10; i++) {
        const next = screen.queryByRole('button', { name: /다음/ });
        if (!next) break;
        fireEvent.click(next);
      }
      const legacy = gender === 'female' ? original.femaleChoices! : original.choices;
      for (const c of legacy) expect(screen.getByText(c.text)).toBeInTheDocument();
      fireEvent.click(screen.getByText(text => text.includes(label)));
      expect(onChoice).toHaveBeenCalledWith(3);
    });
  }
});
