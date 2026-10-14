// Renders index.html with its @media print stylesheet to Bordkarte_Ost-Sardinien_v2.pdf (A4).
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(root, 'index.html'));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(root, 'Bordkarte_Ost-Sardinien_v2.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('PDF written');
})().catch(e => { console.error(e); process.exit(1); });
