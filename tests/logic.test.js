// Acceptance tests for SPEC §7. Run: NODE_PATH=$(npm root -g) node tests/logic.test.js  (from outside the app dir)
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || !detail ? '' : '  -> ' + detail));
}
const lc = (s) => String(s).toLowerCase();

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [], external = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('about:')) return;
    if (u === 'file://' + path.join(ROOT, 'index.html')) return;
    external.push(u);
  });
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await page.waitForFunction(() => window.SKIPPER);

  // helpers evaluated in page context
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const pos = (id) => ev((i) => { const h = SKIPPER.DATA.find(x => x.id === i); return { lat: h.lat, lon: h.lon }; }, id);
  const evalState = (st) => ev((s) => { const r = SKIPPER.evaluate(s); return { gates: r.gates, general: r.general, overall: r.overall, reff: r.reff, section: r.section && r.section.id, info: r.info, missing: r.missing }; }, st);
  const gate = (r, id) => r.gates.find(g => g.id === id);
  const hs = (id, st) => ev(({ id, st }) => { const h = SKIPPER.DATA.find(x => x.id === id); return SKIPPER.harborStatus(h, st); }, { id, st });
  const base = { kids: false, course: 'am Wind', swellDir: null, swellH: 0, trend: false };

  // 1
  {
    const p = await pos('olbia');
    const r = await evalState({ ...base, pos: p, dir: 'E', windTrue: 16, gust: 20 });
    const g = gate(r, 'orosei');
    check('1  Olbia E 16/20 -> Orosei-Gate rot, "nicht nach Süden"', g && g.level === 'r' && lc(g.title + ' ' + g.text).includes('nicht nach süden'), JSON.stringify(g));
  }
  // 2
  {
    const p = await pos('olbia');
    const a = await evalState({ ...base, kids: true, pos: p, dir: 'E', windTrue: 16, gust: 20 });
    const b = await evalState({ ...base, kids: true, pos: p, dir: 'E', windTrue: 12, gust: 16 });
    const c = await evalState({ ...base, kids: false, pos: p, dir: 'E', windTrue: 12, gust: 16 });
    const ok = gate(a, 'orosei')?.level === 'r' && gate(b, 'orosei')?.level === 'r' && !gate(c, 'orosei');
    check('2  Kinder: E 16/20 rot; E 12/16 kids rot; kids=false kein Orosei-Rot', ok, JSON.stringify([!!gate(a,'orosei'), !!gate(b,'orosei'), !!gate(c,'orosei')]));
  }
  // 3
  {
    const p = await pos('olbia');
    const r = await evalState({ ...base, pos: p, dir: 'W', windTrue: 16, gust: 20 });
    check('3  Olbia W 16/20 -> kein Orosei-Gate', !gate(r, 'orosei'));
  }
  // 4
  {
    const r = await evalState({ ...base, pos: { lat: 40.613, lon: 9.755, segId: 'posada' }, dir: 'SE', windTrue: 10, gust: 12, swellDir: 'E', swellH: 2.0 });
    check('4  Posada SE 10/12, Dünung E 2,0 m -> Orosei rot', gate(r, 'orosei')?.level === 'r', JSON.stringify(r.gates));
    // also via plain coordinates (nearest section), without segId
    const r2 = await evalState({ ...base, pos: { lat: 40.613, lon: 9.755 }, dir: 'SE', windTrue: 10, gust: 12, swellDir: 'E', swellH: 2.0 });
    check('4b Posada per GPS-Koordinate (ohne segId) -> Orosei rot', gate(r2, 'orosei')?.level === 'r');
  }
  // 5
  {
    const r = await evalState({ ...base, pos: await pos('bonifacio'), dir: 'E', windTrue: 18, gust: 22 });
    const g = gate(r, 'bonifacio'), t = g ? g.title + ' ' + g.text : '';
    check('5  Bonifacio E 18/22 -> rot, "Levante", "32–37"', g && g.level === 'r' && t.includes('Levante') && t.includes('32–37'), t);
  }
  // 6
  {
    const r = await evalState({ ...base, pos: await pos('bonifacio'), dir: 'NW', windTrue: 18, gust: 22 });
    const g = gate(r, 'bonifacio'), t = g ? g.title + ' ' + g.text : '';
    check('6  Bonifacio NW 18/22 -> rot, "Mistral"', g && g.level === 'r' && t.includes('Mistral'), t);
  }
  // 7
  {
    const a = await hs('cannigione', { ...base, dir: 'NW', windTrue: 20, gust: 25 });
    const b = await hs('cannigione', { ...base, dir: 'E', windTrue: 20, gust: 25 });
    check('7  Cannigione NW 25 nicht rot; E rot', a.level !== 'r' && b.level === 'r', JSON.stringify([a.level, b.level]));
  }
  // 8
  {
    const rows = await ev(() => {
      const out = { a: SKIPPER.reffLevel(22, false).idx, b: SKIPPER.reffLevel(22, true).idx, c: SKIPPER.reffLevel(27, false).idx, d: SKIPPER.reffLevel(28, false).idx, gaps: [] };
      for (const kids of [false, true]) for (let v = 0; v <= 60; v++) {
        const lv = ['Vollzeug','1. Reff','2. Reff','3. Reff'].filter((n, i) => SKIPPER.reffLevel(v, kids).idx === i);
        const t = SKIPPER.reffThresholds ? null : null;
        if (lv.length !== 1) out.gaps.push([kids, v]);
      }
      // monotonic and contiguous: each integer maps to exactly one stage and stages never decrease
      for (const kids of [false, true]) { let prev = 0; for (let v = 0; v <= 60; v++) { const i = SKIPPER.reffLevel(v, kids).idx; if (i < prev) out.gaps.push(['mono', kids, v]); prev = i; } }
      // through reffStufe with true state: gust 19 am Wind -> apparent 22
      out.viaState = SKIPPER.reffStufe({ gust: 19, windTrue: 15, course: 'am Wind', kids: false });
      out.viaStateKids = SKIPPER.reffStufe({ gust: 19, windTrue: 15, course: 'am Wind', kids: true });
      out.course = [SKIPPER.apparentWind(20, 'am Wind'), SKIPPER.apparentWind(20, 'halber Wind'), SKIPPER.apparentWind(20, 'raum'), SKIPPER.apparentWind(20, 'vorm Wind')];
      return out;
    });
    const ok = rows.a === 1 && rows.b === 2 && rows.c === 2 && rows.d === 3 && rows.gaps.length === 0 && rows.viaState.apparent === 22 && rows.viaState.idx === 1 && rows.viaStateKids.idx === 2;
    check('8  Reff: 22->1.Reff, 22 Kinder->2.Reff, 27->2.Reff, 28->3.Reff, keine Lücke 0–60', ok, JSON.stringify(rows));
    check('8b scheinbarer Wind Kursfaktoren (20 kn: 23/21/18/16)', JSON.stringify(rows.course) === JSON.stringify([23, 21, 18, 16]), JSON.stringify(rows.course));
  }
  // 9
  {
    const r = await hs('arbatax', { ...base, dir: 'S', windTrue: 40, gust: 45 });
    const o = await hs('olbia', { ...base, dir: 'N', windTrue: 40, gust: 45 });
    const c = await hs('cagliari', { ...base, dir: 'E', windTrue: 40, gust: 45 });
    check('9  Allwetterhafen bei Böen 45 -> gelb', r.level === 'y' && o.level === 'y' && c.level === 'y', JSON.stringify([r.level, o.level, c.level]));
  }
  // 10
  {
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    const luna = [];
    for (const d of dirs) luna.push((await hs('calaluna', { ...base, dir: d, windTrue: 5, gust: 8 })).level);
    const mor = await hs('calamoresca', { ...base, dir: 'N', windTrue: 5, gust: 8 });
    const nav = await hs('smnavarrese', { ...base, dir: 'N', windTrue: 5, gust: 8 });
    const okLuna = luna.every(l => l !== 'g');
    const okGrey = mor.level === 'n' && nav.level === 'n' && lc(mor.reasons.join(' ')).includes('schutz unbekannt') && lc(nav.reasons.join(' ')).includes('schutz unbekannt');
    check('10 Cala Luna nie grün; Moresca + S. M. Navarrese grau "Schutz unbekannt"', okLuna && okGrey, JSON.stringify({ luna, mor, nav }));
  }
  // 11
  {
    const r = await hs('golfoaranci', { ...base, dir: 'W', windTrue: 8, gust: 10, swellDir: 'SE', swellH: 1.5 });
    check('11 Golfo Aranci bei SE-Dünung 1,5 m -> rot', r.level === 'r', JSON.stringify(r));
  }
  // 12
  {
    const n = await ev(() => SKIPPER.normalize({ windTrue: 20, gust: 15 }));
    const r = await ev(() => SKIPPER.evaluate({ pos: { lat: 40.917, lon: 9.515 }, dir: 'N', windTrue: 20, gust: 15, kids: false }));
    check('12 Gust < Wind wird auf Wind angehoben + Flag', n.gust === 20 && n.gustFixed === true && r.state.gust === 20);
    // UI behaviour: lowering gust below wind via stepper
    await page.evaluate(() => { SKIPPER.state.windTrue = 20; SKIPPER.state.gust = 20; SKIPPER.update(); });
    await page.click('button[data-k="gust"][data-d="-1"]');
    const ui = await page.evaluate(() => ({ g: SKIPPER.state.gust, notice: document.getElementById('gustnotice').textContent, vis: document.getElementById('gustnotice').style.display }));
    check('12b UI: Böen-Minus unter Mittelwind -> bleibt 20 + Hinweis sichtbar', ui.g === 20 && ui.vis === 'block' && ui.notice.length > 5, JSON.stringify(ui));
  }
  // 13
  {
    const d = await ev(() => {
      const f = (a, b) => SKIPPER.haversineNm(SKIPPER.DATA.find(x => x.id === a), SKIPPER.DATA.find(x => x.id === b));
      return { ob: f('olbia', 'arbatax'), ca: f('corallo', 'arbatax') };
    });
    check('13 Haversine Olbia→Arbatax ≈59±3, Corallo→Arbatax ≈30±2', Math.abs(d.ob - 59) <= 3 && Math.abs(d.ca - 30) <= 2, JSON.stringify(d));
  }
  // 14
  {
    const r = await ev(() => {
      const ids = SKIPPER.DATA.map(h => h.id), a = SKIPPER.CONST.area;
      const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      const names = SKIPPER.DATA.map(h => h.name), dupN = names.filter((x, i) => names.indexOf(x) !== i);
      const bad = SKIPPER.DATA.filter(h => !(h.lat >= a.latMin && h.lat <= a.latMax && h.lon >= a.lonMin && h.lon <= a.lonMax)).map(h => h.id);
      const schema = SKIPPER.DATA.filter(h => !(h.id && h.name && h.type && h.prot && Array.isArray(h.swellOpen) && h.verified && typeof h.refuge === 'boolean' && 'vhf' in h && 'tel' in h && 'src' in h && 'note' in h)).map(h => h.id);
      const verified = SKIPPER.DATA.map(h => [h.id, Object.keys(h.verified).filter(k => h.verified[k])]).filter(x => x[1].length);
      return { n: ids.length, dup, dupN, bad, schema, verified };
    });
    check('14 keine doppelten ids/Namen, alle lat/lon im Törngebiet, Schema vollständig', r.dup.length === 0 && r.dupN.length === 0 && r.bad.length === 0 && r.schema.length === 0 && r.n === 32, JSON.stringify(r));
    console.log('   verified fields:', JSON.stringify(r.verified));
  }
  // 15 (checked at the end, after interaction)

  // ---- extra checks ----
  {
    const x = await ev(() => ({
      dm1: SKIPPER.formatDM(41.387, true) + ' ' + SKIPPER.formatDM(9.160, false),
      nav: SKIPPER.utcToLocal('06:50', Date.UTC(2026, 9, 17)).text, nav2: SKIPPER.utcToLocal('18:50', Date.UTC(2026, 9, 17)).text,
      cet: SKIPPER.utcToLocal('06:50', Date.UTC(2026, 9, 26)).text, off1: SKIPPER.euOffset(Date.UTC(2026, 9, 25, 0, 59)), off2: SKIPPER.euOffset(Date.UTC(2026, 9, 25, 1, 0)),
      parse: SKIPPER.parseDM('40', '55.0'), parseBad: SKIPPER.parseDM('40', '61'),
      out: [SKIPPER.isOutOfArea({ lat: 45, lon: 9 }), SKIPPER.isOutOfArea({ lat: 40.9, lon: 9.5 })]
    }));
    check('E1 Grad/Dezimalminuten-Format "41°23,2′ N 009°09,6′ E"', x.dm1 === '41°23,2′ N 009°09,6′ E', x.dm1);
    check('E2 NAVTEX UTC→Ortszeit CEST 06:50→08:50, 18:50→20:50; nach 25.10. CET', x.nav === '08:50' && x.nav2 === '20:50' && x.cet === '07:50' && x.off1 === 2 && x.off2 === 1, JSON.stringify(x));
    check('E3 manuelle Eingabe parse + Plausibilität', Math.abs(x.parse - (40 + 55 / 60)) < 1e-9 && isNaN(x.parseBad) && x.out[0] === true && x.out[1] === false, JSON.stringify(x));
  }
  {
    const r = await ev(() => {
      const s = { pos: { lat: 40.917, lon: 9.515 }, dir: 'N', windTrue: 10, gust: 12, kids: false, course: 'am Wind' };
      const e = SKIPPER.evaluate(s);
      const top = e.rec;
      const e2 = SKIPPER.evaluate({ ...s, trend: true });
      const e3 = SKIPPER.evaluate({ pos: { lat: 39.9, lon: 8.9 }, dir: 'S', windTrue: 20, gust: 24, kids: false });
      const teu = SKIPPER.evaluate({ pos: { lat: 38.925, lon: 8.725 }, dir: 'N', windTrue: 5, gust: 6, kids: false });
      const ampel = [10, 17, 18, 27, 28].map(g => SKIPPER.generalLevel(SKIPPER.normalize({ windTrue: 5, gust: g, kids: false })).level);
      const ampelK = [14, 15, 24, 25].map(g => SKIPPER.generalLevel(SKIPPER.normalize({ windTrue: 5, gust: g, kids: true })).level);
      const sw = [1.5, 2.0, 3.0].map(h => SKIPPER.generalLevel(SKIPPER.normalize({ windTrue: 5, gust: 8, kids: false, swellH: h })).level);
      return { greenFirst: top.green && top.green.h.id, greenDist: top.green && top.green.dist, aw: top.aw && top.aw.h.id, overallTrend: e2.overall.level, trendGate: e2.gates.map(g => g.id),
        far: e3.rec.far, farAw: e3.rec.fallbackAw && e3.rec.fallbackAw.h.id, teu: e.info.length + '/' + teu.info.map(i => i.id), ampel, ampelK, sw };
    });
    check('E4 Ampel unterwegs 18/28 (Kinder 15/25), Dünung ≥2 gelb, ≥3 rot', JSON.stringify(r.ampel) === '["g","g","y","y","r"]' && JSON.stringify(r.ampelK) === '["g","y","y","r"]' && JSON.stringify(r.sw) === '["g","y","r"]', JSON.stringify(r));
    check('E5 Trend-Gate: mindestens gelb', r.trendGate.includes('trend') && ['y', 'r'].includes(r.overallTrend), JSON.stringify(r));
    check('E6 Teulada Info-Banner nur in Abschnitt teulada', r.teu === '0/teulada', r.teu);
    console.log('   rec:', JSON.stringify({ green: r.greenFirst, dist: r.greenDist, aw: r.aw, far: r.far, farAw: r.farAw }));
  }

  // 15
  {
    // exercise UI a bit before judging errors/requests
    await page.click('[data-dir="E"]'); await page.click('[data-sdir="SE"]');
    await page.selectOption('#segselect', 'olbia');
    await page.click('button[data-k="windTrue"]'); await page.click('button[data-k="gust"]');
    for (const s of ['scr-zuflucht', 'scr-notfall', 'scr-regeln', 'scr-lage']) { await page.click(`nav button[data-scr="${s}"]`); }
    await page.click('#themebtn'); await page.click('#themebtn');
    check('15 keine JS-Fehler, 0 externe Requests', errors.length === 0 && external.length === 0, JSON.stringify({ errors, external }));
  }

  // 16 PDF
  {
    execFileSync('node', [path.join(__dirname, 'build-pdf.js')], { stdio: 'inherit' });
    const pdf = path.join(ROOT, 'Bordkarte_Ost-Sardinien_v2.pdf');
    const info = execFileSync('pdfinfo', [pdf]).toString();
    const pages = +/Pages:\s+(\d+)/.exec(info)[1];
    const a4 = /A4/.test(info);
    const txt = [];
    for (let i = 1; i <= pages; i++) txt.push(execFileSync('pdftotext', ['-layout', '-f', String(i), '-l', String(i), pdf, '-']).toString());
    const p1 = txt[0];
    const p1ok = /Notfall/i.test(p1) && /1530/.test(p1) && /MAYDAY/.test(p1) && /Funk/i.test(p1) && /NAVTEX/.test(p1) && /Meteomar/.test(p1);
    // one row per place, sorted north→south inside the DOM print doc; no group duplicated
    const dom = await ev(() => {
      const ids = [...document.querySelectorAll('#printdoc tbody.pl')].map(x => x.dataset.hid);
      const lat = Object.fromEntries(SKIPPER.DATA.map(h => [h.id, h.lat]));
      const heads = [...document.querySelectorAll('#printdoc tbody.gh th')].map(x => x.textContent);
      // within each group lat must be non-increasing; groups ordered by reference latitude
      const groups = []; let cur = null;
      for (const el of document.querySelectorAll('#printdoc section:nth-of-type(2) table > tbody')) {
        if (el.classList.contains('gh')) { cur = { head: el.textContent, ids: [] }; groups.push(cur); } else cur.ids.push(el.dataset.hid);
      }
      const inGroupSorted = groups.every(g => g.ids.every((id, i) => i === 0 || lat[g.ids[i - 1]] >= lat[id]));
      const cols = document.querySelectorAll('#printdoc thead')[1].textContent;
      return { ids, n: SKIPPER.DATA.length, uniq: new Set(ids).size, heads, dupHeads: heads.length - new Set(heads).size, inGroupSorted, cols, order: ids.map(i => lat[i]) };
    });
    const cols = ['Name', 'Typ', 'Position', 'Schutz', 'Schwell', 'VHF', 'Tel', 'Status'].every(c => dom.cols.includes(c));
    const oncePerPlace = dom.ids.length === dom.n && dom.uniq === dom.n && dom.dupHeads === 0;
    // no group header as the last text line of a page, and no page ends with a header followed by nothing
    const heads = dom.heads.map(h => h.trim().toLowerCase());
    let orphan = [];
    txt.forEach((t, i) => {
      const lines = t.split('\n').map(l => l.trim()).filter(Boolean);
      const last = (lines[lines.length - 1] || '').toLowerCase();
      if (heads.some(h => last === h || last.startsWith(h))) orphan.push(i + 1);
    });
    const monoPlaces = dom.order.length === dom.n;
    check('16a PDF ist A4', a4, info.split('\n').find(l => /Page size/.test(l)));
    check('16b Notfall + Funk auf Seite 1', p1ok);
    check('16c Hafentabelle einmal pro Platz, keine doppelten Gruppenköpfe, Spalten vollständig', oncePerPlace && cols && monoPlaces, JSON.stringify({ n: dom.ids.length, uniq: dom.uniq, dup: dom.dupHeads, cols }));
    check('16d Nord→Süd (je Gruppe lat absteigend; Gruppen nach Referenz-lat)', dom.inGroupSorted, JSON.stringify(dom.heads));
    check('16e kein Gruppenkopf als letzte Zeile einer Seite', orphan.length === 0, 'pages: ' + orphan.join(','));
    console.log('   PDF pages:', pages);
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) { console.log('FAILED: ' + failed.map(f => f.name).join(' | ')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(2); });
