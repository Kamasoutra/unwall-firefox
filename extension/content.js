"use strict";

(() => {
  if (window.top !== window || !Unwall.publicUrl(location.href)) return;
  let timer;
  let lastReport = "";
  let preferences;

  async function scan() {
    if (!preferences?.enabled || Unwall.isExcluded(location.href, preferences.excludedSites) || document.visibilityState === "hidden") return;
    const detection = UnwallDetector.detect(document, window);
    if (!detection) return;
    const key = `${location.href}:${detection.signal}`;
    if (key === lastReport) return;
    lastReport = key;
    try {
      const result = await browser.runtime.sendMessage({ type: "DETECTED", url: location.href, ...detection });
      if (result?.error) console.warn("Unwall:", result.error);
      if (!result?.ok) lastReport = "";
    } catch { lastReport = ""; }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; scan(); }, 650);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden", "content", "data-paywall"]
  });
  browser.runtime.onMessage.addListener(message => {
    if (message.type === "RESCAN") { lastReport = ""; schedule(); }
  });
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("pageshow", () => { lastReport = ""; schedule(); });
  window.addEventListener("popstate", () => { lastReport = ""; schedule(); });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !preferences) return;
    for (const key of ["enabled", "excludedSites"]) {
      if (changes[key]) preferences[key] = changes[key].newValue ?? Unwall.defaults[key];
    }
    lastReport = "";
    schedule();
  });
  browser.storage.local.get(Unwall.defaults).then(value => { preferences = value; schedule(); });
})();
