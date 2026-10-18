"use strict";

async function settings() {
  return browser.storage.local.get(Unwall.defaults);
}

async function activeTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("Aucun onglet actif.");
  return tab;
}

async function tabSession(id) {
  const key = `tab:${id}`;
  return (await browser.storage.session.get(key))[key] || {};
}

async function state() {
  const tab = await activeTab();
  const prefs = await settings();
  const original = Unwall.originalUrl(tab.url);
  const source = original || Unwall.articleUrl(tab.url);
  return {
    ...prefs,
    site: Unwall.siteKey(source),
    excluded: source ? Unwall.isExcluded(source, prefs.excludedSites) : false,
    available: !!source,
    inReader: !!original,
    title: tab.title || "Cet article"
  };
}

async function openReader(tab, { automatic = false, reason = "", expectedUrl } = {}) {
  const source = Unwall.articleUrl(tab.url);
  const destination = Unwall.readerUrl(tab.url);
  if (!source || !destination) return { ok: false, error: "Cette adresse ne peut pas être envoyée à Unwall." };
  if (expectedUrl && Unwall.articleUrl(expectedUrl) !== source) return { ok: false };
  const previous = await tabSession(tab.id);
  if (automatic) {
    const prefs = await settings();
    if (!prefs.enabled || Unwall.isExcluded(source, prefs.excludedSites) || previous.original === source) return { ok: false };
  }
  const current = await browser.tabs.get(tab.id);
  if (current.url !== tab.url) return { ok: false };
  await browser.storage.session.set({ [`tab:${tab.id}`]: { original: source, reason, openedAt: Date.now() } });
  try {
    await browser.tabs.update(tab.id, { url: destination });
    return { ok: true };
  } catch (error) {
    await browser.storage.session.set({ [`tab:${tab.id}`]: previous });
    throw error;
  }
}

async function rescanTabs() {
  const tabs = await browser.tabs.query({});
  await Promise.allSettled(tabs.map(tab => browser.tabs.sendMessage(tab.id, { type: "RESCAN" })));
}

async function onMessage(message, sender) {
  if (message.type === "DETECTED") {
    if (!sender.tab || sender.frameId !== 0 || !["wall", "notice", "metadata"].includes(message.signal)) return { ok: false };
    const tab = await browser.tabs.get(sender.tab.id);
    if (new URL(sender.url).origin !== new URL(tab.url).origin) return { ok: false };
    return openReader(tab, { automatic: true, reason: message.reason, expectedUrl: message.url });
  }
  if (!sender.url?.startsWith(browser.runtime.getURL(""))) return { ok: false };
  switch (message.type) {
    case "GET_STATE": return state();
    case "SET_ENABLED":
      await browser.storage.local.set({ enabled: !!message.enabled });
      if (message.enabled) await rescanTabs();
      return state();
    case "TOGGLE_SITE": {
      const current = await state();
      if (!current.site) throw new Error("Aucun site à exclure.");
      const excludedSites = current.excluded
        ? current.excludedSites.filter(site => current.site !== site && !current.site.endsWith(`.${site}`))
        : [...new Set([...current.excludedSites, current.site])];
      await browser.storage.local.set({ excludedSites });
      await rescanTabs();
      return state();
    }
    case "OPEN": return openReader(await activeTab());
    case "ORIGINAL": {
      const tab = await activeTab();
      const original = Unwall.originalUrl(tab.url);
      if (!original) throw new Error("L’adresse d’origine est indisponible.");
      await browser.storage.session.set({ [`tab:${tab.id}`]: { original } });
      await browser.tabs.update(tab.id, { url: original });
      return { ok: true };
    }
    default: return { ok: false };
  }
}

browser.runtime.onMessage.addListener((message, sender) => onMessage(message, sender).catch(error => ({ ok: false, error: error.message })));
browser.tabs.onRemoved.addListener(id => browser.storage.session.remove(`tab:${id}`));
browser.webNavigation.onHistoryStateUpdated.addListener(details => {
  if (details.frameId === 0) browser.tabs.sendMessage(details.tabId, { type: "RESCAN" }).catch(() => {});
});
browser.commands?.onCommand.addListener(async command => {
  if (command === "open-reader") {
    try { await openReader(await activeTab()); } catch (error) { console.error("Unwall:", error); }
  }
});
browser.runtime.onInstalled.addListener(async () => {
  if (!browser.menus) return;
  await browser.menus.removeAll();
  browser.menus.create({ id: "unwall-link", title: "Lire avec Unwall", contexts: ["link"], targetUrlPatterns: ["http://*/*", "https://*/*"] });
  browser.menus.create({ id: "unwall-page", title: "Lire cette page avec Unwall", contexts: ["page"] });
});
browser.menus?.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "unwall-link") {
      const url = Unwall.readerUrl(info.linkUrl);
      if (url) await browser.tabs.create({ url, openerTabId: tab.id });
    } else if (info.menuItemId === "unwall-page") await openReader(tab);
  } catch (error) { console.error("Unwall:", error); }
});
