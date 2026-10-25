import { renderSettings } from "./views/settings.js";
import { renderStart } from "./views/start.js";
import { renderLive } from "./views/live.js";
import { renderGameList, renderGame } from "./views/game.js";
import { renderSeason } from "./views/season.js";
import { loadDraft } from "./storage.js";

function render() {
  const key = location.hash.replace("#/", "");
  const view = document.getElementById("view");
  view.onclick = view.onchange = null; // the views set handlers on this element
  if (key === "einstellungen") renderSettings(view);
  else if (key === "spiel") renderLive(view);
  else if (key === "auswertung") renderGameList(view);
  else if (key === "saison") renderSeason(view);
  else if (key.startsWith("auswertung/")) renderGame(view, key.slice("auswertung/".length));
  else renderStart(view);
}

window.addEventListener("hashchange", render);

// A game that is still running (crash copy) is resumed directly on app start.
if (!location.hash && (await loadDraft().catch(() => null))) location.hash = "#/spiel";
else render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
