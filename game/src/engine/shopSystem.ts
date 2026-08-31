import { GameState, StatKey, ActiveBuff, STAT_LABELS, MemorySlotDraft } from './types';
import { cloneGameState } from './stateClone';
import { applyMemorySlotFromMiniTalk } from './memorySystem';
import { absWeek, isNpcInteractable } from './relationshipSignals';
import { applyGrindIntimacyGain } from './intimacyScaling';
import { josa } from './korean';
import { GAME_EVENTS } from './events/data';

// ===== 생일 주차 맵 (npcId → week) =====
// '*-birthday' 이벤트에서 파생 — 이벤트 주차가 바뀌면 자동 추종(드리프트 방지).
// requireBirthday 게이트가 참조: "만난 친구의 생일 주차"인지 판정.
const BIRTHDAY_WEEK_BY_NPC: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  for (const ev of GAME_EVENTS) {
    if (!ev.id.endsWith('-birthday')) continue;
    const npcId = ev.speakers?.[0];
    if (npcId && typeof ev.week === 'number') map[npcId] = ev.week;
  }
  return map;
})();

// ===== 아이템 타입 =====
export type ItemCategory = 'consumable' | 'growth' | 'gift' | 'fashion' | 'opportunity' | 'aspiration';
export type ItemEffectType = 'instant' | 'buff' | 'npc_intimacy' | 'permanent';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ItemCategory;
  emoji: string;
  // 효과
  effects: ItemEffect[];
  // 제한
  maxPerWeek?: number;      // 주간 구매 제한
  limitGroup?: string;      // 주간 한도 공유 그룹 (여러 아이템이 슬롯 공유 — 없으면 id 단위)
  requireYear?: number;     // 최소 학년
  requireStat?: { stat: StatKey; min: number }; // 스탯 조건
  requireBirthday?: boolean; // 만난 친구의 생일 주차에만 구매 가능
  seasonal?: boolean;       // 기간 한정
  oncePerRun?: boolean;     // T22: 한 판에 한 번만 (state.ownedItems로 판정)
  purchaseMessage?: string; // 구매 시 커스텀 메시지 (없으면 기본 "구매 완료" 문구)
}

export interface ItemEffect {
  type: ItemEffectType;
  // instant: 즉시 효과
  stat?: StatKey | 'fatigue' | 'money';
  value?: number;
  // buff: 기간 버프
  buffId?: string;
  buffDuration?: number;    // 주 단위
  buffTarget?: string;      // 활동 카테고리 or 'exam' or 'all'
  buffAmount?: number;      // 효율 증가 (0.15 = +15%)
  // npc_intimacy
  npcBonus?: number;
  // T22 permanent: buffId/buffTarget/buffAmount를 그대로 쓰되 기간이 없다.
  // memory: 구매가 남기는 회상 슬롯. 이벤트 슬롯과 같은 정책(중요도·카테고리당 2칸)을 공유한다.
  memory?: MemorySlotDraft;
}

