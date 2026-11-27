// Trennung von Spiel und Editor (seit 1.1.1): Animora-Morgenrot.html ist das reine Spiel OHNE Editor,
// der Editor steckt nur in Animora-Morgenrot-Editor.html (startet im Editor; mit #spiel am Titelbild).
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const FILE = process.env.LM_FILE || path.join(__dirname, '..', 'Animora-Morgenrot.html'), EDFILE = FILE.replace(/\.html$/, '-Editor.html');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
async function fresh(url, vp) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: vp || { width: 1360, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof DB === 'object' && DB !== null); await page.waitForTimeout(400);
  return { browser, page, errors };
}
const codeOf = html => { const a = html.indexOf('id="lm-engine">') + 15, b = html.indexOf('</' + 'script>', a); return html.slice(a, b); };
(async () => {
  const game = fs.readFileSync(FILE, 'utf8'), ed = fs.readFileSync(EDFILE, 'utf8');
  // 1) Die Spieldatei enthält keinen Editor
  ok(!/\nconst Editor\b/.test(game) && !/\nconst ED_CSS\b/.test(game) && game.split('id="lm-engine"')[0].indexOf('LM_START') < 0, 'Animora-Morgenrot.html enthält keinen Editor-Code und keinen Start-Schalter');
  ok(/\nconst Editor\b/.test(ed) && ed.length - game.length > 150000, 'Der Editor steckt nur in Animora-Morgenrot-Editor.html (' + Math.round(game.length / 1024) + ' KB gegenüber ' + Math.round(ed.length / 1024) + ' KB)');
  let s = await fresh('file://' + FILE, { width: 700, height: 660 });
  ok(await s.page.evaluate(() => !LM_hasEditor() && !Engine.editorOpen && !document.getElementById('lm-btn-editor') && !/Editor/.test(document.getElementById('lm-hint').textContent)), 'Spieldatei: kein Editor-Knopf und kein Hinweis auf F2 unter dem Spiel');
  await s.page.keyboard.press('F2'); await s.page.waitForTimeout(300);
  ok(await s.page.evaluate(() => !Engine.editorOpen && !document.getElementById('ed-root')), 'Spieldatei: F2 öffnet nichts');
  await s.page.evaluate(async () => { Engine.manual = true; await LMDebug.ff(20); Engine.draw(); });
  await (await s.page.$('#lm-screen')).screenshot({ path: path.join(OUT, 'titel_spiel.png') });
  await s.page.evaluate(() => LMDebug.press('a', 10));
  let items = await s.page.evaluate(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]);
  ok(items && !items.includes('EDITOR') && items.includes('NEUES SPIEL'), 'Spieldatei: Titelmenü ohne EDITOR: ' + JSON.stringify(items));
  ok(s.errors.length === 0, 'keine JS-Fehler (Spieldatei)' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  s = await fresh('file://' + FILE + '#editor');
  ok(await s.page.evaluate(() => !Engine.editorOpen), 'Spieldatei: auch die Adresse mit #editor öffnet keinen Editor'); await s.browser.close();
  // Arbeitskopie des Editors im selben Browser beeinflusst die Spieldatei nicht
  s = await fresh('file://' + EDFILE + '#spiel');
  await s.page.evaluate(() => { DB.meta.title = 'Arbeitskopie-Titel'; Project.saveWorking(); });
  await s.page.goto('file://' + FILE); await s.page.waitForFunction(() => typeof Engine !== 'undefined' && typeof DB === 'object' && DB !== null);
  ok(await s.page.evaluate(() => Project.source === 'embedded' && DB.meta.title === 'Animora – Morgenrot'), 'Spieldatei benutzt immer ihre eigenen Daten, nie die Arbeitskopie des Editors');
  await s.page.goto('file://' + EDFILE + '#spiel'); await s.page.waitForFunction(() => typeof Engine !== 'undefined' && typeof DB === 'object' && DB !== null);
  ok(await s.page.evaluate(() => { const r = Project.source === 'working' && DB.meta.title === 'Arbeitskopie-Titel'; Project.discardWorking(); return r; }), 'Editor-Datei lädt weiterhin ihre Arbeitskopie'); await s.browser.close();
  // 2) Editor-Datei
  s = await fresh('file://' + EDFILE);
  ok(await s.page.evaluate(() => Engine.editorOpen && document.getElementById('ed-root').classList.contains('open')), 'Animora-Morgenrot-Editor.html startet direkt im Editor');
  await s.page.screenshot({ path: path.join(OUT, 'edstart.png') });
  ok(await s.page.evaluate(g => LM_stripEditor(document.getElementById('lm-engine').textContent) === g, codeOf(game)), 'Spieldatei = Editor-Datei ohne den Editor-Teil (Programmcode sonst identisch)');
  const html = await s.page.evaluate(() => Project.buildHTML()), htmlEd = await s.page.evaluate(() => Project.buildHTML({ editor: true }));
  ok(codeOf(html) === codeOf(game) && html.split('id="lm-engine"')[0].indexOf('LM_START') < 0, '"Spiel exportieren" liefert genau die Spieldatei: ohne Editor, ohne Start-Schalter');
  ok(codeOf(htmlEd) === codeOf(ed) && /window\.LM_START = "editor"/.test(htmlEd), '"Editor-Datei exportieren" liefert wieder eine Editor-Datei');
  const exp = path.join(OUT, 'export_from_editorfile.html'); fs.writeFileSync(exp, html);
  await s.page.locator('#ed-root button', { hasText: 'Schliessen' }).first().click(); await s.page.waitForTimeout(400);
  ok(await s.page.evaluate(() => !Engine.editorOpen && Engine.ticks > 5), 'Editor schliessen führt ins Spiel (Titelbild läuft)');
  ok(s.errors.length === 0, 'keine JS-Fehler (Editor-Datei)' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  s = await fresh('file://' + exp);
  ok(await s.page.evaluate(() => !Engine.editorOpen && !LM_hasEditor()), 'Exportiertes Spiel startet am Titelbild und hat keinen Editor'); await s.browser.close();
  // 3) Editor-Datei im Spiel starten (#spiel): Titelmenü-Eintrag EDITOR und F2
  s = await fresh('file://' + EDFILE + '#spiel', { width: 700, height: 660 });
  ok(await s.page.evaluate(() => !Engine.editorOpen && LM_hasEditor() && !!document.getElementById('lm-btn-editor')), 'Editor-Datei mit #spiel startet am Titelbild (Editor-Knopf vorhanden)');
  await s.page.evaluate(async () => { Engine.manual = true; await LMDebug.ff(20); await LMDebug.press('a', 10); });
  items = await s.page.evaluate(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]);
  ok(items && items[items.length - 1] === 'EDITOR', 'Editor-Datei: Titelmenü enthält EDITOR: ' + JSON.stringify(items));
  await s.page.evaluate(async items => { for (let i = 0; i < items.length - 1; i++) await LMDebug.press('down', 3); await LMDebug.press('a', 3); }, items);
  ok(await s.page.evaluate(() => Engine.editorOpen), 'EDITOR im Titelmenü öffnet den Editor');
  await s.page.evaluate(() => { Engine.manual = false; }); await s.page.keyboard.press('F2'); await s.page.waitForTimeout(500);
  ok(await s.page.evaluate(() => !Engine.editorOpen && UI.layers.some(l => l.o && l.o.items && l.o.items.includes('EDITOR'))), 'F2 schliesst den Editor, Titelmenü läuft weiter');
  ok(s.errors.length === 0, 'keine JS-Fehler (Editor-Datei im Spiel)' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
