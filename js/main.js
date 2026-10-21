import { renderSettings } from "./views/settings.js";
import { renderStart } from "./views/start.js";
import { renderLive } from "./views/live.js";
import { loadDraft } from "./storage.js";

function render() {
  const key = location.hash.replace("#/", "");
  const view = document.getElementById("view");
  view.onclick = view.onchange = null; // the views set handlers on this element
  if (key === "einstellungen") renderSettings(view);
  else if (key === "spiel") renderLive(view);
  else if (key === "auswertung") view.innerHTML = `<a class="back" href="#/start">← Spielstart</a><h1>Auswertung</h1>`;
  else renderStart(view);
}

window.addEventListener("hashchange", render);

// A game that is still running (crash copy) is resumed directly on app start.
if (!location.hash && (await loadDraft().catch(() => null))) location.hash = "#/spiel";
else render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
