// Auswählen, Verschieben und Löschen im Karteneditor (Handy 412x800, Touch): Haus antippen und verschieben (Tür + Rückweg wandern mit),
// Teich löschen, NPC wählen/ziehen/löschen, Bereich mit Inhalt löschen, Rückgängig.
const { chromium } = require('playwright'); const path = require('path');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const FILE = (process.env.LM_FILE || path.join(__dirname, '..', 'Animora-Morgenrot.html')).replace(/\.html$/, '-Editor.html') + '#spiel';   // Editor-Datei; #spiel = im Spiel starten (der Test öffnet den Editor selbst)
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + FILE); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  await page.tap('#lm-btn-editor'); await page.waitForTimeout(300);
  const ev = (f, a) => page.evaluate(f, a);
  const cellPos = async (x, y) => { const r = await page.locator('.ed-mapwrap canvas').boundingBox(), m = await ev(() => { const m = Data.map(Editor.pages.maps.state.mapId); return [m.w, m.h]; }); return { x: r.x + (x + 0.5) * r.width / m[0], y: r.y + (y + 0.5) * r.height / m[1] }; };
  const tapCell = async (x, y) => { const p = await cellPos(x, y); await page.touchscreen.tap(p.x, p.y); await page.waitForTimeout(150); };
  const dragCells = async (x0, y0, x1, y1) => { const a = await cellPos(x0, y0), b = await cellPos(x1, y1); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 }); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(150); };
  const selBar = () => ev(() => { const b = document.querySelector('.ed-selbar'); return b && b.style.display !== 'none' ? b.textContent : ''; });
  const st = () => ev(() => { const s = Editor.pages.maps.state; return { tool: s.tool, layer: s.layer, sel: s.sel && { x: s.sel.x, y: s.sel.y, w: s.sel.w, h: s.sel.h, layers: s.sel.layers }, ent: s.ent }; });
  ok((await st()).tool === 'select' && await ev(() => /Auswählen/.test(document.querySelector('.ed-tools .ed-btn.on:not(.ed-propbtn)') ? [...document.querySelectorAll('.ed-tools .ed-btn.on')].map(b => b.textContent).join('|') : '')), '"Auswählen" ist das Standard-Werkzeug');
  // ---- Haus antippen: ganze Sache gewählt ----
  const before = await ev(() => { const m = Data.map('welpenhain'); return { obj: m.layers.objects.slice(), ground: m.layers.ground.slice(), door: m.warps.find(w => w.toMap === 'haus_spieler'), ret: Data.map('haus_spieler').warps.find(w => w.toMap === 'welpenhain') }; });
  await tapCell(4, 9);
  let s = await st();
  ok(s.sel && s.sel.x === 3 && s.sel.y === 8 && s.sel.w === 4 && s.sel.h === 3 && s.sel.layers.join() === 'objects' && s.layer === 'objects', 'Haus antippen wählt das ganze Haus (Ebene Objekte): ' + JSON.stringify(s.sel));
  ok(await ev(() => { const r = Editor.pages.maps.state.sel; return !r.mask || r.mask.filter(Boolean).length === 12; }), 'Gewählt sind genau die 12 zusammenhängenden Felder des Hauses');
  ok(/Auswahl 4×3 \(Objekte\)/.test(await selBar()) && /Löschen/.test(await selBar()), 'Leiste zeigt die Auswahl mit Aktionen: ' + await selBar());
  ok(await ev(() => { const b = document.querySelector('.ed-selbar').getBoundingClientRect(); return b.left >= 0 && b.left < 60; }), 'Auswahl-Leiste steht vorn in der Werkzeugzeile (ohne Wischen sichtbar)');
  await page.screenshot({ path: path.join(OUT, 'eds_haus_gewaehlt.png') });
  // ---- Haus verschieben (ziehen): 4 nach unten ----
  await dragCells(4, 9, 4, 13);
  const moved = await ev(b => {
    const m = Data.map('welpenhain'); let tilesOk = true, oldEmpty = true, groundSame = true;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) { if (m.layers.objects[(12 + j) * m.w + 3 + i] !== b.obj[(8 + j) * m.w + 3 + i]) tilesOk = false; if (m.layers.objects[(8 + j) * m.w + 3 + i] !== 0) oldEmpty = false; }
    for (let k = 0; k < m.layers.ground.length; k++) if (m.layers.ground[k] !== b.ground[k]) groundSame = false;
    const door = m.warps.find(w => w.toMap === 'haus_spieler'), ret = Data.map('haus_spieler').warps.find(w => w.toMap === 'welpenhain'), s = Editor.pages.maps.state.sel;
    return { tilesOk, oldEmpty, groundSame, door: [door.x, door.y], ret: [ret.toX, ret.toY], sel: s && [s.x, s.y] };
  }, before);
  ok(moved.tilesOk && moved.oldEmpty && moved.groundSame, 'Haus durch Ziehen verschoben (alte Stelle leer, Boden unverändert)');
  ok(moved.door[0] === before.door.x && moved.door[1] === before.door.y + 4, 'Tür-Übergang ist mitgewandert: ' + moved.door);
  ok(moved.ret[0] === before.ret.toX && moved.ret[1] === before.ret.toY + 4, 'Rückweg aus dem Haus führt vor die neue Tür: ' + moved.ret);
  ok(moved.sel && moved.sel[0] === 3 && moved.sel[1] === 12, 'Auswahl bleibt auf dem verschobenen Haus');
  await page.screenshot({ path: path.join(OUT, 'eds_haus_verschoben.png') });
  // im Spiel prüfen: durch die neue Tür hinein und wieder heraus
  const play = await ev(async () => { Editor.test({ map: 'welpenhain', x: 4, y: 15 }); Engine.manual = true; await LMDebug.ff(5); await LMDebug.walk('U'); await LMDebug.until(() => World.mapId === 'haus_spieler' && !World.lock && Gfx.fade === 0, 600); const a = World.mapId; await LMDebug.walk('D'); await LMDebug.until(() => World.mapId === 'welpenhain' && !World.lock && Gfx.fade === 0, 600); const r = { a, b: World.mapId + ':' + World.p.x + ',' + World.p.y }; Engine.manual = false; return r; });
  ok(play.a === 'haus_spieler' && play.b === 'welpenhain:4,15', 'Im Spiel: neue Tür führt ins Haus, der Ausgang wieder vor die neue Tür: ' + JSON.stringify(play));
  await ev(() => Engine.toggleEditor()); await page.waitForTimeout(300);
  // ---- Teich antippen und löschen (Boden wird mit Rasen gefüllt) ----
  await page.locator('.ed-selbar button', { hasText: '✕' }).tap(); await page.waitForTimeout(100);
  ok(await selBar() === '', 'Auswahl aufgehoben (✕)');
  await tapCell(15, 14); s = await st();
  ok(s.sel && s.sel.x === 13 && s.sel.y === 13 && s.sel.w === 6 && s.sel.h === 3 && s.sel.layers.join() === 'ground', 'Teich antippen wählt den ganzen Teich: ' + JSON.stringify(s.sel));
  await page.locator('.ed-selbar button', { hasText: 'Löschen' }).tap(); await page.waitForTimeout(200);
  ok(await ev(() => { const m = Data.map('welpenhain'), g = DB.tiles.find(t => t.sprite === 't_grass').id; for (let j = 13; j < 16; j++) for (let i = 13; i < 19; i++) if (m.layers.ground[j * m.w + i] !== g) return false; return !Editor.pages.maps.state.sel; }), 'Löschen ersetzt den Teich durch Rasen (kein schwarzes Loch)');
  // ---- einzelnes Feld im grossen Rasen: nur dieses Feld ----
  await tapCell(13, 8); s = await st();
  ok(s.sel && s.sel.w === 1 && s.sel.h === 1, 'Grosse Flächen (Rasen): Antippen wählt nur das eine Feld');
  await page.locator('.ed-selbar button', { hasText: '✕' }).tap(); await page.waitForTimeout(100);
  // ---- NPC mit dem Auswählen-Werkzeug (ohne Ebenenwechsel) ----
  const npc = await ev(() => { const n = Data.map('welpenhain').npcs.find(n => n.id === 'angler'); return { x: n.x, y: n.y, count: Data.map('welpenhain').npcs.length }; });
  await tapCell(npc.x, npc.y); s = await st();
  ok(s.ent && s.ent.id === 'angler' && /NPC "Angler"/.test(await selBar()), 'NPC antippen wählt ihn aus: ' + await selBar());
  ok(await ev(() => getComputedStyle(document.querySelector('.ed-side')).display === 'none'), 'Die Karte bleibt dabei frei (Eigenschaften öffnen sich erst mit "Bearbeiten")');
  await dragCells(npc.x, npc.y, npc.x - 4, npc.y + 1);
  ok(await ev(n => { const a = Data.map('welpenhain').npcs.find(n => n.id === 'angler'); return a.x === n.x - 4 && a.y === n.y + 1; }, npc), 'NPC durch Ziehen verschoben');
  await page.locator('.ed-selbar button', { hasText: 'Bearbeiten' }).tap(); await page.waitForTimeout(150);
  ok(await ev(() => getComputedStyle(document.querySelector('.ed-side')).display !== 'none' && /NPC "angler"/.test(document.querySelector('.ed-side').textContent)), '"Bearbeiten" öffnet die Eigenschaften des NPCs');
  await page.locator('.ed-side button', { hasText: 'Zuklappen' }).tap(); await page.waitForTimeout(100);
  await page.locator('.ed-selbar button', { hasText: 'Löschen' }).tap(); await page.waitForTimeout(200);
  ok(await ev(n => Data.map('welpenhain').npcs.length === n.count - 1 && !Data.map('welpenhain').npcs.some(x => x.id === 'angler'), npc), 'NPC über die Leiste gelöscht');
  // ---- Bereich aufziehen und löschen (mit Ereignis darin: Rückfrage) ----
  await page.locator('.ed-tools button', { hasText: /^Boden$/ }).tap(); await page.waitForTimeout(100);
  await dragCells(12, 12, 15, 15); s = await st();
  ok(s.sel && s.sel.w === 4 && s.sel.h === 4 && s.sel.layers.length === 5, 'Bereich aufziehen wählt ein Rechteck auf allen Ebenen');
  const evBefore = await ev(() => Data.map('welpenhain').events.length);
  await page.locator('.ed-selbar button', { hasText: 'Löschen' }).tap(); await page.waitForTimeout(200);
  ok(await ev(() => !!document.querySelector('.ed-modal') && /liegt 1 NPC\/Ereignis\/Übergang|liegen/.test(document.querySelector('.ed-modal').textContent)), 'Rückfrage, weil in der Auswahl ein Ereignis liegt');
  await page.locator('.ed-modal .ed-ok').tap(); await page.waitForTimeout(250);
  ok(await ev(n => { const m = Data.map('welpenhain'); return m.events.length < n && m.layers.objects[13 * m.w + 13] === 0; }, evBefore), 'Bereich samt Ereignis gelöscht');
  // ---- Rückgängig (mehrfach) stellt alles wieder her ----
  for (let i = 0; i < 5; i++) { await page.locator('.ed-top button').nth(1).tap(); await page.waitForTimeout(120); }
  ok(await ev(b => { const m = Data.map('welpenhain'); return m.layers.objects.every((v, k) => v === b.obj[k]) && m.layers.ground.every((v, k) => v === b.ground[k]) && m.npcs.some(n => n.id === 'angler') && m.warps.find(w => w.toMap === 'haus_spieler').x === b.door.x && Data.map('haus_spieler').warps.find(w => w.toMap === 'welpenhain').toX === b.ret.toX; }, before), 'Rückgängig stellt Haus, Teich, NPC und Übergänge wieder her');
  ok(errors.length === 0, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
