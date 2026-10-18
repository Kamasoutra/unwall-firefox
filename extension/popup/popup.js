"use strict";

const $ = id => document.getElementById(id);
let current;

function render(state) {
  current = state;
  const paused = !state.enabled || state.excluded;
  document.body.classList.toggle("paused", paused);
  $("enabled").checked = state.enabled;
  $("enabled").disabled = false;
  $("status").textContent = state.inReader ? "Votre lecteur est ouvert" : paused ? "Ouverture automatique en pause" : "Prêt à repérer les articles bloqués";
  $("site").textContent = state.site || "Aucun article public sur cet onglet";
  $("site-state").textContent = !state.available ? "INDISPONIBLE" : state.inReader ? "LECTEUR" : state.excluded ? "EN PAUSE" : "";
  $("site-description").textContent = !state.available
    ? "Ouvrez un article public. Les pages internes et les liens privés sont ignorés."
    : state.inReader ? "Revenez à la source à tout moment, sans réouverture automatique."
    : state.excluded ? "La détection est en pause ici. L’ouverture manuelle reste disponible."
    : "Si un blocage est détecté, cet article s’ouvre dans le lecteur Unwall.";
  $("open").hidden = state.inReader;
  $("open").disabled = !state.available;
  $("original").hidden = !state.inReader;
  $("exclude").disabled = !state.available;
  $("exclude").textContent = state.excluded ? "Réactiver ce site" : "Mettre ce site en pause";
  $("exception-count").textContent = state.excludedSites.length;
  $("exception-list").replaceChildren(...state.excludedSites.map(site => {
    const item = document.createElement("li");
    item.textContent = site;
    return item;
  }));
  $("exceptions").hidden = !state.excludedSites.length;
  if (!navigator.platform.includes("Mac")) document.querySelector(".key").textContent = "Alt ⇧ U";
}

async function request(message, close = false) {
  $("error").hidden = true;
  try {
    const result = await browser.runtime.sendMessage(message);
    if (result?.error || result?.ok === false) throw new Error(result.error || "Action indisponible sur cet onglet.");
    if (close) window.close();
    else render(result);
  } catch (error) {
    $("error").textContent = error.message;
    $("error").hidden = false;
    if (current) render(current);
  }
}

$("enabled").addEventListener("change", () => request({ type: "SET_ENABLED", enabled: $("enabled").checked }));
$("exclude").addEventListener("click", () => request({ type: "TOGGLE_SITE" }));
$("open").addEventListener("click", () => request({ type: "OPEN" }, true));
$("original").addEventListener("click", () => request({ type: "ORIGINAL" }, true));
request({ type: "GET_STATE" });
