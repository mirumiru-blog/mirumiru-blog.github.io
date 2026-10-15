// 訪客計數：使用免費的 Abacus 計數服務（https://abacus.jasoncameron.dev）
// 同一個瀏覽器同一天只算一次，重新整理不會重複計算。

const API = "https://abacus.jasoncameron.dev";
const STORAGE_KEY = "lastCountedVisit";

// 本機預覽用另一組計數器，避免測試灌水正式網站的人數
export function namespaceFor(hostname) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  return local ? "almond-milk-songlist-dev" : "almond-milk-songlist";
}

// 部分瀏覽器設定下光是讀取 localStorage 就會丟錯
function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readStorage(storage) {
  try {
    return storage?.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(storage, value) {
  try {
    storage?.setItem(STORAGE_KEY, value);
  } catch {
    // 無痕模式等情況無法寫入，忽略即可
  }
}

async function request(fetchFn, namespace, action, key) {
  const response = await fetchFn(`${API}/${action}/${namespace}/${key}`);
  if (response.status === 404) return 0; // 計數器還沒建立，代表目前是 0
  if (!response.ok) throw new Error(`counter ${response.status}`);
  return (await response.json()).value;
}

// today 為台灣時間的 "YYYY-MM-DD"；失敗時回傳 null
export async function countVisit({
  today,
  namespace = namespaceFor(globalThis.location?.hostname),
  fetchFn = (url) => fetch(url),
  storage = defaultStorage(),
} = {}) {
  const counted = readStorage(storage) === today;
  const action = counted ? "get" : "hit";
  try {
    const [todayCount, total] = await Promise.all([
      request(fetchFn, namespace, action, `day-${today}`),
      request(fetchFn, namespace, action, "total"),
    ]);
    if (!counted) writeStorage(storage, today);
    return { today: todayCount, total };
  } catch {
    return null;
  }
}
