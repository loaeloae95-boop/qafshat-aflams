export type DialectKey =
  | "gulf"
  | "egyptian"
  | "syrian"
  | "jordanian"
  | "palestinian"
  | "moroccan"
  | "algerian"
  | "sudanese";

export interface DialectReactionPair {
  positive: {
    label: string;
    emoji: string;
  };
  negative: {
    label: string;
    emoji: string;
  };
}

/**
 * Dialect reaction phrases as specified by user requirements (Object Mapping)
 * NOTE: UI shows the expressive colloquial phrases WITHOUT mentioning country names.
 */
export const DIALECT_REACTIONS: Record<DialectKey, DialectReactionPair> = {
  gulf: {
    positive: {
      label: "رهييبة (مالها حلّ!) 🦅🔥",
      emoji: "🔥",
    },
    negative: {
      label: "سامجة (مو جوّي) 🧊🛑",
      emoji: "🛑",
    },
  },
  egyptian: {
    positive: {
      label: "في الجووول (عالمية!) 🎯👑",
      emoji: "👑",
    },
    negative: {
      label: "دمها تِقيل (إيه ده?) 🤦‍♂️💥",
      emoji: "🤦‍♂️",
    },
  },
  syrian: {
    positive: {
      label: "بتجنن (فرطت ضحك!) 😂✨",
      emoji: "😂",
    },
    negative: {
      label: "غليظة (ما بتبلع) 🥴🤐",
      emoji: "🥴",
    },
  },
  jordanian: {
    positive: {
      label: "قطّاعة (نار وشرار!) ⚔️🦅",
      emoji: "⚔️",
    },
    negative: {
      label: "مش مودي (بايخة) 🪵❌",
      emoji: "❌",
    },
  },
  palestinian: {
    positive: {
      label: "إشي فاخر الآخر (قوية!) 👌💎",
      emoji: "💎",
    },
    negative: {
      label: "مش بزيادة (زناخة) 🍋🤷‍♂️",
      emoji: "🍋",
    },
  },
  moroccan: {
    positive: {
      label: "نايضة (واعرة بزاف!) 🇲🇦🌟",
      emoji: "🌟",
    },
    negative: {
      label: "حامضة (بـاسلة) 🧂😑",
      emoji: "🧂",
    },
  },
  algerian: {
    positive: {
      label: "فور بزاف (شـابة!) 💪⚡",
      emoji: "⚡",
    },
    negative: {
      label: "صـامطة (مـاشي قاع) 📉🌪️",
      emoji: "🌪️",
    },
  },
  sudanese: {
    positive: {
      label: "مبالغة (ظابطة شديد!) 🤝💯",
      emoji: "💯",
    },
    negative: {
      label: "جـايطة (ماسخة) 🪵🌾",
      emoji: "🌾",
    },
  },
};

/**
 * Intelligent dialect detection from clip title, author, source, or text keywords
 */
export function detectDialect(text: string): DialectKey {
  const s = (text || "").toLowerCase();

  // Syrian
  if (
    /باب الحارة|دريد لحام|ياسر العظمة|مرايا|بقعة ضوء|شام|بتجنن|فرطت|غليظة|شو هاد|شبيحة|لكان|ابو عصام|معتز/i.test(
      s,
    )
  ) {
    return "syrian";
  }

  // Jordanian
  if (/قطاعة|نار وشرار|زلمة|مش مودي|نشامى|بايخة|هسع|اربد|عمان|ابو عواد|حارة ابو عواد/i.test(s)) {
    return "jordanian";
  }

  // Palestinian
  if (/فاخر الآخر|زناخة|مش بزيادة|فلسطين|القدس|غزة|نابلس|خاوة|يما|شو في ما في/i.test(s)) {
    return "palestinian";
  }

  // Moroccan
  if (/واعرة|بزاف|نايضة|حامضة|باسلة|دابا|كيداير|زوين|المغرب|كازا|طنجة/i.test(s)) {
    return "moroccan";
  }

  // Algerian
  if (/فور بزاف|شابة|صامطة|ماشي قاع|دزاير|الجزائر|وهران|بلوزداد|خويا|برك/i.test(s)) {
    return "algerian";
  }

  // Sudanese
  if (/مبالغة|ظابطة|شديد|جايطة|ماسخة|زول|يا زول|سودان|الخرطوم|داير|شنو/i.test(s)) {
    return "sudanese";
  }

  // Gulf
  if (
    /رهيبة|مالها حل|سامجة|مو جوي|طاش|ناصر القصبي|عبدالله السدحان|الكويت|السعودية|دبي|شلونك|يا رجال|ابشر|يا بعد حيي/i.test(
      s,
    )
  ) {
    return "gulf";
  }

  // Default to Egyptian (very common in Arabic comedy clips)
  return "egyptian";
}

export type ClipEngagementState = {
  reaction: "positive" | "negative" | null;
  reactionLabel: string | null;
  reactionEmoji: string | null;
  positiveCount: number;
  negativeCount: number;
  isFavorite: boolean;
  shareCount: number;
};

const STORAGE_KEY_PREFIX = "qafsha_engagement_";

export function getClipEngagement(clipId: string): ClipEngagementState {
  if (typeof window === "undefined") {
    return {
      reaction: null,
      reactionLabel: null,
      reactionEmoji: null,
      positiveCount: 142,
      negativeCount: 18,
      isFavorite: false,
      shareCount: 65,
    };
  }

  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${clipId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Failed to read clip engagement", err);
  }

  // Default deterministic seed for clean look
  const seed = clipId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    reaction: null,
    reactionLabel: null,
    reactionEmoji: null,
    positiveCount: 80 + (seed % 150),
    negativeCount: 5 + (seed % 25),
    isFavorite: false,
    shareCount: 20 + (seed % 80),
  };
}

export function saveClipEngagement(clipId: string, state: ClipEngagementState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${clipId}`, JSON.stringify(state));
    window.dispatchEvent(
      new CustomEvent("clip-engagement-updated", {
        detail: { clipId, state },
      }),
    );
  } catch (err) {
    console.warn("Failed to save clip engagement", err);
  }
}
