// HTML-Export über die echten Schaltflächen (Download). Seit 1.1.1 gibt es zwei Arten:
//   "Spiel exportieren"        -> reine Spieldatei OHNE Editor (für Spieler)
//   "Editor-Datei exportieren" -> Spiel + Editor, startet im Editor, wieder bearbeit- und exportierbar
// Geprüft wird: Programmcode byte-identisch zu den ausgelieferten Dateien, Spielen der exportierten Datei, Weiterbearbeiten und erneuter Export.
const { chromium } = require('playwright'); require('fs').mkdirSync(require('path').join(__dirname, 'out'), { recursive: true }); const path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, 'out'), GAME = process.env.LM_FILE || path.join(__dirname, '..', 'Animora-Morgenrot.html'), FILE = GAME.replace(/\.html$/, '-Editor.html');   // GAME = reines Spiel, FILE = Editor-Datei
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const codeOf = html => { const a = html.indexOf('id="lm-engine">') + 15, b = html.indexOf('</' + 'script>', a); return html.slice(a, b); };
const dataOf = html => { const mark = 'id="lm-data" type="application/json">', a = html.lastIndexOf(mark) + mark.length, b = html.indexOf('</' + 'script>', a); return JSON.parse(html.slice(a, b)); };
async function fresh(file) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file); await page.waitForFunction(() => typeof Engine !== 'undefined' && (Engine.ticks > 5 || Engine.editorOpen));   // im Editor ruht die Spielschleife
  return { browser, page, errors };
}
async function exportViaButton(page, target, withEditor) {
  if (withEditor) { await page.evaluate(() => Editor.go({ page: 'project' })); await page.waitForTimeout(150); }
  const dl = page.waitForEvent('download', { timeout: 15000 });
  await page.locator('#ed-root button', { hasText: withEditor ? 'Editor-Datei exportieren' : 'Spiel exportieren' }).first().click();
  // Falls die Validierung Hinweise zeigt: Dialog bestätigen
  for (let i = 0; i < 3; i++) { await page.waitForTimeout(150); const m = page.locator('.ed-modal .ed-ok'); if (await m.count()) await m.first().click(); else break; }
  const d = await dl; await d.saveAs(target); return d.suggestedFilename();
}
(async () => {
  const orig = fs.readFileSync(FILE, 'utf8'), game = fs.readFileSync(GAME, 'utf8');
  // --- Generation 1: aus der Originaldatei, mit Änderungen (neue Stadt, 5 Monster, Arena) ---
  let s = await fresh(FILE + '#spiel');
  await s.page.keyboard.press('F2'); await s.page.waitForTimeout(300);
  ok(await s.page.evaluate(() => Engine.editorOpen), 'Editor mit F2 geöffnet');
  await s.page.evaluate(() => {
    Editor.commit && Editor.commit('Test');
    // neue Stadt (Karte), verbunden über einen Übergang von Route 2
    const g = DB.tiles.find(t => t.sprite === 't_grass').id, tr = DB.tiles.find(t => t.sprite === 't_tree').id;
    const m = Data.fixMap({ id: 'neustadt', name: 'NEUSTADT', w: 12, h: 10, kind: 'outdoor', song: 'stadt', border: tr, layers: { ground: new Array(120).fill(g), objects: new Array(120).fill(0).map((v, i) => (i % 12 === 0 || i % 12 === 11 || i < 12 || i >= 108) ? tr : 0) } });
    m.npcs.push({ id: 'bote', name: 'Bote', x: 5, y: 4, charset: 'man', dir: 'down', move: 'none', visibleIf: [], pages: [{ if: [], do: [{ k: 'say', text: 'Willkommen in Neustadt!' }] }] });
    m.warps.push({ id: 'zurueck', x: 1, y: 5, kind: 'step', toMap: 'route2', toX: 17, toY: 2, toDir: 'left', cond: [] });
    m.encounters.push({ zone: 1, name: 'Gras', rate: 20, slots: [{ species: 'neumon_1', min: 5, max: 7, weight: 1 }] });
    DB.maps.push(m);
    Data.map('route2').warps.push({ id: 'nach_neustadt', x: 18, y: 2, kind: 'step', toMap: 'neustadt', toX: 2, toY: 5, toDir: 'right', cond: [] });
    // fünf neue Monster (Kopien mit eigenen Namen/Sprites)
    for (let i = 1; i <= 5; i++) { const c = JSON.parse(JSON.stringify(DB.monsters[i])); c.id = 'neumon_' + i; c.no = 56 + i; c.name = 'Neumon' + i; c.evolutions = []; DB.sprites['neu_front_' + i] = JSON.parse(JSON.stringify(DB.sprites[c.sprites.front])); c.sprites = Object.assign({}, c.sprites, { front: 'neu_front_' + i }); DB.monsters.push(c); }
    // neue Arena mit Leiter
    DB.trainers.push({ id: 'leiter2', cls: 'Leiter', name: 'Nero', charset: 'man', sprite: 'tr_boy', team: [{ species: 'neumon_1', level: 20 }, { species: 'neumon_5', level: 22 }], reward: 2000, intro: 'Ich bin Nero!', defeat: 'Unglaublich!', after: 'Gut gekämpft.', sight: 0, cond: [], ai: 'smart' });
    DB.sprites.badge_neu = JSON.parse(JSON.stringify(DB.sprites.badge_buddel));
    DB.gyms.push({ id: 'gym_neu', name: 'Arena Neustadt', map: 'neustadt', leader: 'leiter2', trainers: [], badge: { name: 'Neumedaille', sprite: 'badge_neu' }, entryCond: [{ k: 'hasBadge', gym: 'gym1' }], entryDenied: 'Nur mit Federmedaille!', needTrainers: false, rewards: [{ k: 'giveMoney', n: 500 }], winText: 'Geschafft!' });
    m.npcs.push({ id: 'nero', name: 'Nero', x: 8, y: 4, charset: 'man', dir: 'down', move: 'none', trainer: 'leiter2', visibleIf: [], pages: [] });
    DB.meta.title = 'Leinenmeister Test';
    Data.reindex();
  });
  const issues = await s.page.evaluate(() => Editor.validate().filter(i => i.level === 'error').map(i => i.msg));
  ok(issues.length === 0, 'Validierung des erweiterten Projekts ohne Fehler' + (issues.length ? ': ' + issues.join(' | ') : ''));
  const e1 = path.join(OUT, 'export_gen1.html');
  const name1 = await exportViaButton(s.page, e1);
  ok(/Leinenmeister_Test\.html/.test(name1), 'Download über Schaltfläche "Spiel exportieren": ' + name1);
  const e1ed = path.join(OUT, 'export_gen1_editor.html'), name1ed = await exportViaButton(s.page, e1ed, true);
  ok(/Leinenmeister_Test-Editor\.html/.test(name1ed), 'Download über Schaltfläche "Editor-Datei exportieren": ' + name1ed);
  ok(s.errors.length === 0, 'keine JS-Fehler in Generation 0' + (s.errors.length ? ': ' + s.errors.join(' | ') : ''));
  await s.browser.close();
  const g1 = fs.readFileSync(e1, 'utf8');
  const g1ed = fs.readFileSync(e1ed, 'utf8'), hasEd = h => /\nconst Editor\b/.test(codeOf(h));
  ok(codeOf(g1) === codeOf(game), 'Spiel-Export: Programmcode ist byte-identisch zur ausgelieferten Spieldatei (' + codeOf(g1).length + ' Zeichen)');
  ok(!hasEd(g1) && !/LM_START/.test(g1.split('id="lm-engine"')[0]) && g1.length < g1ed.length - 150000, 'Spiel-Export enthält KEINEN Editor (' + Math.round(g1.length / 1024) + ' KB statt ' + Math.round(g1ed.length / 1024) + ' KB)');
  ok(codeOf(g1ed) === codeOf(orig) && hasEd(g1ed) && /window\.LM_START = "editor"/.test(g1ed), 'Editor-Export: Programmcode byte-identisch zur Editor-Datei, startet im Editor');
  const d1 = dataOf(g1);
  ok(d1.maps.some(m => m.id === 'neustadt') && d1.monsters.length === 61 && d1.gyms.length === 7 && d1.sprites.neu_front_3 && d1.meta.title === 'Leinenmeister Test', 'Exportierte Daten enthalten neue Stadt, 5 Monster, Arena, Sprites, Titel');
  ok(/<title>Leinenmeister Test<\/title>/.test(g1), 'Titel der exportierten Datei gesetzt');
  // --- Exportierte Datei in frischem Profil öffnen und SPIELEN ---
  s = await fresh(e1);
  ok(await s.page.evaluate(() => Project.source === 'embedded' && !!Data.map('neustadt') && DB.monsters.length === 61), 'Exportierte Datei lädt eigenständig (keine Browserdaten nötig), Änderungen vorhanden');
  const play = await s.page.evaluate(async () => {
    Engine.manual = true; Opt.text = 2; Engine.reset(); G = Game.fresh(); G.name = 'TEST'; Mon.give(Mon.create('quappel', 60)); G.badges.push('gym1'); G.flags.has_dex = true; G.flags.rival2_done = true; Engine.startGame(G); World.enter('route2', 17, 3, 'right'); World.encCooldown = 999;
    await LMDebug.ff(5); await LMDebug.walk('U'); await LMDebug.walk('R');                       // auf den neuen Übergang (18,2)
    await LMDebug.until(() => World.mapId === 'neustadt' && !World.lock && Gfx.fade === 0, 600);
    const r = { map: World.mapId, x: World.p.x, y: World.p.y };
    World.p.x = 5; World.p.y = 5; World.p.dir = 'up'; await LMDebug.press('a', 30); r.npc = UI.tb.lines.join(' ');
    await LMDebug.until(() => !World.lock, 600, 'a');
    World.p.x = 8; World.p.y = 5; World.p.dir = 'up'; await LMDebug.press('a', 10);
    await LMDebug.until(() => Battle.active && Battle.v && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2), 4000, 'a');
    r.battle = Battle.active && Battle.cfg.trainer.id; r.foe = Battle.E().species; Battle.foes.forEach(m => { m.hp = 1; });
    for (let i = 0; i < 30000 && (World.lock || Battle.active); i++) { const top = UI.layers[UI.layers.length - 1]; if (i % 4 === 0) { if (Battle.active && top && top.o && top.o.pitch === 10) top.sel = Battle.P().moves.findIndex(m => Data.move(m.id).power > 0); Input.pend.a = true; } Engine.tick(); await LMDebug.yield(); }
    r.badges = G.badges.slice(); r.money = G.money; return r;
  });
  const noEd = await s.page.evaluate(async () => { const r = { has: LM_hasEditor(), btn: !!document.getElementById('lm-btn-editor'), hint: /Editor/.test(document.getElementById('lm-hint').textContent) }; Engine.toggleEditor(); r.open = Engine.editorOpen; r.root = !!document.getElementById('ed-root'); return r; });
  ok(!noEd.has && !noEd.btn && !noEd.hint && !noEd.open && !noEd.root, 'Im exportierten Spiel gibt es keinen Editor (kein Knopf, kein Hinweis, lässt sich nicht öffnen): ' + JSON.stringify(noEd));
  ok(play.map === 'neustadt' && play.x === 2 && play.y === 5, 'Im Export: neuer Übergang Route 2 -> Neustadt funktioniert: ' + JSON.stringify(play));
  ok(/Willkommen in Neustadt/.test(play.npc), 'Im Export: neuer NPC spricht: ' + play.npc);
  ok(play.battle === 'leiter2' && play.foe === 'neumon_1', 'Im Export: neue Arena – Kampf gegen neuen Leiter mit neuem Monster');
  ok(play.badges.includes('gym_neu') && play.money === 3000 + 2000 + 500, 'Im Export: neue Medaille + Belohnungen erhalten ($' + play.money + ')');
  ok(s.errors.length === 0, 'keine JS-Fehler im exportierten Spiel' + (s.errors.length ? ': ' + s.errors.join(' | ') : ''));
  await s.browser.close();
  // --- Generation 2: die exportierte Editor-Datei öffnen, weiterbearbeiten und erneut exportieren ---
  s = await fresh(e1ed); await s.page.waitForTimeout(300);
  ok(await s.page.evaluate(() => Engine.editorOpen && !!document.getElementById('ed-root') && !!Data.map('neustadt') && DB.monsters.length === 61), 'Exportierte Editor-Datei startet im Editor und enthält alle Änderungen');
  await s.page.evaluate(() => { Data.map('neustadt').name = 'NEUSTADT II'; DB.items.push({ id: 'neuitem', name: 'Neuitem', cat: 'misc', price: 5, desc: 'Test.' }); Data.reindex(); });
  const e2g = path.join(OUT, 'export_gen2_spiel.html'); await exportViaButton(s.page, e2g);
  const e2 = path.join(OUT, 'export_gen2.html'); await exportViaButton(s.page, e2, true);
  ok(s.errors.length === 0, 'keine JS-Fehler in Generation 1' + (s.errors.length ? ': ' + s.errors.join(' | ') : ''));
  await s.browser.close();
  const g2 = fs.readFileSync(e2, 'utf8'), d2 = dataOf(g2), g2g = fs.readFileSync(e2g, 'utf8');
  ok(codeOf(g2) === codeOf(orig) && codeOf(g2g) === codeOf(game), 'Erneuter Export: Programmcode beider Dateien weiterhin identisch');
  ok(d2.maps.find(m => m.id === 'neustadt').name === 'NEUSTADT II' && d2.items.some(i => i.id === 'neuitem') && d2.monsters.length === 61 && dataOf(g2g).items.some(i => i.id === 'neuitem'), 'Erneuter Export enthält alte und neue Änderungen (Spiel- und Editor-Datei)');
  ok(d2.meta.revision > d1.meta.revision && d2.meta.savedAt >= d1.meta.savedAt, 'Revisionszähler steigt (' + d1.meta.revision + ' -> ' + d2.meta.revision + ')');
  s = await fresh(e2); await s.page.waitForTimeout(300);
  ok(await s.page.evaluate(() => Data.map('neustadt').name === 'NEUSTADT II' && !!Data.idx.items.neuitem && Engine.editorOpen), 'Zweite Generation lädt eigenständig und ist wieder im Editor bearbeitbar');
  ok(s.errors.length === 0, 'keine JS-Fehler in Generation 2');
  await s.browser.close();
  console.log('errors: keine');
})().catch(e => { console.error(e); process.exit(1); });
