// Kampfanimationen: jede Animation direkt ausführen (Fehler sichtbar machen) und je ein Bild aus der Mitte aufnehmen.
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => { G.party = [Mon.create('lurchon', 30)]; G.flags.has_starter = true; G.flags.has_dex = true; Bag.add('leine', 9); });
  const fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('rankhorn', 28)] }); await World.afterBattle(window.__res, false); }));
  await page.evaluate(() => LMDebug.until(() => Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2), 4000, 'a'));
  const names = await ev(() => Object.keys(Battle.ANIMS));
  for (const n of names) {
    const err = await ev(async n => {
      let e = null; const side = ['buff', 'heal'].includes(n) ? 'p' : 'e';
      const p = Battle.ANIMS[n](Battle.pos(side), side, 'p').catch(x => { e = String(x); });
      await LMDebug.ff(n === 'hit' || n === 'punch' ? 16 : 12); Engine.draw(); (window.__snaps = window.__snaps || []).push({ label: n, url: Shell.canvas.toDataURL() });
      for (let i = 0; i < 80; i++) { Engine.tick(); await LMDebug.yield(); } await p; Gfx.invert = false; return e;
    }, n);
    if (err) console.log('FAIL Animation', n, err);
  }
  // Statusanzeige + niedrige LP
  await ev(() => { Battle.E().status = 'para'; Battle.E().hp = 5; Battle.v.eHp = 5; Battle.P().status = 'burn'; }); await snap(page, 'status+lowhp');
  // Fehlgeschlagener Fang (Zufall hoch -> sofort abgeschüttelt), Bild beim Reissen
  await ev(() => { Battle.E().status = ''; Battle.E().hp = Mon.maxHp(Battle.E()); Battle.v.eHp = Battle.E().hp; window.__rnd = Math.random; Math.random = () => 0.999; });
  await press(page, 'down', 3); await press(page, 'a', 8); await press(page, 'a', 4);
  await ff(page, 20); await snap(page, 'wurf'); await ff(page, 30); await snap(page, 'halsband'); await ff(page, 22); await snap(page, 'riss'); 
  await page.evaluate(() => LMDebug.until(() => /Mist/.test(UI.tb.lines.join(' ')), 600));
  await snap(page, 'fehlschlag');
  console.log(/Mist/.test(await ev(() => UI.tb.lines.join(' '))) && await ev(() => Bag.count('leine') === 8) ? 'PASS Fehlgeschlagener Fang: Leine verbraucht, Kampf geht weiter' : 'FAIL Fangfehlschlag');
  await ev(() => { Math.random = window.__rnd; });
  await page.evaluate(() => LMDebug.until(() => UI.layers.some(l => l.o && l.o.cols === 2) || !Battle.active, 3000, 'a'));
  console.log(await ev(() => Battle.active && Battle.P().hp <= Mon.maxHp(Battle.P())) ? 'PASS Gegner greift nach Fehlversuch an: LP ' + await ev(() => Battle.P().hp + '/' + Mon.maxHp(Battle.P())) : 'FAIL');
  // Levelaufstieg-Box
  await ev(() => { const m = Battle.P(); m.exp = Mon.expFor(Mon.sp(m), m.level + 1) - 1; Battle.E().hp = 1; });
  await page.evaluate(() => Bot.until(() => UI.layers.some(l => String(l.draw).includes('up.after')), 6000)); await snap(page, 'levelup');
  await ev(() => Bot.free(20000)); await fight;
  await montage(page, 'anims.png', 7);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
