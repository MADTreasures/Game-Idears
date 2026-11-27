// Editor auf schmalen Bildschirmen: Bildschirmfotos + Funktionsprüfungen (Faltgerät 900x780, Handy hoch 412x800, Handy quer 800x380)
const { chromium } = require('playwright'); const path = require('path');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const FILE = (process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html')).replace(/\.html$/, '-Editor.html') + '#spiel';   // Editor-Datei; #spiel = im Spiel starten (der Test öffnet den Editor selbst)
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
async function dev(w, h) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + FILE); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  await page.tap('#lm-btn-editor'); await page.waitForTimeout(300);
  return { browser, page, errors };
}
const info = page => page.evaluate(() => { const s = Editor.pages.maps.state, m = Data.map(s.mapId), c = document.querySelector('.ed-mapwrap canvas').getBoundingClientRect(), w = document.querySelector('.ed-mapwrap').getBoundingClientRect(); return { zoom: s.zoom, fit: s.fit, map: m.id, cw: Math.round(c.width), ch: Math.round(c.height), ww: Math.round(w.width), wh: Math.round(w.height), inside: c.left >= w.left - 1 && c.top >= w.top - 1 && c.right <= w.right + 1 && c.bottom <= w.bottom + 1, scroll: document.documentElement.scrollWidth > window.innerWidth + 1 }; });
(async () => {
  // ---------- Faltgerät / kleines Tablet (wie im Screenshot des Nutzers) ----------
  let s = await dev(900, 780);
  let i = await info(s.page);
  ok(i.fit && i.inside, 'Faltgerät 900x780: ganze Karte sichtbar (Zoom ' + i.zoom + ', Karte ' + i.cw + 'x' + i.ch + ' in Fläche ' + i.ww + 'x' + i.wh + ')');
  ok(i.wh >= 380, 'Kartenfläche ist hoch genug: ' + i.wh + ' px (vorher ca. 200)');
  ok(!i.scroll, 'Seite scrollt nicht seitlich');
  await s.page.screenshot({ path: path.join(OUT, 'edm_fold_map.png') });
  // Tile wählen (Leiste unten) und malen
  const tileId = await s.page.evaluate(() => DB.tiles.find(x => x.sprite === 't_flower_a').id);
  await s.page.tap('.ed-pal canvas[data-tile="' + tileId + '"]'); await s.page.waitForTimeout(100);
  let r = await s.page.locator('.ed-mapwrap canvas').boundingBox(), z = (await info(s.page)).zoom;
  await s.page.touchscreen.tap(r.x + 5.5 * 16 * z, r.y + 7.5 * 16 * z); await s.page.waitForTimeout(120);
  ok(await s.page.evaluate(id => { const m = Data.map(Editor.pages.maps.state.mapId); return m.layers.ground[7 * m.w + 5] === id; }, tileId), 'Tile aus der unteren Leiste gewählt und per Tippen gemalt');
  // Zoom-Leiste
  await s.page.locator('.ed-zoombar button', { hasText: '+' }).tap(); await s.page.waitForTimeout(100);
  i = await info(s.page); ok(!i.fit && i.zoom > z, 'Zoom + vergrössert (' + z + ' -> ' + i.zoom + ')');
  await s.page.locator('.ed-zoombar button', { hasText: 'Ganze Karte' }).tap(); await s.page.waitForTimeout(100);
  i = await info(s.page); ok(i.fit && i.inside && i.zoom === z, '"Ganze Karte" passt die Karte wieder ein');
  // Zwei-Finger-Zoom (Pointer-Events simuliert)
  const pinch = await s.page.evaluate(async () => {
    const cv = document.querySelector('.ed-mapwrap canvas'), r = cv.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, before = Editor.pages.maps.state.zoom, snap = JSON.stringify(DB);
    const ev = (t, id, x, y) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: id === 11 }));
    ev('pointerdown', 11, cx - 40, cy); ev('pointerdown', 12, cx + 40, cy);
    for (let k = 1; k <= 6; k++) { ev('pointermove', 11, cx - 40 - k * 12, cy); ev('pointermove', 12, cx + 40 + k * 12, cy); }
    ev('pointerup', 11, cx - 112, cy); ev('pointerup', 12, cx + 112, cy); await new Promise(r => setTimeout(r, 100));
    return { before, after: Editor.pages.maps.state.zoom, unchanged: JSON.stringify(DB) === snap };
  });
  ok(pinch.after > pinch.before * 2 && pinch.unchanged, 'Zwei-Finger-Zoom vergrössert (' + pinch.before + ' -> ' + pinch.after.toFixed(2) + '), ohne dabei zu malen');
  await s.page.locator('.ed-zoombar button', { hasText: 'Ganze Karte' }).tap(); await s.page.waitForTimeout(100);
  // NPC-Ebene: antippen öffnet die Eigenschaften als Fenster
  await s.page.locator('.ed-tools button', { hasText: /^NPCs$/ }).tap(); await s.page.waitForTimeout(120);
  ok(await s.page.evaluate(() => getComputedStyle(document.querySelector('.ed-side')).display === 'none'), 'Eigenschaften sind zunächst eingeklappt (Karte hat die volle Breite)');
  const npc = await s.page.evaluate(() => { const n = Data.map('welpenhain').npcs[0]; return { x: n.x, y: n.y, id: n.id }; });
  r = await s.page.locator('.ed-mapwrap canvas').boundingBox(); z = (await info(s.page)).zoom;
  await s.page.touchscreen.tap(r.x + (npc.x + 0.5) * 16 * z, r.y + (npc.y + 0.5) * 16 * z); await s.page.waitForTimeout(150);
  ok(await s.page.evaluate(id => getComputedStyle(document.querySelector('.ed-side')).display === 'none' && Editor.pages.maps.state.ent && Editor.pages.maps.state.ent.id === id, npc.id), 'NPC antippen wählt ihn aus, die Karte bleibt frei');
  await s.page.locator('.ed-selbar button', { hasText: 'Bearbeiten' }).tap(); await s.page.waitForTimeout(150);
  ok(await s.page.evaluate(() => getComputedStyle(document.querySelector('.ed-side')).display !== 'none'), '"Bearbeiten" öffnet das Eigenschaftenfenster');
  await s.page.screenshot({ path: path.join(OUT, 'edm_fold_npc.png') });
  await s.page.locator('.ed-side button', { hasText: 'Zuklappen' }).tap(); await s.page.waitForTimeout(100);
  ok(await s.page.evaluate(() => getComputedStyle(document.querySelector('.ed-side')).display === 'none'), 'Eigenschaften lassen sich wieder zuklappen');
  await s.page.locator('.ed-tools button', { hasText: 'Eigenschaften' }).tap(); await s.page.waitForTimeout(100);
  ok(await s.page.evaluate(() => getComputedStyle(document.querySelector('.ed-side')).display !== 'none'), 'Schaltfläche "Eigenschaften" klappt sie wieder auf');
  await s.page.locator('.ed-side button', { hasText: 'Zuklappen' }).tap();
  // andere Seiten
  for (const pg of ['pixel', 'monsters', 'trainers', 'project']) { await s.page.tap('.ed-nav button[data-page="' + pg + '"]'); await s.page.waitForTimeout(200); await s.page.screenshot({ path: path.join(OUT, 'edm_fold_' + pg + '.png') }); }
  ok(await s.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Auch andere Seiten bleiben in der Bildschirmbreite');
  ok(s.errors.length === 0, 'keine JS-Fehler (Faltgerät)' + (s.errors.length ? ': ' + s.errors.join(' | ') : '')); await s.browser.close();
  // ---------- Handy hochkant ----------
  s = await dev(412, 800); i = await info(s.page);
  ok(i.fit && i.inside && i.wh >= 300, 'Handy hochkant 412x800: ganze Karte sichtbar (Zoom ' + i.zoom + ', Fläche ' + i.ww + 'x' + i.wh + ')');
  await s.page.screenshot({ path: path.join(OUT, 'edm_phone_map.png') });
  await s.page.tap('.ed-nav button[data-page="monsters"]'); await s.page.waitForTimeout(200); await s.page.screenshot({ path: path.join(OUT, 'edm_phone_monsters.png') });
  ok(s.errors.length === 0, 'keine JS-Fehler (Handy hoch)'); await s.browser.close();
  // ---------- Handy quer ----------
  s = await dev(800, 380); i = await info(s.page);
  ok(i.fit && i.inside && i.wh >= 150, 'Handy quer 800x380: ganze Karte sichtbar (Zoom ' + i.zoom + ', Fläche ' + i.ww + 'x' + i.wh + ')');
  await s.page.screenshot({ path: path.join(OUT, 'edm_land_map.png') });
  ok(s.errors.length === 0, 'keine JS-Fehler (Handy quer)'); await s.browser.close();
  // ---------- Musik ----------
  const b = await chromium.launch(), pg = await b.newPage(); await pg.goto('file://' + FILE); await pg.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  ok(await pg.evaluate(() => Opt.music === false && Opt.sound === true), 'Musik ist standardmässig aus (Soundeffekte an)');
  await pg.mouse.click(300, 300); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => Sound.ac && Sound.ac.state === 'running' && !Sound.cur), 'Nach der ersten Eingabe läuft keine Musik');
  ok(await pg.evaluate(() => { Opt.music = true; Sound.applyOptions(); Sound.pump(); return !!Sound.cur && Sound.curId === 'title'; }), 'In den Optionen eingeschaltet: Musik spielt');
  await pg.keyboard.press('F2'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => Engine.editorOpen && !Sound.cur && Sound.wantId === ''), 'Im Editor läuft keine Musik (auch wenn sie im Spiel an ist)');
  await pg.mouse.click(600, 400); await pg.waitForTimeout(200);
  ok(await pg.evaluate(() => !Sound.cur), 'Klicks im Editor starten keine Musik');
  await pg.evaluate(() => { Opt.music = false; saveOpt(); localStorage.setItem('leinenmeister.options', JSON.stringify({ text: 1, sound: true, music: true, pal: 'gruen', touch: 'auto' })); });
  await pg.reload(); await pg.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  ok(await pg.evaluate(() => Opt.music === false), 'Alte gespeicherte Vorgabe "Musik an" wird nicht übernommen'); await b.close();
  console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
