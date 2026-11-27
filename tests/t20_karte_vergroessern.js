// Karte vergrössern/verkleinern im Editor (Handy hochkant 412x800, Touch): Schaltfläche sichtbar, Dialog, Inhalte wandern mit,
// neue Felder gefüllt, nahtlose Ränder passen weiter, Rückgängig; ausserdem Kopfleiste (Schliessen sichtbar) und Wisch-Hinweise.
const { chromium } = require('playwright'); const path = require('path');
const OUT = path.join(__dirname, 'out'); require('fs').mkdirSync(OUT, { recursive: true });
const FILE = (process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html')).replace(/\.html$/, '-Editor.html') + '#spiel';   // Editor-Datei; #spiel = im Spiel starten (der Test öffnet den Editor selbst)
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 412, height: 800 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + FILE); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  await page.tap('#lm-btn-editor'); await page.waitForTimeout(300);
  const inView = sel => page.evaluate(sel => { const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent); if (!e) return false; const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth + 1 && r.width > 10; }, sel);
  // Kopfleiste: Schliessen-Knopf ist sichtbar, ungespeicherter Zustand am Speichern-Knopf
  ok(await page.evaluate(() => { const b = [...document.querySelectorAll('.ed-top button')].pop(), r = b.getBoundingClientRect(); return /Schliessen/.test(b.textContent) && r.right <= window.innerWidth && r.left > 0; }), 'Handy: Schliessen-Knopf der Kopfleiste ist ohne Wischen sichtbar');
  // Grösse-Schaltfläche direkt sichtbar
  ok(await page.evaluate(() => { const b = [...document.querySelectorAll('.ed-tools button')].find(x => /^Grösse/.test(x.textContent)), r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }), 'Handy: Schaltfläche "Grösse…" ist neben der Kartenauswahl direkt sichtbar');
  ok(await page.evaluate(() => document.querySelectorAll('.ed-tools.ed-more').length >= 2 && document.querySelector('.ed-nav').classList.contains('ed-more')), 'Wischbare Leisten zeigen rechts einen Pfeil');
  await page.screenshot({ path: path.join(OUT, 'edr_phone_before.png') });
  const before = await page.evaluate(() => { const m = Data.map('welpenhain'); return { w: m.w, h: m.h, npc: m.npcs.map(n => [n.x, n.y]), warp: m.warps.map(w => [w.x, w.y]), ground: m.layers.ground.slice(), obj: m.layers.objects.slice(), inWarp: Data.map('haus_spieler').warps.find(w => w.toMap === 'welpenhain'), east: m.connections.east.offset, r1west: Data.map('route1').connections.west.offset }; });
  // Dialog öffnen
  await page.locator('.ed-tools button', { hasText: /^Grösse/ }).tap(); await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, 'edr_phone_dialog.png') });
  ok(await page.evaluate(() => /Aktuelle Grösse: 24 × 18/.test(document.querySelector('.ed-modal').textContent)), 'Dialog nennt die aktuelle Grösse (24 × 18)');
  const nums = page.locator('.ed-modal input[type=number]');
  await nums.nth(0).fill('5'); await nums.nth(1).fill('4'); await nums.nth(2).fill('3'); await nums.nth(3).fill('2');      // rechts 5, unten 4, links 3, oben 2
  await page.locator('.ed-modal .ed-ok').tap(); await page.waitForTimeout(300);
  const r = await page.evaluate(b => {
    const m = Data.map('welpenhain'), g = DB.tiles.find(t => t.sprite === 't_grass').id; let oldOk = true, newOk = true;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const ox = x - 3, oy = y - 2, inOld = ox >= 0 && oy >= 0 && ox < b.w && oy < b.h;
      if (inOld) { if (m.layers.ground[y * m.w + x] !== b.ground[oy * b.w + ox] || m.layers.objects[y * m.w + x] !== b.obj[oy * b.w + ox]) oldOk = false; }
      else if (m.layers.ground[y * m.w + x] !== g || m.layers.objects[y * m.w + x] !== 0) newOk = false; }
    const s = Editor.pages.maps.state, c = document.querySelector('.ed-mapwrap canvas').getBoundingClientRect(), w = document.querySelector('.ed-mapwrap').getBoundingClientRect();
    return { w: m.w, h: m.h, oldOk, newOk, npc: m.npcs.map(n => [n.x, n.y]), warp: m.warps.map(w => [w.x, w.y]), inWarp: Data.map('haus_spieler').warps.find(w => w.toMap === 'welpenhain'), east: m.connections.east.offset, r1west: Data.map('route1').connections.west.offset, fit: s.fit, inside: c.right <= w.right + 1 && c.bottom <= w.bottom + 1 && c.left >= w.left - 1 };
  }, before);
  ok(r.w === 32 && r.h === 24, 'Karte ist jetzt 32 × 24 Felder (vorher 24 × 18): ' + r.w + ' × ' + r.h);
  ok(r.oldOk, 'Vorhandener Karteninhalt ist unverändert (um 3 nach rechts / 2 nach unten gerückt)');
  ok(r.newOk, 'Neue Felder sind mit dem häufigsten Boden (Rasen) gefüllt');
  ok(r.npc.every((p, i) => p[0] === before.npc[i][0] + 3 && p[1] === before.npc[i][1] + 2) && r.warp.every((p, i) => p[0] === before.warp[i][0] + 3 && p[1] === before.warp[i][1] + 2), 'NPCs und Übergänge sind mitgewandert');
  ok(r.inWarp.toX === before.inWarp.toX + 3 && r.inWarp.toY === before.inWarp.toY + 2, 'Übergänge anderer Karten zeigen weiter auf dasselbe Feld (Haus -> Dorf)');
  ok(r.east === before.east + 2 && r.r1west === before.r1west - 2, 'Versatz der nahtlosen Kartenränder angepasst (Dorf ' + r.east + ', Route 1 ' + r.r1west + ')');
  ok(r.fit && r.inside, 'Die vergrösserte Karte wird wieder ganz angezeigt');
  await page.screenshot({ path: path.join(OUT, 'edr_phone_after.png') });
  // Im Spiel: Haus verlassen landet vor der Tür, Übergang zur Route passt weiterhin
  const play = await page.evaluate(async () => {
    Editor.test({ map: 'welpenhain', x: 30, y: 10 }); Engine.manual = true; await LMDebug.ff(5);   // Ausgangsreihe 8 liegt jetzt in Reihe 10, der Ostrand bei x = 31
    const d = Data.map('welpenhain'), door = d.warps.find(w => w.toMap === 'haus_spieler'), out = {};
    out.doorTile = (Data.tile(d.layers.objects[door.y * d.w + door.x]) || {}).sprite;
    await LMDebug.walk('R'); await LMDebug.walk('R'); await LMDebug.ff(3); out.map = World.mapId; out.x = World.p.x; out.y = World.p.y; out.kind = World.kindAt(World.p.x, World.p.y); out.walk = !World.cellSolid(World.p.x, World.p.y);
    await LMDebug.walk('L'); await LMDebug.walk('L'); await LMDebug.ff(3); out.back = World.mapId + ':' + World.p.x + ',' + World.p.y;
    Engine.manual = false; return out;
  });
  ok(play.doorTile === 't_door', 'Im Spiel: Tür-Übergang liegt weiter auf der Haustür');
  ok(play.map === 'route1' && play.x === 0 && play.y === 6 && play.walk, 'Im Spiel: vom Dorf nach Osten landet man weiter auf dem Weg von Route 1 (' + play.x + ',' + play.y + ')');
  ok(play.back === 'welpenhain:30,10', 'Im Spiel: und zurück wieder in derselben Reihe des Dorfes: ' + play.back);
  // zurück in den Editor, Rückgängig stellt die alte Grösse her
  await page.evaluate(() => Engine.toggleEditor()); await page.waitForTimeout(300);
  await page.locator('.ed-top button').nth(1).tap(); await page.waitForTimeout(300);
  ok(await page.evaluate(b => { const m = Data.map('welpenhain'); return m.w === b.w && m.h === b.h && m.connections.east.offset === b.east && Data.map('route1').connections.west.offset === b.r1west && m.npcs[0].x === b.npc[0][0]; }, before), 'Rückgängig stellt Grösse, Inhalte und Ränder wieder her');
  // Verkleinern (negative Werte) und ungültige Grösse
  await page.locator('.ed-tools button', { hasText: /^Grösse/ }).tap(); await page.waitForTimeout(150);
  await page.locator('.ed-modal input[type=number]').nth(0).fill('-6'); await page.locator('.ed-modal .ed-ok').tap(); await page.waitForTimeout(250);
  ok(await page.evaluate(() => { const m = Data.map('welpenhain'); return m.w === 18 && m.h === 18 && m.npcs.every(n => n.x < 18) && m.warps.every(w => w.x < 18); }), 'Verkleinern mit negativer Zahl: 18 × 18, alles bleibt innerhalb der Karte');
  await page.locator('.ed-tools button', { hasText: /^Grösse/ }).tap(); await page.waitForTimeout(150);
  await page.locator('.ed-modal input[type=number]').nth(1).fill('-30'); await page.locator('.ed-modal .ed-ok').tap(); await page.waitForTimeout(250);
  ok(await page.evaluate(() => Data.map('welpenhain').h === 18 && !!document.querySelector('.ed-toast.bad')), 'Ungültige Grösse wird mit Meldung abgelehnt');
  ok(errors.length === 0, 'keine JS-Fehler' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close(); console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
