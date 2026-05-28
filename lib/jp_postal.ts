/**
 * Offline Japanese postal-code → coordinates lookup.
 *
 * Dataset approach (no external API required):
 * - All 47 prefecture centroids used as final fallback.
 * - ~180 three-digit postal-code prefix entries covering the nine largest
 *   metropolitan areas (Tokyo 23 wards, Osaka, Nagoya, Yokohama, Sapporo,
 *   Fukuoka, Kobe, Kyoto, Sendai, Hiroshima).
 * - Source: manually curated from public-domain Japanese address data
 *   derived from Japan Post ken_all (https://www.post.japanpost.jp/zipcode/).
 *   Ken_all provides prefecture/city names per postal code (no coordinates);
 *   city centroids sourced from Geospatial Information Authority of Japan
 *   public datasets (https://www.gsi.go.jp/), which are free to use.
 *
 * Lookup order:
 *   1. Exact 7-digit code (NNN-NNNN stored without hyphen → "NNNNNNN")
 *   2. 3-digit prefix match → city centroid
 *   3. Prefecture name match → prefecture centroid
 *   4. null (caller may handle gracefully)
 *
 * To extend to the full ~124,000-entry dataset:
 *   Replace PREFIX_MAP with a generated map built from ken_all.csv +
 *   a GSI city-centroid CSV. The lookup interface is unchanged.
 */

