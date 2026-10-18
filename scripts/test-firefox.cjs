const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { Builder, By, until } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const { download } = require("geckodriver");

const root = path.resolve(__dirname, "..");
const android = process.env.UNWALL_ANDROID === "1";
const manifest = require("../extension/manifest.json");
const host = "news.unwall-fixture.org";
const source = route => `http://${host}/${route}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const schema = paid => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "NewsArticle", isAccessibleForFree: !paid })}</script>`;

const server = http.createServer((request, response) => {
  const route = new URL(request.url, `http://${host}`).pathname;
  const paid = route.includes("paid");
  const dynamic = route.includes("dynamic");
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html lang="fr"><head><title>Journal de test — ${route}</title><meta property="og:type" content="article">${schema(paid)}</head><body style="font:20px Georgia;max-width:760px;margin:80px auto"><article><h1>Le journal des lectures sans murs</h1><p>Une page de test locale pour vérifier le comportement réel de l’extension Firefox.</p>${paid ? '<div class="paywall">La suite de cet article est réservée aux abonnés.</div>' : '<p>Abonnez-vous à notre newsletter.</p>'}</article>${dynamic ? '<script>setTimeout(()=>{const wall=document.createElement("div");wall.className="paywall";wall.textContent="Subscribe to continue reading this article";document.querySelector("article").append(wall)},1800)</script>' : ''}</body></html>`);
});

let driver;
async function main() {
  await fs.mkdir(path.join(root, "artifacts"), { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const options = new firefox.Options()
    .setPreference("network.proxy.type", 1)
    .setPreference("network.proxy.http", process.env.UNWALL_PROXY_HOST || (android ? "10.0.2.2" : "127.0.0.1"))
    .setPreference("network.proxy.http_port", port)
    .setPreference("network.proxy.share_proxy_settings", false)
    .setPreference("network.proxy.no_proxies_on", "localhost,127.0.0.1")
    .setPreference("browser.shell.checkDefaultBrowser", false)
    .setPreference("browser.tabs.warnOnClose", false);
  if (android) {
    options.enableMobile(process.env.FIREFOX_ANDROID_PACKAGE || "org.mozilla.firefox", process.env.FIREFOX_ANDROID_ACTIVITY || null);
    options.set("moz:firefoxOptions", {
      ...options.get("moz:firefoxOptions"),
      androidDeviceSerial: process.env.ANDROID_SERIAL || "emulator-5560",
      androidIntentArguments: ["-a", "android.intent.action.VIEW", "-d", "about:blank", "--ez", "performancetest", "true"]
    });
  } else {
    options.setBinary(process.env.FIREFOX_BINARY || "/Applications/Firefox.app/Contents/MacOS/firefox").addArguments("-no-remote");
  }
  const binary = await download();
  const service = new firefox.ServiceBuilder(binary).addArguments("--allow-system-access").setStdio(process.env.UNWALL_WEBDRIVER_LOG ? "inherit" : "ignore");
  if (process.env.UNWALL_WEBDRIVER_LOG) service.addArguments("--log", "debug");
  if (android) service.addArguments("--android-storage", "sdcard");
  driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options)
    .setFirefoxService(service).build();
  await driver.manage().setTimeouts({ pageLoad: 45000, script: 20000 });
  if (!android) await driver.manage().window().setRect({ width: 1100, height: 900 });
  await driver.installAddon(process.env.UNWALL_XPI || path.join(root, `dist/unwall-firefox-${manifest.version}.xpi`), true);
  await driver.setContext("chrome");
  const popupUrl = await driver.executeScript('return WebExtensionPolicy.getByID("unwall-reader@kama.local").getURL("popup/popup.html")');
  await driver.setContext("content");
  await driver.get(source("free"));
  await pause(1700);
  assert.equal(await driver.getCurrentUrl(), source("free"));
  console.log("PASS article gratuit et newsletter laissés intacts");
  const articleHandle = await driver.getWindowHandle();
  await driver.switchTo().newWindow("tab");
  const controlHandle = await driver.getWindowHandle();
  await driver.get(popupUrl);
  await driver.wait(until.elementIsEnabled(driver.findElement(By.id("enabled"))), 10000);
  const invoke = async (fn, ...args) => {
    if (await driver.getWindowHandle() !== controlHandle) await driver.switchTo().window(controlHandle);
    return driver.executeAsyncScript(`const done=arguments[arguments.length-1]; (${fn})(...Array.from(arguments).slice(0,-1)).then(done,e=>done({error:e.message}));`, ...args);
  };
  const tabId = await invoke(async url => (await browser.tabs.query({})).find(tab => tab.url === url).id, source("free"));
  const message = async payload => {
    await invoke(async id => browser.tabs.update(id, { active: true }), tabId);
    const result = await invoke(async value => browser.runtime.sendMessage(value), payload);
    if (result?.error || result?.ok === false) throw new Error(JSON.stringify({ payload, result }));
    return result;
  };
  const navigate = async route => {
    await driver.switchTo().window(articleHandle);
    await driver.get(source(route));
  };
  const assertSource = async route => {
    await pause(1700);
    await driver.switchTo().window(articleHandle);
    assert.equal(await driver.getCurrentUrl(), source(route));
  };

  await message({ type: "SET_ENABLED", enabled: false });
  await navigate("paid-paused");
  await assertSource("paid-paused");
  console.log("PASS pause globale respectée");

  const excluded = await message({ type: "TOGGLE_SITE" });
  assert.equal(excluded.excluded, true);
  await message({ type: "SET_ENABLED", enabled: true });
  await assertSource("paid-paused");
  console.log("PASS exception par site respectée");

  const resumed = await message({ type: "TOGGLE_SITE" });
  assert.equal(resumed.excluded, false);
  await driver.switchTo().window(articleHandle);
  await driver.wait(async () => (await driver.getCurrentUrl()).startsWith("https://unwall.app/"), 20000);
  assert.equal(await driver.getCurrentUrl(), `https://unwall.app/${source("paid-paused")}`);
  console.log("PASS réactivation et ouverture automatique dans Unwall");

  const original = await message({ type: "ORIGINAL" });
  assert.equal(original.ok, true);
  await driver.switchTo().window(articleHandle);
  await driver.wait(until.urlIs(source("paid-paused")), 10000);
  await assertSource("paid-paused");
  console.log("PASS retour à l’original sans boucle");

  await navigate("dynamic");
  await driver.wait(async () => (await driver.getCurrentUrl()).startsWith("https://unwall.app/"), 20000);
  console.log("PASS mur ajouté après chargement détecté");

  await message({ type: "SET_ENABLED", enabled: false });
  await navigate("free-manual");
  const opened = await message({ type: "OPEN" });
  assert.equal(opened.ok, true);
  await driver.switchTo().window(articleHandle);
  await driver.wait(async () => (await driver.getCurrentUrl()).startsWith("https://unwall.app/"), 10000);
  console.log("PASS ouverture manuelle pendant la pause");

  await message({ type: "SET_ENABLED", enabled: true });
  await navigate("paid-history");
  await driver.wait(async () => (await driver.getCurrentUrl()).startsWith("https://unwall.app/"), 15000);
  await driver.navigate().back();
  await driver.wait(until.urlIs(source("paid-history")), 10000);
  await assertSource("paid-history");
  console.log("PASS bouton Précédent sans boucle de redirection");

  await message({ type: "SET_ENABLED", enabled: true });
  await navigate("free-popup");
  await invoke(async id => browser.tabs.update(id, { active: true }), tabId);
  const popupState = await invoke(async () => browser.runtime.sendMessage({ type: "GET_STATE" }));
  if (android) {
    await driver.switchTo().window(articleHandle);
    await driver.get(popupUrl);
    await driver.wait(async () => driver.executeScript('return innerWidth > 0 && document.body.getBoundingClientRect().height > 0'), 10000);
    await driver.executeScript('render(arguments[0])', popupState);
  } else {
    await invoke(async value => { render(value); return true; }, popupState);
  }
  const popup = await driver.findElement(By.css("body")).takeScreenshot();
  await fs.writeFile(path.join(root, android ? "artifacts/popup-android.png" : "artifacts/popup.png"), popup, "base64");
  assert.equal(popupState.site, host);
  assert.equal(popupState.enabled, true);
  console.log(`PASS interface du popup rendue dans Firefox ${android ? "Android" : "bureau"}`);
  if (android) {
    assert.equal(await driver.executeScript('return document.body.classList.contains("mobile")'), true);
    assert.equal(await driver.executeScript('return document.documentElement.scrollWidth <= innerWidth'), true);
    assert.equal(await driver.executeScript('return document.querySelector("footer").hidden'), true);
    console.log("PASS interface tactile sans débordement ni raccourci clavier bureau");
  }

  if (process.env.LIVE_ARTICLE_URL) {
    await driver.switchTo().window(articleHandle);
    await driver.get(process.env.LIVE_ARTICLE_URL);
    await driver.wait(async () => (await driver.getCurrentUrl()).startsWith("https://unwall.app/"), 30000);
    console.log("PASS article réel détecté et transmis à Unwall");
    await pause(15000);
    await fs.writeFile(path.join(root, "artifacts/live-reader.png"), await driver.takeScreenshot(), "base64");
    await fs.writeFile(path.join(root, "artifacts/live-reader.txt"), await driver.findElement(By.css("body")).getText());
    const frames = await driver.findElements(By.css("iframe"));
    const observations = [];
    for (let i = 0; i < frames.length; i++) {
      try {
        await driver.switchTo().frame(frames[i]);
        const text = await driver.findElement(By.css("body")).getText();
        await fs.writeFile(path.join(root, `artifacts/live-frame-${i}.txt`), text);
        observations.push({ frame: i, characters: text.length, blocked: /requête n.a pas pu aboutir|access denied|reserved for subscribers|réservé.{0,20}abonnés|request blocked|enable javascript and cookies|known limitation|paywall enforced/i.test(text) });
      } catch (error) { console.log(`Frame ${i}: ${error.message.slice(0, 120)}`); }
      finally { await driver.switchTo().defaultContent(); }
    }
    console.log("OBSERVATION lecteur distant (récupération intégrale à examiner) :", observations);
  }
}

main().catch(async error => {
  console.error(error);
  process.exitCode = 1;
  if (driver) {
    try { await fs.writeFile(path.join(root, "artifacts/failure.png"), await driver.takeScreenshot(), "base64"); } catch {}
    try {
      await driver.setContext("chrome");
      console.error("FIREFOX ERRORS", await driver.executeScript('return Services.console.getMessageArray().map(m=>m.message).filter(m=>/unwall|ReferenceError|TypeError/i.test(m)).slice(-20)'));
      await driver.setContext("content");
    } catch {}
  }
}).finally(async () => {
  if (driver) await driver.quit();
  await new Promise(resolve => server.close(resolve));
});
