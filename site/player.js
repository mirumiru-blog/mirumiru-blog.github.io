// 懷舊風格 YouTube 播放器：影片畫面 + 自訂的播放、進度、音量控制列

const ID_PATTERN = /^[\w-]{11}$/;

// 從各種 YouTube 網址取出影片 ID，無法辨識回傳 null
export function parseYouTubeId(url) {
  const text = String(url ?? "").trim();
  if (ID_PATTERN.test(text)) return text;
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m|music)\./, "");
  let id = null;
  if (host === "youtu.be") id = parsed.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = parsed.searchParams.get("v");
    const match = parsed.pathname.match(/^\/(embed|shorts|live|v)\/([^/]+)/);
    if (match) id = match[2];
  }
  return id && ID_PATTERN.test(id) ? id : null;
}

// 把設定檔的歌曲清單整理成 [{ title, id }]，略過網址錯誤的項目
export function playlistFrom(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((e) => ({ title: String(e?.title ?? "").trim(), id: parseYouTubeId(e?.url) }))
    .filter((e) => e.id)
    .map((e) => ({ ...e, title: e.title || "未命名歌曲" }));
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------- 畫面 ----------

let apiPromise;
function loadYouTubeApi() {
  apiPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("YouTube 載入失敗"));
    document.head.append(script);
  });
  return apiPromise;
}

function button(className, label, text) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.setAttribute("aria-label", label);
  btn.textContent = text;
  return btn;
}

export function mountPlayer(container, entries) {
  const list = playlistFrom(entries);
  if (!list.length) {
    container.hidden = true;
    return;
  }
  let index = 0;
  let player = null;
  let ready = false;
  let timer = null;

  const title = document.createElement("div");
  title.className = "player-title";

  const screen = document.createElement("div");
  screen.className = "player-screen";
  const host = document.createElement("div");
  const bigPlay = button("player-big", "播放", "▶︎");
  screen.append(host, bigPlay);

  const bar = document.createElement("div");
  bar.className = "player-bar";
  const play = button("player-btn", "播放", "▶︎");
  const prev = button("player-btn", "上一首", "⏮︎");
  const next = button("player-btn", "下一首", "⏭︎");
  const current = document.createElement("span");
  current.className = "player-time";
  const seek = document.createElement("input");
  seek.type = "range";
  seek.className = "player-seek";
  seek.min = "0";
  seek.max = "1000";
  seek.value = "0";
  seek.setAttribute("aria-label", "播放進度");
  const duration = document.createElement("span");
  duration.className = "player-time";
  const mute = button("player-btn", "靜音", "♪");
  const volume = document.createElement("input");
  volume.type = "range";
  volume.className = "player-volume";
  volume.min = "0";
  volume.max = "100";
  volume.value = "80";
  volume.setAttribute("aria-label", "音量");

  const multi = list.length > 1;
  bar.append(...(multi ? [prev] : []), play, ...(multi ? [next] : []), current, seek, duration, mute, volume);
  container.append(title, screen, bar);

  function showTitle() {
    title.textContent = list[index].title;
    current.textContent = formatTime(0);
    duration.textContent = formatTime(0);
    seek.value = "0";
  }

  function setPlaying(playing) {
    play.textContent = playing ? "⏸︎" : "▶︎";
    play.setAttribute("aria-label", playing ? "暫停" : "播放");
    bigPlay.hidden = playing;
  }

  function tick() {
    if (!ready) return;
    const now = player.getCurrentTime();
    const total = player.getDuration();
    current.textContent = formatTime(now);
    duration.textContent = formatTime(total);
    if (total > 0 && document.activeElement !== seek) seek.value = String(Math.round((now / total) * 1000));
  }

  function load(newIndex, autoplay) {
    index = (newIndex + list.length) % list.length;
    showTitle();
    if (!ready) return;
    if (autoplay) player.loadVideoById(list[index].id);
    else player.cueVideoById(list[index].id);
  }

  function toggle() {
    if (!ready) return;
    const state = player.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }

  function updateMute() {
    const muted = player?.isMuted?.() || Number(volume.value) === 0;
    mute.textContent = muted ? "×" : "♪";
    mute.setAttribute("aria-label", muted ? "取消靜音" : "靜音");
  }

  play.addEventListener("click", toggle);
  bigPlay.addEventListener("click", toggle);
  prev.addEventListener("click", () => load(index - 1, true));
  next.addEventListener("click", () => load(index + 1, true));
  seek.addEventListener("change", () => {
    if (ready) player.seekTo((Number(seek.value) / 1000) * player.getDuration(), true);
  });
  volume.addEventListener("input", () => {
    if (!ready) return;
    player.setVolume(Number(volume.value));
    if (Number(volume.value) > 0 && player.isMuted()) player.unMute();
    updateMute();
  });
  mute.addEventListener("click", () => {
    if (!ready) return;
    if (player.isMuted()) player.unMute();
    else player.mute();
    // isMuted 會延遲更新，稍後再刷新圖示
    setTimeout(updateMute, 100);
  });

  showTitle();
  setPlaying(false);

  loadYouTubeApi()
    .then((YT) => {
      player = new YT.Player(host, {
        videoId: list[index].id,
        width: "100%",
        height: "100%",
        playerVars: { controls: 0, rel: 0, playsinline: 1, modestbranding: 1, origin: location.origin },
        events: {
          onReady() {
            ready = true;
            player.setVolume(Number(volume.value));
            tick();
          },
          onStateChange(event) {
            const playing = event.data === YT.PlayerState.PLAYING;
            setPlaying(playing);
            clearInterval(timer);
            if (playing) timer = setInterval(tick, 500);
            tick();
            if (event.data === YT.PlayerState.ENDED) {
              if (multi) load(index + 1, true);
              else seek.value = "0";
            }
          },
          onError() {
            title.textContent = `${list[index].title}（無法播放）`;
          },
        },
      });
    })
    .catch(() => {
      title.textContent = "播放器載入失敗";
    });
}
