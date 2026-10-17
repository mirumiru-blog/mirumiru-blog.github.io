// 搜尋與篩選邏輯（不碰 DOM，方便測試）

export const ALL = "全部";

const KATAKANA = /[ァ-ヶ]/g;

// 搜尋用的正規化：全形轉半形、忽略大小寫與空白、片假名視同平假名
export function normalizeText(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s​]+/g, "")
    .replace(KATAKANA, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

function uniqueInOrder(values) {
  return [...new Set(values)];
}

export function listLanguages(songs) {
  return uniqueInOrder(songs.map((s) => s.language));
}

// 只列出所選語言底下真的有的類別；和語言同名的類別（例如「中文」）不重複顯示
export function availableCategories(songs, language) {
  const languages = new Set(listLanguages(songs));
  return uniqueInOrder(
    songs
      .filter((s) => language === ALL || s.language === language)
      .map((s) => s.category)
      .filter((c) => !languages.has(c))
  );
}

// 側欄分類樹：每個語言的歌曲數，以及底下各類別的歌曲數
export function categoryTree(songs) {
  return listLanguages(songs).map((language) => {
    const inLanguage = songs.filter((s) => s.language === language);
    return {
      language,
      count: inLanguage.length,
      categories: availableCategories(inLanguage, language)
        .filter((c) => c !== language)
        .map((name) => ({ name, count: inLanguage.filter((s) => s.category === name).length })),
    };
  });
}

// 搜尋框下方的標籤：全部、各語言、各類別。
// 點類別時，若該類別只出現在一種語言就一併切到那個語言，否則語言維持全部。
export function filterChips(songs) {
  const languages = listLanguages(songs);
  const chips = [{ label: "全部", language: ALL, category: ALL }];
  for (const language of languages) chips.push({ label: language, language, category: ALL });
  for (const category of availableCategories(songs, ALL)) {
    const inLanguages = new Set(songs.filter((s) => s.category === category).map((s) => s.language));
    chips.push({ label: category, language: inLanguages.size === 1 ? [...inLanguages][0] : ALL, category });
  }
  return chips;
}

// ---------- 排序 ----------
// 歌名排序分四組：數字 → 英文 A-Z → 日文假名（五十音）→ 漢字（筆劃少到多）
export const SORT_NAME = "name";
export const SORT_ORIGINAL = "original";

const collators = {};
function collator(locale) {
  return (collators[locale] ??= new Intl.Collator(locale, { numeric: true, sensitivity: "base" }));
}

const GROUPS = [
  { test: /^[0-9]/, locale: "en" },
  { test: /^[a-z]/i, locale: "en" },
  { test: /^[぀-ヿ]/, locale: "ja" },
];
const OTHER_GROUP = { locale: "zh-Hant-TW-u-co-stroke" };

// 排序用的歌名：全形轉半形、去掉開頭的空白與符號（例如「(」「「」）
function sortKey(name) {
  return String(name).normalize("NFKC").replace(/^[\s\p{P}\p{S}]+/u, "");
}

function sortGroup(key) {
  const index = GROUPS.findIndex((g) => g.test.test(key));
  return index === -1 ? GROUPS.length : index;
}

export function compareNames(a, b) {
  const ka = sortKey(a);
  const kb = sortKey(b);
  const ga = sortGroup(ka);
  const gb = sortGroup(kb);
  if (ga !== gb) return ga - gb;
  const compare = collator((GROUPS[ga] ?? OTHER_GROUP).locale).compare;
  return compare(ka, kb) || compare(a, b);
}

export function sortSongs(songs, mode = SORT_NAME) {
  if (mode !== SORT_NAME) return songs.slice();
  return songs.slice().sort((a, b) => compareNames(a.name, b.name));
}

// 歌曲資訊文字，例如「唱過 3 次 · 上次 2026/10/12」
export function sungInfo(song) {
  if (!song.count || !song.lastSung) return "-";
  return `唱過 ${song.count} 次 · 上次 ${song.lastSung.replaceAll("-", "/")}`;
}

export function filterSongs(songs, { query = "", language = ALL, category = ALL } = {}) {
  const q = normalizeText(query);
  return songs.filter(
    (s) =>
      (language === ALL || s.language === language) &&
      (category === ALL || s.category === category) &&
      (!q || normalizeText(s.name).includes(q))
  );
}
