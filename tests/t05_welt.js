// Weltmechanik: Kollisionen, Sprungkanten, Schilder, Gegenstände, NPC-Bewegung, hohes Gras, Zufallsbegegnungen (Statistik)
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => { Mon.give(Mon.create('glutwelp', 50)); G.flags.has_starter = true; G.flags.has_dex = true; World.enter('route1', 3, 16, 'down'); World.encCooldown = 99999; });
  await ff(page, 3);
  // Sprungkante: von oben hinunter (2 Felder), von unten blockiert
  await ev(() => LMDebug.walk('D')); await ff(page, 2);
  ok(await ev(() => World.p.x === 3 && World.p.y === 18), 'Sprungkante von oben: Spieler landet 2 Felder tiefer: ' + await ev(() => World.p.y));
  await ev(() => LMDebug.walk('U')); await ff(page, 2);
  ok(await ev(() => World.p.y === 18), 'Sprungkante von unten blockiert');
  // Baum, Wasser (Kollision)
  await ev(() => World.enter('welpenhain', 1, 9, 'left')); await ev(() => LMDebug.walk('L'));
  ok(await ev(() => World.p.x === 1), 'Baum blockiert');
  await ev(() => World.enter('welpenhain', 1, 10, 'right')); await ev(() => LMDebug.walk('R'));
  ok(await ev(() => World.p.x === 1), 'Wasser blockiert');
  // Schild lesen
  await ev(() => World.enter('welpenhain', 8, 15, 'up')); await ev(() => Bot.talk('up')); await ff(page, 40);
  ok(await ev(() => /WELPENHAIN/.test(UI.tb.lines.join(' '))), 'Schild: ' + await ev(() => UI.tb.lines.join(' / ')));
  await snap(page, 'schild'); await ev(() => Bot.free());
  // Gegenstand aufsammeln
  await ev(() => World.enter('welpenhain', 17, 16, 'up')); await ff(page, 3); await snap(page, 'gegenstand');
  ok(await ev(() => World.blocked(17, 15)), 'Gegenstand am Boden blockiert das Feld');
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('trank') === 1 && !World.blocked(17, 15)), 'Gegenstand aufgesammelt und verschwunden');
  await ev(() => World.enter('welpenhain', 17, 16, 'up'));
  ok(await ev(() => World.ents.find(e => e.def.id === 'item1').hidden), 'Gegenstand bleibt nach Kartenwechsel verschwunden (dauerhaftes Flag)');
  // NPC wandert
  const n0 = await ev(() => { World.enter('welpenhain', 3, 6, 'down'); const e = World.ents.find(e => e.def.id === 'maedchen'); return e.x + ',' + e.y; });
  let moved = false; for (let i = 0; i < 40 && !moved; i++) { await ff(page, 60); moved = await ev(n => { const e = World.ents.find(e => e.def.id === 'maedchen'); return (e.x + ',' + e.y) !== n; }, n0); }
  ok(moved, 'NPC mit Bewegungsmuster "wander" bewegt sich');
  // Tür mit Bedingung (Arena ohne Monster)
  await ev(() => { G.party = []; World.enter('bellstadt', 4, 5, 'up'); }); await ev(() => LMDebug.walk('U')); await ff(page, 40);
  ok(await ev(() => World.mapId === 'bellstadt' && /Monster/.test(UI.tb.lines.join(' '))), 'Arena-Zugangsbedingung verweigert Eintritt: ' + await ev(() => UI.tb.lines.join(' ')));
  await ev(() => Bot.free()); await ev(() => { Mon.give(Mon.create('glutwelp', 50)); });
  // Hohes Gras: Bild + Begegnungsstatistik
  await ev(() => { World.enter('route1', 4, 3, 'down'); World.encCooldown = 0; }); await ff(page, 3); await snap(page, 'gras');
  const stat = await ev(() => { const c = {}; const tab = World.map.encounters[0]; for (let i = 0; i < 4000; i++) { const s = U.weighted(tab.slots, q => q.weight); c[s.species] = (c[s.species] || 0) + 1; } return c; });
  ok(stat.nagri > stat.piepsel && stat.piepsel > stat.krabbli && stat.krabbli > stat.blitzel && stat.blitzel > 100, 'Begegnungswahrscheinlichkeiten folgen den Gewichten: ' + JSON.stringify(stat));
  let steps = 0, enc = 0;
  for (let k = 0; k < 6; k++) { for (let i = 0; i < 40; i++) { await ev(() => LMDebug.walk(World.p.x >= 6 ? 'L' : (World.p.x <= 3 ? 'R' : (Math.random() < .5 ? 'L' : 'R')))); steps++; if (await ev(() => World.lock > 0 || Battle.active)) { enc++; await ev(() => { Battle.E && Battle.foes[0] && (Battle.foes[0].hp = 1); }); await ev(() => Bot.free(20000)); await ev(() => { World.encCooldown = 0; }); } } }
  ok(enc >= 8 && enc <= 60, 'Zufallsbegegnungen im Gras: ' + enc + ' in ' + steps + ' Schritten (Rate 12 %)');
  await ev(() => { World.enter('route1', 9, 22, 'down'); World.encCooldown = 0; }); let none = true;
  for (let i = 0; i < 20; i++) { await ev(() => LMDebug.walk(World.p.y > 24 ? 'U' : 'D')); if (await ev(() => World.lock > 0)) none = false; }
  ok(none, 'Keine Begegnungen auf dem Weg');
  await montage(page, 'world.png', 4);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
