// Testversion (zeitlich begrenzt): Erzeugen über den Editor-Dialog, Spielbarkeit, Editor-Sperre, Ablauf nach 24 h,
// Sperre bleibt nach Neuladen, spätestes Verfallsdatum, zurückgestellte Uhr, normale Datei unverändert.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const FILE = process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const codeOf = html => { const a = html.indexOf('id="lm-engine">') + 15, b = html.indexOf('</' + 'script>', a); return html.slice(a, b); };
const H = 3600000;
async function fresh(file, shift, vp) {   // shift = Zeitverschiebung der Browser-Uhr in ms (vor dem Laden gesetzt)
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: vp || { width: 1360, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  if (shift) await page.addInitScript(s => { const r = Date.now.bind(Date); window.__shift = s; Date.now = () => r() + window.__shift; }, shift);
  await page.goto('file://' + file); await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof DB === 'object' && DB !== null && Engine.ticks > 5);
  return { browser, ctx, page, errors };
}
const shotScreen = async (page, name) => { await page.evaluate(() => Engine.draw()); await (await page.$('#lm-screen')).screenshot({ path: path.join(OUT, name) }); };
(async () => {
  // --- 1) Testversion über den Editor-Dialog exportieren (echter Download) ---
  let s = await fresh(FILE);
  ok(await s.page.evaluate(() => !Trial.active()), 'Normale Spieldatei: keine Testversion aktiv');
  await s.page.keyboard.press('F2'); await s.page.waitForTimeout(300);
  await s.page.click('.ed-nav button[data-page="project"]'); await s.page.waitForTimeout(150);
  await s.page.locator('#ed-root button', { hasText: 'Testversion exportieren' }).first().click(); await s.page.waitForTimeout(150);
  await s.page.screenshot({ path: path.join(OUT, 'trial_dialog.png') });
  const vals = await s.page.evaluate(() => Array.from(document.querySelectorAll('.ed-modal input')).map(i => i.value));
  ok(vals.join(',') === '24,7', 'Dialog mit Vorgaben 24 Stunden / 7 Tage: ' + vals);
  const dl = s.page.waitForEvent('download', { timeout: 15000 }); await s.page.click('.ed-modal .ed-ok'); const d = await dl;
  const tfile = path.join(OUT, 'Leinenmeister-Testversion.html'); await d.saveAs(tfile);
  ok(/_Testversion\.html$/.test(d.suggestedFilename()), 'Download: ' + d.suggestedFilename());
  ok(s.errors.length === 0, 'keine JS-Fehler beim Export' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  const t = fs.readFileSync(tfile, 'utf8'), orig = fs.readFileSync(FILE, 'utf8');
  const cfg = JSON.parse(/window\.LM_TRIAL = (\{[^}]*\});/.exec(t.slice(0, 2000))[1]);
  ok(codeOf(t) === codeOf(orig), 'Programmcode der Testversion ist identisch mit der Spieldatei');
  ok(cfg.hours === 24 && Math.abs(cfg.until - Date.now() - 8 * 24 * H) < 5 * 60000, 'Schalter: 24 Stunden Laufzeit, spätestens gültig bis ' + new Date(cfg.until).toISOString().slice(0, 16));
  // --- 2) Testversion spielen: Editor gesperrt ---
  s = await fresh(tfile, 0, { width: 700, height: 660 });
  ok(await s.page.evaluate(() => Trial.active() && !Trial.expired && !Trial.locked), 'Testversion startet normal');
  ok(await s.page.evaluate(() => document.getElementById('lm-btn-editor').style.display === 'none' && !/Editor/.test(document.getElementById('lm-keys').textContent)), 'Editor-Schaltfläche und -Hinweis ausgeblendet');
  await s.page.keyboard.press('F2'); await s.page.waitForTimeout(200);
  ok(await s.page.evaluate(() => !Engine.editorOpen && !document.querySelector('#ed-root.open')), 'F2 öffnet den Editor in der Testversion nicht');
  await s.page.evaluate(async () => { Engine.manual = true; Opt.text = 2; await LMDebug.ff(20); });
  await shotScreen(s.page, 'trial_titel.png');
  const left = await s.page.evaluate(() => Trial.leftText());
  ok(/^2[34]:\d\d$/.test(left), 'Titelbild zeigt die Restzeit: ' + left);
  await s.page.evaluate(() => LMDebug.press('a', 10));
  const items = await s.page.evaluate(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]);
  ok(items && !items.includes('EDITOR'), 'Titelmenü ohne EDITOR: ' + JSON.stringify(items));
  // Neues Spiel bis ins Zimmer
  await s.page.evaluate(async () => { await LMDebug.press('a', 30); await LMDebug.until(() => UI.layers.some(l => l.draw && String(l.draw).includes('NAME_PAGES')), 3000, 'a'); await LMDebug.press('start', 4); await LMDebug.press('a', 8); await LMDebug.until(() => World.active && !World.lock && Gfx.fade === 0, 6000, 'a'); await LMDebug.walk('RR'); });
  ok(await s.page.evaluate(() => World.active && World.mapId === 'zimmer' && World.p.x === 5), 'Testversion ist spielbar (neues Spiel, Laufen)');
  // --- 3) 25 Stunden später: Sperre während des Spiels, Spielstand gesichert ---
  await s.page.evaluate(() => { G.money = 4711; const r = Date.now.bind(Date); Date.now = () => r() + 25 * 3600000; });
  await s.page.evaluate(() => LMDebug.ff(601));
  ok(await s.page.evaluate(() => Trial.locked && !World.active && G === null), 'Nach 25 Stunden sperrt sich das laufende Spiel');
  ok(await s.page.evaluate(() => { const sv = Store.getJSON(LS + 'save.' + DB.meta.id); return !!sv && sv.money === 4711; }), 'Spielstand wurde vor der Sperre gesichert');
  await shotScreen(s.page, 'trial_abgelaufen.png');
  await s.page.evaluate(async () => { for (const k of ['a', 'start', 'b', 'down']) await LMDebug.press(k, 5); });
  ok(await s.page.evaluate(() => !World.active && UI.layers.length === 1 && !UI.layers.some(l => l.o)), 'Gesperrter Bildschirm reagiert auf keine Taste');
  // --- 4) Sperre bleibt nach dem Neuladen (erster Start liegt 25 h zurück) ---
  await s.page.evaluate(() => { const k = Trial.key(), st = Store.getJSON(k); st.first -= 25 * 3600000; st.last = st.first; Store.setJSON(k, st); });
  await s.page.reload(); await s.page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  ok(await s.page.evaluate(() => Trial.locked && !World.active && !UI.layers.some(l => l.o)), 'Nach dem Neuladen bleibt die Testversion gesperrt');
  ok(s.errors.length === 0, 'keine JS-Fehler in der Testversion' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  // --- 5) Innerhalb der 24 Stunden läuft sie auch nach Neuladen weiter ---
  s = await fresh(tfile); await s.page.evaluate(() => { const k = Trial.key(), st = Store.getJSON(k); st.first -= 23 * 3600000; st.last = Date.now(); Store.setJSON(k, st); });
  await s.page.reload(); await s.page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  ok(await s.page.evaluate(() => !Trial.locked && /^0:\d\d$|^1:00$/.test(Trial.leftText())), 'Nach 23 Stunden noch nutzbar, Restzeit ' + await s.page.evaluate(() => Trial.leftText()));
  // zurückgestellte Uhr
  await s.page.evaluate(() => { const k = Trial.key(), st = Store.getJSON(k); st.first = Date.now() - 3600000; st.last = Date.now() + 5 * 3600000; Store.setJSON(k, st); });
  await s.page.reload(); await s.page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  ok(await s.page.evaluate(() => Trial.locked), 'Zurückgestellte Systemuhr wird erkannt und sperrt'); await s.browser.close();
  // --- 6) Spätestes Verfallsdatum: frisches Profil, aber 9 Tage später ---
  s = await fresh(tfile, 9 * 24 * H);
  ok(await s.page.evaluate(() => Trial.locked && !World.active), 'Neun Tage nach dem Export startet die Datei auch in einem frischen Browser nicht mehr'); await s.browser.close();
  s = await fresh(tfile, 6 * 24 * H);
  ok(await s.page.evaluate(() => !Trial.locked && /^2[34]:\d\d$/.test(Trial.leftText())), 'Sechs Tage nach dem Export: Tester bekommt noch die vollen 24 Stunden'); await s.browser.close();
  console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
