import { ALL, availableCategories, filterSongs, listLanguages, sungInfo } from "./filter.js";

const $ = (id) => document.getElementById(id);
const state = { query: "", language: ALL, category: ALL };
let songs = [];

function renderChips(container, options, selected, onPick) {
  container.replaceChildren(
    ...[ALL, ...options].map((value) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = value;
      btn.setAttribute("aria-pressed", String(value === selected));
      btn.addEventListener("click", () => onPick(value));
      return btn;
    })
  );
}

function songItem(song) {
  const li = document.createElement("li");
  li.className = "song";

  const info = document.createElement("div");
  info.className = "info";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = song.name;
  const tags = document.createElement("span");
  tags.className = "tags";
  tags.textContent =
    song.category === song.language ? song.language : `${song.language} · ${song.category}`;
  const stats = document.createElement("span");
  stats.className = "stats";
  stats.textContent = sungInfo(song);
  info.append(name, tags, stats);

  const actions = document.createElement("div");
  actions.className = "actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "btn primary";
  copy.textContent = "複製";
  copy.addEventListener("click", () => copyName(song.name));
  actions.append(copy);

  li.append(info, actions);
  return li;
}

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1800);
}

// 部分 App 內建瀏覽器不支援 Clipboard API，改用舊方法備援
function legacyCopy(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

async function copyName(name) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(name);
    ok = true;
  } catch {
    ok = legacyCopy(name);
  }
  toast(ok ? `已複製：${name}` : "無法複製，請手動選取歌名");
}

function render() {
  const categories = availableCategories(songs, state.language);
  if (!categories.includes(state.category)) state.category = ALL;

  renderChips($("languages"), listLanguages(songs), state.language, (v) => {
    state.language = v;
    render();
  });
  renderChips($("categories"), categories, state.category, (v) => {
    state.category = v;
    render();
  });
  $("categories").hidden = categories.length === 0;

  const result = filterSongs(songs, state);
  $("count").textContent = `共 ${result.length} 首`;
  $("list").replaceChildren(...result.map(songItem));
  $("empty").hidden = result.length > 0;
}

$("search").addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

try {
  songs = await (await fetch("data/songs.json")).json();
  render();
} catch {
  $("count").textContent = "歌單載入失敗，請重新整理頁面";
}
