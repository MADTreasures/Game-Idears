// Verschiedenes: Sound (ohne Hören: nur Fehlerfreiheit), Touch-Layout, Kampfmechanik-Stichproben, Spielstand-Export/-Import
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const path = require('path');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  // --- Sound ---
  const snd = await ev(async () => {
    Sound.unlock(); const out = { state: Sound.ac && Sound.ac.state, songs: [], bad: [] };
    for (const s of DB.songs) { const p = Sound.parse(s); out.songs.push(s.id + ':' + p.tracks.length + '/' + p.tracks.reduce((a, t) => a + t.ev.length, 0)); if (!p.tracks.length) out.bad.push(s.id); const lens = p.tracks.map(t => t.ev.reduce((a, e) => a + e.len, 0)); if (s.loop !== false && lens.some(l => Math.max(...lens) % l)) out.bad.push(s.id + ' Länge ' + lens); }
    for (const s of DB.songs) { if (s.loop === false) Sound.jingle(s.id); else { Sound.playSong(s.id); Sound.pump(); } await new Promise(r => setTimeout(r, 30)); }
    for (const s of DB.sfx) Sound.sfx(s.id);
    await new Promise(r => setTimeout(r, 300)); Sound.pump(); Sound.stopSong(); return out;
  });
  ok(snd.state === 'running' && !snd.bad.length, 'Sound: AudioContext ' + snd.state + ', ' + snd.songs.length + ' Stücke geparst, fehlerhaft: ' + (snd.bad.join(',') || 'keine'));
  // --- Kampfmechanik (Stichproben) ---
  await newGame(page);
  const mech = await ev(() => {
    const r = {}; const A = Mon.create('glutwelp', 20), W = Mon.create('quappel', 20), P = Mon.create('sprossel', 20);
    G.party = [A]; Battle.cfg = { kind: 'wild' }; Battle.foes = [P]; Battle.pi = 0; Battle.ei = 0; Battle.ps = Battle.newSide(); Battle.es = Battle.newSide();
    const fire = Data.move('zuendler'), norm = Data.move('rempler');
    r.se = Battle.calcDamage('p', fire, false, 1); Battle.foes = [W]; r.nve = Battle.calcDamage('p', fire, false, 1); r.neutral = Battle.calcDamage('p', norm, false, 1); r.crit = Battle.calcDamage('p', norm, true, 1);
    Battle.ps.stages.atk = 2; r.buffed = Battle.calcDamage('p', norm, false, 1); Battle.ps.stages.atk = 0; A.status = 'burn'; r.burned = Battle.calcDamage('p', norm, false, 1); A.status = '';
    r.immune = Data.typeFactor('normal', ['geist']); r.dual = Data.typeFactor('wasser', ['boden', 'gestein']);
    const E = Mon.create('nagri', 5), leine = Data.item('leine'), meister = Data.item('meisterleine'), stark = Data.item('starkleine');
    r.cFull = Battle.catchChance(E, leine); E.hp = 1; r.cLow = Battle.catchChance(E, leine); E.status = 'sleep'; r.cSleep = Battle.catchChance(E, leine); E.status = ''; E.hp = Mon.maxHp(E);
    const S = Mon.create('glutwelp', 5); r.sFull = Battle.catchChance(S, leine); r.sStark = Battle.catchChance(S, stark); r.sMeister = Battle.catchChance(S, meister);
    r.exp5 = Mon.expFor(Data.mon('glutwelp'), 5); r.exp100 = Mon.expFor(Data.mon('glutwelp'), 100);
    const L = Mon.create('nagri', 99); L.exp = Mon.expFor(Mon.sp(L), 100) - 1; const ups = Mon.addExp(L, 9999999); r.max = L.level; r.ups = ups.length;
    r.stats = Mon.stats(Mon.create('kiesling', 50));
    return r;
  });
  ok(mech.se > mech.neutral && mech.nve < mech.se / 3, 'Typeneffektivität wirkt auf Schaden: sehr effektiv ' + mech.se + ', nicht effektiv ' + mech.nve + ', neutral ' + mech.neutral);
  ok(mech.crit > mech.neutral && mech.buffed > mech.neutral && mech.burned < mech.neutral, 'Volltreffer ' + mech.crit + ' / Angriff+2 ' + mech.buffed + ' / Verbrennung ' + mech.burned + ' gegenüber normal ' + mech.neutral);
  ok(mech.immune === 0 && mech.dual === 4, 'Immunität (Normal->Geist = 0) und Doppeltyp (Wasser->Boden/Gestein = 4)');
  ok(mech.cFull < mech.cLow && mech.cLow <= mech.cSleep && mech.sFull < mech.sStark && mech.sMeister === 1, 'Fangchance: volle LP ' + mech.cFull.toFixed(2) + ' < 1 LP ' + mech.cLow.toFixed(2) + ' <= Schlaf ' + mech.cSleep.toFixed(2) + '; Starter ' + mech.sFull.toFixed(3) + ' < Starkleine ' + mech.sStark.toFixed(3) + '; Meisterleine ' + mech.sMeister);
  ok(mech.exp5 === 125 && mech.max === 100 && mech.ups === 1, 'EP-Kurve und Maximallevel 100: ' + JSON.stringify([mech.exp5, mech.exp100, mech.max]));
  // --- Statusattacken im echten Kampf (Zufall fixiert) ---
  await ev(() => { G.party = [Mon.create('sprossel', 30)]; G.flags.has_starter = true; });
  const fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('kiesling', 12)] }); await World.afterBattle(window.__res, false); }));
  await page.evaluate(() => LMDebug.until(() => Battle.active && Battle.v.pHud && UI.layers.some(l => l.o && l.o.cols === 2), 4000, 'a'));
  await ev(() => { window.__rnd = Math.random; Math.random = () => 0.5; });
  // Schlummerstaub wählen
  await press(page, 'a', 8);
  const mi = await ev(() => Battle.P().moves.findIndex(m => m.id === 'schlummerstaub'));
  await ev(i => { UI.layers[UI.layers.length - 1].sel = i; }, mi); await press(page, 'a', 8);
  await page.evaluate(() => LMDebug.until(() => UI.layers.some(l => l.o && l.o.cols === 2), 3000, 'a'));
  ok(await ev(() => Battle.E().status === 'sleep'), 'Statusattacke: Gegner schläft ein (Zähler ' + await ev(() => Battle.E().sleep) + ')');
  await snap(page, 'schlaf');
  // Kampfschrei/Panzern -> Wertestufe
  const pi = await ev(() => Battle.P().moves.findIndex(m => m.id === 'panzern'));
  if (pi >= 0) { await press(page, 'a', 8); await ev(i => { UI.layers[UI.layers.length - 1].sel = i; }, pi); await press(page, 'a', 8); await page.evaluate(() => LMDebug.until(() => UI.layers.some(l => l.o && l.o.cols === 2), 3000, 'a')); ok(await ev(() => Battle.ps.stages.def === 1), 'Werteveränderung: Verteidigung +1'); }
  await ev(() => { Math.random = window.__rnd; Battle.E().hp = 1; });
  await ev(() => Bot.free(20000)); await fight;
  ok(await ev(() => window.__res === 'win'), 'Kampf gewonnen');
  // --- Spielstand-Export / -Import ---
  await ev(() => { G.money = 4242; Save.write(); });
  const exported = await ev(() => JSON.stringify(G));
  ok(await ev(t => { Save.del(); const s = Save.importText(t); return s.money === 4242 && Save.exists(); }, exported), 'Spielstand-Export/-Import (Datenebene) funktioniert');
  ok(await ev(() => { try { Save.importText('{"format":"x"}'); return false; } catch (e) { return /Kein Animora/.test(e.message); } }), 'Ungültige Spielstand-Datei wird abgelehnt');
  ok(await ev(() => { const s = JSON.parse(JSON.stringify(G)); s.party.push({ species: 'gibtsnicht', moves: [] }); s.map = 'weg'; s.bag.unsinn = 3; const c = Save.sanitize(s); return c.party.every(m => Data.hasMon(m.species)) && c.map === DB.meta.startMap && !c.bag.unsinn; }), 'Spielstand wird gegen geänderte Projektdaten abgesichert');
  await montage(page, 'misc.png', 4);
  // --- Touch-Layout (Hochformat-Handy) ---
  await page.setViewportSize({ width: 390, height: 780 });
  await ev(() => { Opt.touch = 'on'; Shell.applyTouch(); Engine.draw(); });
  await page.screenshot({ path: path.join(__dirname, 'out', 'touch_portrait.png') });
  const hit = await ev(async () => { const b = document.querySelector('#lm-act [data-k="a"]'), r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { clientX: r.left + 5, clientY: r.top + 5, bubbles: true })); const d = Input.down.a; b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); return d && !Input.down.a; });
  ok(hit, 'Touch-Taste A erzeugt Eingabe');
  const dp = await ev(() => {
    const pad = document.getElementById('lm-pad'), c = k => { const r = pad.querySelector('[data-k="' + k + '"]').getBoundingClientRect(); return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, pointerId: 1, buttons: 1 }; };
    pad.dispatchEvent(new PointerEvent('pointerdown', c('up'))); const up = Input.down.up;
    pad.dispatchEvent(new PointerEvent('pointermove', c('right'))); const slid = Input.down.right && !Input.down.up;   // Finger gleitet zur nächsten Taste
    pad.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })); return up && slid && !Input.down.right;
  });
  ok(dp, 'Touch-Richtungstasten erzeugen Eingaben (inkl. Gleiten zwischen Tasten)');
  await page.setViewportSize({ width: 780, height: 390 }); await ev(() => { Shell.layout(); Engine.draw(); });
  await page.screenshot({ path: path.join(__dirname, 'out', 'touch_landscape.png') });
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
