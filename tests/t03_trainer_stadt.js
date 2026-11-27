// Durchlauf Teil 2: Trainer-Sichtlinie, Levelaufstieg, Entwicklung, Attacke lernen/vergessen, Bellstadt, Heilzentrum, Speicher, Shop
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  // --- Zustand vorbereiten: Glutwelp Lv15 kurz vor Lv16, auf Route 1 unterhalb von Timo ---
  await ev(() => {
    const m = Mon.create('glutwelp', 15); m.exp = Mon.expFor(Mon.sp(m), 16) - 3; Mon.give(m);
    G.flags.has_starter = true; G.flags.has_dex = true; G.vars.starter = 1; Bag.add('leine', 5); Bag.add('trank', 2);
    World.enter('route1', 7, 8, 'right'); World.encCooldown = 99;
  });
  await ff(page, 5);
  ok(await ev(() => G.party[0].moves.length === 4), 'Lv15-Glutwelp hat 4 Attacken: ' + await ev(() => G.party[0].moves.map(m => m.id).join(',')));
  // Timo steht bei (10,5) und schaut nach unten (Sichtweite 3)
  await ev(() => LMDebug.walk('RRR')); await ff(page, 30); await snap(page, 'trainer_sieht');
  ok(await ev(() => World.lock > 0), 'Trainer entdeckt den Spieler: ' + await ev(() => Bot.st()));
  await mash(page, 'Battle.active && Battle.v && Battle.v.eKind === "trainer"', 3000); await ff(page, 40); await snap(page, 'trainer_intro');
  await mash(page, 'Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2)', 4000); await snap(page, 'trainerkampf');
  ok(await ev(() => Battle.cfg.trainer.id === 'timo' && Battle.foes.length === 2), 'Kampf gegen Timo mit 2 Monstern');
  // FLUCHT im Trainerkampf nicht möglich
  await press(page, 'down', 3); await press(page, 'right', 3); await press(page, 'a', 30);
  ok(await ev(() => /Trainerkampf/.test(UI.tb.lines.join(" "))), 'Flucht aus Trainerkampf verweigert: ' + await ev(() => UI.tb.lines.join(' ')));
  await mash(page, 'UI.layers.some(l => l.o && l.o.cols === 2)', 500);
  // Leine im Trainerkampf nicht möglich
  await press(page, 'left', 3); await press(page, 'a', 8); await press(page, 'a', 40);
  ok(await ev(() => /Trainer/.test(UI.tb.lines.join(' ')) && Bag.count('leine') === 5), 'Leine im Trainerkampf verweigert, nicht verbraucht: ' + await ev(() => UI.tb.lines.join(' ')));
  await mash(page, 'UI.layers.some(l => l.o && l.o.cols === 2)', 500);
  await press(page, 'up', 3);
  // Kampf durchklicken bis Entwicklung beginnt
  await mash(page, 'UI.layers.some(l => String(l.draw).includes("sil"))', 20000); await ff(page, 30); await snap(page, 'entwicklung1'); await ff(page, 120); await snap(page, 'entwicklung2');
  ok(await ev(() => G.party[0].level >= 16), 'Levelaufstieg auf ' + await ev(() => G.party[0].level));
  await ev(() => Bot.free(30000)); await ff(page, 10); await snap(page, 'nach_entwicklung');
  ok(await ev(() => G.party[0].species === 'lohwolf' && G.caught.lohwolf), 'Glutwelp hat sich zu Lohwolf entwickelt');
  ok(await ev(() => G.defeated.timo && G.money === 3080), 'Timo besiegt, Preisgeld $80: $' + await ev(() => G.money));
  // Timo erneut ansprechen -> nur noch Text
  await ev(async () => { const t = World.ents.find(e => e.def.id === 'timo'); await Bot.goto(t.x + 1, t.y); }); await ev(() => Bot.talk('left')); await ff(page, 50);
  ok(await ev(() => !Battle.active && /übe/.test(UI.tb.lines.join(' '))), 'Besiegter Trainer spricht nur noch: ' + await ev(() => UI.tb.lines.join(' ')));
  await ev(() => Bot.free());
  // --- Attacke lernen mit 4 Attacken: Lohwolf lernt Flammenbiss auf Lv20 ---
  await ev(() => { const m = G.party[0]; m.level = 19; m.exp = Mon.expFor(Mon.sp(m), 20) - 2; m.hp = Mon.maxHp(m); });
  const fight = ev(() => World.run(async () => { const r = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 3)] }); await World.afterBattle(r, false); }));
  await mash(page, 'UI.layers.some(l => l.o && l.o.title === "VERGESSEN?")', 20000); await snap(page, 'vergessen');
  ok(await ev(() => UI.layers.some(l => l.o && l.o.title === 'VERGESSEN?')), 'Abfrage: Attacke vergessen?');
  const old = await ev(() => G.party[0].moves[0].id);
  await press(page, 'a', 10); await ev(() => Bot.free(20000)); await fight;
  ok(await ev(old => G.party[0].moves.length === 4 && G.party[0].moves[0].id === 'flammenbiss' && !G.party[0].moves.some(m => m.id === old), old), 'Flammenbiss ersetzt ' + old + ': ' + await ev(() => G.party[0].moves.map(m => m.id).join(',')));
  // --- Nach Bellstadt ---
  await ev(() => { World.encCooldown = 9999; G.defeated.lena = true; G.defeated.sepp = true; });
  await ev(() => Bot.edge('east', 'bellstadt'));
  ok(await ev(() => World.mapId === 'bellstadt'), 'Bellstadt erreicht: ' + await ev(() => Bot.st()));
  await ff(page, 20); await snap(page, 'bellstadt');
  // --- Heilzentrum ---
  await ev(() => { G.party[0].hp = 5; G.party[0].status = 'poison'; G.party[0].moves[0].pp = 0; });
  await ev(() => Bot.door('heilzentrum'));
  ok(await ev(() => World.mapId === 'heilzentrum'), 'Heilzentrum betreten');
  await ev(() => Bot.goto(3, 3)); await ev(() => Bot.talk('up')); await mash(page, '/JA/.test(Bot.text())', 600); await snap(page, 'heilfrage');
  await press(page, 'a', 60); await mash(page, 'UI.layers.some(l => String(l.draw).includes("lit"))', 600); await ff(page, 50); await snap(page, 'heilung');
  await ev(() => Bot.free());
  ok(await ev(() => { const m = G.party[0]; return m.hp === Mon.maxHp(m) && !m.status && m.moves[0].pp === Data.move(m.moves[0].id).pp; }), 'Team vollständig geheilt (LP, Status, AP)');
  ok(await ev(() => G.respawn.map === 'heilzentrum'), 'Rückkehrpunkt = Heilzentrum');
  // --- Monsterspeicher ---
  await ev(() => { Mon.give(Mon.create('nagri', 4)); Mon.give(Mon.create('piepsel', 5)); });
  await ev(() => Bot.goto(9, 2)); await ev(() => Bot.talk('up')); await mash(page, '/ABHOLEN/.test(Bot.text())', 600); await snap(page, 'speicher');
  await press(page, 'down', 3); await press(page, 'a', 8); await press(page, 'down', 3); await snap(page, 'einlagern'); await press(page, 'a', 8);
  await mash(page, '/ABHOLEN/.test(Bot.text()) && !/eingelagert/.test(UI.tb.lines.join(" ")) && UI.layers.indexOf(UI.tb) < 0', 600);
  ok(await ev(() => G.storage.length === 1 && G.storage[0].species === 'nagri' && G.party.length === 2), 'Nagri eingelagert: ' + await ev(() => Bot.st()));
  await press(page, 'up', 3); await press(page, 'a', 8); await snap(page, 'abholen'); await press(page, 'a', 8);
  await mash(page, '/ABHOLEN/.test(Bot.text()) && UI.layers.indexOf(UI.tb) < 0', 600);
  ok(await ev(() => G.storage.length === 0 && G.party.length === 3), 'Nagri wieder abgeholt');
  // tauschen: Team[1] gegen Speicher
  await ev(() => { G.storage.push(Mon.create('krabbli', 6)); });
  await press(page, 'down', 3); await press(page, 'down', 3); await press(page, 'a', 8); await press(page, 'down', 3); await press(page, 'a', 8); await press(page, 'a', 8);
  await mash(page, '/ABHOLEN/.test(Bot.text()) && UI.layers.indexOf(UI.tb) < 0', 600);
  ok(await ev(() => G.party[1].species === 'krabbli' && G.storage[0].species === 'piepsel'), 'Tausch Team <-> Speicher: ' + await ev(() => G.party.map(m => m.species) + ' | ' + G.storage.map(m => m.species)));
  await press(page, 'b', 8); await ev(() => Bot.free());
  // automatische Einlagerung bei vollem Team
  await ev(() => { while (G.party.length < 6) Mon.give(Mon.create('nagri', 2)); });
  ok(await ev(() => Mon.give(Mon.create('kiesling', 3)) === 'storage' && G.storage.length === 2), 'Volles Team: neues Monster wird automatisch eingelagert');
  await ev(() => { G.party.length = 2; });
  // --- Shop ---
  await ev(() => Bot.out());
  ok(await ev(() => World.mapId === 'bellstadt' && World.p.x === 4 && World.p.y === 15), 'Heilzentrum verlassen: ' + await ev(() => Bot.st()));
  await ev(() => Bot.door('shop'));
  ok(await ev(() => World.mapId === 'shop'), 'Shop betreten');
  const money0 = await ev(() => G.money), leine0 = await ev(() => Bag.count('leine'));
  await ev(() => Bot.goto(1, 3)); await ev(() => Bot.talk('up')); await mash(page, '/KAUFEN/.test(Bot.text())', 600); await snap(page, 'shop');
  await press(page, 'a', 8); await snap(page, 'kaufliste');
  ok(await ev(() => !/Starkleine/.test(Bot.text())), 'Sortiment ohne Medaille: ' + await ev(() => Bot.text().split('##').pop()));
  await press(page, 'a', 8); await press(page, 'up', 3); await press(page, 'up', 3); await snap(page, 'menge'); await press(page, 'a', 30); await snap(page, 'kaufen_frage');
  await press(page, 'a', 40); await press(page, 'a', 10);
  ok(await ev(([m, l]) => G.money === m - 600 && Bag.count('leine') === l + 3, [money0, leine0]), '3 Hundeleinen für $600 gekauft: $' + await ev(() => G.money));
  await press(page, 'b', 8);
  await press(page, 'down', 3); await press(page, 'a', 10); await snap(page, 'verkaufen'); await press(page, 'a', 8); await press(page, 'a', 40); await press(page, 'a', 40); await press(page, 'a', 10);
  ok(await ev(([m, l]) => G.money === m - 500 && Bag.count('leine') === l + 2, [money0, leine0]), '1 Hundeleine für $100 verkauft: $' + await ev(() => G.money + ' Leinen ' + Bag.count('leine')));
  await press(page, 'b', 8); await press(page, 'b', 8); await ev(() => Bot.free());
  // zu wenig Geld
  await ev(() => { G.money = 50; }); await ev(() => Bot.talk('up')); await mash(page, '/KAUFEN/.test(Bot.text())', 600); await press(page, 'a', 8); await press(page, 'a', 30);
  ok(await ev(() => /reicht/.test(UI.tb.lines.join(' '))), 'Kauf ohne genug Geld wird abgelehnt: ' + await ev(() => UI.tb.lines.join(' ')));
  await mash(page, 'UI.layers.indexOf(UI.tb) < 0 || /Hundeleine/.test(Bot.text())', 300); await press(page, 'b', 8); await press(page, 'b', 8); await ev(() => Bot.free());
  await montage(page, 'play2.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
