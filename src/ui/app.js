import { fetchJson } from "../core/fetcher.js";
import { loadCache, saveCache } from "../core/cache.js";
import { validateStandings } from "../core/schema.js";
import { buildJiangsuCanvasModel } from "../canvases/jiangsu-standings.js";

const elements = {
  refresh: document.querySelector("#refresh"),
  status: document.querySelector("#status"),
  content: document.querySelector("#content"),
  updatedAt: document.querySelector("#updated-at"),
  body: document.querySelector("#standings-body"),
  sourceState: document.querySelector("#source-state")
};

function formatUpdatedAt(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(new Date(value));
}

function showStatus(message, type = "loading") {
  elements.status.className = `status ${type}`;
  elements.status.innerHTML = type === "loading" ? `<span class="spinner" aria-hidden="true"></span><span>${message}</span>` : `<span>${message}</span>`;
  elements.status.hidden = false;
}

function render(data, { stale = false } = {}) {
  const model = buildJiangsuCanvasModel(data, { stale });
  elements.updatedAt.textContent = formatUpdatedAt(model.updatedAt);
  elements.sourceState.textContent = stale ? "缓存数据" : "官方快照";
  elements.body.replaceChildren();

  for (const [index, row] of model.rows.entries()) {
    if (index === data.qualification.count) {
      const cut = document.createElement("tr");
      cut.className = "cut-line";
      cut.innerHTML = `<td colspan="10"><div>${model.qualificationLabel}</div></td>`;
      elements.body.append(cut);
    }
    const tr = document.createElement("tr");
    tr.className = row.qualified ? "qualified" : "outside";
    const trendClass = row.trend > 0 ? "up" : row.trend < 0 ? "down" : "";
    const diffClass = row.goalDifference > 0 ? "positive" : row.goalDifference < 0 ? "negative" : "";
    tr.innerHTML = `
      <td><span class="rank-badge">${row.rank}</span></td>
      <td class="trend ${trendClass}">${row.trendLabel}</td>
      <td class="team-cell"><strong>${row.team.name}</strong><span>JIANGSU CITY</span></td>
      <td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td>
      <td>${row.goalsFor}/${row.goalsAgainst}</td>
      <td class="goal-diff ${diffClass}">${row.goalDifferenceLabel}</td>
      <td class="points">${row.points}</td>`;
    elements.body.append(tr);
  }

  elements.content.hidden = false;
  if (stale) showStatus("数据获取失败，正在显示上一次成功更新的数据。", "warning");
  else elements.status.hidden = true;
}

async function refresh() {
  elements.refresh.disabled = true;
  showStatus("正在更新积分榜…");
  try {
    const raw = await fetchJson(`./data/standings.json?t=${Date.now()}`);
    const data = validateStandings(raw);
    saveCache(data);
    render(data);
  } catch (error) {
    const cached = loadCache();
    if (cached?.data) {
      try { render(validateStandings(cached.data), { stale: true }); }
      catch { showStatus("缓存数据无效，暂时无法获取比赛数据。", "error"); }
    } else {
      elements.content.hidden = true;
      showStatus(error?.name === "ValidationError" ? "积分榜数据格式无效，请稍后重试。" : "暂时无法获取比赛数据。", "error");
    }
  } finally {
    elements.refresh.disabled = false;
  }
}

elements.refresh.addEventListener("click", refresh);
refresh();
