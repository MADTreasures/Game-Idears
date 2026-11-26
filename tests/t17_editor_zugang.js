// Editor-Zugänge: Begleitdatei startet im Editor, Titelmenü-Eintrag EDITOR, Adresse mit #editor; Export aus der Editor-Datei ergibt normale Spieldatei.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const FILE = process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html'), EDFILE = FILE.replace(/\.html$/, '-Editor.html');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
async function fresh(url, vp) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: vp || { width: 1360, height: 820 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => typeof Engine !== 'undefined' && typeof DB === 'object' && DB !== null); await page.waitForTimeout(400);
  return { browser, page, errors };
}
(async () => {
  // 1) Begleitdatei
  let s = await fresh('file://' + EDFILE);
  ok(await s.page.evaluate(() => Engine.editorOpen && document.getElementById('ed-root').classList.contains('open')), 'Leinenmeister-Editor.html startet direkt im Editor');
  await s.page.screenshot({ path: path.join(OUT, 'edstart.png') });
  const a = fs.readFileSync(FILE, 'utf8'), b = fs.readFileSync(EDFILE, 'utf8');
  ok(b.replace('<' + 'script>window.LM_START = "editor";</' + 'script>\n', '') === a, 'Editor-Datei ist bis auf den Start-Schalter identisch mit der Spieldatei');
  const html = await s.page.evaluate(() => Project.buildHTML());
  ok(html.indexOf('<' + 'script>window.LM_START') < 0 && html.indexOf('id="lm-engine"') > 0, 'HTML-Export aus der Editor-Datei enthält keinen Start-Schalter (normale Spieldatei)');
  const exp = path.join(OUT, 'export_from_editorfile.html'); fs.writeFileSync(exp, html);
  // Editor schliessen -> Titelbild
  await s.page.locator('#ed-root button', { hasText: 'Schliessen' }).first().click(); await s.page.waitForTimeout(400);
  ok(await s.page.evaluate(() => !Engine.editorOpen && Engine.ticks > 5), 'Editor schliessen führt ins Spiel (Titelbild läuft)');
  ok(s.errors.length === 0, 'keine JS-Fehler (Editor-Datei)' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  s = await fresh('file://' + exp);
  ok(await s.page.evaluate(() => !Engine.editorOpen), 'Exportierte Datei startet normal am Titelbild'); await s.browser.close();
  // 2) #editor
  s = await fresh('file://' + FILE + '#editor');
  ok(await s.page.evaluate(() => Engine.editorOpen), 'Adresse mit #editor öffnet den Editor'); await s.browser.close();
  // 3) Titelmenü-Eintrag
  s = await fresh('file://' + FILE, { width: 700, height: 660 });
  ok(await s.page.evaluate(() => !Engine.editorOpen), 'Spieldatei startet normal am Titelbild');
  await s.page.evaluate(async () => { Engine.manual = true; await LMDebug.ff(20); await LMDebug.press('a', 10); });
  const items = await s.page.evaluate(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]);
  ok(items && items[items.length - 1] === 'EDITOR', 'Titelmenü enthält EDITOR: ' + JSON.stringify(items));
  await s.page.evaluate(() => { Engine.draw(); }); await (await s.page.$('#lm-screen')).screenshot({ path: path.join(OUT, 'titel_editor.png') });
  await s.page.evaluate(async items => { for (let i = 0; i < items.length - 1; i++) await LMDebug.press('down', 3); await LMDebug.press('a', 3); }, items);
  ok(await s.page.evaluate(() => Engine.editorOpen), 'EDITOR im Titelmenü öffnet den Editor');
  await s.page.evaluate(() => { Engine.manual = false; }); await s.page.keyboard.press('F2'); await s.page.waitForTimeout(500);
  ok(await s.page.evaluate(() => !Engine.editorOpen && UI.layers.some(l => l.o && l.o.items && l.o.items.includes('EDITOR'))), 'F2 schliesst den Editor, Titelmenü läuft weiter');
  ok(s.errors.length === 0, 'keine JS-Fehler (Spieldatei)' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
