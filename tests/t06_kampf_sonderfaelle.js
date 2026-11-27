// Kampf-Sonderfälle: Trainer-KI mit Heilitem, Verwirrung, Paralyse/Schlaf-Aussetzer, Niederlage im Trainerkampf, erlaubte Niederlage (canLose), Volles Team beim Fangen
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => { Mon.give(Mon.create('quappel', 14)); G.flags.has_starter = true; G.flags.has_dex = true; Bag.add('leine', 5); World.enter('arena', 4, 2, 'up'); G.defeated.till = G.defeated.vroni = true; });
  // Falk: Trainer setzt Trank ein, wenn LP < 30 %
  let log = [];
  await ev(() => { window.__says = []; const o = UI.say; UI.say = function (t, opts) { window.__says.push(UI.subst(t)); return o.call(UI, t, opts); }; });
  await ev(() => Bot.talk('up'));
  await mash(page, 'Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2)', 6000);
  await ev(() => { Battle.E().hp = 3; Battle.v.eHp = 3; window.__rnd = Math.random; Math.random = () => 0.5; G.party[0].level = 60; G.party[0].hp = 150; });
  // Zug mit Statusattacke (Wedler), damit der Gegner überlebt und heilen kann
  await press(page, 'a', 8); const wi = await ev(() => Battle.P().moves.findIndex(m => m.id === 'wedler' || m.id === 'panzern'));
  await ev(i => { UI.layers[UI.layers.length - 1].sel = i; }, wi); await press(page, 'a', 8);
  await page.evaluate(() => LMDebug.until(() => UI.layers.some(l => l.o && l.o.cols === 2), 4000, 'a'));
  ok(await ev(() => window.__says.some(s => /Falk setzt Trank ein/.test(s)) && Battle.E().hp > 3), 'Arenaleiter benutzt einen Trank: LP ' + await ev(() => Battle.E().hp));
  await ev(() => { Math.random = window.__rnd; });
  // Verwirrung und Paralyse am Gegner: Meldungen erscheinen
  await ev(() => { Battle.es.confuse = 3; });
  await press(page, 'a', 8); await ev(i => { UI.layers[UI.layers.length - 1].sel = i; }, wi); await press(page, 'a', 8);
  await page.evaluate(() => LMDebug.until(() => UI.layers.some(l => l.o && l.o.cols === 2) || !Battle.active, 4000, 'a'));
  ok(await ev(() => window.__says.some(s => /ist verwirrt/.test(s))), 'Verwirrung wird abgehandelt');
  await ev(() => { Battle.E().status = 'sleep'; Battle.E().sleep = 3; });
  await press(page, 'a', 8); await ev(i => { UI.layers[UI.layers.length - 1].sel = i; }, wi); await press(page, 'a', 8);
  await page.evaluate(() => LMDebug.until(() => UI.layers.some(l => l.o && l.o.cols === 2) || !Battle.active, 4000, 'a'));
  ok(await ev(() => window.__says.some(s => /schläft tief/.test(s)) && Battle.E().sleep === 2), 'Schlafendes Monster setzt aus');
  // Niederlage gegen Trainer -> Whiteout, Trainer NICHT besiegt, Script abgebrochen
  await ev(() => { G.respawn = { map: 'heilzentrum', x: 3, y: 3, dir: 'up' }; G.party[0].level = 2; G.party[0].hp = 1; Battle.E().status = ''; Battle.es.confuse = 0; });
  await page.evaluate(() => LMDebug.until(() => !World.lock && !Battle.active && Gfx.fade === 0, 30000, 'a'));
  ok(await ev(() => World.mapId === 'heilzentrum' && !G.defeated.falk && !G.badges.length), 'Niederlage im Trainerkampf: zurück im Heilzentrum, keine Medaille');
  // canLose: Rivalenkampf im Labor verlieren -> Geschichte geht weiter
  await ev(() => { G.party = []; G.flags = {}; G.vars = {}; G.defeated = {}; G.bag = {}; G.money = 3000; World.enter('labor', 2, 5, 'up'); });
  await ev(() => Bot.talk('up')); await mash(page, 'Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2)', 9000);
  await ev(() => { G.party[0].hp = 1; Battle.v.pHp = 1; Battle.E().level = 50; });
  await page.evaluate(() => LMDebug.until(() => !World.lock && !Battle.active && Gfx.fade === 0, 30000, 'a'));
  ok(await ev(() => World.mapId === 'labor' && Game.flag('rival_left') && G.party[0].hp === Mon.maxHp(G.party[0]) && !G.defeated.rival_a && G.money === 3000), 'Erlaubte Niederlage (Labor): kein Whiteout, Team geheilt, Geschichte läuft weiter');
  ok(await ev(() => window.__says.some(s => /Ich bin eben der Beste/.test(s))), 'Niederlagen-Zweig des Ereignisses wurde ausgeführt');
  // Fangen bei vollem Team -> Speicher
  await ev(() => { while (G.party.length < 6) Mon.give(Mon.create('nagri', 3)); G.party[0].level = 30; Bag.add('meisterleine', 1); });
  const f = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('blitzel', 5)] }); await World.afterBattle(window.__res, false); }));
  await page.evaluate(() => LMDebug.until(() => Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2), 4000, 'a'));
  await press(page, 'down', 3); await press(page, 'a', 8);
  const bl = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label)); for (let i = 0; i < bl.indexOf('Meisterleine'); i++) await press(page, 'down', 3);
  await press(page, 'a', 8); await page.evaluate(() => LMDebug.until(() => !World.lock && !Battle.active && Gfx.fade === 0, 30000, 'a')); await f;
  ok(await ev(() => window.__res === 'caught' && G.party.length === 6 && G.storage.length === 1 && G.storage[0].species === 'blitzel' && Bag.count('meisterleine') === 0), 'Meisterleine fängt garantiert; bei vollem Team geht das Monster in den Speicher');
  ok(await ev(() => window.__says.some(s => /Monsterspeicher gebracht/.test(s))), 'Meldung über Einlagerung erscheint');
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