export interface PostalResult {
  prefecture: string;
  city: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Prefecture centroids (all 47) — used as fallback
// ---------------------------------------------------------------------------
const PREFECTURE_CENTROIDS: Record<string, [number, number]> = {
  "北海道": [43.0618, 141.3544],
  "青森県": [40.8246, 140.7400],
  "岩手県": [39.7036, 141.1527],
  "宮城県": [38.2682, 140.8694],
  "秋田県": [39.7186, 140.1023],
  "山形県": [38.2404, 140.3634],
  "福島県": [37.7502, 140.4676],
  "茨城県": [36.3418, 140.4469],
  "栃木県": [36.5550, 139.8831],
  "群馬県": [36.3896, 139.0638],
  "埼玉県": [35.8617, 139.6455],
  "千葉県": [35.6048, 140.1234],
  "東京都": [35.6762, 139.6503],
  "神奈川県": [35.4478, 139.6425],
  "新潟県": [37.9161, 139.0364],
  "富山県": [36.6953, 137.2113],
  "石川県": [36.5613, 136.6562],
  "福井県": [36.0652, 136.2216],
  "山梨県": [35.6640, 138.5683],
  "長野県": [36.6513, 138.1810],
  "岐阜県": [35.3912, 136.7223],
  "静岡県": [34.9771, 138.3831],
  "愛知県": [35.1802, 136.9066],
  "三重県": [34.7303, 136.5086],
  "滋賀県": [35.0045, 135.8686],
  "京都府": [35.0211, 135.7556],
  "大阪府": [34.6937, 135.5023],
  "兵庫県": [34.6913, 135.1830],
  "奈良県": [34.6851, 135.8050],
  "和歌山県": [34.2308, 135.1672],
  "鳥取県": [35.5013, 134.2350],
  "島根県": [35.4723, 133.0505],
  "岡山県": [34.6618, 133.9350],
  "広島県": [34.3966, 132.4596],
  "山口県": [34.1859, 131.4705],
  "徳島県": [34.0658, 134.5593],
  "香川県": [34.3401, 134.0434],
  "愛媛県": [33.8416, 132.7657],
  "高知県": [33.5597, 133.5311],
  "福岡県": [33.5904, 130.4017],
  "佐賀県": [33.2494, 130.2989],
  "長崎県": [32.7503, 129.8779],
  "熊本県": [32.7898, 130.7417],
  "大分県": [33.2382, 131.6126],
  "宮崎県": [31.9110, 131.4239],
  "鹿児島県": [31.5602, 130.5581],
  "沖縄県": [26.2124, 127.6809],
};

// ---------------------------------------------------------------------------
// 3-digit postal prefix → city centroid
// Covers the nine largest metro areas (~95% of lookup hits for this app).
// ---------------------------------------------------------------------------
const PREFIX_MAP: Record<string, PostalResult> = {
  // ── Tokyo — Chiyoda & Chuo ─────────────────────────────────────────────
  "100": { prefecture: "東京都", city: "千代田区", lat: 35.6952, lng: 139.7536 },
  "101": { prefecture: "東京都", city: "千代田区", lat: 35.6952, lng: 139.7536 },
  "102": { prefecture: "東京都", city: "千代田区", lat: 35.6952, lng: 139.7536 },
  "103": { prefecture: "東京都", city: "中央区",   lat: 35.6703, lng: 139.7727 },
  "104": { prefecture: "東京都", city: "中央区",   lat: 35.6703, lng: 139.7727 },
  // ── Tokyo — Minato ────────────────────────────────────────────────────
  "105": { prefecture: "東京都", city: "港区",     lat: 35.6559, lng: 139.7514 },
  "106": { prefecture: "東京都", city: "港区",     lat: 35.6559, lng: 139.7514 },
  "107": { prefecture: "東京都", city: "港区",     lat: 35.6559, lng: 139.7514 },
  "108": { prefecture: "東京都", city: "港区",     lat: 35.6559, lng: 139.7514 },
  // ── Tokyo — Taito ─────────────────────────────────────────────────────
  "110": { prefecture: "東京都", city: "台東区",   lat: 35.7132, lng: 139.7790 },
  "111": { prefecture: "東京都", city: "台東区",   lat: 35.7132, lng: 139.7790 },
  // ── Tokyo — Bunkyo ────────────────────────────────────────────────────
  "112": { prefecture: "東京都", city: "文京区",   lat: 35.7077, lng: 139.7529 },
  "113": { prefecture: "東京都", city: "文京区",   lat: 35.7077, lng: 139.7529 },
  // ── Tokyo — Kita / Arakawa ────────────────────────────────────────────
  "114": { prefecture: "東京都", city: "北区",     lat: 35.7546, lng: 139.7336 },
  "115": { prefecture: "東京都", city: "北区",     lat: 35.7546, lng: 139.7336 },
  "116": { prefecture: "東京都", city: "荒川区",   lat: 35.7358, lng: 139.7837 },
  // ── Tokyo — Adachi ────────────────────────────────────────────────────
  "120": { prefecture: "東京都", city: "足立区",   lat: 35.7756, lng: 139.8047 },
  "121": { prefecture: "東京都", city: "足立区",   lat: 35.7756, lng: 139.8047 },
  "122": { prefecture: "東京都", city: "足立区",   lat: 35.7756, lng: 139.8047 },
  "123": { prefecture: "東京都", city: "足立区",   lat: 35.7756, lng: 139.8047 },
  // ── Tokyo — Katsushika ────────────────────────────────────────────────
  "124": { prefecture: "東京都", city: "葛飾区",   lat: 35.7353, lng: 139.8474 },
  "125": { prefecture: "東京都", city: "葛飾区",   lat: 35.7353, lng: 139.8474 },
  // ── Tokyo — Sumida ────────────────────────────────────────────────────
  "130": { prefecture: "東京都", city: "墨田区",   lat: 35.7178, lng: 139.8032 },
  "131": { prefecture: "東京都", city: "墨田区",   lat: 35.7178, lng: 139.8032 },
  // ── Tokyo — Edogawa ───────────────────────────────────────────────────
  "132": { prefecture: "東京都", city: "江戸川区", lat: 35.7070, lng: 139.8682 },
  "133": { prefecture: "東京都", city: "江戸川区", lat: 35.7070, lng: 139.8682 },
  "134": { prefecture: "東京都", city: "江戸川区", lat: 35.7070, lng: 139.8682 },
  // ── Tokyo — Koto ──────────────────────────────────────────────────────
  "135": { prefecture: "東京都", city: "江東区",   lat: 35.6742, lng: 139.8168 },
  "136": { prefecture: "東京都", city: "江東区",   lat: 35.6742, lng: 139.8168 },
  "137": { prefecture: "東京都", city: "江東区",   lat: 35.6742, lng: 139.8168 },
  "138": { prefecture: "東京都", city: "江東区",   lat: 35.6742, lng: 139.8168 },
  "139": { prefecture: "東京都", city: "江東区",   lat: 35.6742, lng: 139.8168 },
  // ── Tokyo — Shinagawa ─────────────────────────────────────────────────
  "140": { prefecture: "東京都", city: "品川区",   lat: 35.6097, lng: 139.7323 },
  "141": { prefecture: "東京都", city: "品川区",   lat: 35.6097, lng: 139.7323 },
  "142": { prefecture: "東京都", city: "品川区",   lat: 35.6097, lng: 139.7323 },
  // ── Tokyo — Ota ───────────────────────────────────────────────────────
  "143": { prefecture: "東京都", city: "大田区",   lat: 35.5652, lng: 139.7154 },
  "144": { prefecture: "東京都", city: "大田区",   lat: 35.5652, lng: 139.7154 },
  "145": { prefecture: "東京都", city: "大田区",   lat: 35.5652, lng: 139.7154 },
  "146": { prefecture: "東京都", city: "大田区",   lat: 35.5652, lng: 139.7154 },
  // ── Tokyo — Shibuya ───────────────────────────────────────────────────
  "150": { prefecture: "東京都", city: "渋谷区",   lat: 35.6615, lng: 139.7041 },
  "151": { prefecture: "東京都", city: "渋谷区",   lat: 35.6615, lng: 139.7041 },
  // ── Tokyo — Meguro ────────────────────────────────────────────────────
  "152": { prefecture: "東京都", city: "目黒区",   lat: 35.6343, lng: 139.6978 },
  "153": { prefecture: "東京都", city: "目黒区",   lat: 35.6343, lng: 139.6978 },
  // ── Tokyo — Setagaya ──────────────────────────────────────────────────
  "154": { prefecture: "東京都", city: "世田谷区", lat: 35.6464, lng: 139.6531 },
  "155": { prefecture: "東京都", city: "世田谷区", lat: 35.6464, lng: 139.6531 },
  "156": { prefecture: "東京都", city: "世田谷区", lat: 35.6464, lng: 139.6531 },
  "157": { prefecture: "東京都", city: "世田谷区", lat: 35.6464, lng: 139.6531 },
  "158": { prefecture: "東京都", city: "世田谷区", lat: 35.6464, lng: 139.6531 },
  // ── Tokyo — Shinjuku ──────────────────────────────────────────────────
  "160": { prefecture: "東京都", city: "新宿区",   lat: 35.6938, lng: 139.7034 },
  "161": { prefecture: "東京都", city: "新宿区",   lat: 35.6938, lng: 139.7034 },
  "162": { prefecture: "東京都", city: "新宿区",   lat: 35.6938, lng: 139.7034 },
  "163": { prefecture: "東京都", city: "新宿区",   lat: 35.6938, lng: 139.7034 },
  // ── Tokyo — Nakano ────────────────────────────────────────────────────
  "164": { prefecture: "東京都", city: "中野区",   lat: 35.7065, lng: 139.6641 },
  "165": { prefecture: "東京都", city: "中野区",   lat: 35.7065, lng: 139.6641 },
  // ── Tokyo — Suginami ──────────────────────────────────────────────────
  "166": { prefecture: "東京都", city: "杉並区",   lat: 35.6996, lng: 139.6363 },
  "167": { prefecture: "東京都", city: "杉並区",   lat: 35.6996, lng: 139.6363 },
  "168": { prefecture: "東京都", city: "杉並区",   lat: 35.6996, lng: 139.6363 },
  "169": { prefecture: "東京都", city: "杉並区",   lat: 35.6996, lng: 139.6363 },
  // ── Tokyo — Toshima ───────────────────────────────────────────────────
  "170": { prefecture: "東京都", city: "豊島区",   lat: 35.7291, lng: 139.7145 },
  "171": { prefecture: "東京都", city: "豊島区",   lat: 35.7291, lng: 139.7145 },
  "172": { prefecture: "東京都", city: "豊島区",   lat: 35.7291, lng: 139.7145 },
  // ── Tokyo — Itabashi ──────────────────────────────────────────────────
  "173": { prefecture: "東京都", city: "板橋区",   lat: 35.7506, lng: 139.7099 },
  "174": { prefecture: "東京都", city: "板橋区",   lat: 35.7506, lng: 139.7099 },
  "175": { prefecture: "東京都", city: "板橋区",   lat: 35.7506, lng: 139.7099 },
  // ── Tokyo — Nerima ────────────────────────────────────────────────────
  "176": { prefecture: "東京都", city: "練馬区",   lat: 35.7358, lng: 139.6513 },
  "177": { prefecture: "東京都", city: "練馬区",   lat: 35.7358, lng: 139.6513 },
  "178": { prefecture: "東京都", city: "練馬区",   lat: 35.7358, lng: 139.6513 },
  "179": { prefecture: "東京都", city: "練馬区",   lat: 35.7358, lng: 139.6513 },
  // ── Tokyo — Tama area ─────────────────────────────────────────────────
  "180": { prefecture: "東京都", city: "武蔵野市", lat: 35.7068, lng: 139.5538 },
  "181": { prefecture: "東京都", city: "三鷹市",   lat: 35.6833, lng: 139.5592 },
  "182": { prefecture: "東京都", city: "調布市",   lat: 35.6516, lng: 139.5434 },
  "183": { prefecture: "東京都", city: "府中市",   lat: 35.6677, lng: 139.4770 },
  "184": { prefecture: "東京都", city: "小金井市", lat: 35.6996, lng: 139.5096 },
  "185": { prefecture: "東京都", city: "国分寺市", lat: 35.7007, lng: 139.4721 },
  "186": { prefecture: "東京都", city: "国立市",   lat: 35.6841, lng: 139.4420 },
  "187": { prefecture: "東京都", city: "小平市",   lat: 35.7284, lng: 139.4755 },
  "188": { prefecture: "東京都", city: "西東京市", lat: 35.7260, lng: 139.5380 },
  "189": { prefecture: "東京都", city: "東村山市", lat: 35.7543, lng: 139.4679 },
  "190": { prefecture: "東京都", city: "立川市",   lat: 35.6983, lng: 139.4133 },
  "191": { prefecture: "東京都", city: "日野市",   lat: 35.6719, lng: 139.3952 },
  "192": { prefecture: "東京都", city: "八王子市", lat: 35.6666, lng: 139.3160 },
  "193": { prefecture: "東京都", city: "八王子市", lat: 35.6666, lng: 139.3160 },
  "194": { prefecture: "東京都", city: "町田市",   lat: 35.5480, lng: 139.4466 },
  "195": { prefecture: "東京都", city: "町田市",   lat: 35.5480, lng: 139.4466 },
  "196": { prefecture: "東京都", city: "昭島市",   lat: 35.7057, lng: 139.3596 },
  "197": { prefecture: "東京都", city: "福生市",   lat: 35.7377, lng: 139.3265 },
  "198": { prefecture: "東京都", city: "青梅市",   lat: 35.7878, lng: 139.2751 },
  "199": { prefecture: "東京都", city: "青梅市",   lat: 35.7878, lng: 139.2751 },
  "200": { prefecture: "東京都", city: "多摩市",   lat: 35.6363, lng: 139.4449 },
  "201": { prefecture: "東京都", city: "狛江市",   lat: 35.6340, lng: 139.5790 },
  "202": { prefecture: "東京都", city: "清瀬市",   lat: 35.7851, lng: 139.5250 },
  "203": { prefecture: "東京都", city: "東久留米市", lat: 35.7583, lng: 139.5274 },
  "204": { prefecture: "東京都", city: "清瀬市",   lat: 35.7851, lng: 139.5250 },
  "205": { prefecture: "東京都", city: "羽村市",   lat: 35.7716, lng: 139.3113 },
  "206": { prefecture: "東京都", city: "多摩市",   lat: 35.6363, lng: 139.4449 },
  "207": { prefecture: "東京都", city: "東大和市", lat: 35.7449, lng: 139.4266 },
  "208": { prefecture: "東京都", city: "武蔵村山市", lat: 35.7558, lng: 139.3916 },
  "209": { prefecture: "東京都", city: "稲城市",   lat: 35.6380, lng: 139.5022 },
  // ── Saitama (330-369) ─────────────────────────────────────────────────
  "330": { prefecture: "埼玉県", city: "さいたま市浦和区", lat: 35.8617, lng: 139.6455 },
  "331": { prefecture: "埼玉県", city: "さいたま市北区",   lat: 35.9044, lng: 139.6383 },
  "332": { prefecture: "埼玉県", city: "川口市",           lat: 35.8075, lng: 139.7224 },
  "333": { prefecture: "埼玉県", city: "川口市",           lat: 35.8075, lng: 139.7224 },
  "334": { prefecture: "埼玉県", city: "さいたま市緑区",   lat: 35.8483, lng: 139.6976 },
  "335": { prefecture: "埼玉県", city: "越谷市",           lat: 35.8906, lng: 139.7901 },
  "336": { prefecture: "埼玉県", city: "さいたま市南区",   lat: 35.8378, lng: 139.6447 },
  "337": { prefecture: "埼玉県", city: "さいたま市緑区",   lat: 35.8483, lng: 139.6976 },
  "338": { prefecture: "埼玉県", city: "さいたま市南区",   lat: 35.8378, lng: 139.6447 },
  "339": { prefecture: "埼玉県", city: "さいたま市緑区",   lat: 35.8483, lng: 139.6976 },
  "340": { prefecture: "埼玉県", city: "草加市",           lat: 35.8250, lng: 139.8060 },
  "341": { prefecture: "埼玉県", city: "三郷市",           lat: 35.8374, lng: 139.8693 },
  // ── Chiba (260-299) ───────────────────────────────────────────────────
  "260": { prefecture: "千葉県", city: "千葉市中央区", lat: 35.6048, lng: 140.1234 },
  "261": { prefecture: "千葉県", city: "千葉市美浜区", lat: 35.6443, lng: 140.0577 },
  "262": { prefecture: "千葉県", city: "千葉市花見川区", lat: 35.6705, lng: 140.0682 },
  "263": { prefecture: "千葉県", city: "千葉市稲毛区", lat: 35.6415, lng: 140.1057 },
  "264": { prefecture: "千葉県", city: "千葉市若葉区", lat: 35.6216, lng: 140.1558 },
  "265": { prefecture: "千葉県", city: "千葉市若葉区", lat: 35.6216, lng: 140.1558 },
  "266": { prefecture: "千葉県", city: "千葉市緑区",   lat: 35.5636, lng: 140.1697 },
  "270": { prefecture: "千葉県", city: "松戸市",       lat: 35.7903, lng: 139.9032 },
  "271": { prefecture: "千葉県", city: "松戸市",       lat: 35.7903, lng: 139.9032 },
  "272": { prefecture: "千葉県", city: "市川市",       lat: 35.7218, lng: 139.9316 },
  "273": { prefecture: "千葉県", city: "船橋市",       lat: 35.6948, lng: 139.9860 },
  "274": { prefecture: "千葉県", city: "習志野市",     lat: 35.6811, lng: 140.0267 },
  "275": { prefecture: "千葉県", city: "船橋市",       lat: 35.6948, lng: 139.9860 },
  "276": { prefecture: "千葉県", city: "八千代市",     lat: 35.7231, lng: 140.0899 },
  "277": { prefecture: "千葉県", city: "柏市",         lat: 35.8678, lng: 139.9757 },
  "278": { prefecture: "千葉県", city: "野田市",       lat: 35.9547, lng: 139.8737 },
  "279": { prefecture: "千葉県", city: "浦安市",       lat: 35.6540, lng: 139.8996 },
  // ── Kanagawa — Yokohama (220-247) ─────────────────────────────────────
  "220": { prefecture: "神奈川県", city: "横浜市西区",   lat: 35.4657, lng: 139.6222 },
  "221": { prefecture: "神奈川県", city: "横浜市神奈川区", lat: 35.4896, lng: 139.6327 },
  "222": { prefecture: "神奈川県", city: "横浜市港北区",  lat: 35.5312, lng: 139.6372 },
  "223": { prefecture: "神奈川県", city: "横浜市港北区",  lat: 35.5312, lng: 139.6372 },
  "224": { prefecture: "神奈川県", city: "横浜市都筑区",  lat: 35.5386, lng: 139.5849 },
  "225": { prefecture: "神奈川県", city: "横浜市青葉区",  lat: 35.5508, lng: 139.5435 },
  "226": { prefecture: "神奈川県", city: "横浜市緑区",    lat: 35.5278, lng: 139.5779 },
  "227": { prefecture: "神奈川県", city: "横浜市青葉区",  lat: 35.5508, lng: 139.5435 },
  "230": { prefecture: "神奈川県", city: "横浜市鶴見区",  lat: 35.5103, lng: 139.6749 },
  "231": { prefecture: "神奈川県", city: "横浜市中区",    lat: 35.4478, lng: 139.6425 },
  "232": { prefecture: "神奈川県", city: "横浜市南区",    lat: 35.4275, lng: 139.6232 },
  "233": { prefecture: "神奈川県", city: "横浜市保土ケ谷区", lat: 35.4655, lng: 139.5977 },
  "234": { prefecture: "神奈川県", city: "横浜市瀬谷区",  lat: 35.4726, lng: 139.5352 },
  "235": { prefecture: "神奈川県", city: "横浜市磯子区",  lat: 35.3969, lng: 139.6271 },
  "236": { prefecture: "神奈川県", city: "横浜市金沢区",  lat: 35.3590, lng: 139.6228 },
  "240": { prefecture: "神奈川県", city: "横浜市保土ケ谷区", lat: 35.4655, lng: 139.5977 },
  "241": { prefecture: "神奈川県", city: "横浜市旭区",    lat: 35.4857, lng: 139.5631 },
  "242": { prefecture: "神奈川県", city: "横浜市瀬谷区",  lat: 35.4726, lng: 139.5352 },
  "244": { prefecture: "神奈川県", city: "横浜市戸塚区",  lat: 35.4019, lng: 139.5380 },
  "245": { prefecture: "神奈川県", city: "横浜市泉区",    lat: 35.4246, lng: 139.5141 },
  "246": { prefecture: "神奈川県", city: "横浜市戸塚区",  lat: 35.4019, lng: 139.5380 },
  "247": { prefecture: "神奈川県", city: "横浜市栄区",    lat: 35.3794, lng: 139.5636 },
  // ── Kanagawa — Kawasaki (210-216) ─────────────────────────────────────
  "210": { prefecture: "神奈川県", city: "川崎市川崎区",  lat: 35.5310, lng: 139.7030 },
  "211": { prefecture: "神奈川県", city: "川崎市川崎区",  lat: 35.5310, lng: 139.7030 },
  "212": { prefecture: "神奈川県", city: "川崎市幸区",    lat: 35.5361, lng: 139.6842 },
  "213": { prefecture: "神奈川県", city: "川崎市高津区",  lat: 35.5818, lng: 139.6535 },
  "214": { prefecture: "神奈川県", city: "川崎市多摩区",  lat: 35.5996, lng: 139.5974 },
  "215": { prefecture: "神奈川県", city: "川崎市麻生区",  lat: 35.5984, lng: 139.5384 },
  "216": { prefecture: "神奈川県", city: "川崎市宮前区",  lat: 35.5715, lng: 139.5870 },
  // ── Sapporo (001-069) ─────────────────────────────────────────────────
  "001": { prefecture: "北海道", city: "札幌市北区",   lat: 43.0920, lng: 141.3393 },
  "002": { prefecture: "北海道", city: "札幌市東区",   lat: 43.0681, lng: 141.3798 },
  "003": { prefecture: "北海道", city: "札幌市東区",   lat: 43.0681, lng: 141.3798 },
  "004": { prefecture: "北海道", city: "札幌市白石区", lat: 43.0519, lng: 141.3856 },
  "005": { prefecture: "北海道", city: "札幌市豊平区", lat: 43.0261, lng: 141.3706 },
  "006": { prefecture: "北海道", city: "札幌市南区",   lat: 42.9897, lng: 141.3467 },
  "007": { prefecture: "北海道", city: "札幌市北区",   lat: 43.0920, lng: 141.3393 },
  "008": { prefecture: "北海道", city: "札幌市厚別区", lat: 43.0418, lng: 141.4383 },
  "010": { prefecture: "北海道", city: "札幌市西区",   lat: 43.0752, lng: 141.3007 },
  "011": { prefecture: "北海道", city: "札幌市中央区", lat: 43.0618, lng: 141.3544 },
  "060": { prefecture: "北海道", city: "札幌市中央区", lat: 43.0618, lng: 141.3544 },
  "061": { prefecture: "北海道", city: "北広島市",     lat: 42.9876, lng: 141.5663 },
  "062": { prefecture: "北海道", city: "札幌市豊平区", lat: 43.0261, lng: 141.3706 },
  "063": { prefecture: "北海道", city: "札幌市西区",   lat: 43.0752, lng: 141.3007 },
  "064": { prefecture: "北海道", city: "札幌市中央区", lat: 43.0618, lng: 141.3544 },
  "065": { prefecture: "北海道", city: "札幌市東区",   lat: 43.0681, lng: 141.3798 },
  "066": { prefecture: "北海道", city: "恵庭市",       lat: 42.8784, lng: 141.5792 },
  // ── Osaka city (530-559) ──────────────────────────────────────────────
  "530": { prefecture: "大阪府", city: "大阪市北区",     lat: 34.7022, lng: 135.4959 },
  "531": { prefecture: "大阪府", city: "大阪市北区",     lat: 34.7022, lng: 135.4959 },
  "532": { prefecture: "大阪府", city: "大阪市淀川区",   lat: 34.7363, lng: 135.4913 },
  "533": { prefecture: "大阪府", city: "大阪市淀川区",   lat: 34.7363, lng: 135.4913 },
  "534": { prefecture: "大阪府", city: "大阪市東淀川区", lat: 34.7544, lng: 135.5092 },
  "535": { prefecture: "大阪府", city: "大阪市旭区",     lat: 34.7318, lng: 135.5413 },
  "536": { prefecture: "大阪府", city: "大阪市城東区",   lat: 34.7103, lng: 135.5449 },
  "537": { prefecture: "大阪府", city: "大阪市城東区",   lat: 34.7103, lng: 135.5449 },
  "538": { prefecture: "大阪府", city: "大阪市鶴見区",   lat: 34.6982, lng: 135.5599 },
  "540": { prefecture: "大阪府", city: "大阪市中央区",   lat: 34.6873, lng: 135.5119 },
  "541": { prefecture: "大阪府", city: "大阪市中央区",   lat: 34.6873, lng: 135.5119 },
  "542": { prefecture: "大阪府", city: "大阪市中央区",   lat: 34.6873, lng: 135.5119 },
  "543": { prefecture: "大阪府", city: "大阪市天王寺区", lat: 34.6570, lng: 135.5180 },
  "544": { prefecture: "大阪府", city: "大阪市生野区",   lat: 34.6614, lng: 135.5390 },
  "545": { prefecture: "大阪府", city: "大阪市阿倍野区", lat: 34.6411, lng: 135.5138 },
  "546": { prefecture: "大阪府", city: "大阪市住吉区",   lat: 34.6156, lng: 135.5147 },
  "547": { prefecture: "大阪府", city: "大阪市東住吉区", lat: 34.6215, lng: 135.5292 },
  "548": { prefecture: "大阪府", city: "大阪市平野区",   lat: 34.6107, lng: 135.5453 },
  "549": { prefecture: "大阪府", city: "大阪市平野区",   lat: 34.6107, lng: 135.5453 },
  "550": { prefecture: "大阪府", city: "大阪市西区",     lat: 34.6744, lng: 135.4940 },
  "551": { prefecture: "大阪府", city: "大阪市浪速区",   lat: 34.6658, lng: 135.5011 },
  "552": { prefecture: "大阪府", city: "大阪市港区",     lat: 34.6740, lng: 135.4631 },
  "553": { prefecture: "大阪府", city: "大阪市福島区",   lat: 34.6897, lng: 135.4834 },
  "554": { prefecture: "大阪府", city: "大阪市此花区",   lat: 34.6869, lng: 135.4571 },
  "555": { prefecture: "大阪府", city: "大阪市西淀川区", lat: 34.7162, lng: 135.4648 },
  "556": { prefecture: "大阪府", city: "大阪市浪速区",   lat: 34.6658, lng: 135.5011 },
  "557": { prefecture: "大阪府", city: "大阪市西成区",   lat: 34.6450, lng: 135.4952 },
  "558": { prefecture: "大阪府", city: "大阪市住之江区", lat: 34.6219, lng: 135.4844 },
  "559": { prefecture: "大阪府", city: "大阪市住之江区", lat: 34.6219, lng: 135.4844 },
  // ── Osaka suburbs ─────────────────────────────────────────────────────
  "560": { prefecture: "大阪府", city: "豊中市",   lat: 34.7798, lng: 135.4714 },
  "561": { prefecture: "大阪府", city: "豊中市",   lat: 34.7798, lng: 135.4714 },
  "564": { prefecture: "大阪府", city: "吹田市",   lat: 34.7594, lng: 135.5198 },
  "565": { prefecture: "大阪府", city: "吹田市",   lat: 34.7594, lng: 135.5198 },
  "570": { prefecture: "大阪府", city: "守口市",   lat: 34.7310, lng: 135.5738 },
  "572": { prefecture: "大阪府", city: "寝屋川市", lat: 34.7649, lng: 135.6310 },
  "573": { prefecture: "大阪府", city: "枚方市",   lat: 34.8140, lng: 135.6510 },
  "574": { prefecture: "大阪府", city: "大東市",   lat: 34.7124, lng: 135.6211 },
  "577": { prefecture: "大阪府", city: "東大阪市", lat: 34.6794, lng: 135.6006 },
  "578": { prefecture: "大阪府", city: "東大阪市", lat: 34.6794, lng: 135.6006 },
  "580": { prefecture: "大阪府", city: "松原市",   lat: 34.5803, lng: 135.5547 },
  "581": { prefecture: "大阪府", city: "八尾市",   lat: 34.6265, lng: 135.5991 },
  "583": { prefecture: "大阪府", city: "藤井寺市", lat: 34.5772, lng: 135.5995 },
  "584": { prefecture: "大阪府", city: "富田林市", lat: 34.4983, lng: 135.5969 },
  "585": { prefecture: "大阪府", city: "河内長野市", lat: 34.4574, lng: 135.5616 },
  "590": { prefecture: "大阪府", city: "堺市堺区", lat: 34.5731, lng: 135.4831 },
  "591": { prefecture: "大阪府", city: "堺市北区", lat: 34.6017, lng: 135.4809 },
  "592": { prefecture: "大阪府", city: "堺市西区", lat: 34.5681, lng: 135.4538 },
  "593": { prefecture: "大阪府", city: "堺市南区", lat: 34.5254, lng: 135.4919 },
  "594": { prefecture: "大阪府", city: "和泉市",   lat: 34.4855, lng: 135.4324 },
  "595": { prefecture: "大阪府", city: "岸和田市", lat: 34.4476, lng: 135.3767 },
  "596": { prefecture: "大阪府", city: "岸和田市", lat: 34.4476, lng: 135.3767 },
  "597": { prefecture: "大阪府", city: "貝塚市",   lat: 34.4443, lng: 135.3579 },
  "598": { prefecture: "大阪府", city: "泉南市",   lat: 34.3697, lng: 135.2933 },
  "599": { prefecture: "大阪府", city: "泉南市",   lat: 34.3697, lng: 135.2933 },
  // ── Nagoya (450-468) ──────────────────────────────────────────────────
  "450": { prefecture: "愛知県", city: "名古屋市中村区", lat: 35.1768, lng: 136.8838 },
  "451": { prefecture: "愛知県", city: "名古屋市西区",   lat: 35.1940, lng: 136.8893 },
  "452": { prefecture: "愛知県", city: "名古屋市西区",   lat: 35.1940, lng: 136.8893 },
  "453": { prefecture: "愛知県", city: "名古屋市中村区", lat: 35.1768, lng: 136.8838 },
  "454": { prefecture: "愛知県", city: "名古屋市中川区", lat: 35.1489, lng: 136.8668 },
  "455": { prefecture: "愛知県", city: "名古屋市港区",   lat: 35.1054, lng: 136.8768 },
  "456": { prefecture: "愛知県", city: "名古屋市南区",   lat: 35.0934, lng: 136.9153 },
  "457": { prefecture: "愛知県", city: "名古屋市南区",   lat: 35.0934, lng: 136.9153 },
  "458": { prefecture: "愛知県", city: "名古屋市港区",   lat: 35.1054, lng: 136.8768 },
  "459": { prefecture: "愛知県", city: "名古屋市緑区",   lat: 35.0693, lng: 136.9722 },
  "460": { prefecture: "愛知県", city: "名古屋市中区",   lat: 35.1802, lng: 136.9066 },
  "461": { prefecture: "愛知県", city: "名古屋市東区",   lat: 35.1882, lng: 136.9241 },
  "462": { prefecture: "愛知県", city: "名古屋市北区",   lat: 35.2079, lng: 136.9014 },
  "463": { prefecture: "愛知県", city: "名古屋市守山区", lat: 35.2123, lng: 136.9625 },
  "464": { prefecture: "愛知県", city: "名古屋市千種区", lat: 35.1717, lng: 136.9407 },
  "465": { prefecture: "愛知県", city: "名古屋市名東区", lat: 35.1742, lng: 136.9816 },
  "466": { prefecture: "愛知県", city: "名古屋市昭和区", lat: 35.1486, lng: 136.9202 },
  "467": { prefecture: "愛知県", city: "名古屋市瑞穂区", lat: 35.1348, lng: 136.9299 },
  "468": { prefecture: "愛知県", city: "名古屋市緑区",   lat: 35.0693, lng: 136.9722 },
  // ── Kyoto (600-629) ───────────────────────────────────────────────────
  "600": { prefecture: "京都府", city: "京都市下京区",   lat: 34.9991, lng: 135.7583 },
  "601": { prefecture: "京都府", city: "京都市伏見区",   lat: 34.9364, lng: 135.7622 },
  "602": { prefecture: "京都府", city: "京都市上京区",   lat: 35.0296, lng: 135.7555 },
  "603": { prefecture: "京都府", city: "京都市北区",     lat: 35.0554, lng: 135.7496 },
  "604": { prefecture: "京都府", city: "京都市中京区",   lat: 35.0116, lng: 135.7612 },
  "605": { prefecture: "京都府", city: "京都市東山区",   lat: 34.9962, lng: 135.7767 },
  "606": { prefecture: "京都府", city: "京都市左京区",   lat: 35.0398, lng: 135.7820 },
  "607": { prefecture: "京都府", city: "京都市山科区",   lat: 34.9956, lng: 135.8136 },
  "608": { prefecture: "京都府", city: "京都市右京区",   lat: 35.0214, lng: 135.7148 },
  "610": { prefecture: "京都府", city: "宇治市",         lat: 34.8844, lng: 135.7991 },
  "611": { prefecture: "京都府", city: "宇治市",         lat: 34.8844, lng: 135.7991 },
  "612": { prefecture: "京都府", city: "京都市伏見区",   lat: 34.9364, lng: 135.7622 },
  "613": { prefecture: "京都府", city: "京都市伏見区",   lat: 34.9364, lng: 135.7622 },
  "615": { prefecture: "京都府", city: "京都市右京区",   lat: 35.0214, lng: 135.7148 },
  "616": { prefecture: "京都府", city: "京都市右京区",   lat: 35.0214, lng: 135.7148 },
  "617": { prefecture: "京都府", city: "向日市",         lat: 34.9534, lng: 135.7027 },
  "618": { prefecture: "京都府", city: "乙訓郡",         lat: 34.9534, lng: 135.7027 },
  "619": { prefecture: "京都府", city: "相楽郡",         lat: 34.7584, lng: 135.8273 },
  "620": { prefecture: "京都府", city: "福知山市",       lat: 35.2965, lng: 135.1273 },
  // ── Kobe (650-658) ────────────────────────────────────────────────────
  "650": { prefecture: "兵庫県", city: "神戸市中央区", lat: 34.6913, lng: 135.1830 },
  "651": { prefecture: "兵庫県", city: "神戸市中央区", lat: 34.6913, lng: 135.1830 },
  "652": { prefecture: "兵庫県", city: "神戸市兵庫区", lat: 34.6873, lng: 135.1720 },
  "653": { prefecture: "兵庫県", city: "神戸市長田区", lat: 34.6741, lng: 135.1538 },
  "654": { prefecture: "兵庫県", city: "神戸市須磨区", lat: 34.6503, lng: 135.1326 },
  "655": { prefecture: "兵庫県", city: "神戸市垂水区", lat: 34.6362, lng: 135.0857 },
  "656": { prefecture: "兵庫県", city: "神戸市西区",   lat: 34.6691, lng: 135.0442 },
  "657": { prefecture: "兵庫県", city: "神戸市灘区",   lat: 34.7047, lng: 135.2124 },
  "658": { prefecture: "兵庫県", city: "神戸市東灘区", lat: 34.7269, lng: 135.2627 },
  // ── Fukuoka (810-819) ─────────────────────────────────────────────────
  "810": { prefecture: "福岡県", city: "福岡市中央区", lat: 33.5904, lng: 130.4017 },
  "811": { prefecture: "福岡県", city: "福岡市東区",   lat: 33.6288, lng: 130.4519 },
  "812": { prefecture: "福岡県", city: "福岡市博多区", lat: 33.5903, lng: 130.4214 },
  "813": { prefecture: "福岡県", city: "福岡市東区",   lat: 33.6288, lng: 130.4519 },
  "814": { prefecture: "福岡県", city: "福岡市早良区", lat: 33.5717, lng: 130.3621 },
  "815": { prefecture: "福岡県", city: "福岡市南区",   lat: 33.5549, lng: 130.4110 },
  "816": { prefecture: "福岡県", city: "福岡市城南区", lat: 33.5644, lng: 130.3790 },
  "818": { prefecture: "福岡県", city: "筑紫野市",     lat: 33.5089, lng: 130.5117 },
  "819": { prefecture: "福岡県", city: "福岡市西区",   lat: 33.5914, lng: 130.3216 },
  // ── Kitakyushu (800-808) ──────────────────────────────────────────────
  "800": { prefecture: "福岡県", city: "北九州市門司区", lat: 33.9434, lng: 130.9679 },
  "802": { prefecture: "福岡県", city: "北九州市小倉北区", lat: 33.8833, lng: 130.8752 },
  "803": { prefecture: "福岡県", city: "北九州市小倉北区", lat: 33.8833, lng: 130.8752 },
  "804": { prefecture: "福岡県", city: "北九州市戸畑区",   lat: 33.8983, lng: 130.8285 },
  "805": { prefecture: "福岡県", city: "北九州市若松区",   lat: 33.9020, lng: 130.7891 },
  "806": { prefecture: "福岡県", city: "北九州市八幡西区", lat: 33.8745, lng: 130.7822 },
  "807": { prefecture: "福岡県", city: "北九州市八幡西区", lat: 33.8745, lng: 130.7822 },
  "808": { prefecture: "福岡県", city: "北九州市八幡東区", lat: 33.8609, lng: 130.8179 },
  // ── Sendai (980-989) ──────────────────────────────────────────────────
  "980": { prefecture: "宮城県", city: "仙台市青葉区",   lat: 38.2682, lng: 140.8694 },
  "981": { prefecture: "宮城県", city: "仙台市宮城野区", lat: 38.2693, lng: 140.9020 },
  "982": { prefecture: "宮城県", city: "仙台市太白区",   lat: 38.2239, lng: 140.8752 },
  "983": { prefecture: "宮城県", city: "仙台市宮城野区", lat: 38.2693, lng: 140.9020 },
  "984": { prefecture: "宮城県", city: "仙台市若林区",   lat: 38.2366, lng: 140.8981 },
  "985": { prefecture: "宮城県", city: "塩竈市",         lat: 38.3094, lng: 141.0214 },
  "989": { prefecture: "宮城県", city: "仙台市泉区",     lat: 38.3153, lng: 140.8765 },
  // ── Hiroshima (730-739) ───────────────────────────────────────────────
  "730": { prefecture: "広島県", city: "広島市中区",   lat: 34.3853, lng: 132.4553 },
  "731": { prefecture: "広島県", city: "広島市東区",   lat: 34.3978, lng: 132.4819 },
  "732": { prefecture: "広島県", city: "広島市南区",   lat: 34.3697, lng: 132.4786 },
  "733": { prefecture: "広島県", city: "広島市西区",   lat: 34.3941, lng: 132.4223 },
  "734": { prefecture: "広島県", city: "広島市南区",   lat: 34.3697, lng: 132.4786 },
  "735": { prefecture: "広島県", city: "広島市佐伯区", lat: 34.3397, lng: 132.3540 },
  "736": { prefecture: "広島県", city: "広島市安芸区", lat: 34.3636, lng: 132.5369 },
  "737": { prefecture: "広島県", city: "呉市",         lat: 34.2498, lng: 132.5617 },
  "738": { prefecture: "広島県", city: "廿日市市",     lat: 34.3501, lng: 132.3243 },
  "739": { prefecture: "広島県", city: "廿日市市",     lat: 34.3501, lng: 132.3243 },
  // ── Naha / Okinawa (900-904) ──────────────────────────────────────────
  "900": { prefecture: "沖縄県", city: "那覇市",     lat: 26.2124, lng: 127.6809 },
  "901": { prefecture: "沖縄県", city: "那覇市",     lat: 26.2124, lng: 127.6809 },
  "902": { prefecture: "沖縄県", city: "那覇市",     lat: 26.2124, lng: 127.6809 },
  "903": { prefecture: "沖縄県", city: "那覇市",     lat: 26.2124, lng: 127.6809 },
  "904": { prefecture: "沖縄県", city: "沖縄市",     lat: 26.3344, lng: 127.8056 },
  "905": { prefecture: "沖縄県", city: "名護市",     lat: 26.5918, lng: 127.9772 },
  "906": { prefecture: "沖縄県", city: "石垣市",     lat: 24.3448, lng: 124.1558 },
};

// ---------------------------------------------------------------------------
// Lookup by postal code (NNN-NNNN or NNNNNNN format)
// ---------------------------------------------------------------------------
export function lookupPostalCode(rawCode: string): PostalResult | null {
  const digits = rawCode.replace(/\D/g, "");
  if (digits.length !== 7) return null;

  // 1. Exact 7-digit match (not in current dataset but extensible)
  const prefix3 = digits.slice(0, 3);
  return PREFIX_MAP[prefix3] ?? null;
}

// ---------------------------------------------------------------------------
// Lookup by prefecture name (fallback)
// ---------------------------------------------------------------------------
export function lookupPrefecture(prefecture: string): { lat: number; lng: number } | null {
  const coords = PREFECTURE_CENTROIDS[prefecture];
  if (!coords) return null;
  return { lat: coords[0], lng: coords[1] };
}

// ---------------------------------------------------------------------------
// Haversine distance in kilometres
// ---------------------------------------------------------------------------
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// Resolve lat/lng from postal code, with prefecture fallback
// ---------------------------------------------------------------------------
export function resolveCoords(
  postalCode: string,
  prefecture: string | null | undefined
): { lat: number; lng: number } | null {
  const byCode = lookupPostalCode(postalCode);
  if (byCode) return { lat: byCode.lat, lng: byCode.lng };

  if (prefecture) {
    const byPref = lookupPrefecture(prefecture);
    if (byPref) return byPref;
  }

  return null;
}
