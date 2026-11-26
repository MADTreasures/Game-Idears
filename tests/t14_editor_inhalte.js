// Zweiter Funktionstest: weitere Editorfunktionen, Touch-Bedienung und "neue Inhalte direkt im Spiel testen".
const { chromium } = require('playwright'); const path = require('path');
const OUT = path.join(__dirname, 'out'), FILE = process.argv[2] || process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html');
require('fs').mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const fails = [];
function check(name, ok, info) { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; fails.push(name); console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); } }
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + FILE); await p.waitForTimeout(400);
  const ev = (fn, a) => p.evaluate(fn, a), nav = async id => { await p.click('.ed-nav button[data-page="' + id + '"]'); await p.waitForTimeout(80); };
  const btn = async (text, scope) => { await p.locator((scope || '#ed-root') + ' button', { hasText: text }).first().click(); await p.waitForTimeout(60); };
  const ok = async () => { await p.click('.ed-modal .ed-ok'); await p.waitForTimeout(80); };
  const mapCell = async (x, y) => { const z = await ev(() => Editor.pages.maps.state.zoom), r = await p.locator('.ed-mapwrap canvas').boundingBox(); return { x: r.x + (x + 0.5) * 16 * z, y: r.y + (y + 0.5) * 16 * z }; };
  const clickCell = async (x, y) => { const c = await mapCell(x, y); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(60); };
  const layer = async name => { await p.locator('.ed-tools button', { hasText: new RegExp('^' + name + '$') }).first().click(); await p.waitForTimeout(60); };
  const field = (scope, label) => p.locator(scope + ' .ed-f', { hasText: label }).first();
  const mk = async (page, id, name) => { await nav(page); await btn('Neu', '.ed-listhead'); const t = p.locator('.ed-modal input[type=text]'); if (await t.count() > 1) { await t.nth(0).fill(id); await t.nth(1).fill(name); } else await t.nth(0).fill(name); await ok(); };
  await p.keyboard.press('F2'); await p.waitForTimeout(200);

  console.log('1) Sprites, Tiles, Figuren');
  await nav('pixel'); await ev(() => Editor.go({ page: 'pixel', sprite: 't_grass' }));
  await btn('Dupl.', '.ed-listhead');
  check('Sprite dupliziert', await ev(() => !!DB.sprites.t_grass_2 && Editor.pages.pixel.state.key === 't_grass_2'));
  await btn('Umben.', '.ed-listhead'); await p.locator('.ed-modal input[type=text]').fill('t_wiese'); await ok();
  check('Sprite umbenannt', await ev(() => !!DB.sprites.t_wiese && !DB.sprites.t_grass_2));
  await ev(() => Editor.go({ page: 'pixel', sprite: 't_grass' })); await btn('Umben.', '.ed-listhead'); await p.locator('.ed-modal input[type=text]').fill('t_rasen'); await ok();
  check('Umbenennen passt Verweise an', await ev(() => DB.tiles.some(t => t.sprite === 't_rasen') && !DB.tiles.some(t => t.sprite === 't_grass') && !DB.sprites.t_grass));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  check('Umbenennen rückgängig', await ev(() => DB.tiles.some(t => t.sprite === 't_grass') && !!DB.sprites.t_grass));
  await ev(() => Editor.go({ page: 'pixel', sprite: 't_wiese' })); await btn('Grösse…', '.ed-tools'); await p.locator('.ed-modal input[type=number]').nth(0).fill('24'); await p.locator('.ed-modal input[type=number]').nth(1).fill('20'); await ok();
  check('Sprite-Grösse geändert, Inhalt erhalten', await ev(() => { const s = DB.sprites.t_wiese, o = DB.sprites.t_grass; return s.w === 24 && s.h === 20 && s.px.length === 20 && s.px[0].length === 24 && s.px[3].substr(0, 16) === o.px[3] && s.px[19] === '.'.repeat(24); }));
  await btn('Löschen', '.ed-listhead'); await ok();
  check('Sprite gelöscht', await ev(() => !DB.sprites.t_wiese));
  await mk('tiles', '', 'Testboden');
  await field('.ed-form', 'Sprite (16×16)').locator('select').selectOption('t_path'); await p.waitForTimeout(60);
  await field('.ed-form', 'Nicht begehbar').locator('input').check();
  await field('.ed-form', 'Art').locator('select').selectOption('grass');
  const tid = await ev(() => Editor.sel.tiles);
  check('Tile angelegt (Zahlen-ID, Sprite, solid, Art)', await ev(id => { const t = Data.tile(id); return !!t && t.id === Math.max(...DB.tiles.map(x => x.id)) && t.sprite === 't_path' && t.solid === true && t.kind === 'grass'; }, tid));
  await field('.ed-form', 'Animationsframes').locator('select').selectOption('t_water_a'); await p.waitForTimeout(60);
  check('Animationsframe hinzugefügt', await ev(id => Data.tile(id).frames.length === 1 && Data.tile(id).frames[0] === 't_water_a', tid));
  await mk('charsets', 'testfigur', 'Testfigur');
  await field('.ed-form', 'Unten – stehend').locator('select').selectOption('c_mom_d0'); await p.waitForTimeout(60);
  check('Figur angelegt und Frame gesetzt', await ev(() => { const c = Data.charset('testfigur'); return !!c && c.d[0] === 'c_mom_d0' && c.u.length === 2; }));

  console.log('2) Musik, Soundeffekte, Einstellungen');
  await mk('songs', 'testsong', 'Testsong'); await btn('Abspielen', '.ed-form'); await p.waitForTimeout(200);
  check('Musik-Vorschau läuft', await ev(() => !!Sound.ac && Sound.curId === 'testsong'), await ev(() => ({ ac: !!Sound.ac, cur: Sound.curId })));
  await btn('Stopp', '.ed-form'); check('Musik gestoppt', await ev(() => !Sound.cur));
  await p.locator('.ed-form .ed-row textarea').first().fill('c4:4 d4:4 e4:8'); await p.keyboard.press('Tab');
  check('Spur bearbeitet', await ev(() => Data.song('testsong').tracks[0].seq === 'c4:4 d4:4 e4:8'));
  await mk('sfx', 'testton', 'Testton'); await btn('+ Schritt', '.ed-form'); await btn('Abspielen', '.ed-form'); await p.waitForTimeout(150);
  check('Soundeffekt mit zwei Schritten', await ev(() => Data.sfxDef('testton').steps.length === 2));
  await nav('meta'); await field('.ed-form', 'Spieltitel').locator('input').fill('Mein Abenteuer'); await p.keyboard.press('Tab');
  await field('.ed-form', 'Startgeld').locator('input').fill('5000'); await p.keyboard.press('Tab');
  await btn('+ Monster', '.ed-form');
  check('Einstellungen geändert', await ev(() => DB.meta.title === 'Mein Abenteuer' && DB.meta.startMoney === 5000 && DB.meta.testTeam.length === 3 && Project.fileBase() === 'Mein_Abenteuer'));

  console.log('3) Shop, Quest (verschachtelte Aktionen), Karte mit NPCs');
  await mk('shops', 'testshop', 'Testshop'); await btn('+ Ware', '.ed-form');
  await p.locator('.ed-form .ed-row .ed-f', { hasText: 'Preis' }).locator('input').fill('42'); await p.keyboard.press('Tab');
  await p.locator('.ed-form .ed-row select', { has: p.locator('option', { hasText: '+ Bedingung…' }) }).selectOption('money'); await p.waitForTimeout(60);
  check('Shop-Sortiment mit Preis und Bedingung', await ev(() => { const s = Data.shop('testshop').stock[0]; return s.item === DB.items[0].id && s.price === 42 && s.cond[0].k === 'money' && s.cond[0].op === '>=' && s.cond[0].n === 100; }));
  await mk('quests', 'testquest', 'Testquest');
  await p.locator('.ed-form select', { has: p.locator('option', { hasText: '+ Aktion hinzufügen…' }) }).first().selectOption('ask'); await p.waitForTimeout(80);
  await p.locator('.ed-form .ed-act .ed-actbody select', { has: p.locator('option', { hasText: '+ Aktion hinzufügen…' }) }).first().selectOption('say'); await p.waitForTimeout(80);
  await p.locator('.ed-form .ed-act .ed-act textarea').first().fill('Verschachtelt!'); await p.keyboard.press('Tab');
  check('Verschachtelte Aktionsliste (Ja/Nein -> Dialog)', await ev(() => { const r = Data.quest('testquest').rewards; return r[0].k === 'ask' && r[0].yes.length === 1 && r[0].yes[0].k === 'say' && r[0].yes[0].text === 'Verschachtelt!' && Array.isArray(r[0].no); }), await ev(() => Data.quest('testquest').rewards));
  await p.locator('.ed-form .ed-act .ed-acthead select').first().selectOption('if'); await p.waitForTimeout(80);
  check('Aktionsart wechseln setzt Felder neu', await ev(() => { const a = Data.quest('testquest').rewards[0]; return a.k === 'if' && Array.isArray(a.cond) && Array.isArray(a.then) && a.yes === undefined; }));
  // Karte
  await nav('maps'); await btn('Neu', '.ed-tools'); await p.locator('.ed-modal input[type=text]').nth(0).fill('spielwiese'); await p.locator('.ed-modal input[type=text]').nth(1).fill('Spielwiese');
  await p.locator('.ed-modal input[type=number]').nth(0).fill('10'); await p.locator('.ed-modal input[type=number]').nth(1).fill('9'); await ok();
  await layer('NPCs'); await clickCell(4, 3);
  await field('.ed-side', 'ID').locator('input').fill('wirt'); await p.keyboard.press('Tab'); await p.waitForTimeout(60);
  check('NPC-ID geändert', await ev(() => { const m = Data.map('spielwiese'), s = Editor.pages.maps.state; return m.npcs[0].id === 'wirt' && s.ent.id === 'wirt'; }));
  await btn('Händler', '.ed-side'); await p.locator('.ed-modal select').selectOption('testshop'); await ok();
  check('NPC-Vorlage Händler weist Shop zu', await ev(() => Data.map('spielwiese').npcs[0].pages[0].do[0].shop === 'testshop'));
  await field('.ed-side', 'Bewegung').locator('select').selectOption('wander'); await p.waitForTimeout(60);
  check('Bewegungsmuster: Reichweite erscheint', await field('.ed-side', 'Reichweite').count() === 1 && await ev(() => Data.map('spielwiese').npcs[0].move === 'wander'));
  await field('.ed-side', 'Bewegung').locator('select').selectOption('none'); await p.waitForTimeout(60);
  await clickCell(7, 3); await btn('Gegenstand schenken', '.ed-side'); await ok();
  check('NPC-Vorlage Geschenk (zwei Seiten, Flag)', await ev(() => { const n = Data.map('spielwiese').npcs[1]; return n.pages.length === 2 && n.pages[0].if[0].k === 'flag' && n.pages[1].do.some(a => a.k === 'setFlag' && a.flag === n.pages[0].if[0].flag) && n.pages[1].do.some(a => a.k === 'giveItem'); }));
  await clickCell(1, 1); check('Dritter NPC', await ev(() => Data.map('spielwiese').npcs.length === 3));
  await p.keyboard.press('Delete'); await p.waitForTimeout(80);
  check('Entf löscht ausgewählten NPC', await ev(() => Data.map('spielwiese').npcs.length === 2 && !Editor.pages.maps.state.ent));
  await layer('Ereignisse'); await clickCell(2, 5); await btn('Gegenstand am Boden', '.ed-side'); await ok();
  await layer('Übergänge'); await clickCell(8, 7);
  await field('.ed-side', 'Art').locator('select').selectOption('push'); await p.waitForTimeout(60);
  check('Übergang Art "push": Laufrichtung erscheint', await field('.ed-side', 'Laufrichtung').count() === 1);
  await field('.ed-side', 'Art').locator('select').selectOption('step'); await p.waitForTimeout(60);
  await field('.ed-side', 'Zielkarte').locator('select').selectOption('spielwiese');
  const nums = field('.ed-side', 'Zielposition').locator('input[type=number]'); await nums.nth(0).fill('1'); await p.keyboard.press('Tab'); await nums.nth(1).fill('1'); await p.keyboard.press('Tab');
  // Tastenkürzel
  await p.locator('.ed-mapwrap').click({ position: { x: 4, y: 4 } }); await p.keyboard.press('Escape'); await p.keyboard.press('3'); await p.waitForTimeout(60);
  check('Taste 3 wählt Ebene Objekte', await ev(() => Editor.pages.maps.state.layer === 'objects'));
  await p.keyboard.press('e'); await p.waitForTimeout(60); check('Taste E wählt Radierer', await ev(() => Editor.pages.maps.state.tool === 'erase'));
  await p.keyboard.press('b'); await p.waitForTimeout(60);
  // Karte duplizieren / löschen / Grösse per Dialog
  await btn('Duplizieren', '.ed-tools');
  check('Karte dupliziert', await ev(() => { const s = Editor.pages.maps.state, m = Data.map(s.mapId); return s.mapId !== 'spielwiese' && m.name === 'Spielwiese (Kopie)' && m.npcs.length === 2 && m.npcs !== Data.map('spielwiese').npcs; }));
  { const cw = await ev(() => Data.map(Editor.pages.maps.state.mapId).w); await btn('Ändern…', '.ed-side'); await p.locator('.ed-modal input[type=number]').nth(0).fill(String(6 - cw)); await ok(); }   // "Rechts anfügen" negativ = Karte schmaler
  check('Grösse per Dialog (Elemente bleiben in der Karte)', await ev(() => { const m = Data.map(Editor.pages.maps.state.mapId); return m.w === 6 && m.layers.ground.length === 54 && m.npcs.every(n => n.x < 6) && m.warps.every(w => w.x < 6); }));
  await btn('Löschen', '.ed-tools'); await ok();
  check('Karte gelöscht', await ev(() => !DB.maps.some(m => m.name === 'Spielwiese (Kopie)')));
  // Rückgängig-Verlauf ist begrenzt
  await ev(() => { for (let i = 0; i < 50; i++) { DB.meta.author = 'A' + i; Editor.commit(); } });
  check('Rückgängig-Verlauf auf 40 Schritte begrenzt', await ev(() => Editor.undoStack.length === 40));
  await p.keyboard.press('Control+s'); await p.waitForTimeout(100);
  check('Strg+S speichert', await ev(() => !Editor.dirty && Project.source === 'working'));

  console.log('4) Neue Inhalte direkt im Spiel testen');
  await ev(() => { Editor.go({ page: 'maps', map: 'spielwiese' }); });
  await btn('Hier testen', '.ed-tools'); await clickCell(4, 4); await p.waitForTimeout(400);
  check('Testspiel auf neuer Karte', await ev(() => World.active && World.mapId === 'spielwiese' && World.p.x === 4 && World.p.y === 4 && G.party.length === 3 && G.money === 5000));
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(60); await p.keyboard.up('ArrowUp'); await p.waitForTimeout(250);
  check('Spieler dreht sich zum NPC (blockiert)', await ev(() => World.p.dir === 'up' && World.p.y === 4));
  await p.keyboard.press('z'); await p.waitForTimeout(900);
  check('Ansprechen öffnet den zugewiesenen Shop', await ev(() => World.lock > 0 && UI.layers.length >= 2 && UI.tb.lines.join(' ').indexOf('Was darf es sein') >= 0), await ev(() => ({ lock: World.lock, tb: UI.tb.lines, n: UI.layers.length })));
  await p.screenshot({ path: path.join(OUT, 'edt_testshop.png') });
  await p.keyboard.press('x'); await p.waitForTimeout(900); await p.keyboard.press('z'); await p.waitForTimeout(500);
  check('Shop verlassen', await ev(() => World.lock === 0), await ev(() => ({ lock: World.lock, tb: UI.tb.lines })));
  // Gegenstand am Boden aufheben: Ereignis bei (2,5); Spieler nach (3,5), Blick links
  await ev(() => { World.p.x = 3; World.p.y = 5; World.p.dir = 'left'; });
  const before = await ev(() => Bag.count(DB.items[0].id));
  await p.keyboard.press('z'); await p.waitForTimeout(2600); await p.keyboard.press('z'); await p.waitForTimeout(600);
  check('Ereignis "Gegenstand am Boden" vergibt Item und verschwindet', await ev(n => Bag.count(DB.items[0].id) === n + 1 && World.ents.find(e => e.kind === 'event').hidden === true, before), await ev(() => ({ n: Bag.count(DB.items[0].id), lock: World.lock, tb: UI.tb.lines })));
  // Übergang betreten: Warp bei (8,7) -> (1,1)
  await ev(() => { World.p.x = 7; World.p.y = 7; World.p.dir = 'right'; World.p.walked = true; });
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(450); await p.keyboard.up('ArrowRight'); await p.waitForTimeout(900);
  check('Übergang teleportiert zum Ziel', await ev(() => World.p.x === 1 && World.p.y === 1 && World.mapId === 'spielwiese'), await ev(() => ({ x: World.p.x, y: World.p.y })));
  await p.keyboard.press('F2'); await p.waitForTimeout(200);
  check('Zurück im Editor', await ev(() => Engine.editorOpen && Editor.page === 'maps'));
  await ctx.close();

  console.log('5) Touch-Bedienung (Tablet 1024x768)');
  const tctx = await b.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const t = await tctx.newPage(); const terrs = []; t.on('pageerror', e => terrs.push('PAGEERROR ' + e.message));
  await t.goto('file://' + FILE); await t.waitForTimeout(400);
  await t.tap('#lm-btn-editor'); await t.waitForTimeout(250);
  check('Editor per Touch-Button geöffnet', await t.evaluate(() => Engine.editorOpen && Editor.root.classList.contains('open')));
  const tileId = await t.evaluate(() => DB.tiles.find(x => x.sprite === 't_flower_a').id);
  await t.tap('.ed-pal canvas[data-tile="' + tileId + '"]'); await t.waitForTimeout(100);
  const r = await t.locator('.ed-mapwrap canvas').boundingBox(), z = await t.evaluate(() => Editor.pages.maps.state.zoom);
  await t.touchscreen.tap(r.x + 3.5 * 16 * z, r.y + 2.5 * 16 * z); await t.waitForTimeout(120);
  check('Tippen malt ein Tile', await t.evaluate(id => { const m = Data.map(Editor.pages.maps.state.mapId); return m.layers.ground[2 * m.w + 3] === id; }, tileId));
  await t.screenshot({ path: path.join(OUT, 'edt_tablet_map.png') });
  await t.tap('.ed-nav button[data-page="pixel"]'); await t.waitForTimeout(150);
  await t.evaluate(() => { DB.sprites.touch_test = Editor.blankSprite(8, 8); Editor.go({ page: 'pixel', sprite: 'touch_test' }); });
  const r2 = await t.locator('.ed-mapwrap canvas').boundingBox(), z2 = r2.width / 8;
  await t.touchscreen.tap(r2.x + 2.5 * z2, r2.y + 3.5 * z2); await t.waitForTimeout(120);
  check('Tippen zeichnet einen Pixel', await t.evaluate(() => DB.sprites.touch_test.px[3][2] === '3'), await t.evaluate(() => DB.sprites.touch_test.px));
  await t.screenshot({ path: path.join(OUT, 'edt_tablet_pixel.png') });
  await t.tap('.ed-nav button[data-page="trainers"]'); await t.waitForTimeout(150); await t.screenshot({ path: path.join(OUT, 'edt_tablet_trainer.png') });
  check('Keine Fehler bei Touch-Bedienung', terrs.length === 0, terrs);
  await tctx.close();

  console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen' + (fails.length ? ':\n - ' + fails.join('\n - ') : ''));
  console.log(errs.length ? 'JS-FEHLER:\n' + errs.join('\n') : 'keine JS-Fehler');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('TEST ABGEBROCHEN', e); process.exit(2); });
