"use strict";

globalThis.Unwall = (() => {
  const defaults = { enabled: true, excludedSites: [] };
  const sensitiveKey = /^(?:access[_-]?token|token|auth|authorization|jwt|session(?:id)?|sid|password|secret|api[_-]?key|key|code|signature|sig|x-amz-.+)$/i;

  function publicUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
      if (!host.includes(".") || host.includes(":") || host.startsWith("[") || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
      if (/(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion|home|lan|localdomain)$/.test(host)) return null;
      if (host === "unwall.app" || host.endsWith(".unwall.app")) return null;
      if (url.port && !["80", "443"].includes(url.port)) return null;
      let sensitive = false;
      url.searchParams.forEach((value, key) => { if (sensitiveKey.test(key)) sensitive = true; });
      if (sensitive) return null;
      return url;
    } catch {
      return null;
    }
  }

  function articleUrl(value) {
    const url = publicUrl(value);
    if (!url) return null;
    const keys = [];
    url.searchParams.forEach((value, key) => keys.push(key));
    for (const key of keys) {
      if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.href;
  }

  function siteKey(value) {
    try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
    catch { return ""; }
  }

  function isExcluded(value, sites) {
    const host = siteKey(value);
    return sites.some(site => host === site || host.endsWith(`.${site}`));
  }

  function readerUrl(value) {
    const url = articleUrl(value);
    return url ? `https://unwall.app/${url}` : null;
  }

  function originalUrl(value) {
    try {
      const url = new URL(value);
      if (url.hostname !== "unwall.app") return null;
      let path = url.pathname.slice(1);
      if (!/^https?:\/\//.test(path)) path = `https://${path}`;
      return articleUrl(path + url.search);
    } catch { return null; }
  }

  return { defaults, publicUrl, articleUrl, siteKey, isExcluded, readerUrl, originalUrl };
})();
