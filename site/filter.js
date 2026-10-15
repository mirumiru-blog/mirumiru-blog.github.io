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

// 歌曲資訊文字，例如「唱過 3 次 · 上次 2026/10/12」
export function sungInfo(song) {
  if (!song.count || !song.lastSung) return "還沒唱過";
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