// ===== 상점 아이템 목록 =====
export const SHOP_ITEMS: ShopItem[] = [
  // ===== 소모품 (편의점) =====
  {
    id: 'snack', name: '삼각김밥 세트', description: '출출할 때 먹으면 기운이 난다.',
    price: 0.5, category: 'consumable', emoji: '🍙',
    effects: [{ type: 'instant', stat: 'fatigue', value: -3 }],
    maxPerWeek: 2,
  },
  {
    id: 'sweet-drink', name: '달달한 음료', description: '달콤한 걸 마시면 기분이 좋아진다.',
    price: 0.5, category: 'consumable', emoji: '🧋',
    effects: [{ type: 'instant', stat: 'mental', value: 2 }],
    maxPerWeek: 2,
  },
  {
    id: 'energy-drink', name: '에너지 드링크', description: '마시면 피로가 좀 풀리고 이번 주 효율이 오른다.',
    price: 1, category: 'consumable', emoji: '⚡',
    effects: [
      { type: 'buff', buffId: 'energy-boost', buffDuration: 1, buffTarget: 'all', buffAmount: 0.15 },
      { type: 'instant', stat: 'fatigue', value: -5 }, // v6.1: 반동 → 피로 즉시 감소
    ],
    maxPerWeek: 1,
  },
  {
    id: 'vitamin', name: '종합 비타민', description: '꾸준히 먹으면 운동 효율이 오른다.',
    price: 1.5, category: 'consumable', emoji: '💊',
    effects: [{ type: 'buff', buffId: 'vitamin', buffDuration: 4, buffTarget: 'exercise', buffAmount: 0.15 }],
    maxPerWeek: 1,
  },

  // ===== 성장 보조 (서점/장비) =====
  {
    id: 'study-guide', name: '참고서', description: '3주간 공부 효율이 올라간다.',
    price: 3, category: 'growth', emoji: '📖',
    effects: [{ type: 'buff', buffId: 'study-guide', buffDuration: 3, buffTarget: 'study', buffAmount: 0.15 }],
  },
  {
    id: 'workbook', name: '문제집 세트', description: '단기간에 공부 효율을 크게 끌어올린다.',
    price: 4, category: 'growth', emoji: '📝',
    // study-guide(3주/+15%)보다 짧고 강한 단기 집중형
    effects: [{ type: 'buff', buffId: 'workbook', buffDuration: 2, buffTarget: 'study', buffAmount: 0.2 }],
  },
  {
    id: 'sports-shoes', name: '운동화', description: '좋은 신발은 운동 효율을 높여준다.',
    price: 5, category: 'growth', emoji: '👟',
    effects: [{ type: 'buff', buffId: 'sports-shoes', buffDuration: 8, buffTarget: 'exercise', buffAmount: 0.15 }],
  },
  {
    id: 'art-supplies', name: '미술/음악 용품 세트', description: '좋은 도구가 실력을 끌어올린다.',
    price: 5, category: 'growth', emoji: '🎨',
    effects: [{ type: 'buff', buffId: 'art-supplies', buffDuration: 8, buffTarget: 'talent', buffAmount: 0.15 }],
  },
  {
    id: 'tablet', name: '태블릿 PC', description: '인강, 노트 정리, 창작까지. 만능 도구.',
    price: 15, category: 'growth', emoji: '📱',
    effects: [{ type: 'buff', buffId: 'tablet', buffDuration: 24, buffTarget: 'all', buffAmount: 0.1 }],
    requireYear: 5, // 고1부터 (Y5=고1)
  },
  {
    // 루틴 슬롯에 "매주 입시 설명회"는 말이 안 되므로 활동이 아니라 상점 단발 구매로 둔다.
    // 참고서(3주/+0.15)·문제집(2주/+0.2)보다 길고 약하게 — 정보는 오래 가되 즉효는 아니다.
    id: 'admission-briefing', name: '입시 설명회', description: '입시 설명회에 다녀온다. 한동안 방향이 잡힌다.',
    price: 3, category: 'growth', emoji: '🎓',
    effects: [{ type: 'buff', buffId: 'admission-briefing', buffDuration: 6, buffTarget: 'study', buffAmount: 0.1 }],
    requireYear: 5, // 고1부터
    maxPerWeek: 1,
  },

  // ===== 관계 아이템 (선물) =====
  {
    id: 'small-gift', name: '작은 선물', description: '작지만 마음이 담긴 선물.',
    price: 1, category: 'gift', emoji: '🎁',
    effects: [{ type: 'npc_intimacy', npcBonus: 2 }],
    maxPerWeek: 1, // 돈으로 관계 무한 구매 차단
  },
  {
    id: 'movie-ticket', name: '영화 티켓', description: '같이 영화 보러 가자!',
    price: 2, category: 'gift', emoji: '🎬',
    effects: [
      { type: 'npc_intimacy', npcBonus: 4 },
      { type: 'instant', stat: 'mental', value: 3 },
    ],
    // 영화·공연은 "직접 나가서 함께하는" 외출이라 몸이 하나 → 주 1회 공유 슬롯
    maxPerWeek: 1, limitGroup: 'outing',
  },
  {
    id: 'birthday-gift', name: '생일 선물 세트', description: '특별한 날을 위한 특별한 선물.',
    price: 5, category: 'gift', emoji: '🎂',
    effects: [{ type: 'npc_intimacy', npcBonus: 8 }],
    maxPerWeek: 1, requireBirthday: true, // 생일인 친구가 있을 때만
  },
  {
    id: 'concert-ticket', name: '공연/전시 티켓', description: '함께 보면 더 좋은 공연.',
    price: 4, category: 'gift', emoji: '🎵',
    effects: [
      { type: 'npc_intimacy', npcBonus: 6 },
      { type: 'instant', stat: 'mental', value: 5 },
    ],
    requireYear: 3, // 중2부터
    maxPerWeek: 1, limitGroup: 'outing', // 영화 티켓과 슬롯 공유
  },

  // ===== 자기표현 (패션) =====
  {
    id: 'new-clothes', name: '새 옷', description: '새 옷을 입으면 자신감이 올라간다.',
    price: 3, category: 'fashion', emoji: '👕',
    effects: [
      { type: 'instant', stat: 'social', value: 2 },
      { type: 'instant', stat: 'mental', value: 2 },
    ],
  },
  {
    id: 'trendy-item', name: '유행 아이템', description: '요즘 다들 이거 하나씩 가지고 있다.',
    price: 5, category: 'fashion', emoji: '✨',
    effects: [
      { type: 'buff', buffId: 'trendy', buffDuration: 4, buffTarget: 'social', buffAmount: 0.2 },
      { type: 'instant', stat: 'social', value: 3 },
    ],
    requireYear: 3, // 중2부터
  },

  // ===== 특별 (방학 한정) =====
  {
    id: 'camp-fee', name: '캠프 참가비', description: '방학 특별 캠프에 참가한다.',
    price: 8, category: 'opportunity', emoji: '⛺',
    effects: [{ type: 'buff', buffId: 'camp', buffDuration: 4, buffTarget: 'all', buffAmount: 0.15 }],
    seasonal: true,
  },

  // ===== 오래 모아서 (T22 — 처방 C: 돈 배출구) =====
  // 왜 이 칸이 필요한가: 상점 17종을 전부 한 번씩 사도 66.5만인데 무료 루틴 빌드는 7년에
  // 1537만이 남는다(혼합 801만). 기존 구매는 전부 0.5~8만짜리 주간 반복이라 "모을 이유"가
  // 하나도 없었다 — 저축은 이자도 목표도 없어 항상 손해였다. 배출구가 없는 게 아니라
  // 모아서 살 게 없는 것이다(집중 과외 28만/주가 있지만 unlockYear 5라 Y1~Y4는 무이자 적금).
  //
  // 가격은 빌드별 도달 개수로 설계했다: 무료 1537만 → 4개 / 혼합 801만 → 2~3개 /
  // 유료 97만 → 0개. **유료가 0개인 건 의도다** — 그들은 이미 매주 돈을 힘으로 바꿔 쓰고 있고,
  // 진단 문서가 그 99만(B-2로 비로소 생긴 재량)을 다시 0으로 돌리지 말라고 못박아 뒀다.
  //
  // 효과가 작은 것도 의도다(+8~10%, 부모 강점 보너스와 같은 급). 크게 주면 "무료 루틴으로
  // 모았다가 몰아 사기"가 지배 전략이 된다. 여기서 사는 것은 힘이 아니라 회상 한 칸이다.
  {
    id: 'desk-setup', name: '내 방 책상·PC',
    description: '식탁에서 공부하던 시절이 끝난다. 내 자리가 생긴다.',
    price: 150, category: 'aspiration', emoji: '💻',
    effects: [
      { type: 'permanent', buffId: 'perm-desk', buffTarget: 'study', buffAmount: 0.08 },
      { type: 'permanent', memory: {
        category: 'growth', importance: 6, toneTag: 'warm',
        recallText: '내 방에 처음 내 책상이 생기던 날, 밤늦게까지 앉아 있었다.',
      } },
    ],
    oncePerRun: true,
    purchaseMessage: '드디어 내 책상이 생겼다. 앞으로 공부가 조금 더 손에 붙는다.',
  },
  {
    id: 'own-instrument', name: '내 악기',
    description: '빌려 쓰던 것 말고, 내 것.',
    price: 200, category: 'aspiration', emoji: '🎹', requireYear: 2,
    effects: [
      { type: 'permanent', buffId: 'perm-instrument', buffTarget: 'talent', buffAmount: 0.10 },
      { type: 'permanent', memory: {
        category: 'discovery', importance: 6, toneTag: 'breakthrough',
        recallText: '오래 모아 산 악기를 처음 열어보던 저녁, 손이 떨렸다.',
      } },
    ],
    oncePerRun: true,
    purchaseMessage: '내 악기가 생겼다. 연습이 전과 같지 않다.',
  },
  {
    id: 'language-trip', name: '여름 어학연수',
    description: '한 달을 통째로 다른 나라에서 보낸다. 방학에만 갈 수 있다.',
    price: 350, category: 'aspiration', emoji: '✈️', requireYear: 3,
    effects: [
      { type: 'permanent', buffId: 'perm-abroad', buffTarget: 'all', buffAmount: 0.05 },
      { type: 'instant', stat: 'social', value: 4 },
      { type: 'permanent', memory: {
        category: 'discovery', importance: 7, toneTag: 'breakthrough',
        recallText: '말이 하나도 안 통하던 첫 주, 그래도 웃으며 손짓하던 여름.',
      } },
    ],
    oncePerRun: true, seasonal: true,
    purchaseMessage: '한 달을 통째로 낯선 곳에서 보냈다. 돌아온 뒤로 세상이 조금 넓어졌다.',
  },
  {
    id: 'admission-consulting', name: '입시 컨설팅',
    description: '전문가와 내 성적표를 놓고 3년치 계획을 짠다.',
    price: 300, category: 'aspiration', emoji: '🎓', requireYear: 5,
    effects: [
      { type: 'permanent', buffId: 'perm-consulting', buffTarget: 'study', buffAmount: 0.10 },
      { type: 'permanent', memory: {
        category: 'growth', importance: 6, toneTag: 'resolve',
        recallText: '처음으로 내 성적표를 놓고 어른과 마주 앉아 3년을 계산했다.',
      } },
    ],
    oncePerRun: true,
    purchaseMessage: '막연하던 것이 표가 되어 나왔다. 어디를 파야 하는지 알겠다.',
  },
];

