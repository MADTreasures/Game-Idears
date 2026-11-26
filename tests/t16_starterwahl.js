// Starterwahl: Das Monster ist bei der Auswahl zu sehen (Bild, Name, Typ) – für alle drei Körbchen, bei NEIN verschwindet es wieder.
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => World.enter('labor', 2, 5, 'up')); await ff(page, 3);
  for (const [x, species] of [[2, 'glutwelp'], [4, 'quappel'], [6, 'sprossel']]) {
    await ev(x => Bot.goto(x, 5), x); await ev(() => Bot.talk('up')); await ff(page, 4);
    ok(await ev(s => UI.layers.includes(UI.pic) && UI.pic.species === s, species), 'Körbchen ' + species + ': Monsterbild wird sofort angezeigt');
    await mash(page, '/JA/.test(Bot.text())', 900); await snap(page, 'wahl_' + species);
    ok(await ev(s => UI.layers.includes(UI.pic) && UI.pic.species === s && UI.layers.indexOf(UI.pic) < UI.layers.indexOf(UI.tb), species), 'Körbchen ' + species + ': Bild bleibt während der Ja/Nein-Frage sichtbar (hinter Textbox und Auswahl)');
    await press(page, 'down', 3); await press(page, 'a', 20);                         // NEIN
    ok(await ev(() => !UI.layers.includes(UI.pic)), 'Bei NEIN verschwindet das Bild');
    await ev(() => Bot.free());
  }
  ok(await ev(() => G.party.length === 0 && !G.seen.glutwelp), 'Ansehen allein vergibt nichts');
  // jetzt Quappel nehmen
  await ev(() => Bot.goto(4, 5)); await ev(() => Bot.talk('up')); await mash(page, '/JA/.test(Bot.text())', 900); await press(page, 'a', 12);
  await page.evaluate(() => LMDebug.until(() => /erhält/.test(UI.tb.lines.join(' ')), 300)); await ff(page, 20); await snap(page, 'erhalten');
  ok(await ev(() => UI.layers.includes(UI.pic) && UI.pic.species === 'quappel'), 'Bei der Übergabe ist das Monster zu sehen');
  await mash(page, 'Battle.active', 9000);
  ok(await ev(() => !UI.layers.includes(UI.pic) && G.party[0].species === 'quappel'), 'Danach ist das Bild weg, Quappel im Team');
  await ev(() => { Battle.foes[0].hp = 1; }); await ev(() => Bot.free(30000));
  ok(await ev(() => !UI.layers.includes(UI.pic) && UI.pic.species === null), 'Nach dem Ereignis ist kein Bild mehr aktiv');
  await montage(page, 'starter.png', 4);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
