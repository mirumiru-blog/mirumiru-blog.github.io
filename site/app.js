import {
  ALL,
  SORT_NAME,
  availableCategories,
  categoryTree,
  filterChips,
  filterSongs,
  listLanguages,
  sortSongs,
  sungInfo,
} from "./filter.js";
import { MONTH_NAMES, isoDate, monthGrid, shiftMonth, todayInTaipei } from "./calendar.js";
import { countVisit } from "./counter.js";
import { mountPlayer } from "./player.js";

const $ = (id) => document.getElementById(id);
const state = { query: "", language: ALL, category: ALL, sort: SORT_NAME };
let songs = [];

const today = todayInTaipei();
let shownMonth = { year: today.year, month: today.month };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function pickButton(className, label, pressed, onPick) {
  const btn = el("button", className, label);
  btn.type = "button";
  btn.setAttribute("aria-pressed", String(pressed));
  btn.addEventListener("click", onPick);
  return btn;
}

function setFilter(language, category = ALL) {
  state.language = language;
  state.category = category;
  render();
}

// ---------- 歌單 ----------

function songItem(song) {
  const li = el("li", "song");
  const info = el("div", "info");
  const meta = song.category === song.language ? song.language : `${song.language} · ${song.category}`;
  info.append(el("span", "name", song.name), el("span", "meta", `${meta}｜${sungInfo(song)}`));

  const copy = el("button", "copy", "複製歌名");
  copy.type = "button";
  copy.addEventListener("click", () => copyName(song.name));

  li.append(info, copy);
  return li;
}

function renderTree() {
  const item = (label, count, active, onPick) => {
    const li = el("li");
    li.append(pickButton("tree-link", `${label} (${count})`, active, onPick));
    return li;
  };
  const rows = [item("全部歌曲", songs.length, state.language === ALL, () => setFilter(ALL))];
  for (const node of categoryTree(songs)) {
    const li = item(node.language, node.count, state.language === node.language && state.category === ALL, () =>
      setFilter(node.language)
    );
    if (node.categories.length) {
      const sub = el("ul", "tree-sub");
      for (const c of node.categories) {
        sub.append(
          item(c.name, c.count, state.language === node.language && state.category === c.name, () =>
            setFilter(node.language, c.name)
          )
        );
      }
      li.append(sub);
    }
    rows.push(li);
  }
  $("tree").replaceChildren(...rows);
}

function render() {
  const categories = availableCategories(songs, state.language);
  if (!categories.includes(state.category)) state.category = ALL;

  $("languages").replaceChildren(
    ...[ALL, ...listLanguages(songs)].map((v) =>
      pickButton("tab", v === ALL ? "全部歌曲" : v, v === state.language, () => setFilter(v))
    )
  );
  $("categories").replaceChildren(
    ...filterChips(songs).map((chip) =>
      pickButton(
        "chip",
        chip.label,
        chip.language === state.language && chip.category === state.category,
        () => setFilter(chip.language, chip.category)
      )
    )
  );
  renderTree();

  const result = sortSongs(filterSongs(songs, state), state.sort);
  $("count").textContent = `共 ${result.length} 首`;
  $("list").replaceChildren(...result.map(songItem));
  $("empty").hidden = result.length > 0;
}

// ---------- 複製 ----------

let toastTimer;
function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 1800);
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

// ---------- 日曆 ----------

function renderCalendar() {
  const { year, month } = shownMonth;
  $("cal-label").textContent = `${MONTH_NAMES[month - 1]} ${year}`;
  $("cal-body").replaceChildren(
    ...monthGrid(year, month).map((week) => {
      const tr = el("tr");
      for (const day of week) {
        const td = el("td", "", day ?? "");
        if (day === today.day && month === today.month && year === today.year) {
          td.className = "today";
          td.setAttribute("aria-current", "date");
        }
        tr.append(td);
      }
      return tr;
    })
  );
}

$("cal-prev").addEventListener("click", () => {
  shownMonth = shiftMonth(shownMonth, -1);
  renderCalendar();
});
$("cal-next").addEventListener("click", () => {
  shownMonth = shiftMonth(shownMonth, 1);
  renderCalendar();
});

// ---------- 啟動 ----------

$("today-label").textContent = `Today: ${isoDate(today).replaceAll("-", "/")}`;
$("post-date").textContent = `${MONTH_NAMES[today.month - 1]} ${today.day}, ${today.year}`;
renderCalendar();

$("sort").addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

$("search").addEventListener("input", (e) => {
  state.query = e.target.value;
  render();
});

countVisit({ today: isoDate(today) }).then((counts) => {
  if (!counts) return;
  $("visitors-today").textContent = counts.today;
  $("visitors-total").textContent = counts.total;
});

// 網站設定（大頭貼、播放清單）：site/data/settings.json
fetch("data/settings.json")
  .then((r) => r.json())
  .then(({ owner = {}, player = [] }) => {
    const caption = owner.caption || "";
    if (owner.avatar) {
      $("owner-avatar").src = owner.avatar;
      $("owner-avatar").alt = caption ? `${caption} 大頭貼` : "大頭貼";
    } else {
      $("owner-avatar").hidden = true;
    }
    $("owner-caption").textContent = caption;
    mountPlayer($("player"), player);
  })
  .catch(() => {
    document.querySelector(".side-owner").hidden = true;
    document.querySelector(".side-player").hidden = true;
  });

try {
  songs = await (await fetch("data/songs.json")).json();
  render();
} catch {
  $("count").textContent = "歌單載入失敗，請重新整理頁面";
}
