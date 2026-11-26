const { open, ff, press, shot, mash, snap, montage } = require('./lib.js');
(async () => {
  const { browser, page, errors } = await open();
  await ff(page, 30); await snap(page, 's01_title');
  await press(page, 'a', 10); await snap(page, 's02_titlemenu');
  // NEUES SPIEL (kein Spielstand -> erster Eintrag)
  await press(page, 'a', 30); await snap(page, 's03_intro');
  // Intro durchklicken bis zur Namenseingabe
  await mash(page, "UI.layers.some(l => l.draw && String(l.draw).includes('NAME_PAGES'))", 2000);
  await snap(page, 's04_name');
  // Name: A (ein Buchstabe), dann START -> ENDE, A
  await press(page, 'a', 4); await press(page, 'right', 4); await press(page, 'a', 4); await press(page, 'start', 4); await press(page, 'a', 8);
  await snap(page, 's05_confirm');
  // bestätigen und Rest durchklicken, bis die Welt aktiv ist
  const ok = await mash(page, "World.active && !World.lock && Gfx.fade === 0", 4000);
  await ff(page, 20); await snap(page, 's06_room');
  console.log('world active:', ok, await page.evaluate(() => JSON.stringify({ name: G.name, rival: G.rival, map: World.mapId, x: World.p.x, y: World.p.y })));
  // Menü öffnen
  await press(page, 'start', 6); await snap(page, 's07_menu'); await press(page, 'b', 6);
  // laufen
  await page.evaluate(() => LMDebug.walk('RRR')); await snap(page, 's08_walk');
  console.log('pos', await page.evaluate(() => JSON.stringify(World.p)));
  await montage(page, 'smoke.png', 4);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
