import { GameState, StatKey, ActiveBuff, STAT_LABELS } from './types';

// ===== 아이템 타입 =====
export type ItemCategory = 'consumable' | 'growth' | 'gift' | 'fashion' | 'opportunity';
export type ItemEffectType = 'instant' | 'buff' | 'event_unlock' | 'npc_intimacy';

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
  requireYear?: number;     // 최소 학년
  requireStat?: { stat: StatKey; min: number }; // 스탯 조건
  seasonal?: boolean;       // 기간 한정
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
  // event_unlock
  eventId?: string;
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

  // ===== 관계 아이템 (선물) =====
  {
    id: 'small-gift', name: '작은 선물', description: '작지만 마음이 담긴 선물.',
    price: 1, category: 'gift', emoji: '🎁',
    effects: [{ type: 'npc_intimacy', npcBonus: 5 }],
  },
  {
    id: 'movie-ticket', name: '영화 티켓', description: '같이 영화 보러 가자!',
    price: 2, category: 'gift', emoji: '🎬',
    effects: [
      { type: 'npc_intimacy', npcBonus: 8 },
      { type: 'instant', stat: 'mental', value: 3 },
    ],
  },
  {
    id: 'birthday-gift', name: '생일 선물 세트', description: '특별한 날을 위한 특별한 선물.',
    price: 5, category: 'gift', emoji: '🎂',
    effects: [{ type: 'npc_intimacy', npcBonus: 15 }],
  },
  {
    id: 'concert-ticket', name: '공연/전시 티켓', description: '함께 보면 더 좋은 공연.',
    price: 4, category: 'gift', emoji: '🎵',
    effects: [
      { type: 'npc_intimacy', npcBonus: 12 },
      { type: 'instant', stat: 'mental', value: 5 },
    ],
    requireYear: 3, // 중2부터
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

  // ===== 기회 해금 =====
  // TODO(event_unlock): 'contest'/'portfolio' 이벤트가 events.ts에 아직 없어 unlockedEvents가
  // getEventForWeek에 반영되지 않음. 현재는 instant 스탯 보너스만 실제 효과. 추후 해당 이벤트
  // 콘텐츠가 추가되면 unlockedEvents 체크를 getEventForWeek에 연결해 활성화.
  {
    id: 'contest-fee', name: '대회 참가비', description: '교내/교외 대회에 참가할 수 있다.',
    price: 3, category: 'opportunity', emoji: '🏆',
    effects: [
      { type: 'event_unlock', eventId: 'contest' },
      { type: 'instant', stat: 'talent', value: 2 },
    ],
    requireStat: { stat: 'talent', min: 40 },
    purchaseMessage: '대회 참가 신청 완료! 출전 자격을 얻었다.',
  },
  {
    id: 'camp-fee', name: '캠프 참가비', description: '방학 특별 캠프에 참가한다.',
    price: 8, category: 'opportunity', emoji: '⛺',
    effects: [{ type: 'buff', buffId: 'camp', buffDuration: 4, buffTarget: 'all', buffAmount: 0.15 }],
    seasonal: true,
  },
  {
    id: 'portfolio-kit', name: '포트폴리오 준비 패키지', description: '특기자 전형을 위한 준비물.',
    price: 10, category: 'opportunity', emoji: '📂',
    effects: [
      { type: 'event_unlock', eventId: 'portfolio' },
      { type: 'instant', stat: 'talent', value: 3 },
      { type: 'instant', stat: 'academic', value: 2 },
    ],
    requireYear: 5,
    requireStat: { stat: 'talent', min: 60 },
    purchaseMessage: '포트폴리오 준비를 시작했다. 특기자 전형에 한 발 다가섰다.',
  },
];

// ===== 상점 카테고리 정보 =====
export const SHOP_CATEGORIES: Record<ItemCategory, { name: string; emoji: string; desc: string }> = {
  consumable: { name: '편의점', emoji: '🏪', desc: '간식, 음료, 일상 소모품' },
  growth:     { name: '서점/장비', emoji: '📚', desc: '참고서, 운동장비, 도구' },
  gift:       { name: '선물샵', emoji: '🎁', desc: '친구에게 줄 선물' },
  fashion:    { name: '패션', emoji: '👗', desc: '옷, 액세서리' },
  opportunity:{ name: '특별', emoji: '🌟', desc: '대회, 캠프, 기회' },
};

// ===== 구매 가능 여부 체크 =====
export function canBuyItem(item: ShopItem, state: GameState, weekPurchases: Record<string, number>): { ok: boolean; reason?: string } {
  if (state.money < item.price) return { ok: false, reason: '돈이 부족해요' };
  if (item.requireYear && state.year < item.requireYear) {
    const yearNames = ['초6', '중1', '중2', '중3', '고1', '고2', '고3'];
    return { ok: false, reason: `${yearNames[item.requireYear - 1]}부터 구매 가능` };
  }
  if (item.requireStat) {
    const val = state.stats[item.requireStat.stat];
    if (val < item.requireStat.min) return { ok: false, reason: `${STAT_LABELS[item.requireStat.stat]} ${item.requireStat.min} 이상 필요` };
  }
  if (item.maxPerWeek) {
    const bought = weekPurchases[item.id] || 0;
    if (bought >= item.maxPerWeek) return { ok: false, reason: '이번 주 구매 한도 초과' };
  }
  if (item.seasonal && !state.isVacation) return { ok: false, reason: '방학 기간에만 구매 가능' };
  if (item.effects.some(e => e.type === 'event_unlock' && e.eventId && state.unlockedEvents?.includes(e.eventId))) {
    return { ok: false, reason: '이미 해금됨' };
  }
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
  const newState = JSON.parse(JSON.stringify(state)) as GameState;
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

      case 'npc_intimacy':
        if (targetNpcId && effect.npcBonus) {
          const npc = newState.npcs.find(n => n.id === targetNpcId);
          if (npc) {
            npc.intimacy = Math.max(0, Math.min(100, npc.intimacy + effect.npcBonus));
            messages.push(`${npc.name}에게 ${item.name}을 줬다! 친밀도가 올랐다.`);
          }
        }
        break;

      case 'event_unlock':
        if (effect.eventId) {
          if (!newState.unlockedEvents) newState.unlockedEvents = [];
          if (!newState.unlockedEvents.includes(effect.eventId)) {
            newState.unlockedEvents.push(effect.eventId);
          }
          messages.push(item.purchaseMessage || `${item.name} 구매 완료! 관련 기회가 열렸다.`);
        }
        break;
    }
  }

  if (messages.length === 0) {
    messages.push(item.purchaseMessage || `${item.name}을(를) 구매했다!`);
  }

  return { newState, messages };
}
