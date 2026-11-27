// Funktionstest des Editors über die echte Oberfläche (Klicks, Dialoge, Zeichnen) + Zustandsprüfungen.
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out'), FILE = process.argv[2] || process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html');
require('fs').mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const fails = [];
function check(name, ok, info) { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; fails.push(name); console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); } }
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto('file://' + FILE); await p.waitForTimeout(400);
  const ev = (fn, a) => p.evaluate(fn, a), nav = async id => { await p.click('.ed-nav button[data-page="' + id + '"]'); await p.waitForTimeout(80); };
  const btn = async (text, scope) => { await p.locator((scope || '#ed-root') + ' button', { hasText: text }).first().click(); await p.waitForTimeout(60); };
  const ok = async () => { await p.click('.ed-modal .ed-ok'); await p.waitForTimeout(80); };
  const mapCell = async (x, y) => { const z = await ev(() => Editor.pages.maps.state.zoom), r = await p.locator('.ed-mapwrap canvas').boundingBox(); return { x: r.x + (x + 0.5) * 16 * z, y: r.y + (y + 0.5) * 16 * z }; };
  const clickCell = async (x, y) => { const c = await mapCell(x, y); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(60); };
  const dragCells = async (x0, y0, x1, y1) => { const a = await mapCell(x0, y0), c = await mapCell(x1, y1); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move((a.x + c.x) / 2, (a.y + c.y) / 2, { steps: 6 }); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(60); };
  const layer = async name => { await p.locator('.ed-tools button', { hasText: new RegExp('^' + name + '$') }).first().click(); await p.waitForTimeout(60); };

  console.log('1) Editor öffnen');
  await p.keyboard.press('F2'); await p.waitForTimeout(200);
  check('Editor offen, Spiel pausiert', await ev(() => Engine.editorOpen && document.getElementById('ed-root').classList.contains('open')));
  const baseMaps = await ev(() => DB.maps.length);

  console.log('2) Neue Karte + Tiles malen');
  await btn('Neu', '.ed-tools');
  await p.locator('.ed-modal input[type=text]').nth(0).fill('testkarte'); await p.locator('.ed-modal input[type=text]').nth(1).fill('Testkarte');
  await p.locator('.ed-modal input[type=number]').nth(0).fill('12'); await p.locator('.ed-modal input[type=number]').nth(1).fill('10'); await ok();
  check('Karte angelegt', await ev(() => { const m = Data.map('testkarte'); return !!m && m.w === 12 && m.h === 10 && m.layers.ground.every(v => v === DB.tiles[0].id) && Editor.pages.maps.state.mapId === 'testkarte'; }));
  const grassId = await ev(() => (DB.tiles.find(t => t.kind === 'grass') || {}).id), treeId = await ev(() => (DB.tiles.find(t => t.sprite === 't_tree') || {}).id), pathId = await ev(() => (DB.tiles.find(t => t.sprite === 't_path') || {}).id);
  await p.click('.ed-pal canvas[data-tile="' + grassId + '"]'); await p.waitForTimeout(60);
  await dragCells(2, 2, 6, 2);
  check('Stift: 5 Felder hohes Gras', await ev(g => { const m = Data.map('testkarte'); return [2, 3, 4, 5, 6].every(x => m.layers.ground[2 * 12 + x] === g); }, grassId));
  await p.click('.ed-pal canvas[data-tile="' + pathId + '"]'); await btn('Füllen', '.ed-tools'); await clickCell(0, 0);
  check('Füllen: Boden ersetzt, Gras bleibt', await ev(a => { const m = Data.map('testkarte'); return m.layers.ground[0] === a.p && m.layers.ground[9 * 12 + 11] === a.p && m.layers.ground[2 * 12 + 4] === a.g; }, { p: pathId, g: grassId }));
  await layer('Objekte'); await p.click('.ed-pal canvas[data-tile="' + treeId + '"]'); await btn('Rechteck', '.ed-tools'); await dragCells(0, 0, 11, 0);
  check('Rechteck: Baumreihe auf Objekt-Ebene', await ev(t => { const m = Data.map('testkarte'); return m.layers.objects.slice(0, 12).every(v => v === t) && m.layers.objects[12] === 0; }, treeId));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  check('Rückgängig entfernt Baumreihe', await ev(() => Data.map('testkarte').layers.objects.every(v => v === 0)));
  await p.keyboard.press('Control+y'); await p.waitForTimeout(100);
  check('Wiederholen stellt Baumreihe her', await ev(t => Data.map('testkarte').layers.objects.slice(0, 12).every(v => v === t), treeId));
  await btn('Radierer', '.ed-tools'); await clickCell(11, 0);
  check('Radierer löscht Tile', await ev(() => Data.map('testkarte').layers.objects[11] === 0));
  // Auswahl, Kopieren, Einfügen, Vorlage
  await layer('Boden'); await btn('Auswählen', '.ed-tools'); await dragCells(2, 2, 4, 2); await btn('Kopieren', '.ed-tools'); await btn('Einfügen', '.ed-tools'); await clickCell(2, 6);
  check('Kopieren/Einfügen', await ev(g => { const m = Data.map('testkarte'); return [2, 3, 4].every(x => m.layers.ground[6 * 12 + x] === g); }, grassId));
  await p.keyboard.press('Escape'); await btn('Auswählen', '.ed-tools'); await dragCells(0, 0, 2, 1); await btn('Als Vorlage', '.ed-tools'); await p.locator('.ed-modal input[type=text]').fill('Testvorlage'); await ok();
  check('Vorlage gespeichert', await ev(() => { const pf = DB.prefabs.find(x => x.name === 'Testvorlage'); return !!pf && pf.w === 3 && pf.h === 2 && pf.objects.length === 6; }));
  const pfId = await ev(() => DB.prefabs.find(x => x.name === 'Testvorlage').id);
  await p.click('.ed-pal canvas[data-prefab="' + pfId + '"]'); await p.waitForTimeout(60); await clickCell(6, 7);
  check('Vorlage platziert', await ev(a => { const m = Data.map('testkarte'); return m.layers.objects[7 * 12 + 6] === a.t && m.layers.ground[8 * 12 + 6] === a.p; }, { t: treeId, p: pathId }));
  // Kollision und Begegnungszone
  await p.keyboard.press('Escape'); await layer('Kollision'); await btn('Blockiert', '.ed-palcol'); await btn('Stift', '.ed-tools'); await clickCell(9, 5);
  check('Kollision gemalt', await ev(() => Data.map('testkarte').layers.collision[5 * 12 + 9] === 2));
  await layer('Begegnungszonen'); await btn('Zone 2', '.ed-palcol'); await clickCell(9, 6);
  check('Begegnungszone gemalt', await ev(() => Data.map('testkarte').layers.encounter[6 * 12 + 9] === 2));
  await p.screenshot({ path: path.join(OUT, 'edt_map_zone.png') });

  console.log('3) NPC, Ereignis, Übergang');
  await layer('NPCs'); await clickCell(3, 4);
  check('NPC angelegt und ausgewählt', await ev(() => { const m = Data.map('testkarte'), s = Editor.pages.maps.state; return m.npcs.length === 1 && m.npcs[0].x === 3 && m.npcs[0].y === 4 && s.ent && s.ent.kind === 'npc'; }));
  await p.locator('.ed-side .ed-f', { hasText: 'Name' }).first().locator('input').fill('Pflegerin'); await p.keyboard.press('Tab');
  await btn('Heiler', '.ed-side');
  check('NPC-Vorlage Heiler', await ev(() => { const n = Data.map('testkarte').npcs[0]; return n.name === 'Pflegerin' && n.pages[0].do[0].k === 'ask' && n.pages[0].do[0].yes.some(a => a.k === 'heal') && n.pages[0].do[0].yes.some(a => a.k === 'setRespawn'); }));
  // NPC verschieben (ziehen)
  await dragCells(3, 4, 4, 5);
  check('NPC durch Ziehen verschoben', await ev(() => { const n = Data.map('testkarte').npcs[0]; return n.x === 4 && n.y === 5; }));
  // Bedingung + Aktion über die generierten Formulare
  await p.locator('.ed-side select', { has: p.locator('option', { hasText: '+ Bedingung…' }) }).first().selectOption('hasBadge'); await p.waitForTimeout(80);
  check('Bedingung über Formular hinzugefügt', await ev(() => { const c = Data.map('testkarte').npcs[0].visibleIf[0]; return c && c.k === 'hasBadge' && c.gym === DB.gyms[0].id; }));
  await p.locator('.ed-side select', { has: p.locator('option', { hasText: '+ Aktion hinzufügen…' }) }).last().selectOption('giveItem'); await p.waitForTimeout(80);
  check('Aktion über Formular hinzugefügt', await ev(() => { const d = Data.map('testkarte').npcs[0].pages[0].do; return d.length === 2 && d[1].k === 'giveItem' && d[1].item === DB.items[0].id && d[1].n === 1; }));
  await p.screenshot({ path: path.join(OUT, 'edt_npc.png') });
  await layer('Ereignisse'); await clickCell(6, 4); await btn('Gegenstand am Boden', '.ed-side'); await ok();
  check('Ereignis-Vorlage Gegenstand', await ev(() => { const e = Data.map('testkarte').events[0]; return e && e.x === 6 && e.sprite === 's_pouch' && e.solid && e.once && e.pages[0].do[0].k === 'giveItem'; }));
  await clickCell(8, 4); await btn('Schild', '.ed-side'); await p.locator('.ed-modal textarea').fill('Testschild!'); await ok();
  check('Ereignis-Vorlage Schild', await ev(() => { const e = Data.map('testkarte').events[1]; return e && e.pages[0].do[0].text === 'Testschild!' && e.trigger === 'interact'; }));
  await layer('Übergänge'); await clickCell(5, 9);
  await p.locator('.ed-side .ed-f', { hasText: 'Zielkarte' }).first().locator('select').selectOption('welpenhain');
  const tx = await ev(() => { const m = Data.map('welpenhain'); for (let y = 2; y < m.h - 1; y++) for (let x = 2; x < m.w - 2; x++) if (!Editor.cellSolid(m, x, y) && !Editor.cellSolid(m, x, y + 1) && !m.warps.some(w => w.x === x && (w.y === y || w.y === y + 1))) return { x, y }; });
  const numIn = p.locator('.ed-side .ed-f', { hasText: 'Zielposition' }).first().locator('input[type=number]');
  await numIn.nth(0).fill(String(tx.x)); await p.keyboard.press('Tab'); await numIn.nth(1).fill(String(tx.y)); await p.keyboard.press('Tab');
  check('Übergang konfiguriert', await ev(t => { const w = Data.map('testkarte').warps[0]; return w && w.toMap === 'welpenhain' && w.toX === t.x && w.toY === t.y && w.x === 5 && w.y === 9; }, tx));
  const wBefore = await ev(() => Data.map('welpenhain').warps.length);
  await btn('Rückweg erzeugen', '.ed-side');
  check('Rückweg erzeugt (zwei Karten verbunden)', await ev(n => { const ws = Data.map('welpenhain').warps; return ws.length === n + 1 && ws[ws.length - 1].toMap === 'testkarte' && ws[ws.length - 1].kind === 'push'; }, wBefore));
  // "Ziel auf Karte wählen"
  await btn('Ziel auf Karte wählen', '.ed-side'); await p.waitForTimeout(100);
  check('Zielwahl wechselt zur Zielkarte', await ev(() => Editor.pages.maps.state.mapId === 'welpenhain' && !!Editor.pages.maps.state.pick));
  await clickCell(tx.x, tx.y + 1);
  check('Zielwahl setzt Position und kehrt zurück', await ev(t => { const w = Data.map('testkarte').warps[0], s = Editor.pages.maps.state; return w.toY === t.y + 1 && s.mapId === 'testkarte' && !s.pick; }, tx));
  // Nahtlose Verbindung + Gegenrichtung
  await p.keyboard.press('Escape'); await p.waitForTimeout(80);
  await p.locator('.ed-side .ed-row', { hasText: 'Osten' }).locator('select').selectOption('route2'); await p.waitForTimeout(60);
  await p.locator('.ed-side .ed-row', { hasText: 'Osten' }).locator('button').click(); await p.waitForTimeout(60);
  check('Kartenränder verbunden (beide Richtungen)', await ev(() => { const a = Data.map('testkarte').connections.east, c = Data.map('route2').connections.west; return a && a.map === 'route2' && c && c.map === 'testkarte'; }));
  await ev(() => { delete Data.map('route2').connections.west; delete Data.map('testkarte').connections.east; Editor.commit(); });
  // Begegnungstabelle
  await btn('+ Tabelle', '.ed-side'); await btn('+ Monster', '.ed-side');
  check('Begegnungstabelle mit Slot', await ev(() => { const e = Data.map('testkarte').encounters[0]; return e && e.zone === 1 && e.slots.length === 1 && e.slots[0].species === DB.monsters[0].id && e.slots[0].min === 2; }));
  // Startposition
  await btn('Startposition setzen', '.ed-tools'); await clickCell(2, 4);
  check('Startposition gesetzt', await ev(() => DB.meta.startMap === 'testkarte' && DB.meta.startX === 2 && DB.meta.startY === 4));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  check('Startposition rückgängig', await ev(() => DB.meta.startMap !== 'testkarte'));
  // Grösse ändern
  await ev(() => { Editor.pages.maps.resizeMap(Data.map('testkarte'), 14, 11, 1, 1); Editor.commit(); Editor.render(); });
  check('Grösse ändern verschiebt Inhalt', await ev(g => { const m = Data.map('testkarte'); return m.w === 14 && m.h === 11 && m.layers.ground[3 * 14 + 3] === g && m.npcs[0].x === 5 && m.npcs[0].y === 6 && m.layers.ground.length === 154; }, grassId));

  console.log('4) Datenbank: Monster, Attacke, Trainer, Arena, Gegenstand');
  const mk = async (page, id, name) => { await nav(page); await btn('Neu', '.ed-listhead'); await p.locator('.ed-modal input[type=text]').nth(0).fill(id); await p.locator('.ed-modal input[type=text]').nth(1).fill(name); await ok(); };
  await mk('monsters', 'testmon', 'Testmon');
  check('Monster angelegt', await ev(() => { const m = Data.idx.monsters.testmon; return !!m && m.name === 'Testmon' && m.no === 38 && Editor.sel.monsters === 'testmon'; }));
  await p.locator('.ed-form .ed-f', { hasText: 'Basiswerte' }).first().locator('input').nth(0).fill('77'); await p.keyboard.press('Tab');
  await btn('+ Attacke', '.ed-form'); await btn('+ Entwicklung', '.ed-form');
  await p.locator('.ed-form .ed-f', { hasText: 'Lexikon-Beschreibung' }).locator('textarea').fill('Ein Testmonster.'); await p.keyboard.press('Tab');
  check('Monster bearbeitet (Basiswert, Lernliste, Entwicklung, Text)', await ev(() => { const m = Data.idx.monsters.testmon; return m.base.hp === 77 && m.learnset.length === 2 && m.evolutions.length === 1 && m.evolutions[0].kind === 'level' && m.desc === 'Ein Testmonster.'; }));
  await p.locator('.ed-form .ed-row select', { has: p.locator('option', { hasText: 'durch Gegenstand' }) }).selectOption('item'); await p.waitForTimeout(60);
  check('Entwicklungsbedingung Gegenstand (Feld erscheint)', await ev(() => Data.idx.monsters.testmon.evolutions[0].kind === 'item') && await p.locator('.ed-form .ed-row .ed-f', { hasText: 'Gegenstand' }).count() > 0);
  await btn('Dupl.', '.ed-listhead');
  check('Monster dupliziert', await ev(() => DB.monsters.length === 39 && DB.monsters[38].no === 39 && DB.monsters[38].base.hp === 77));
  await btn('Löschen', '.ed-listhead'); await ok();
  check('Monster gelöscht', await ev(() => DB.monsters.length === 38));
  await mk('moves', 'testhieb', 'Testhieb'); await btn('+ Effekt', '.ed-form');
  check('Attacke mit Effekt', await ev(() => { const m = Data.idx.moves.testhieb; return !!m && m.effects.length === 1 && m.effects[0].k === 'status' && m.effects[0].status === 'poison'; }));
  await p.locator('.ed-form .ed-row .ed-f', { hasText: 'Effekt' }).first().locator('select').selectOption('stat'); await p.waitForTimeout(60);
  check('Effektart gewechselt -> Standardwerte', await ev(() => { const e = Data.idx.moves.testhieb.effects[0]; return e.k === 'stat' && e.stages === -1; }), await ev(() => Data.idx.moves.testhieb.effects[0]));
  await mk('trainers', 'testtrainer', 'Tina'); await btn('+ Monster', '.ed-form');
  check('Trainer mit Team', await ev(() => { const t = Data.idx.trainers.testtrainer; return !!t && t.team.length === 2 && t.team[1].level === 5; }));
  await mk('gyms', 'testarena', 'Testarena');
  await p.locator('.ed-form .ed-f', { hasText: 'Arena-Leiter' }).first().locator('select').selectOption('testtrainer');
  await p.locator('.ed-form .ed-f', { hasText: 'Arena-Karte' }).first().locator('select').selectOption('testkarte');
  await p.locator('.ed-form select', { has: p.locator('option', { hasText: '+ Aktion hinzufügen…' }) }).first().selectOption('giveMoney'); await p.waitForTimeout(60);
  check('Arena konfiguriert', await ev(() => { const g = Data.idx.gyms.testarena; return !!g && g.leader === 'testtrainer' && g.map === 'testkarte' && g.rewards[0].k === 'giveMoney' && g.rewards[0].n === 100 && g.badge.name; }));
  await p.screenshot({ path: path.join(OUT, 'edt_gym.png') });
  await mk('items', 'testleine', 'Testleine');
  await p.locator('.ed-form .ed-f', { hasText: 'Kategorie' }).first().locator('select').selectOption('leash'); await p.waitForTimeout(60);
  await p.locator('.ed-form .ed-f', { hasText: 'Fangstärke' }).first().locator('input').fill('3'); await p.keyboard.press('Tab');
  check('Gegenstand (Leine mit Fangstärke)', await ev(() => { const i = Data.idx.items.testleine; return i.cat === 'leash' && i.leash === 3; }));
  await nav('types'); await p.locator('.ed-matrix tr').nth(1).locator('td').nth(0).click();
  check('Typentabelle: Klick schaltet Faktor', await ev(() => DB.typeChart[DB.types[0].id][DB.types[0].id] === 2));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(80);
  await nav('songs'); await nav('sfx'); await nav('meta'); await nav('charsets'); await nav('tiles'); await nav('shops'); await nav('quests');

  console.log('5) Pixel-Editor');
  await nav('pixel'); await btn('Neu', '.ed-listhead'); await p.locator('.ed-modal input[type=text]').fill('test_sprite'); await ok();
  check('Sprite angelegt', await ev(() => { const s = DB.sprites.test_sprite; return !!s && s.w === 16 && s.h === 16 && s.px.every(r => r === '................') && Editor.pages.pixel.state.key === 'test_sprite'; }));
  const px = async (x, y) => { const z = await ev(() => { const c = document.querySelector('.ed-mapwrap canvas'); return c.width / DB.sprites[Editor.pages.pixel.state.key].w; }), r = await p.locator('.ed-mapwrap canvas').boundingBox(); return { x: r.x + (x + 0.5) * z, y: r.y + (y + 0.5) * z }; };
  const pxDrag = async (x0, y0, x1, y1) => { const a = await px(x0, y0), c = await px(x1, y1); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(60); };
  await pxDrag(2, 2, 9, 2); await pxDrag(2, 2, 2, 9); await pxDrag(2, 9, 9, 9); await pxDrag(9, 2, 9, 9);
  check('Stift zeichnet Rahmen', await ev(() => { const s = DB.sprites.test_sprite; return s.px[2].substr(2, 8) === '33333333' && s.px[5][2] === '3' && s.px[5][9] === '3' && s.px[5][5] === '.'; }), await ev(() => DB.sprites.test_sprite.px));
  await p.click('.ed-swatch[data-color="1"]'); await btn('Füllen', '.ed-tools'); const c5 = await px(5, 5); await p.mouse.click(c5.x, c5.y); await p.waitForTimeout(60);
  check('Füllen innen', await ev(() => { const s = DB.sprites.test_sprite; return s.px[5].substr(3, 6) === '111111' && s.px[0][0] === '.'; }));
  await p.click('.ed-swatch[data-color="0"]'); await btn('Stift', '.ed-tools'); await pxDrag(3, 3, 4, 3);
  await btn('⇋ Spiegeln', '.ed-tools');
  check('Horizontal spiegeln', await ev(() => { const r = DB.sprites.test_sprite.px[3]; return r[11] === '0' && r[12] === '0' && r[3] === '.'; }), await ev(() => DB.sprites.test_sprite.px[3]));
  await p.keyboard.press('Control+z'); await p.waitForTimeout(100);
  check('Rückgängig im Pixel-Editor', await ev(() => DB.sprites.test_sprite.px[3][3] === '0'));
  await btn('Radierer', '.ed-tools'); await pxDrag(2, 2, 3, 2);
  check('Radierer macht transparent', await ev(() => DB.sprites.test_sprite.px[2].substr(2, 2) === '..'));
  await btn('Auswahl', '.ed-tools'); await pxDrag(2, 9, 9, 9); await btn('Kopieren', '.ed-tools'); await btn('Einfügen', '.ed-tools');
  { const a = await px(4, 9), c = await px(4, 13); await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(c.x, c.y, { steps: 6 }); await p.mouse.up(); await p.keyboard.press('Enter'); await p.waitForTimeout(80); }
  check('Kopieren/Einfügen/Verschieben', await ev(() => { const s = DB.sprites.test_sprite; return s.px[13].substr(2, 8) === '33333333' && s.px[9].substr(2, 8) === '33333333'; }), await ev(() => DB.sprites.test_sprite.px));
  await p.screenshot({ path: path.join(OUT, 'edt_pixel.png') });
  const url = await ev(() => Editor.pages.pixel.exportDataURL(2));
  check('PNG-Export liefert Bild', /^data:image\/png;base64,/.test(url) && url.length > 200);
  await ev(async u => { DB.sprites.test_import = Editor.blankSprite(16, 16); Editor.pages.pixel.state.key = 'test_import'; await Editor.pages.pixel.importDataURL(u, 'fit'); }, url);
  check('PNG-Import (32x32 -> 16x16, 4 Stufen + Transparenz)', await ev(() => { const a = DB.sprites.test_sprite.px, c = DB.sprites.test_import.px; return c.length === 16 && c[13].substr(2, 8) === a[13].substr(2, 8) && c[0][0] === '.' && c[5][5] === a[5][5]; }), await ev(() => DB.sprites.test_import.px));
  await ev(() => { Editor.go({ page: 'pixel', sprite: 'c_hero_d0' }); });
  check('Animationsvorschau automatisch (Figur)', await ev(() => { const a = Editor.pages.pixel.state.anim; return a.keys.length === 4 && a.keys[1] === 'c_hero_d1' && a.flips[3] === true; }));
  await ev(() => { Editor.go({ page: 'pixel', sprite: 'test_sprite' }); });

  console.log('6) Validierung');
  let v = await ev(() => Editor.validate().filter(i => i.level === 'error').map(i => i.msg));
  check('Neue Inhalte ohne Fehler', v.length === 0, v);
  await ev(() => { Data.idx.monsters.testmon.learnset[0].move = 'gibtsnicht'; Data.idx.trainers.testtrainer.team[0].species = 'nix'; Data.map('testkarte').warps[0].toMap = 'weg'; Data.map('testkarte').npcs[0].pages[0].do.push({ k: 'giveItem', item: 'kaputt', n: 1 }, { k: 'unsinn' }); Data.idx.monsters.testmon.sprites.front = 'fehlt_sprite'; DB.monsters.push(U.clone(DB.monsters[0])); Data.map('testkarte').encounters[0].slots[0].species = 'x'; });
  v = await ev(() => Editor.validate().filter(i => i.level === 'error').map(i => i.msg));
  const need = ['Attacke "gibtsnicht"', 'Monster "nix"', 'Zielkarte "weg"', 'Gegenstand "kaputt"', 'unbekannter Art "unsinn"', 'Sprite "fehlt_sprite" fehlt', 'Doppelte ID', 'unbekanntem Monster "x"'];
  for (const n of need) check('Validierung meldet: ' + n, v.some(m => m.indexOf(n) >= 0), v.length);
  await nav('validate'); await p.screenshot({ path: path.join(OUT, 'edt_validate.png') });
  await p.locator('.ed-issue', { hasText: 'Zielkarte "weg"' }).first().click(); await p.waitForTimeout(100);
  check('Klick auf Meldung springt zum Übergang', await ev(() => { const s = Editor.pages.maps.state; return Editor.page === 'maps' && s.mapId === 'testkarte' && s.ent && s.ent.kind === 'warp'; }));
  await ev(() => { Data.idx.monsters.testmon.learnset[0].move = DB.moves[0].id; Data.idx.trainers.testtrainer.team[0].species = DB.monsters[0].id; Data.map('testkarte').warps[0].toMap = 'welpenhain'; Data.map('testkarte').npcs[0].pages[0].do.splice(-2, 2); Data.idx.monsters.testmon.sprites.front = ''; DB.monsters.pop(); Data.map('testkarte').encounters[0].slots[0].species = DB.monsters[0].id; Data.reindex(); Editor.commit(); });
  v = await ev(() => Editor.validate().filter(i => i.level === 'error').map(i => i.msg));
  check('Nach Korrektur fehlerfrei', v.length === 0, v);

  console.log('7) JSON-Export / Re-Import');
  const res = await ev(() => { const json = Project.toJSON(); const before = JSON.stringify(DB); DB.maps = DB.maps.filter(m => m.id !== 'testkarte'); Data.reindex(); Editor.commit(); const gone = !Data.map('testkarte'); Editor.importJSONText(json); return { gone, back: !!Data.map('testkarte') && !!Data.idx.monsters.testmon, same: JSON.stringify(DB) === before, undo: Editor.undoStack.length > 0 }; });
  check('JSON-Re-Import stellt Projekt identisch her', res.gone && res.back && res.same && res.undo, res);
  let threw = await ev(() => { try { Editor.importJSONText('{"format":"falsch"}'); return false; } catch (e) { return e.message; } });
  check('Ungültiges JSON wird abgelehnt', typeof threw === 'string' && await ev(() => !!Data.map('testkarte')), threw);
  const [dl] = await Promise.all([p.waitForEvent('download'), (async () => { await nav('project'); await btn('Projekt als JSON exportieren', '.ed-form'); })()]);
  const jsonPath = path.join(OUT, 'edt_export.json'); await dl.saveAs(jsonPath);
  const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  check('JSON-Datei-Download enthält neue Inhalte', exported.format === 'leinenmeister-project' && exported.maps.some(m => m.id === 'testkarte') && exported.monsters.some(m => m.id === 'testmon') && !!exported.sprites.test_sprite, dl.suggestedFilename());

  console.log('8) Sicherheitskopie, Arbeitskopie');
  await btn('Sicherheitskopie anlegen', '.ed-form'); await ok();
  check('Sicherheitskopie angelegt', await ev(() => Project.backupList().length === 1));
  await ev(() => { DB.monsters = DB.monsters.filter(m => m.id !== 'testmon'); Data.reindex(); Editor.commit(); Editor.render(); });
  await btn('Wiederherstellen', '.ed-form'); await ok();
  check('Sicherheitskopie wiederhergestellt', await ev(() => !!Data.idx.monsters.testmon));
  await btn('Löschen', '.ed-form .ed-row'); await ok();
  check('Sicherheitskopie gelöscht', await ev(() => Project.backupList().length === 0));
  check('Ungespeichert-Anzeige aktiv', await ev(() => Editor.dirty && document.querySelector('.ed-status').classList.contains('dirty')));
  await btn('Speichern', '.ed-top');
  check('Speichern legt Arbeitskopie an', await ev(() => !Editor.dirty && !!localStorage.getItem('leinenmeister.project.' + DB.meta.id) && Project.source === 'working'));

  console.log('9) HTML-Export und erneuter Export');
  // Export mit Validierungsfehler: Rückfrage erscheint, Export bleibt möglich
  await ev(() => { Data.idx.trainers.testtrainer.team[0].species = 'nix'; Editor.commit(); });
  await btn('HTML exportieren', '.ed-top'); await p.waitForTimeout(150);
  check('Export zeigt Validierungsfehler vorab', (await p.locator('.ed-modal p').innerText()).indexOf('Monster "nix"') >= 0);
  await p.click('.ed-modal .ed-cancel'); await p.waitForTimeout(100);
  check('Abbruch führt zur Validierungsseite', await ev(() => Editor.page === 'validate'));
  await ev(() => { Data.idx.trainers.testtrainer.team[0].species = DB.monsters[0].id; Editor.commit(); });
  const [dl2] = await Promise.all([p.waitForEvent('download'), btn('HTML exportieren', '.ed-top')]);
  const htmlPath = path.join(OUT, 'edt_export1.html'); await dl2.saveAs(htmlPath);
  const html1 = fs.readFileSync(htmlPath, 'utf8');
  check('HTML-Export geladen (' + Math.round(html1.length / 1024) + ' KB, ' + dl2.suggestedFilename() + ')', html1.indexOf('id="lm-engine"') > 0 && html1.indexOf('id="lm-data"') > 0 && html1.indexOf('testkarte') > 0);
  const ctx2 = await b.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 }); const p2 = await ctx2.newPage(); const errs2 = [];
  p2.on('pageerror', e => errs2.push('PAGEERROR ' + e.message)); p2.on('console', m => { if (m.type() === 'error') errs2.push('CONSOLE ' + m.text()); });
  await p2.goto('file://' + htmlPath); await p2.waitForTimeout(400);
  check('Exportierte Datei: eingebettete Daten enthalten alle Änderungen (frischer Browser, ohne Arbeitskopie)', await p2.evaluate(() => Project.source === 'embedded' && !!Data.map('testkarte') && Data.map('testkarte').npcs[0].name === 'Pflegerin' && !!Data.idx.monsters.testmon && !!Data.idx.gyms.testarena && !!DB.sprites.test_sprite && DB.prefabs.some(x => x.name === 'Testvorlage')));
  await p2.keyboard.press('F2'); await p2.waitForTimeout(200);
  check('Exportierte Datei: Editor öffnet sich', await p2.evaluate(() => Engine.editorOpen && Editor.root.classList.contains('open')));
  const html2 = await p2.evaluate(() => { DB.maps.find(m => m.id === 'testkarte').name = 'Zweitexport'; Editor.commit(); return Project.buildHTML(); });
  const strip = h => h.replace(/"revision":\d+/, '').replace(/"savedAt":\d+/, '');
  const code = h => h.substring(h.indexOf('id="lm-engine">'), h.indexOf('id="lm-data"'));
  check('Erneuter Export: identischer Programmcode, geänderte Daten', code(html1) === code(html2) && html2.indexOf('Zweitexport') > 0 && strip(html1) !== strip(html2));
  const htmlPath2 = path.join(OUT, 'edt_export2.html'); fs.writeFileSync(htmlPath2, html2);
  const p3 = await ctx2.newPage(); p3.on('pageerror', e => errs2.push('PAGEERROR3 ' + e.message)); await p3.goto('file://' + htmlPath2); await p3.waitForTimeout(400);
  check('Zweite Exportgeneration lädt und enthält Änderung', await p3.evaluate(() => Data.map('testkarte').name === 'Zweitexport' && typeof Editor.open === 'function' && typeof Project.buildHTML === 'function'));
  const orig = fs.readFileSync(FILE, 'utf8');
  check('Export hat denselben Programmcode wie die Ausgangsdatei', code(orig) === code(html1));
  check('Keine Fehler in exportierten Dateien', errs2.length === 0, errs2);
  await ctx2.close();

  console.log('10) "Hier testen", zurück in den Editor, Schliessen');
  await nav('maps'); await ev(() => { const s = Editor.pages.maps.state; s.zoom = 3; Editor.render(); });
  await btn('Hier testen', '.ed-tools'); await clickCell(3, 5); await p.waitForTimeout(300);
  check('"Hier testen" startet Testspiel an Position', await ev(() => !Engine.editorOpen && Game.testMode && World.active && World.mapId === 'testkarte' && World.p.x === 3 && World.p.y === 5 && G.party.length > 0 && !document.getElementById('ed-root').classList.contains('open')), await ev(() => ({ open: Engine.editorOpen, map: World.mapId, x: World.p.x, y: World.p.y, party: G && G.party.length })));
  await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, 'edt_testplay.png') });
  await p.keyboard.press('F2'); await p.waitForTimeout(200);
  check('F2 führt zurück, Editorzustand erhalten', await ev(() => { const s = Editor.pages.maps.state; return Engine.editorOpen && Editor.page === 'maps' && s.mapId === 'testkarte' && s.zoom === 3; }));
  await btn('Spiel testen', '.ed-top'); await p.waitForTimeout(300);
  check('"Spiel testen" startet ab Spielstart', await ev(() => !Engine.editorOpen && Game.testMode && World.mapId === DB.meta.startMap && G.party.length === 0));
  await p.keyboard.press('F2'); await p.waitForTimeout(150);
  await ev(() => { Data.map('testkarte').name = 'Geändert'; Editor.commit(); });
  await btn('Schliessen', '.ed-top'); await p.waitForTimeout(300);
  check('Schliessen nach Änderung -> Titelbild mit neuen Daten', await ev(() => !Engine.editorOpen && !World.active && !Game.testMode && G === null));
  await p.keyboard.press('F2'); await p.waitForTimeout(150); await btn('Schliessen', '.ed-top'); await p.waitForTimeout(100);
  check('Schliessen ohne Änderung setzt fort', await ev(() => !Engine.editorOpen));
  // Arbeitskopie hat beim Neuladen Vorrang
  await p.keyboard.press('F2'); await p.waitForTimeout(100); await btn('Speichern', '.ed-top'); await p.reload(); await p.waitForTimeout(400);
  check('Neuladen: Arbeitskopie wird geladen', await ev(() => Project.source === 'working' && !!Data.map('testkarte') && Data.map('testkarte').name === 'Geändert'));
  await p.keyboard.press('F2'); await p.waitForTimeout(150); await nav('project'); await btn('Arbeitskopie verwerfen', '.ed-form'); await ok();
  check('Arbeitskopie verwerfen lädt eingebettete Daten', await ev(n => Project.source === 'embedded' && !Data.map('testkarte') && DB.maps.length === n, baseMaps));

  console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen' + (fails.length ? ':\n - ' + fails.join('\n - ') : ''));
  console.log(errs.length ? 'JS-FEHLER:\n' + errs.join('\n') : 'keine JS-Fehler');
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})().catch(e => { console.error('TEST ABGEBROCHEN', e); process.exit(2); });
