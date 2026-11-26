// Durchlauf Teil 1: Zimmer -> Dorf -> Routensperre -> Labor -> Starter -> Rivalenkampf -> Route 1 -> wilder Kampf -> Fangen
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  ok(await ev(() => World.mapId === 'zimmer' && G.name === 'LEO'), 'Start im Zimmer, Name LEO');
  // Treppe -> Wohnzimmer
  await ev(() => Bot.goto(7, 1)); await ev(() => Bot.free());
  ok(await ev(() => World.mapId === 'haus_spieler'), 'Treppe führt ins Erdgeschoss: ' + await ev(() => Bot.st()));
  // Mama ansprechen
  await ev(() => Bot.goto(4, 3)); await ev(() => Bot.talk('right')); await ff(page, 40); await snap(page, 'mama');
  ok(await ev(() => World.lock > 0 && /Professor|Guten/.test(UI.tb.lines.join(' '))), 'Mama spricht: ' + await ev(() => Bot.text()));
  await ev(() => Bot.free());
  // Haus verlassen
  await ev(() => Bot.goto(2, 5)); await ev(() => Bot.step('D')); await ev(() => Bot.free());
  ok(await ev(() => World.mapId === 'welpenhain' && World.p.x === 3 && World.p.y === 5), 'Haus verlassen -> Welpenhain: ' + await ev(() => Bot.st()));
  await ff(page, 30); await snap(page, 'dorf');
  // Routensperre
  await ev(() => Bot.goto(9, 2)); await ev(() => Bot.step('U')); await ff(page, 60); await snap(page, 'sperre');
  ok(await ev(() => World.lock > 0), 'Routensperre löst aus: ' + await ev(() => Bot.text()));
  await ev(() => Bot.free());
  ok(await ev(() => World.mapId === 'welpenhain' && World.p.y === 2), 'Spieler wurde zurückgeschoben: ' + await ev(() => Bot.st()));
  // Labor
  await ev(() => Bot.goto(14, 12)); await ev(() => Bot.step('U')); await ev(() => Bot.free());
  ok(await ev(() => World.mapId === 'labor'), 'Labor betreten: ' + await ev(() => Bot.st()));
  await ff(page, 10); await snap(page, 'labor');
  // Starter 1 (Glutwelp) wählen
  await ev(() => Bot.goto(2, 5)); await ev(() => Bot.talk('up')); await mash(page, '/JA/.test(Bot.text())', 900); await snap(page, 'starterfrage');
  ok(await ev(() => /JA/.test(Bot.text())), 'Starter-Frage erscheint: ' + await ev(() => Bot.text()));
  // JA, dann alles durchklicken bis zum Kampf
  await mash(page, 'Battle.active && Battle.v && Battle.v.pHud', 8000); await ff(page, 30); await snap(page, 'rivalenkampf');
  ok(await ev(() => Battle.active && Battle.cfg.kind === 'trainer' && G.party.length === 1 && G.party[0].species === 'glutwelp'), 'Rivalenkampf läuft, Glutwelp im Team');
  ok(await ev(() => Battle.E().species === 'quappel'), 'Rivale hat Quappel (Typvorteil)');
  await ev(() => { Battle.E().hp = 1; });               // Kampf abkürzen
  await ev(() => Bot.free(30000));
  ok(await ev(() => !Battle.active && World.mapId === 'labor' && Game.flag('has_starter') && Game.flag('has_dex') && Bag.count('leine') === 5 && G.defeated.rival_a), 'Nach Kampf: Flags, 5 Leinen, Rivale besiegt: ' + await ev(() => Bot.st()));
  ok(await ev(() => World.ents.find(e => e.def.id === 'rival').hidden), 'Rivale ist aus dem Labor verschwunden');
  ok(await ev(() => G.party[0].exp > 125 && G.money > 3000), 'EP und Preisgeld erhalten: ' + await ev(() => G.party[0].exp + ' EP, $' + G.money));
  await snap(page, 'nach_kampf');
  // Menü: jetzt mit LEXIKON und MONSTER
  await press(page, 'start', 6); await snap(page, 'menue'); 
  ok(await ev(() => /LEXIKON\/MONSTER/.test(Bot.text())), 'Hauptmenü zeigt LEXIKON und MONSTER');
  await press(page, 'down', 3); await press(page, 'a', 8); await snap(page, 'team');
  await press(page, 'a', 6); await press(page, 'a', 8); await snap(page, 'werte1'); await press(page, 'a', 6); await snap(page, 'werte2');
  await press(page, 'b', 6); await press(page, 'b', 6); await press(page, 'b', 6); await press(page, 'b', 6); await ff(page, 5);
  // Route 1
  await ev(() => Bot.goto(4, 7)); await ev(() => Bot.step('D')); await ev(() => Bot.free());
  await ev(() => Bot.goto(9, 1)); await ev(() => Bot.step('U')); await ev(() => Bot.free()); await ev(() => Bot.step('U')); await ev(() => Bot.step('U'));
  ok(await ev(() => World.mapId === 'route1'), 'Nahtloser Übergang auf Route 1: ' + await ev(() => Bot.st()));
  await ff(page, 30); await snap(page, 'route1');
  // Wilde Begegnung erzwingen: im Gras laufen
  await ev(async () => { World.encCooldown = 0; await Bot.goto(13, 20, { grassOk: true }); });
  let found = false;
  for (let i = 0; i < 60 && !found; i++) { await ev(() => LMDebug.walk(World.p.x >= 15 ? 'L' : 'R')); await ff(page, 2); found = await ev(() => World.lock > 0 || Battle.active); if (!found && await ev(() => World.p.x >= 15)) await ev(() => LMDebug.walk('LLL')); }
  ok(found, 'Wilde Begegnung im hohen Gras');
  await mash(page, 'Battle.active && Battle.v && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2)', 4000); await snap(page, 'wildkampf');
  ok(await ev(() => Battle.cfg.kind === 'wild' && !!G.seen[Battle.E().species]), 'Wildes Monster: ' + await ev(() => Battle.E().species + ' Lv' + Battle.E().level));
  // KAMPF -> erste Attacke
  await press(page, 'a', 6); await snap(page, 'attacken'); await press(page, 'a', 40); await snap(page, 'angriff');
  await mash(page, 'UI.layers.some(l => l.o && l.o.cols === 2) || !Battle.active', 4000);
  if (await ev(() => Battle.active)) {
    // Fangen: Gegner schwächen und Leine werfen (Zufall festlegen)
    await ev(() => { Battle.E().hp = 1; Battle.v.eHp = 1; window.__rnd = Math.random; Math.random = () => 0.01; });
    await press(page, 'down', 3); await press(page, 'a', 8); await snap(page, 'beutel');
    await press(page, 'a', 30); await snap(page, 'wurf'); await ff(page, 60); await snap(page, 'zerren'); await ff(page, 120); await snap(page, 'gefangen');
    await ev(() => { Math.random = window.__rnd; });
    await ev(() => Bot.free(20000));
    ok(await ev(() => G.party.length === 2 && Bag.count('leine') === 4 && Object.keys(G.caught).length === 2), 'Monster angeleint, Leine verbraucht, Lexikon aktualisiert: ' + await ev(() => Bot.st()));
  } else ok(false, 'Kampf endete zu früh');
  await montage(page, 'play1.png', 5);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
