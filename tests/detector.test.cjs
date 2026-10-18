const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "../extension");

function page(html, url = "https://news.publisher.org/articles/example") {
  const dom = new JSDOM(html, { url, runScripts: "outside-only" });
  const win = dom.window;
  win.HTMLElement.prototype.getClientRects = function () { return [{ width: 100, height: 30 }]; };
  win.eval(fs.readFileSync(path.join(root, "shared.js"), "utf8"));
  win.eval(fs.readFileSync(path.join(root, "detector.js"), "utf8"));
  return { win, detect: () => win.UnwallDetector.detect(win.document, win), close: () => win.close() };
}

function check(html, expected, url) {
  const p = page(html, url);
  try { assert.equal(p.detect()?.signal ?? null, expected); } finally { p.close(); }
}

const schema = object => `<script type="application/ld+json">${JSON.stringify(object)}</script>`;
const article = content => `<meta property="og:type" content="article"><article><h1>Un titre</h1>${content}</article>`;

test("article payant déclaré en JSON-LD, graphe et hasPart", () => {
  check(schema({ "@type": "NewsArticle", isAccessibleForFree: false }), "metadata");
  check(schema({ "@graph": [{ "@type": ["Article", "NewsArticle"], isAccessibleForFree: "false" }] }), "metadata");
  check(schema({ "@type": "Article", hasPart: [{ isAccessibleForFree: false }] }), "metadata");
});

test("article gratuit et données JSON invalides ignorés", () => {
  check(schema({ "@type": "NewsArticle", isAccessibleForFree: true }), null);
  check('<script type="application/ld+json">{invalid}</script>' + article("<p>Lecture libre.</p>"), null);
});

test("détecte les murs visibles français et anglais", () => {
  check(article('<div class="paywall">Abonnez-vous pour lire la suite</div>'), "wall");
  check(article('<p>La suite de cet article est réservée aux abonnés.</p>'), "notice");
  check(article('<p>Subscribe to continue reading this article</p>'), "notice");
  check(article('<p>Read the full article with a subscription</p>'), "notice");
});

test("ignore les murs masqués et les newsletters", () => {
  for (const hide of ['hidden', 'style="display:none"', 'style="visibility:hidden"', 'aria-hidden="true"']) {
    check(article(`<div ${hide}><div class="paywall">Subscribe to continue reading</div></div>`), null);
  }
  check(article('<div class="paywall-newsletter">Subscribe to our newsletter</div>'), null);
  check(article('<p>Abonnez-vous à notre newsletter</p>'), null);
});

test("ignore les pages d’accueil, catégories et offres d’abonnement", () => {
  check(article('<div class="paywall">Contenu payant</div>'), null, "https://news.publisher.org/");
  check('<h1>Nos offres</h1><div class="paywall">Abonnez-vous</div>', null);
  check(article('<div class="paywall">Abonnez-vous</div>'), null, "https://news.publisher.org/abonnement/offres");
  check(schema({ "@type": "ItemList", itemListElement: [{ item: { "@type": "NewsArticle", isAccessibleForFree: false } }] }), null);
  check(schema({ "@type": "NewsArticle", url: "https://news.publisher.org/other", isAccessibleForFree: false }), null);
});

test("une page non éditoriale n’est pas un article", () => {
  check('<h1>Mon compte</h1><p>Article réservé aux abonnés</p>', null);
  check(schema({ "@type": "Product", isAccessibleForFree: false }), null);
});

test("adresses internes, privées, sensibles et Unwall refusées", () => {
  const p = page("");
  try {
    for (const url of ["about:config", "file:///tmp/a", "javascript:alert(1)", "http://localhost/a", "http://192.168.1.8/a", "http://127.1/a", "http://[::1]/a", "http://printer.local/a", "http://a.internal/a", "https://unwall.app/a", "https://api.unwall.app/a", "https://user:pass@publisher.org/a", "https://publisher.org:9000/a", "https://publisher.org/a?access_token=private", "https://publisher.org/a?X-Amz-Signature=private"]) {
      assert.equal(p.win.Unwall.readerUrl(url), null, url);
    }
  } finally { p.close(); }
});

test("le lecteur préserve l’URL utile et nettoie seulement le suivi", () => {
  const p = page("");
  try {
    const source = "https://publisher.org/article?id=42&lang=fr&utm_source=email&fbclid=tracking#paragraph";
    const target = p.win.Unwall.readerUrl(source);
    assert.equal(target, "https://unwall.app/https://publisher.org/article?id=42&lang=fr");
    assert.equal(p.win.Unwall.originalUrl(target), "https://publisher.org/article?id=42&lang=fr");
    assert.equal(p.win.Unwall.originalUrl("https://unwall.app/publisher.org/article?id=42"), "https://publisher.org/article?id=42");
    assert.equal(p.win.Unwall.originalUrl("https://unwall.app/"), null);
    assert.equal(p.win.Unwall.isExcluded("https://news.publisher.org/a", ["publisher.org"]), true);
    assert.equal(p.win.Unwall.isExcluded("https://notpublisher.org/a", ["publisher.org"]), false);
  } finally { p.close(); }
});

test("fonctionne avec les itérateurs URLSearchParams isolés de Firefox", () => {
  const p = page("");
  try {
    p.win.URLSearchParams.prototype.keys = () => { throw new TypeError("URLSearchParams iterator unavailable across compartments"); };
    assert.equal(p.win.Unwall.readerUrl("https://publisher.org/story?id=42&utm_source=mail"), "https://unwall.app/https://publisher.org/story?id=42");
    assert.equal(p.win.Unwall.readerUrl("https://publisher.org/story?token=private"), null);
  } finally { p.close(); }
});