// ===== 상점 카테고리 정보 =====
export const SHOP_CATEGORIES: Record<ItemCategory, { name: string; emoji: string; desc: string }> = {
  consumable: { name: '편의점', emoji: '🏪', desc: '간식, 음료, 일상 소모품' },
  growth:     { name: '서점/장비', emoji: '📚', desc: '참고서, 운동장비, 도구' },
  gift:       { name: '선물샵', emoji: '🎁', desc: '친구에게 줄 선물' },
  fashion:    { name: '패션', emoji: '👗', desc: '옷, 액세서리' },
  opportunity:{ name: '특별', emoji: '🌟', desc: '대회, 캠프, 기회' },
  aspiration: { name: '오래 모아서', emoji: '🏦', desc: '몇 해를 모아야 닿는 것' },
};

// 주간 한도 카운트 키 — limitGroup이 있으면 그룹 단위로 합산, 없으면 아이템 단위.
export function limitKey(item: ShopItem): string {
  return item.limitGroup ?? item.id;
}

// ===== 구매 가능 여부 체크 =====
export function canBuyItem(item: ShopItem, state: GameState, weekPurchases: Record<string, number>): { ok: boolean; reason?: string } {
  // 소유 판정은 잔액보다 먼저다 — 이미 산 물건에 "돈이 부족해요"가 뜨면 계속 모으게 만든다.
  if (item.oncePerRun && (state.ownedItems || []).includes(item.id)) {
    return { ok: false, reason: '이미 가지고 있어요' };
  }
  // 학년 게이트가 잔액보다 먼저다. 둘 다 못 넘을 때 더 쓸모 있는 정보는 학년 쪽이다 —
  // 돈은 모으면 되지만 학년은 못 앞당긴다. T22 고가 구매는 목록에 잠긴 채 계속 보이므로
  // (Shop.tsx의 aspiration 예외) 이 문구가 몇 해 동안 플레이어에게 노출된다.
  if (item.requireYear && state.year < item.requireYear) {
    const yearNames = ['초6', '중1', '중2', '중3', '고1', '고2', '고3'];
    return { ok: false, reason: `${yearNames[item.requireYear - 1]}부터 구매 가능` };
  }
  if (state.money < item.price) return { ok: false, reason: '돈이 부족해요' };
  if (item.requireStat) {
    const val = state.stats[item.requireStat.stat];
    if (val < item.requireStat.min) return { ok: false, reason: `${STAT_LABELS[item.requireStat.stat]} ${item.requireStat.min} 이상 필요` };
  }
  if (item.requireBirthday) {
    const hasBirthday = state.npcs.some(n => n.met && BIRTHDAY_WEEK_BY_NPC[n.id] === state.week);
    if (!hasBirthday) return { ok: false, reason: '생일인 친구가 있을 때만' };
  }
  if (item.maxPerWeek) {
    const bought = weekPurchases[limitKey(item)] || 0;
    if (bought >= item.maxPerWeek) return { ok: false, reason: '이번 주 구매 한도 초과' };
  }
  if (item.seasonal && !state.isVacation) return { ok: false, reason: '방학 기간에만 구매 가능' };
  // 동일 buff 활성 중이면 재구매 차단 (덮어쓰기로 남은 기간 손실 방지)
  const activeBuffIds = new Set((state.activeBuffs || []).map(b => b.id));
  const clashingBuff = item.effects.find(e => e.type === 'buff' && e.buffId && activeBuffIds.has(e.buffId));
  if (clashingBuff) {
    const existing = state.activeBuffs?.find(b => b.id === clashingBuff.buffId);
    const weeks = existing?.remainingWeeks ?? 0;
    return { ok: false, reason: `이미 활성 (${weeks}주 남음)` };
  }
  return { ok: true };
}

