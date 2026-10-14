// Generates 390x844 screenshots into ../screens
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const out = path.join(root, 'screens');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, geolocation: { latitude: 40.917, longitude: 9.515, accuracy: 8 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + path.join(root, 'index.html'));
  const shot = (n, full = true) => page.screenshot({ path: path.join(out, n + '.png'), fullPage: full });
  const go = async (scr) => { await page.click(`nav button[data-scr="${scr}"]`); };
  const set = (st) => page.evaluate((s) => { Object.assign(SKIPPER.state, s); SKIPPER.update(); }, st);

  await shot('01-lage-leer');
  // scenario A: Orosei stop from Olbia (GPS via UI)
  await page.click('#btn-gps'); await page.waitForTimeout(500);
  await set({ dir: 'E', windTrue: 16, gust: 20, swellDir: 'E', swellH: 1.0 });
  await shot('02-lage-orosei-stopp-ab-olbia');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('02b-lage-orosei-viewport', false);
  await go('scr-zuflucht'); await shot('03-zuflucht-olbia-E');
  // scenario B: Mistral Bonifacio
  await go('scr-lage');
  await set({ pos: { lat: 41.387, lon: 9.160, src: 'segment', segId: 'bonifacio', t: Date.now() }, dir: 'NW', windTrue: 18, gust: 22, swellDir: null, swellH: 0, kids: true });
  await shot('04-lage-mistral-bonifacio');
  await go('scr-zuflucht'); await shot('05-zuflucht-bonifacio-NW');
  // other views
  await go('scr-notfall');
  await page.fill('#f-name', 'ESEMPIO'); await page.click('#btn-mypos'); await page.waitForTimeout(500);
  await shot('06-notfall');
  await page.fill('#f-name', '');
  await go('scr-regeln'); await shot('07-regeln');
  // manual position flow
  await go('scr-lage');
  await page.evaluate(() => { SKIPPER.state.pos = null; SKIPPER.update(); });
  await page.click('#det-manual summary'); await page.fill('#latd', '40'); await page.fill('#latm', '55.0'); await page.fill('#lond', '9'); await page.fill('#lonm', '31.0'); await page.click('#btn-manual');
  await set({ dir: 'W', windTrue: 12, gust: 14, kids: false });
  await shot('08-lage-gruen-manuell');
  // night mode
  await page.click('#themebtn');
  await set({ pos: { lat: 40.917, lon: 9.515, src: 'segment', segId: 'olbia', t: Date.now() }, dir: 'E', windTrue: 16, gust: 20, swellDir: 'SE', swellH: 1.5, kids: true });
  await shot('09-nacht-lage');
  await go('scr-zuflucht'); await shot('10-nacht-zuflucht');
  await go('scr-notfall'); await shot('11-nacht-notfall');
  await go('scr-regeln'); await shot('12-nacht-regeln');
  await browser.close();
  console.log('errors:', JSON.stringify(errs));
})().catch(e => { console.error(e); process.exit(1); });
