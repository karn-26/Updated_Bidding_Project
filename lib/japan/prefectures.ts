/**
 * Canonical Japanese prefecture list — all 47.
 *
 * Canonical stored value = Japanese name (e.g. "東京都", "大阪府").
 * This matches the keys used in lib/jp_postal.ts PREFECTURE_CENTROIDS,
 * the prefecture column in supplier_profiles, delivery_partners, and
 * restaurant_profiles, and user_metadata.prefecture.
 *
 * Usage in a select:
 *   label: `${ja} (${en})`  →  "東京都 (Tokyo)"
 *   value: ja               →  "東京都"   ← what gets stored in DB
 */

export interface Prefecture {
  /** Canonical DB value — Japanese official name */
  value: string;
  /** Japanese display name (same as value) */
  ja: string;
  /** English reading */
  en: string;
}

export const PREFECTURES: Prefecture[] = [
  { value: "北海道",   ja: "北海道",   en: "Hokkaido"   },
  { value: "青森県",   ja: "青森県",   en: "Aomori"     },
  { value: "岩手県",   ja: "岩手県",   en: "Iwate"      },
  { value: "宮城県",   ja: "宮城県",   en: "Miyagi"     },
  { value: "秋田県",   ja: "秋田県",   en: "Akita"      },
  { value: "山形県",   ja: "山形県",   en: "Yamagata"   },
  { value: "福島県",   ja: "福島県",   en: "Fukushima"  },
  { value: "茨城県",   ja: "茨城県",   en: "Ibaraki"    },
  { value: "栃木県",   ja: "栃木県",   en: "Tochigi"    },
  { value: "群馬県",   ja: "群馬県",   en: "Gunma"      },
  { value: "埼玉県",   ja: "埼玉県",   en: "Saitama"    },
  { value: "千葉県",   ja: "千葉県",   en: "Chiba"      },
  { value: "東京都",   ja: "東京都",   en: "Tokyo"      },
  { value: "神奈川県", ja: "神奈川県", en: "Kanagawa"   },
  { value: "新潟県",   ja: "新潟県",   en: "Niigata"    },
  { value: "富山県",   ja: "富山県",   en: "Toyama"     },
  { value: "石川県",   ja: "石川県",   en: "Ishikawa"   },
  { value: "福井県",   ja: "福井県",   en: "Fukui"      },
  { value: "山梨県",   ja: "山梨県",   en: "Yamanashi"  },
  { value: "長野県",   ja: "長野県",   en: "Nagano"     },
  { value: "岐阜県",   ja: "岐阜県",   en: "Gifu"       },
  { value: "静岡県",   ja: "静岡県",   en: "Shizuoka"   },
  { value: "愛知県",   ja: "愛知県",   en: "Aichi"      },
  { value: "三重県",   ja: "三重県",   en: "Mie"        },
  { value: "滋賀県",   ja: "滋賀県",   en: "Shiga"      },
  { value: "京都府",   ja: "京都府",   en: "Kyoto"      },
  { value: "大阪府",   ja: "大阪府",   en: "Osaka"      },
  { value: "兵庫県",   ja: "兵庫県",   en: "Hyogo"      },
  { value: "奈良県",   ja: "奈良県",   en: "Nara"       },
  { value: "和歌山県", ja: "和歌山県", en: "Wakayama"   },
  { value: "鳥取県",   ja: "鳥取県",   en: "Tottori"    },
  { value: "島根県",   ja: "島根県",   en: "Shimane"    },
  { value: "岡山県",   ja: "岡山県",   en: "Okayama"    },
  { value: "広島県",   ja: "広島県",   en: "Hiroshima"  },
  { value: "山口県",   ja: "山口県",   en: "Yamaguchi"  },
  { value: "徳島県",   ja: "徳島県",   en: "Tokushima"  },
  { value: "香川県",   ja: "香川県",   en: "Kagawa"     },
  { value: "愛媛県",   ja: "愛媛県",   en: "Ehime"      },
  { value: "高知県",   ja: "高知県",   en: "Kochi"      },
  { value: "福岡県",   ja: "福岡県",   en: "Fukuoka"    },
  { value: "佐賀県",   ja: "佐賀県",   en: "Saga"       },
  { value: "長崎県",   ja: "長崎県",   en: "Nagasaki"   },
  { value: "熊本県",   ja: "熊本県",   en: "Kumamoto"   },
  { value: "大分県",   ja: "大分県",   en: "Oita"       },
  { value: "宮崎県",   ja: "宮崎県",   en: "Miyazaki"   },
  { value: "鹿児島県", ja: "鹿児島県", en: "Kagoshima"  },
  { value: "沖縄県",   ja: "沖縄県",   en: "Okinawa"    },
];
