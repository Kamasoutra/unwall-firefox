"use strict";

globalThis.UnwallDetector = (() => {
  const articleType = /^(?:(?:https?:\/\/)?schema\.org\/)?(?:Article|NewsArticle|AnalysisNewsArticle|OpinionNewsArticle|ReportageNewsArticle|BlogPosting|ScholarlyArticle|TechArticle)$/i;
  const wallText = /(?:article|contenu|suite|lecture|accès)[\s\S]{0,90}(?:réservé(?:e|s|es)? (?:aux|à nos) abonnés|abonn(?:ez|er|ement)|débloqu)|réservé(?:e|s|es)? (?:aux|à nos) abonnés|pour (?:continuer|poursuivre) (?:à lire|la lecture)|(?:subscribe|subscription required|subscribers? only|already a subscriber)[\s\S]{0,90}(?:read|continue|access|article)|(?:continue reading|read (?:the )?(?:full|rest of|this) article)[\s\S]{0,90}(?:subscri|sign in|log in)|(?:subscriber|subscription)[ -]only|abonnez-vous pour (?:lire|accéder)|contenido (?:exclusivo|para suscriptores)|nur für abonnenten/i;
  const markerSelector = '.paywall, #paywall, [id*="paywall" i], [class*="paywall" i], [data-testid*="paywall" i], [data-test*="paywall" i], [class*="regwall" i], [id*="regwall" i], [data-paywall="true"], [data-testid="piano-wall"], .tp-modal, .piano-paywall, .poool-widget, #poool-widget, .article__paywall, .subscription-wall';

  function structuredArticles(doc) {
    const articles = [];
    let budget = 500;
    function visit(value, depth = 0) {
      if (!value || typeof value !== "object" || depth > 12 || --budget < 0) return;
      if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
      if ([value["@type"]].flat().some(type => typeof type === "string" && articleType.test(type))) articles.push(value);
      for (const key of ["@graph", "mainEntity"]) visit(value[key], depth + 1);
    }
    for (const script of [...doc.querySelectorAll('script[type="application/ld+json"]')].slice(0, 25)) {
      if (script.textContent.length > 1_000_000) continue;
      try { visit(JSON.parse(script.textContent)); } catch {}
    }
    return articles;
  }

  function isFalse(value) { return value === false || value === "false"; }

  function paidArticle(article) {
    if (isFalse(article.isAccessibleForFree)) return true;
    return [article.hasPart].flat().some(part => part && isFalse(part.isAccessibleForFree));
  }

  function visible(element, win) {
    if (element.closest('[hidden], [inert], [aria-hidden="true"], template, script, noscript')) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = win.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    }
    return element.getClientRects().length > 0;
  }

  function detect(doc, win) {
    const url = globalThis.Unwall.publicUrl(win.location.href);
    if (!url || url.pathname === "/" || /\/(?:login|signin|sign-in|subscribe|abonnement|connexion|account|compte)(?:\/|$)/i.test(url.pathname)) return null;
    const articles = structuredArticles(doc).filter(article => {
      const page = article.mainEntityOfPage;
      const identity = article.url || (typeof page === "string" ? page : page?.["@id"]) || article["@id"];
      if (!identity) return true;
      try {
        const candidate = new URL(identity, url);
        return Unwall.siteKey(candidate.href) === Unwall.siteKey(url.href) && candidate.pathname.replace(/\/$/, "") === url.pathname.replace(/\/$/, "");
      } catch { return false; }
    });
    const ogArticle = doc.querySelector('meta[property="og:type"]')?.content?.toLowerCase() === "article";
    const articleElement = doc.querySelector("article h1, main h1[itemprop='headline'], h1[itemprop='headline']");
    const isArticle = articles.length > 0 || ogArticle || !!articleElement;
    if (!isArticle) return null;
    const marker = [...doc.querySelectorAll(markerSelector)].slice(0, 80).find(element => {
      if (!visible(element, win)) return false;
      if (/^(?:false|0)$/i.test(element.getAttribute("data-paywall") || "")) return false;
      const text = (element.innerText || element.textContent || "").trim();
      return text.length > 0 && (wallText.test(text.slice(0, 3000)) || !/newsletter/i.test(text));
    });
    if (marker) return { reason: "Un blocage de lecture est visible", signal: "wall" };
    const notice = [...doc.querySelectorAll('article p, main p, [role="dialog"], [class*="premium" i], [class*="subscriber" i]')].slice(0, 160)
      .find(element => {
        const text = (element.innerText || element.textContent || "").trim();
        return text.length < 1200 && wallText.test(text) && visible(element, win);
      });
    if (notice) return { reason: "Un accès réservé aux abonnés est annoncé", signal: "notice" };
    if (articles.some(paidArticle)) return { reason: "L’article est déclaré payant par le site", signal: "metadata" };
    return null;
  }

  return { detect, structuredArticles };
})();
