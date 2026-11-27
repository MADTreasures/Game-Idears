// Durchlauf Teil 3: Arena (Flug), Medaille, Wächter, Route 2, Rivale, Quest, Speichern/Laden, Niederlage, Flucht, Items/Wechsel/Status im Kampf
const { open, ff, press, mash, snap, montage, newGame, installBot } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => {
    Mon.give(Mon.create('quappel', 40)); Mon.give(Mon.create('nagri', 5));
    G.flags.has_starter = true; G.flags.has_dex = true; G.vars.starter = 2; Bag.add('leine', 5); Bag.add('trank', 3); Bag.add('gegengift', 1); Bag.add('hundepfeife', 1);
    World.enter('bellstadt', 4, 6, 'up'); World.encCooldown = 9999;
  });
  await ff(page, 5);
  // Wächter blockiert das Nordtor
  ok(await ev(() => !Bot.ent('waechter').hidden && Bot.ent('waechter_ok').hidden), 'Wächter steht ohne Medaille im Weg');
  ok(await ev(() => Bot.path(13, 0) === null), 'Nordtor ohne Medaille nicht erreichbar');
  // Quest annehmen
  await ev(() => Bot.door('haus_oma'));
  ok(await ev(() => World.mapId === 'haus_oma'), 'Haus von Oma Hilde betreten');
  await ev(() => Bot.goto(4, 3)); await ev(() => Bot.talk('right')); await ev(() => Bot.free());
  ok(await ev(() => G.quests.glocke === 'active'), 'Quest "Omas Glöckchen" gestartet');
  await ev(() => Bot.out());
  // --- Arena ---
  await ev(() => Bot.door('arena'));
  ok(await ev(() => World.mapId === 'arena'), 'Arena betreten: ' + await ev(() => Bot.st()));
  await ff(page, 10); await snap(page, 'arena');
  // Leiterin vor den Trainern ansprechen -> verweigert
  await ev(() => { World.p.x = 4; World.p.y = 2; World.p.dir = 'up'; }); await ev(() => Bot.talk('up')); await ff(page, 60); await snap(page, 'falk_verweigert');
  ok(await ev(() => !Battle.active && /stürmisch|Beweise/.test(UI.tb.lines.join(' '))), 'Leiter verlangt zuerst Siege über die Arena-Trainer: ' + await ev(() => UI.tb.lines.join(' ')));
  await ev(() => Bot.free()); await ev(() => { World.p.x = 4; World.p.y = 9; });
  // regulär durch die Arena: Till (Sicht) -> Vroni (Sicht) -> Falk
  await ev(() => Bot.goto(1, 5));
  ok(await ev(() => G.defeated.till), 'Arena-Trainer Till besiegt (Sichtlinie)');
  await ev(() => Bot.goto(6, 2));
  ok(await ev(() => G.defeated.vroni), 'Arena-Trainerin Vroni besiegt (Sichtlinie)');
  await ev(() => Bot.goto(4, 2)); await ev(() => Bot.talk('up'));
  await mash(page, 'Battle.active && Battle.v && Battle.v.eKind === "trainer"', 3000); await ff(page, 40); await snap(page, 'falk');
  await mash(page, 'Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2)', 4000); await snap(page, 'falk_kampf');
  const moneyBefore = await ev(() => G.money);
  await ev(() => Bot.free(60000)); await ff(page, 10); await snap(page, 'nach_arena');
  ok(await ev(() => G.badges.includes('gym1') && G.defeated.falk), 'Arenaleiter besiegt, Federmedaille erhalten');
  ok(await ev(() => Bag.count('starkleine') === 3), 'Arena-Belohnung (3 Starkleinen) erhalten');
  ok(await ev(m => G.money === m + 1000, moneyBefore), 'Preisgeld $1000 erhalten');
  // erneut ansprechen: keine zweite Belohnung
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('starkleine') === 3 && G.badges.length === 1), 'Belohnung wird nicht doppelt vergeben');
  // Medaillen-Menü
  await press(page, 'start', 6); await press(page, 'down', 3); await press(page, 'down', 3); await press(page, 'down', 3); await press(page, 'down', 3); await press(page, 'a', 8); await snap(page, 'medaillen');
  await press(page, 'b', 6); await press(page, 'up', 3); await press(page, 'a', 8); await snap(page, 'pass'); await press(page, 'a', 6); await snap(page, 'pass2'); await press(page, 'b', 6);
  await press(page, 'up', 3); await press(page, 'up', 3); await press(page, 'up', 3); await press(page, 'a', 8); await snap(page, 'lexikon'); await press(page, 'down', 3); await press(page, 'down', 3); await press(page, 'a', 8); await snap(page, 'lexikon2');
  await press(page, 'b', 6); await press(page, 'b', 6); await press(page, 'b', 6); await ff(page, 5);
  // Arena verlassen, Wächter ist weg
  await ev(() => Bot.out());
  ok(await ev(() => World.mapId === 'bellstadt' && Bot.ent('waechter').hidden && !Bot.ent('waechter_ok').hidden), 'Wächter hat den Weg freigegeben');
  // Shop-Sortiment mit Medaille
  ok(await ev(() => Data.shop('shop_bellstadt').stock.filter(s => Cond.all(s.cond)).length === 7), 'Shop schaltet neue Ware frei');
  // --- Route 2 ---
  await ev(() => Bot.edge('north', 'route2'));
  ok(await ev(() => World.mapId === 'route2'), 'Route 2 freigeschaltet und betreten: ' + await ev(() => Bot.st()));
  await ff(page, 20); await snap(page, 'route2');
  // Der Rivale steht als Trainer am Engpass; welche Variante sichtbar ist, hängt vom gewählten Starter ab (hier 2 = Quappel).
  ok(await ev(() => !Bot.ent('rival_b').hidden && Bot.ent('rival_a').hidden && Bot.ent('rival_c').hidden), 'Rivale steht passend zum Starter am Weg (Variante b)');
  await ev(() => LMDebug.walk('UUU')); await mash(page, 'Battle.active && Battle.v && Battle.v.eKind === "trainer"', 3000);
  ok(await ev(() => Battle.active && Battle.cfg.trainer.id === 'rival2_b'), 'Rivale fordert auf Sicht heraus (rival2_b): ' + await ev(() => Battle.cfg && Battle.cfg.trainer && Battle.cfg.trainer.id));
  await ev(() => Bot.free(60000));
  ok(await ev(() => G.defeated.rival2_b), 'Rivale besiegt');
  await ev(() => Bot.goto(2, 7)); await ev(() => Bot.talk('left')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('supertrank') === 1), 'Supertrank am Teich von Route 2 gefunden (Trainer unterwegs besiegt: ' + await ev(() => Object.keys(G.defeated).join(',')) + ')');
  ok(await ev(() => Bot.ent('item2').hidden), 'Aufgesammelter Gegenstand verschwindet von der Karte');
  // --- Quest: Glöckchen auf Route 1 holen ---
  await ev(() => { World.enter('route1', 28, 10, 'up'); }); await ff(page, 3);
  ok(await ev(() => !World.ents.find(e => e.def.id === 'glocke').hidden), 'Quest-Gegenstand ist bei aktiver Quest sichtbar');
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('gloeckchen') === 1), 'Glöckchen gefunden');
  await ev(() => { World.enter('haus_oma', 4, 3, 'right'); }); await ff(page, 3); await ev(() => Bot.talk('right')); await ev(() => Bot.free());
  ok(await ev(() => G.quests.glocke === 'done' && Bag.count('gloeckchen') === 0 && Bag.count('starkleine') === 6), 'Quest abgeschlossen: Glöckchen abgegeben, 3 weitere Starkleinen erhalten');
  await ev(() => Bot.talk('right')); await ff(page, 50);
  ok(await ev(() => /Danke/.test(UI.tb.lines.join(' '))), 'NPC-Dialog ändert sich nach der Quest: ' + await ev(() => UI.tb.lines.join(' ')));
  await ev(() => Bot.free());
  // --- Speichern & Laden ---
  await press(page, 'start', 6);
  const items = await ev(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]); const si = items.indexOf('SPEICHERN');
  for (let i = 0; i < si; i++) await press(page, 'down', 3);
  await press(page, 'a', 40); await snap(page, 'speichern'); await press(page, 'a', 40); await snap(page, 'gespeichert'); await press(page, 'a', 8); await press(page, 'b', 8); await ff(page, 5);
  const before = await ev(() => JSON.stringify({ m: World.mapId, x: World.p.x, y: World.p.y, p: G.party.map(q => q.species + q.level), b: G.badges, bag: G.bag, q: G.quests, money: G.money, d: Object.keys(G.defeated).sort() }));
  ok(await ev(() => Save.exists()), 'Spielstand wurde gespeichert');
  await page.reload(); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 2); await ev(() => { Engine.manual = true; Opt.text = 2; });
  await ff(page, 20); await press(page, 'a', 10); await snap(page, 'titel_fortsetzen');
  ok(await ev(() => UI.layers.some(l => l.o && l.o.items && l.o.items[0] === 'FORTSETZEN')), 'Titelmenü bietet FORTSETZEN an');
  await press(page, 'a', 40); await ff(page, 30); await installBot(page);
  const after = await ev(() => JSON.stringify({ m: World.mapId, x: World.p.x, y: World.p.y, p: G.party.map(q => q.species + q.level), b: G.badges, bag: G.bag, q: G.quests, money: G.money, d: Object.keys(G.defeated).sort() }));
  ok(before === after, 'Geladener Spielstand ist identisch: ' + after);
  // --- Kampfdetails: Wechsel, Item, Status, Flucht ---
  await ev(() => { G.party[0].hp = 30; const n = G.party[1]; n.level = 12; n.exp = Mon.expFor(Mon.sp(n), 12); n.hp = Mon.maxHp(n); });   // zweites Monster robust genug für zwei gegnerische Züge
  let fight = ev(() => World.run(async () => { const e = Mon.create('krabbli', 9); const r = await Battle.start({ kind: 'wild', enemy: [e] }); window.__res = r; await World.afterBattle(r, false); }));
  await mash(page, 'Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2)', 4000);
  // Trank benutzen: BEUTEL -> Trank -> Monster 1
  await press(page, 'down', 3); await press(page, 'a', 8);
  const bl = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label)); const ti = bl.indexOf('Trank');
  for (let i = 0; i < ti; i++) await press(page, 'down', 3);
  await press(page, 'a', 8); await snap(page, 'trank_ziel'); await press(page, 'a', 8);
  await LM_until(page, 'UI.layers.some(l => l.o && l.o.cols === 2)');
  ok(await ev(() => G.party[0].hp > 30 && Bag.count('trank') === 2), 'Trank im Kampf eingesetzt (+20 LP, danach greift der Gegner an), Zug verbraucht: LP ' + await ev(() => G.party[0].hp));
  // Wechsel: MONSTER -> zweites Monster -> WECHSEL
  await press(page, 'right', 3); await press(page, 'a', 8); await press(page, 'down', 3); await press(page, 'a', 8); await snap(page, 'wechsel'); await press(page, 'a', 8);
  await LM_until(page, 'UI.layers.some(l => l.o && l.o.cols === 2)');
  ok(await ev(() => Battle.pi === 1 && Battle.P().species === 'nagri'), 'Monsterwechsel im Kampf: aktiv ist ' + await ev(() => Battle.P().species));
  await snap(page, 'nach_wechsel');
  // Status: Gegner vergiften -> Schaden am Rundenende
  await ev(() => { Battle.E().status = 'poison'; Battle.E().hp = Mon.maxHp(Battle.E()); Battle.v.eHp = Battle.E().hp; Battle.P().hp = Mon.maxHp(Battle.P()); Battle.v.pHp = Battle.P().hp; });
  const ehp = await ev(() => Battle.E().hp);
  await press(page, 'left', 3); await press(page, 'up', 3); await press(page, 'a', 8); await press(page, 'a', 8);
  await LM_until(page, 'UI.layers.some(l => l.o && l.o.cols === 2) || !Battle.active');
  ok(await ev(h => !Battle.active || Battle.E().hp < h, ehp), 'Giftschaden am Rundenende');
  // Flucht mit Hundepfeife (garantiert)
  if (await ev(() => Battle.active)) {
    await press(page, 'down', 3); await press(page, 'a', 8);
    const bl2 = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label)); const pi = bl2.indexOf('Hundepfeife');
    for (let i = 0; i < pi; i++) await press(page, 'down', 3);
    await press(page, 'a', 8); await ev(() => LMDebug.until(() => !World.lock && !Battle.active && Gfx.fade === 0, 4000, 'a')); await fight;
    ok(await ev(() => window.__res === 'flee' && Bag.count('hundepfeife') === 0), 'Flucht mit Hundepfeife gelingt: ' + await ev(() => window.__res));
  }
  // --- Niederlage -> Rückkehr zum Heilzentrum ---
  await ev(() => { G.respawn = { map: 'heilzentrum', x: 3, y: 3, dir: 'up' }; G.party.length = 1; G.party.forEach(m => { m.hp = 1; }); G.money = 1000; });
  fight = ev(() => World.run(async () => { const r = await Battle.start({ kind: 'wild', enemy: [Mon.create('grabator', 60)] }); window.__res = r; await World.afterBattle(r, false); }));
  await ev(() => LMDebug.until(() => !World.lock && !Battle.active && Gfx.fade === 0, 30000, 'a')); await fight;
  ok(await ev(() => window.__res === 'lose' && World.mapId === 'heilzentrum' && G.money === 750 && G.party.every(m => m.hp === Mon.maxHp(m))), 'Niederlage: Rückkehr ins Heilzentrum, Team geheilt, 25 % Geld verloren: ' + await ev(() => Bot.st()));
  await ff(page, 10); await snap(page, 'nach_niederlage');
  await montage(page, 'play3.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
  async function LM_until(page, c) { return page.evaluate(c => LMDebug.until(new Function('return (' + c + ')'), 6000, 'a'), c); }
})().catch(e => { console.error(e); process.exit(1); });
