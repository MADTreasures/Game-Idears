// Velo-Aufgabe (Tupperwil) und das legendäre RAMBOSS (Kriegerhöhle mit zwei Rätseln, nur mit der Meisterleine fangbar).
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => { Mon.give(Mon.create('lurchon', 60)); G.flags.has_starter = true; G.flags.has_dex = true; G.badges = ['gym1', 'gym2', 'gym3']; World.encCooldown = 1e9; ['zoe', 'hans', 'kurt', 'luca', 'maxx', 'otto', 'mia', 'jonas', 'kim'].forEach(t => { G.defeated[t] = true; }); });
  // ---------- Velo-Aufgabe ----------
  await ev(() => World.enter('route3', 14, 2, 'up')); await ff(page, 3);
  ok(await ev(() => Bot.ent('velo').hidden && Bot.ent('veloteil3').hidden), 'Ohne Aufgabe liegen weder Velo noch Teile herum');
  await ev(() => World.enter('haus_tup1', 5, 5, 'up')); await ff(page, 3); await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => G.quests.velo === 'active'), 'Lia in Tupperwil gibt die Aufgabe "Das Velo"');
  await ev(() => World.enter('route3', 14, 2, 'up')); await ff(page, 3); await snap(page, 'Kaputtes Velo');
  ok(await ev(() => !Bot.ent('velo').hidden && World.blocked(14, 1)), 'Am Schrottpfad liegt jetzt das kaputte Velo');
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('velo_kaputt') === 1 && Bot.ent('velo').hidden), 'Kaputtes Velo eingesammelt');
  // Werkstatt ohne Teile
  await ev(() => World.enter('tupperwil', 9, 9, 'up')); await ff(page, 3); await snap(page, 'Werkstatt aussen');
  ok(await ev(() => Bot.door('werkstatt')), 'Die Velowerkstatt am Platz von Tupperwil ist begehbar');
  await ev(async () => { await Bot.goto(4, 3); await Bot.talk('up'); }); await ff(page, 40); await snap(page, 'Werkstatt');
  await ev(() => Bot.free());
  ok(await ev(() => Bag.count('velo_kaputt') === 1 && Bag.count('velo') === 0), 'Ohne die fünf Teile repariert die Mechanikerin nichts');
  await ev(() => Bot.out());
  // fünf Teile einsammeln
  const parts = await ev(async () => {
    const res = [];
    for (const [map, id] of [['tupperwil', 'veloteil1'], ['route2', 'veloteil2'], ['route3', 'veloteil3'], ['route3', 'veloteil4'], ['route3', 'veloteil5']]) {
      const d = Data.map(map).events.find(e => e.id === id); let done = false;
      for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]) {
        if (Editor.cellSolid(Data.map(map), d.x + dx, d.y + dy)) continue;
        World.enter(map, d.x + dx, d.y + dy, dir); await LMDebug.ff(3); if (Bot.ent(id).hidden) break; await Bot.talk(dir); await Bot.free(); done = true; break;
      }
      res.push(id + ':' + done + ':' + Bag.count('veloteil'));
    }
    return res;
  });
  ok(await ev(() => Bag.count('veloteil') === 5), 'Fünf Veloteile gefunden (Tupperwil, Route 2, dreimal Route 3): ' + parts.join(' '));
  // Reparatur
  await ev(() => World.enter('werkstatt', 4, 3, 'up')); await ff(page, 3); await ev(() => Bot.talk('up')); await ev(() => Bot.free(3000));
  ok(await ev(() => Bag.count('velo') === 1 && Bag.count('velo_kaputt') === 0 && Bag.count('veloteil') === 0 && G.quests.velo === 'done'), 'Die Werkstatt repariert das Velo: Aufgabe erledigt, VELO im Beutel');
  // drinnen nicht fahrbar
  await ev(() => { World.run(() => World.toggleBike()); }); await ff(page, 30);
  const inside = await ev(() => UI.tb.lines.join(' ')); await ev(() => Bot.free());
  ok(await ev(() => !G.bike && !World.riding()) && /Hier drinnen/.test(inside), 'Drinnen kann man nicht aufsteigen: ' + inside);
  await ev(() => Bot.out());
  // über den Beutel aufsteigen
  await press(page, 'start', 6); let items = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label || i)); for (let i = 0; i < items.indexOf('BEUTEL'); i++) await press(page, 'down', 3);
  await press(page, 'a', 8); const bl = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label)); for (let i = 0; i < bl.indexOf('Velo'); i++) await press(page, 'down', 3);
  await snap(page, 'Velo im Beutel'); await press(page, 'a', 8); await press(page, 'a', 8); await ff(page, 30); await ev(() => Bot.free()); await ff(page, 5); await snap(page, 'auf dem Velo');
  ok(await ev(() => G.bike && World.riding()), 'BENUTZEN im Beutel: der Spieler sitzt auf dem Velo');
  const speed = await ev(async () => {
    const run = async () => { World.enter('tupperwil', 3, 9, 'right'); await LMDebug.ff(2); const t0 = Engine.ticks; await LMDebug.walk('RRRRRRRR'); return { ticks: Engine.ticks - t0, x: World.p.x }; };
    const bike = await run(); G.bike = false; const foot = await run(); G.bike = true; return { bike: bike.ticks, foot: foot.ticks, x: bike.x + '/' + foot.x };
  });
  ok(speed.bike * 2.2 < speed.foot, 'Auf dem Velo ist man fast dreimal so schnell (8 Felder: ' + speed.bike + ' statt ' + speed.foot + ' Ticks, Ziel x=' + speed.x + ')');
  ok(await ev(() => { World.enter('heil2', 4, 4, 'up'); const a = World.riding(); World.enter('tupperwil', 5, 17, 'down'); return !a && World.riding(); }), 'In Gebäuden wird geschoben, draussen fährt man automatisch weiter');
  // Spielstand merkt sich das Velo
  ok(await ev(() => { const s = JSON.parse(JSON.stringify(G)); return Save.sanitize(s).bike === true; }), 'Der Spielstand merkt sich, dass man auf dem Velo sitzt');
  await ev(() => { G.bike = false; });
  // ---------- Kriegerhöhle ----------
  await ev(() => World.enter('route4', 2, 30, 'up')); await ff(page, 60); await snap(page, 'Höhleneingang');
  await ev(() => Bot.step('U')); await ev(() => Bot.free()); await ff(page, 20); await snap(page, 'Höhle Raum 1');
  ok(await ev(() => World.mapId === 'hoehle' && World.p.x === 7 && World.p.y === 14), 'Auf Route 4 führt ein Höhleneingang in die Kriegerhöhle');
  ok(await ev(() => !Bot.ent('tor1').hidden && Bot.path(7, 9) === null), 'Das erste Tor ist verschlossen');
  await ev(async () => { await Bot.goto(12, 13); await Bot.talk('down'); }); await ff(page, 60); await snap(page, 'Zettel');
  const note = await ev(async () => { let t = ''; for (let i = 0; i < 40 && World.lock; i++) { t += ' ' + UI.tb.lines.join(' '); await LMDebug.press('a', 12); } return t; });
  ok(/MEISTERLEINE/.test(note) && /Alpsteig/.test(note), 'Ein Zettel in der Höhle verrät: nur die MEISTERLEINE bändigt RAMBOSS – und wo sie liegt');
  // Rätsel 1: Felsen schieben
  const push = await ev(async () => {
    const f1 = Bot.ent('fels1'), f2 = Bot.ent('fels2'), r = {};
    await Bot.goto(6, 13); await LMDebug.walk('L'); await LMDebug.ff(20); r.a = f1.x + ',' + f1.y; await LMDebug.walk('L'); await LMDebug.ff(20); await LMDebug.walk('L'); await LMDebug.ff(20); r.b = f1.x + ',' + f1.y;
    await Bot.goto(3, 14); await LMDebug.walk('U'); await LMDebug.ff(20); r.c = f1.x + ',' + f1.y; r.gate1 = !!Game.flag('hoehle_tor1');
    await Bot.goto(8, 13); await LMDebug.walk('R'); await LMDebug.ff(20); await LMDebug.walk('R'); await LMDebug.ff(20); await LMDebug.walk('R'); await LMDebug.ff(20); r.d = f2.x + ',' + f2.y;
    return r;
  });
  ok(push.a === '4,13' && push.b === '3,13' && push.c === '3,12', 'Felsbrocken lassen sich feldweise schieben: ' + JSON.stringify(push));
  ok(push.gate1 === false, 'Ein Fels allein öffnet das Tor nicht');
  await snap(page, 'Fels auf Siegel');
  await ev(async () => { await Bot.goto(11, 14); await LMDebug.walk('U'); await LMDebug.ff(30); }); await snap(page, 'Tor öffnet sich'); await ev(() => Bot.free());
  ok(await ev(() => Game.flag('hoehle_tor1') && Bot.ent('tor1').hidden && Bot.path(7, 9) !== null), 'Beide Felsen auf den Siegeln: das erste Tor öffnet sich');
  ok(await ev(() => { const f = Bot.ent('fels1'), x = f.x; World.enter('hoehle', 7, 14, 'up'); return x === 3 && Bot.ent('fels1').x === 5 && Bot.ent('tor1').hidden; }), 'Beim erneuten Betreten liegen die Felsen wieder am Ausgangsort, das Tor bleibt offen');
  // Rätsel 2: Hebel
  await ev(async () => { await Bot.goto(2, 8); await Bot.talk('up'); }); await ff(page, 60); await snap(page, 'Tafel');
  const riddle = await ev(async () => { let t = ''; for (let i = 0; i < 30 && World.lock; i++) { t += ' ' + UI.tb.lines.join(' '); await LMDebug.press('a', 12); } return t; });
  ok(/STIRNBAND/.test(riddle) && /FAUST/.test(riddle) && /SCHWEIF/.test(riddle), 'Eine Steintafel nennt die Reihenfolge der Hebel');
  const pull = id => ev(async id => { const e = World.ents.find(e => e.def.id === id || e.def.id === id + '_an' ? !e.hidden : false) || Bot.ent(id); await Bot.goto(e.x, 9); await Bot.talk('up'); await LMDebug.until(() => /JA/.test(Bot.text()), 600, 'a'); await LMDebug.press('a', 10); await Bot.free(); return Game.getVar('hebel'); }, id);
  const wrong = [await pull('hebel_band'), await pull('hebel_schweif')];
  ok(wrong[0] === 1 && wrong[1] === 0 && await ev(() => !Game.flag('hoehle_tor2')), 'Falsche Reihenfolge: alle Hebel springen zurück (' + wrong.join(' -> ') + ')');
  const right = [await pull('hebel_band'), await pull('hebel_faust')]; await snap(page, 'Hebel'); right.push(await pull('hebel_schweif'));
  ok(right.join() === '1,2,3' && await ev(() => Game.flag('hoehle_tor2') && Bot.ent('tor2').hidden), 'Stirnband, Faust, Schweif: das innere Tor öffnet sich');
  // ---------- RAMBOSS ----------
  await ev(async () => { await Bot.goto(7, 3); World.p.dir = 'up'; }); await ff(page, 20); await snap(page, 'Kammer des Kriegers');
  const info = await ev(() => { const m = Data.mon('ramboss'); return { types: m.types.join('/'), need: m.needLeash, no: m.no, spr: ['front', 'back', 'icon'].every(k => DB.sprites[m.sprites[k]]), f: [Data.typeFactor('feuer', m.types), Data.typeFactor('gift', m.types), Data.typeFactor('normal', m.types), Data.typeFactor('boden', m.types)], total: DB.monsters.length, types20: DB.types.length }; });
  ok(info.types === 'stahl/kampf' && info.need === 'meisterleine' && info.no === 37 && info.spr && info.total === 37 && info.types20 === 20, 'RAMBOSS ist Monster Nr. 37, Typ Stahl/Kampf (neuer Typ Stahl), mit eigenen Grafiken');
  ok(info.f.join() === '2,0,0.5,2', 'Stahl: schwach gegen Feuer und Boden, immun gegen Gift, robust gegen Normal (' + info.f.join(', ') + ')');
  await ev(() => { Bag.add('profileine', 2); Bag.add('leine', 2); });
  await ev(() => Bot.talk('up')); await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 5000); await snap(page, 'RAMBOSS');
  ok(await ev(() => Battle.active && Battle.E().species === 'ramboss' && Battle.E().level === 40), 'In der innersten Kammer wartet RAMBOSS (Lv 40)');
  // gewöhnliche Leine wird abgelehnt
  await press(page, 'down', 3); await press(page, 'a', 8);
  await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = top.o.items.findIndex(s => /Profi/.test(s.label || s)); }); await press(page, 'a', 6); await ff(page, 60); await snap(page, 'Leine abgelehnt');
  ok(await ev(() => /würde diese Leine/.test(UI.tb.lines.join(' '))) && await ev(() => Bag.count('profileine') === 2 && !Battle.v.leash), 'Eine gewöhnliche Leine wird gar nicht erst geworfen (nicht verbraucht): ' + await ev(() => UI.tb.lines.join(' ')));
  await mash(page, "UI.layers.some(l => l.o && l.o.cols === 2)", 800);
  // fliehen, Meisterleine oben am Alpsteig holen
  await ev(() => { window.__rnd = Math.random; Math.random = () => 0; }); await press(page, 'down', 3); await press(page, 'right', 3); await press(page, 'a', 8); await ev(() => Bot.free()); await ev(() => { Math.random = window.__rnd; });
  ok(await ev(() => !Battle.active && !Bot.ent('ramboss').hidden && !G.caught.ramboss), 'Nach der Flucht wartet RAMBOSS weiter in seiner Kammer');
  await ev(() => World.enter('route4', 13, 3, 'up')); await ff(page, 3); await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('meisterleine') === 1 && Game.flag('ml_gefunden')), 'Im Schnee am Alpsteig (4. Gebiet) liegt die Meisterleine');
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('meisterleine') === 1), 'Dort liegt nur eine einzige');
  // mit der Meisterleine fangen
  await ev(() => { World.enter('hoehle', 7, 3, 'up'); }); await ff(page, 3); await ev(() => Bot.talk('up')); await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 5000);
  await press(page, 'down', 3); await press(page, 'a', 8);
  await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = top.o.items.findIndex(s => /Meister/.test(s.label || s)); }); await press(page, 'a', 6);
  await mash(page, 'Battle.v && Battle.v.leash && Battle.v.leash.on', 600); await ff(page, 20); await snap(page, 'Meisterleine');
  ok(await ev(() => Battle.v.leash && Battle.v.leash.style === 3), 'Die Meisterleine fliegt (eigenes Aussehen mit Krone)');
  await ev(() => Bot.free(30000));
  ok(await ev(() => G.caught.ramboss && G.party.some(m => m.species === 'ramboss') && Bag.count('meisterleine') === 0), 'RAMBOSS ist angeleint und im Team');
  ok(await ev(() => { World.enter('hoehle', 7, 3, 'up'); return Bot.ent('ramboss').hidden; }), 'Der Sockel in der Höhle ist danach leer');
  // Lexikon-Eintrag und Zusammenfassung passen auf den Bildschirm (grosses Bild 48x48)
  await ev(() => { G.party = [G.party.find(m => m.species === 'ramboss')]; });
  await press(page, 'start', 6); items = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label || i)); for (let i = 0; i < items.indexOf('LEXIKON'); i++) await press(page, 'down', 3);
  await press(page, 'a', 8); await ev(() => { const top = UI.layers[UI.layers.length - 1]; if (top.o && top.o.items) top.sel = top.o.items.length - 1; }); await ff(page, 3); await press(page, 'up', 3); await press(page, 'down', 3); await snap(page, 'Lexikon Liste'); await press(page, 'a', 10); await snap(page, 'Lexikon RAMBOSS');
  await press(page, 'b', 6); await press(page, 'b', 6); await press(page, 'b', 6); await ff(page, 5);
  let fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 3)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 3000); await snap(page, 'RAMBOSS im eigenen Team');
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000)); await fight;
  await montage(page, 'velo_ramboss.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
