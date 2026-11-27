// Menüabläufe: Beutel (benutzen/wegwerfen), Team umsortieren, Spitzname, Optionen, Titel-Spielstandmenü, Computer im Zimmer
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  const menuTo = async label => { const items = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => typeof i === 'string' ? i : i.label)); const cur = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().sel); const t = items.findIndex(s => s.indexOf(label) === 0); if (t < 0) throw new Error('Menüeintrag fehlt: ' + label + ' in ' + items); for (let i = cur; i < t; i++) await press(page, 'down', 3); for (let i = cur; i > t; i--) await press(page, 'up', 3); await press(page, 'a', 8); };
  // Computer ohne Monster
  await ev(() => Bot.goto(3, 2)); await ev(() => Bot.talk('up')); await ff(page, 60);
  ok(await ev(() => /Computer/.test(UI.tb.lines.join(' '))), 'Computer im Zimmer (ohne Monster): ' + await ev(() => UI.tb.lines.join(' ')));
  await ev(() => Bot.free());
  await ev(() => { const a = Mon.create('glutwelp', 12), b = Mon.create('nagri', 6); a.hp = 5; a.status = 'poison'; Mon.give(a); Mon.give(b); G.flags.has_dex = true; Bag.add('trank', 2); Bag.add('gegengift', 1); Bag.add('leine', 3); Bag.add('stadtplan', 1); Bag.add('beleber', 1); });
  // Beutel: Trank benutzen
  await press(page, 'start', 6); await menuTo('BEUTEL'); await snap(page, 'beutel');
  await menuTo('Trank'); await snap(page, 'beutel_aktion'); await menuTo('BENUTZEN'); await snap(page, 'ziel'); await press(page, 'a', 40); await snap(page, 'geheilt');
  ok(await ev(() => G.party[0].hp === 25 && Bag.count('trank') === 1), 'Trank im Feld benutzt: LP ' + await ev(() => G.party[0].hp));
  await press(page, 'a', 8);
  await menuTo('Gegengift'); await menuTo('BENUTZEN'); await press(page, 'a', 40); await press(page, 'a', 8);
  ok(await ev(() => G.party[0].status === '' && Bag.count('gegengift') === 0), 'Gegengift heilt Vergiftung');
  await menuTo('Beleber'); await menuTo('BENUTZEN'); await press(page, 'a', 40);
  ok(await ev(() => /keine Wirkung/.test(UI.tb.lines.join(' ')) && Bag.count('beleber') === 1), 'Beleber auf gesundes Monster: keine Wirkung, nicht verbraucht');
  await press(page, 'a', 8);
  await menuTo('Hundeleine'); await menuTo('WEGWERFEN'); await press(page, 'up', 3); await press(page, 'a', 4); await mash(page, '/JA/.test(Bot.text())', 300); await snap(page, 'wegwerfen'); await press(page, 'up', 3); await press(page, 'a', 30); await press(page, 'a', 8);
  ok(await ev(() => Bag.count('leine') === 1), '2 Hundeleinen weggeworfen: ' + await ev(() => Bag.count('leine')));
  await menuTo('Stadtplan'); const acts = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.join('/'));
  ok(acts === 'BENUTZEN/ZURÜCK', 'Schlüsselitem kann nicht weggeworfen werden: ' + acts);
  await press(page, 'b', 6); await press(page, 'b', 6);
  // Team: umsortieren
  await menuTo('ANIMORA'); await press(page, 'a', 6); await menuTo('TAUSCH'); await snap(page, 'tausch'); await press(page, 'down', 3); await press(page, 'a', 6);
  ok(await ev(() => G.party[0].species === 'nagri' && G.party[1].species === 'glutwelp'), 'Team umsortiert: ' + await ev(() => G.party.map(m => m.species).join(',')));
  await press(page, 'b', 6);
  // Optionen
  await menuTo('OPTIONEN'); await snap(page, 'optionen');
  await menuTo('FARBE'); ok(await ev(() => Opt.pal === 'dmg' && Gfx.css[0] === '#9bbc0f'), 'Farbpalette umgeschaltet'); await snap(page, 'palette_dmg');
  await menuTo('FARBE'); await menuTo('FARBE'); await menuTo('FARBE');
  ok(await ev(() => Opt.pal === 'gruen'), 'Palette wieder Klassik');
  await menuTo('TON'); ok(await ev(() => Opt.sound === false), 'Ton aus'); await menuTo('TON');
  await press(page, 'b', 6); await press(page, 'b', 6); await ff(page, 4);
  ok(await ev(() => World.lock === 0), 'Menü geschlossen');
  // Spitzname über Aktion giveMonster
  const p = ev(() => World.run(() => Script.run([{ k: 'giveMonster', species: 'piepsel', level: 7 }], {})));
  await mash(page, '/JA/.test(Bot.text())', 600); await press(page, 'up', 3); await press(page, 'a', 10); await snap(page, 'spitzname');
  await press(page, 'a', 4); await press(page, 'right', 3); await press(page, 'a', 4); await press(page, 'start', 4); await press(page, 'a', 10); await ev(() => Bot.free()); await p;
  ok(await ev(() => G.party[2].nick === 'AB' && Mon.name(G.party[2]) === 'AB' && G.caught.piepsel), 'Spitzname vergeben: ' + await ev(() => Mon.name(G.party[2])));
  // Computer mit Monstern -> Speicher öffnet sich
  await ev(() => Bot.goto(3, 2)); await ev(() => Bot.talk('up')); await mash(page, '/ABHOLEN/.test(Bot.text())', 900);
  ok(await ev(() => /ABHOLEN/.test(Bot.text())), 'Computer im Zimmer öffnet den Monsterspeicher'); await press(page, 'b', 8); await ev(() => Bot.free());
  // Zum Titelbild + Spielstandmenü
  await ev(() => Save.write());
  await press(page, 'start', 6); await menuTo('OPTIONEN'); await menuTo('ZUM TITELBILD'); await mash(page, '/JA/.test(Bot.text())', 300); await press(page, 'up', 3); await press(page, 'a', 30);
  ok(await ev(() => !World.active && G === null), 'Zurück zum Titelbild');
  await ff(page, 20); await press(page, 'a', 10); await menuTo('SPIELSTAND'); await snap(page, 'spielstandmenue');
  await menuTo('LÖSCHEN'); await mash(page, '/JA/.test(Bot.text())', 300); await press(page, 'up', 3); await press(page, 'a', 30); await press(page, 'a', 10);
  ok(await ev(() => !Save.exists()), 'Spielstand gelöscht');
  await montage(page, 'menus.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
