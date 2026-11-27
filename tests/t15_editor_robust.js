// Robustheit: leeres bzw. beschädigtes Projekt darf den Editor nicht zum Absturz bringen; Aufbau von Null.
const { chromium } = require('playwright'); const path = require('path');
const OUT = path.join(__dirname, 'out'), GAME = process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html'), FILE = process.argv[2] || GAME.replace(/\.html$/, '-Editor.html'), URL0 = 'file://' + FILE + '#spiel';   // FILE = Editor-Datei; #spiel = im Spiel starten (der Test öffnet den Editor selbst)
require('fs').mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const fails = [];
function check(name, ok, info) { if (ok) { pass++; console.log('  ok   ' + name); } else { fail++; fails.push(name); console.log('  FAIL ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : '')); } }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: 860 }, deviceScaleFactor: 1 }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await p.goto(URL0); await p.waitForTimeout(400); await p.keyboard.press('F2'); await p.waitForTimeout(200);
  const ev = (fn, a) => p.evaluate(fn, a);
  const allPages = async tag => { const ids = await ev(() => Editor.PAGES.filter(x => x[0] !== '-').map(x => x[0])); for (const id of ids) { await p.click('.ed-nav button[data-page="' + id + '"]'); await p.waitForTimeout(60); const bad = await ev(() => { const e = document.querySelector('.ed-main > .ed-err, .ed-main > .ed-form.ed-err'); return e ? e.textContent : ''; }); if (bad) errs.push(tag + ' Seite ' + id + ': ' + bad); } };
  const btn = async (text, scope) => { await p.locator((scope || '#ed-root') + ' button', { hasText: text }).first().click(); await p.waitForTimeout(60); };
  const ok = async () => { await p.click('.ed-modal .ed-ok'); await p.waitForTimeout(80); };

  console.log('1) Leeres Projekt');
  await ev(() => Editor.replaceProject(() => Data.init({ format: 'leinenmeister-project' })));
  await allPages('leer'); check('Alle Seiten rendern mit leerem Projekt', errs.length === 0, errs);
  const issues = await ev(() => Editor.validate().map(i => i.level + ': ' + i.msg));
  check('Validierung des leeren Projekts läuft und meldet Fehler', issues.some(m => m.indexOf('Startkarte') >= 0) && issues.some(m => m.indexOf('Elementtyp') >= 0), issues);
  // Aufbau von Null: Sprite -> Tile -> Karte -> Typ -> Attacke -> Monster -> Figur
  await p.click('.ed-nav button[data-page="pixel"]'); await btn('Neues Sprite', '.ed-form'); await p.locator('.ed-modal input[type=text]').fill('t_boden'); await ok();
  await ev(() => { const s = DB.sprites.t_boden; s.px = s.px.map((r, y) => r.replace(/\./g, () => String((y & 1)))); Gfx.invalidate(); Editor.commit(); });
  await p.click('.ed-nav button[data-page="tiles"]'); await btn('Neu', '.ed-listhead'); await p.locator('.ed-modal input[type=text]').fill('Boden'); await ok();
  await p.locator('.ed-form .ed-f', { hasText: 'Sprite (16×16)' }).first().locator('select').selectOption('t_boden'); await p.waitForTimeout(60);
  check('Erstes Tile bekommt ID 1', await ev(() => DB.tiles.length === 1 && DB.tiles[0].id === 1 && DB.tiles[0].sprite === 't_boden'));
  await p.click('.ed-nav button[data-page="maps"]'); await btn('Neue Karte anlegen', '.ed-form'); await ok();
  check('Erste Karte angelegt und mit Tile gefüllt', await ev(() => DB.maps.length === 1 && DB.maps[0].layers.ground.every(v => v === 1)));
  for (const [pg, name] of [['types', 'Normal'], ['moves', 'Stupser'], ['monsters', 'Erstling'], ['charsets', 'Held'], ['items', 'Leine'], ['trainers', 'Testi'], ['shops', 'Laden'], ['gyms', 'Arena'], ['quests', 'Aufgabe'], ['songs', 'Lied'], ['sfx', 'Ton']]) {
    await p.click('.ed-nav button[data-page="' + pg + '"]'); await btn('Neu', '.ed-listhead'); const t = p.locator('.ed-modal input[type=text]'); await t.nth((await t.count()) - 1).fill(name); await ok();
  }
  check('Alle Tabellen von Null befüllbar', await ev(() => ['types', 'moves', 'monsters', 'charsets', 'items', 'trainers', 'shops', 'gyms', 'quests', 'songs', 'sfx'].every(t => DB[t].length === 1)), await ev(() => TABLES.map(t => t + ':' + DB[t].length)));
  check('Neues Monster verweist auf vorhandenen Typ und Attacke', await ev(() => DB.monsters[0].types[0] === DB.types[0].id && DB.monsters[0].learnset[0].move === DB.moves[0].id));
  await allPages('aufbau'); check('Alle Seiten rendern nach dem Aufbau', errs.length === 0, errs);

  console.log('2) Beschädigte Daten');
  await ev(() => { Editor.replaceProject(() => Project.discardWorking()); });
  await ev(() => {
    DB.monsters[0].sprites = null; DB.monsters[1].learnset = null; DB.monsters[2].base = null; DB.moves[0].effects = [null, { k: 'gibtsnicht' }]; DB.trainers[0].team = null; DB.items[0].cat = 'kaputt';
    DB.maps[0].npcs.push({ id: 'x' }); DB.maps[0].events.push({}); DB.maps[0].warps.push({ id: 'w', x: 999, y: -3, toMap: 'nix' }); DB.maps[0].npcs[0].pages = [{ if: [null, { k: 'unsinn' }], do: [null, { k: 'quatsch' }, { k: 'ask' }] }];
    DB.maps[1].layers.ground.length = 5; DB.maps[1].encounters = [{}]; DB.gyms[0].badge = null; DB.shops[0].stock = [{}]; DB.sprites.kaputt = { w: 4, h: 4, px: ['..'] }; DB.sprites.leer = {}; DB.charsets[0].d = null; DB.tiles[3].sprite = null; DB.typeChart.quark = { x: 3 };
    DB.songs[0].tracks = null; DB.sfx[0].steps = [null]; DB.meta.songs = null; DB.meta.testTeam = null; DB.prefabs.push({ id: 'p', name: 'kaputt', w: 2, h: 2 });
  });
  const before = errs.length; let threw = '';
  try { await ev(() => Editor.validate().length); } catch (e) { threw = e.message; }
  check('Validierung übersteht beschädigte Daten', !threw, threw);
  await allPages('kaputt');
  for (const [pg, sel] of [['monsters', 0], ['monsters', 1], ['monsters', 2], ['moves', 0], ['trainers', 0], ['items', 0], ['gyms', 0], ['shops', 0], ['charsets', 0], ['songs', 0], ['sfx', 0]]) { await ev(a => Editor.go({ page: a[0], id: DB[a[0]][a[1]].id }), [pg, sel]); await p.waitForTimeout(40); const bad = await ev(() => { const e = document.querySelector('.ed-main > .ed-err, .ed-main > .ed-form.ed-err'); return e ? e.textContent : ''; }); if (bad) errs.push('kaputt ' + pg + ': ' + bad); }
  await ev(() => Editor.go({ page: 'maps', map: DB.maps[0].id, kind: 'npc', ent: DB.maps[0].npcs[0].id })); await p.waitForTimeout(60);
  await ev(() => Editor.go({ page: 'maps', map: DB.maps[1].id })); await p.waitForTimeout(60);
  await ev(() => Editor.go({ page: 'pixel', sprite: 'kaputt' })); await p.waitForTimeout(60); await ev(() => Editor.go({ page: 'pixel', sprite: 'leer' })); await p.waitForTimeout(60);
  check('Keine Abstürze mit beschädigten Daten', errs.length === before, errs.slice(before));
  await p.screenshot({ path: path.join(OUT, 'edt_broken.png') });

  console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen' + (fails.length ? ':\n - ' + fails.join('\n - ') : ''));
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('TEST ABGEBROCHEN', e); process.exit(2); });