// ===== 아이템 사용 효과 적용 =====
export function applyItemEffects(
  item: ShopItem,
  state: GameState,
  targetNpcId?: string,
): { newState: GameState; messages: string[] } {
  const newState = cloneGameState(state);
  const messages: string[] = [];

  newState.money = Math.round((newState.money - item.price) * 10) / 10;
  if (newState.money < 0) newState.money = 0;

  for (const effect of item.effects) {
    switch (effect.type) {
      case 'instant':
        if (effect.stat === 'fatigue') {
          newState.fatigue = Math.max(0, Math.min(100, newState.fatigue + (effect.value || 0)));
        } else if (effect.stat === 'money') {
          newState.money = Math.round((newState.money + (effect.value || 0)) * 10) / 10;
        } else if (effect.stat) {
          const key = effect.stat as StatKey;
          newState.stats[key] = Math.max(0, Math.min(100, newState.stats[key] + (effect.value || 0)));
        }
        break;

      case 'buff':
        if (effect.buffId && effect.buffDuration) {
          // 기존 같은 버프 교체
          if (!newState.activeBuffs) newState.activeBuffs = [];
          newState.activeBuffs = newState.activeBuffs.filter((b: ActiveBuff) => b.id !== effect.buffId);
          newState.activeBuffs.push({
            id: effect.buffId!,
            name: item.name,
            target: effect.buffTarget || 'all',
            amount: effect.buffAmount || 0,
            remainingWeeks: effect.buffDuration,
          });
        }
        break;

      case 'permanent':
        // 효율 보너스와 회상 슬롯이 같은 effect 타입을 공유한다 — 한 아이템이 둘 다 갖는다.
        if (effect.buffId && effect.buffAmount) {
          if (!newState.permanentBonuses) newState.permanentBonuses = [];
          // 같은 id 재부여 방지. oncePerRun이 먼저 막지만 장부를 두 벌 두지 않는다.
          if (!newState.permanentBonuses.some(b => b.id === effect.buffId)) {
            newState.permanentBonuses.push({
              id: effect.buffId,
              name: item.name,
              target: effect.buffTarget || 'all',
              amount: effect.buffAmount,
            });
          }
        }
        if (effect.memory) {
          // 이벤트 슬롯과 같은 함수를 쓴다 — 중요도 하한·카테고리당 2칸 정책이 한 곳에만 있게.
          applyMemorySlotFromMiniTalk(newState, `shop_${item.id}`, effect.memory);
        }
        break;

      case 'npc_intimacy':
        if (targetNpcId && effect.npcBonus) {
          const npc = newState.npcs.find(n => n.id === targetNpcId);
          // 부재(전출·졸업) 중인 친구에겐 선물을 건넬 수 없다 — 말 걸기와 동일 게이트.
          // 잡담(친밀도 0)보다 큰 구멍이었다: 선물은 반복 구매라 소프트캡 80까지 밀어올릴 수 있고,
          // 그렇게 유지한 친밀도는 후회 레이어의 드리프트 가산(≤30)까지 없애 이별의 회수를 깎는다.
          if (npc && isNpcInteractable(npc, newState)) {
            // 반복 grind 소프트캡 경유 — 선물은 반복 구매 가능하므로 캡 이상은 이벤트로만.
            // (감쇠 exemptMajorReward=false + 소프트캡: 돈으로 관계를 무한히 살 수 없게 이중 봉합)
            npc.intimacy = applyGrindIntimacyGain(npc.intimacy, effect.npcBonus);
            npc.lastInteractionWeek = absWeek(newState.year, newState.week); // 관계 신호: 선물 = 상호작용
            messages.push(`${npc.name}에게 ${josa(item.name, '을/를')} 줬다! 친밀도가 올랐다.`);
          }
        }
        break;
    }
  }

  if (item.oncePerRun) {
    if (!newState.ownedItems) newState.ownedItems = [];
    if (!newState.ownedItems.includes(item.id)) newState.ownedItems.push(item.id);
  }

  if (messages.length === 0) {
    messages.push(item.purchaseMessage || `${josa(item.name, '을/를')} 구매했다!`);
  }

  return { newState, messages };
}
