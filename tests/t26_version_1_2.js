// Version 1.2: Spielstand-Kompatibilität (Stände aus 1.1.x laufen weiter, Stände der alten Welt lassen sich übernehmen),
// Flaschi mit Riss (Plastik -> Wasser), dritte Entwicklungsstufe der Starter, neue Monster, Route 6 und Nebelmoor.
const { open, ff, press, mash, snap, montage, installBot } = require('./lib.js'); const fs = require('fs'), path = require('path');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'spielstand_1_1_1.json'), 'utf8'));
(async () => {
  let { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  // ---------- 1) Spielstand aus Version 1.1.1 weiterspielen ----------
  ok(await ev(k => Save.key() === k, FIX.key), 'Der Spielstand liegt unter demselben Schlüssel wie in Version 1.1.1 (' + FIX.key + ')');
  await ev(f => { localStorage.setItem(f.key, JSON.stringify(f.save)); }, FIX);
  await page.reload(); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 2); await ev(() => { Engine.manual = true; Opt.text = 2; });
  await ff(page, 20); await press(page, 'a', 10); await snap(page, 'Titelmenü mit altem Stand');
  ok(await ev(() => UI.layers.some(l => l.o && l.o.items && l.o.items[0] === 'FORTSETZEN')), 'Titelmenü bietet FORTSETZEN für den Stand aus 1.1.1 an');
  await press(page, 'a', 40); await ff(page, 30); await installBot(page); await snap(page, 'Weiterspielen in Käsingen');
  const st = await ev(() => ({ name: G.name, map: World.mapId, x: World.p.x, y: World.p.y, dir: World.p.dir, money: G.money, diff: G.diff, bike: G.bike, riding: World.riding(), party: G.party.map(m => m.species + ':' + m.level + ':' + (m.nick || '')), storage: G.storage.map(m => m.species), badges: G.badges.join(), bag: G.bag, flags: Object.keys(G.flags).length, quests: G.quests, def: Object.keys(G.defeated).length, caught: Object.keys(G.caught).length, solid: World.cellSolid(World.p.x, World.p.y), respawn: G.respawn.map }));
  const s0 = FIX.save;
  ok(st.name === 'GLEN' && st.map === s0.map && st.x === s0.x && st.y === s0.y && st.dir === s0.dir && !st.solid, 'Der Spieler steht am selben Ort wie beim Speichern (' + st.map + ' ' + st.x + ',' + st.y + ') und kann sich bewegen');
  ok(st.party.join() === s0.party.map(m => m.species + ':' + m.level + ':' + (m.nick || '')).join() && st.storage.join() === s0.storage.map(m => m.species).join(), 'Team und Monsterspeicher sind unverändert: ' + st.party.join(' '));
  ok(st.money === s0.money && st.badges === s0.badges.join() && JSON.stringify(st.bag) === JSON.stringify(s0.bag) && st.diff === s0.diff && st.def === Object.keys(s0.defeated).length && st.caught === Object.keys(s0.caught).length, 'Geld, Medaillen, Beutel, Schwierigkeitsstufe, besiegte Trainer und Lexikon stimmen');
  ok(JSON.stringify(st.quests) === JSON.stringify(s0.quests) && st.flags === Object.keys(s0.flags).length && st.bike && st.riding && st.respawn === 'heil4', 'Aufgaben, Ereignis-Flags, Velo und Rückkehrpunkt sind erhalten');
  await ev(() => LMDebug.walk('LL')); ok(await ev(x => World.p.x === x - 2, s0.x), 'Weiterspielen funktioniert: der Spieler fährt weiter');
  // der alte Stand profitiert von den Neuerungen
  const neu = await ev(() => { const f = G.party.find(m => m.species === 'flaschi'), l = G.party.find(m => m.species === 'lohwolf'); return { fl: Mon.types(f).join(), flFull: (() => { const h = f.hp; f.hp = Mon.maxHp(f); const t = Mon.types(f).join(); f.hp = h; return t; })(), evo: (Mon.evolution(Object.assign({}, l, { level: 34 }), { kind: 'level' }) || {}).to, gate: !!Data.map('amtshausen').connections.south }; });
  ok(neu.fl === 'wasser' && neu.flFull === 'plastik', 'Das FLASCHI aus dem alten Stand (20 LP, also beschädigt) ist jetzt Typ Wasser, geheilt wäre es Plastik');
  ok(neu.evo === 'vulkanis' && neu.gate, 'LOHWOLF aus dem alten Stand kann sich ab Level 34 zu VULKANIS entwickeln; das neue Südtor ist da');
  await ev(() => { Save.write(); }); const again = await ev(() => JSON.parse(localStorage.getItem(Save.key())).version);
  ok(again === s0.version, 'Erneutes Speichern behält das Spielstandformat (Version ' + again + ')');
  await browser.close();
  // ---------- 2) Stand der alten Welt (1.0.x) übernehmen ----------
  ({ browser, page, errors } = await open()); const ev2 = (f, a) => page.evaluate(f, a);
  await ev2(() => { const m = Mon.create('lohwolf', 18); m.nick = 'ALTI'; const n = Mon.create('nagrotz', 14); const o = { format: 'leinenmeister-save', version: 1, projectId: 'leinenmeister', name: 'ALT', rival: 'RICO', map: 'route2', x: 25, y: 6, dir: 'left', money: 4321, time: 99, steps: 500, party: [m, n], storage: [Mon.create('piepsel', 9)], bag: { leine: 3, trank: 2, unbekannt: 9 }, seen: { nagri: true, lohwolf: true }, caught: { lohwolf: true }, flags: { has_starter: true }, vars: {}, defeated: { wanda: true }, badges: ['gym1'], quests: {}, respawn: { map: 'heilzentrum', x: 3, y: 3, dir: 'up' }, npcState: {}, tiles: {}, uid: 9 }; localStorage.setItem('leinenmeister.save.leinenmeister', JSON.stringify(o)); });
  await page.reload(); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 2); await ev2(() => { Engine.manual = true; Opt.text = 2; });
  await ff(page, 20); await press(page, 'a', 10); await snap(page, 'Alter Spielstand im Titelmenü');
  const items = await ev2(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]);
  ok(items[0] === 'ALTER SPIELSTAND' && !items.includes('FORTSETZEN'), 'Stand der alten Welt (1.0.x) wird erkannt: ' + JSON.stringify(items));
  await press(page, 'a', 30); await mash(page, "UI.layers.some(l => l.o && l.o.items && l.o.items.includes('JA'))", 2000); await snap(page, 'Übernehmen?'); await press(page, 'a', 30);
  await mash(page, "World.active && !World.lock && Gfx.fade === 0", 4000); await installBot(page); await snap(page, 'Alter Stand übernommen');
  const ad = await ev2(() => ({ name: G.name, map: World.mapId, pos: World.p.x + ',' + World.p.y, party: G.party.map(m => m.species + ':' + m.level + ':' + (m.nick || '')).join(), storage: G.storage.length, money: G.money, bag: JSON.stringify(G.bag), badges: G.badges.length, starter: G.vars.starter, flags: G.flags.has_starter && G.flags.has_dex && G.flags.rival_left, saved: Save.exists(), full: G.party.every(m => m.hp === Mon.maxHp(m)) }));
  ok(ad.name === 'ALT' && ad.party === 'lohwolf:18:ALTI,nagrotz:14:' && ad.storage === 1 && ad.money === 4321 && ad.bag === '{"leine":3,"trank":2}', 'Team, Speicher, Geld und Beutel wurden übernommen (unbekannte Gegenstände entfernt): ' + ad.party);
  ok(ad.map === 'welpenhain' && ad.pos === '4,11' && ad.badges === 0 && ad.starter === 1 && ad.flags && ad.saved && ad.full, 'Die Reise beginnt mit dem alten Team im Startdorf der neuen Welt (Starter erkannt, Team geheilt, gespeichert)');
  ok(await ev2(() => Bot.path(23, 8) !== null), 'Mit dem übernommenen Team ist der Weg zur Route 1 frei');
  // ---------- 3) Flaschi: Plastik -> Riss -> Wasser ----------
  const fl = await ev2(() => { const m = Mon.create('flaschi', 20), d = Data.mon('flaschi'); return { base: d.types.join(), t0: Mon.types(m).join(), f0: Mon.frontKey(m), lock0: Mon.moveLocked(m, Data.move('spritzer')), free0: Mon.moveLocked(m, Data.move('rempler')), spr: !!DB.sprites.mon_flaschi_front_riss && !!DB.sprites.mon_flaschi_back_riss, t1: (m.hp -= 1, Mon.types(m).join()), f1: Mon.frontKey(m), b1: Mon.backKey(m), lock1: Mon.moveLocked(m, Data.move('spritzer')), t2: (m.hp = Mon.maxHp(m), Mon.types(m).join()) }; });
  ok(fl.base === 'plastik' && fl.t0 === 'plastik' && fl.f0 === 'mon_flaschi_front' && fl.lock0 && !fl.free0, 'FLASCHI ist zuerst reines Plastik; Wasser-Attacken sind gesperrt');
  ok(fl.spr && fl.t1 === 'wasser' && fl.f1 === 'mon_flaschi_front_riss' && fl.b1 === 'mon_flaschi_back_riss' && !fl.lock1 && fl.t2 === 'plastik', 'Mit Schaden: Bild mit Riss, Typ Wasser, Wasser-Attacken frei; voll geheilt wieder Plastik');
  await ev2(() => { G.party = []; Mon.give(Mon.create('glutwelp', 30)); World.encCooldown = 1e9; window.__says = []; const o = UI.say; UI.say = function (t, opts) { window.__says.push(UI.subst(String(t))); return o.call(UI, t, opts); }; });
  let fight = ev2(() => World.run(async () => { const e = Mon.create('flaschi', 30); window.__e = e; window.__res = await Battle.start({ kind: 'wild', enemy: [e] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await snap(page, 'Flaschi heil (Plastik)');
  const f0 = await ev2(() => ({ feuer: Data.typeFactor('feuer', Mon.types(Battle.E())), ai: [0, 1, 2, 3, 4, 5, 6, 7].map(() => Battle.aiAction()).every(a => a.type !== 'move' || !Mon.moveLocked(Battle.E(), Battle.moveOf('e', a.idx))) }));
  ok(f0.feuer === 2 && f0.ai, 'Im Kampf: heiles FLASCHI ist Plastik (Feuer sehr effektiv) und wählt keine Wasser-Attacke');
  await press(page, 'a', 6); await ev2(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => m.id === 'rempler'); if (top.sel < 0) top.sel = 0; }); await press(page, 'a', 6);
  await mash(page, "window.__says.some(s => /Riss/.test(s))", 2500); await ff(page, 10); await snap(page, 'Flaschi bekommt einen Riss');
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 3000); await snap(page, 'Flaschi mit Riss (Wasser)');
  const f1 = await ev2(() => ({ msg: window.__says.find(s => /Riss/.test(s)) || '', types: Mon.types(Battle.E()).join(), key: Mon.frontKey(Battle.E()), feuer: Data.typeFactor('feuer', Mon.types(Battle.E())), elektro: Data.typeFactor('elektro', Mon.types(Battle.E())) }));
  ok(/Riss/.test(f1.msg) && /WASSER/.test(f1.msg) && f1.types === 'wasser' && f1.key === 'mon_flaschi_front_riss', 'Nach dem ersten Treffer: ' + f1.msg);
  ok(f1.feuer === 0.5 && f1.elektro === 2, 'Mit Riss gelten die Stärken und Schwächen von Wasser (Feuer ' + f1.feuer + ', Elektro ' + f1.elektro + ')');
  await ev2(() => { Battle.E().hp = 1; }); await ev2(() => Bot.free(20000)); await fight;
  // eigenes Flaschi: Wasser-Attacke erst mit Riss wählbar
  await ev2(() => { G.party = []; Mon.give(Mon.create('flaschi', 30)); });
  fight = ev2(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 3)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  await press(page, 'a', 6); await ev2(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => Data.move(m.id).type === 'wasser'); }); await press(page, 'a', 6); await ff(page, 50); await snap(page, 'Wasser-Attacke gesperrt');
  ok(await ev2(() => /noch dicht/.test(UI.tb.lines.join(' ')) && Battle.E().hp === Mon.maxHp(Battle.E())), 'Eigenes heiles FLASCHI: Wasser-Attacke wird abgelehnt (Zug nicht verbraucht): ' + await ev2(() => UI.tb.lines.join(' ')));
  await ev2(() => { Battle.E().hp = 1; }); await mash(page, "UI.layers.some(l => l.o && l.o.pitch === 10)", 600);
  await ev2(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => Data.move(m.id).type !== 'wasser' && Data.move(m.id).power > 0); }); await press(page, 'a', 6); await ev2(() => Bot.free(20000)); await fight;
  // ---------- 4) Dritte Entwicklungsstufe und neue Monster ----------
  const data = await ev2(() => ({
    n: DB.monsters.length, spr: DB.monsters.every(m => ['front', 'back', 'icon'].every(k => DB.sprites[m.sprites[k]])), nos: DB.monsters.every((m, i) => m.no === i + 1),
    lines: [['glutwelp', 'lohwolf', 'vulkanis'], ['quappel', 'lurchon', 'hydrax'], ['sprossel', 'rankhorn', 'waldkron']].map(l => l.map((id, i) => i === 2 ? id : (Data.mon(id).evolutions[0] || {}).to + '@' + (Data.mon(id).evolutions[0] || {}).level).slice(0, 2).join('>')),
    evo: ['frostel', 'spukel', 'hirnix', 'schlinger', 'zwickel', 'drakling', 'socki', 'kissi', 'schraubi', 'pilzling'].map(id => (Data.mon(id).evolutions[0] || {}).to).join(),
    types: ['geist', 'psycho', 'stahl', 'pflanze'].map(t => t + ':' + DB.monsters.filter(m => m.types.includes(t)).length).join(' '), moves: DB.moves.length,
    learn: DB.monsters.every(m => m.learnset.every(l => Data.idx.moves[l.move]))
  }));
  ok(data.n === 56 && data.spr && data.nos && data.learn, '56 Monster mit lückenlosen Lexikon-Nummern, vollständigen Grafiken und gültigen Attacken (' + data.moves + ' Attacken)');
  ok(data.lines.join(' | ') === 'lohwolf@16>vulkanis@34 | lurchon@16>hydrax@34 | rankhorn@16>waldkron@34', 'Alle drei Starter haben drei Stufen: ' + data.lines.join(' | '));
  ok(data.evo === 'glaziel,lakengraf,geniux,wuergon,scherox,drakor,sockrates,albtraum,bohrox,fungor', 'Weiterentwicklungen: ' + data.evo);
  ok(/geist:7/.test(data.types) && /psycho:7/.test(data.types), 'Mehr Geist- und Psycho-Monster: ' + data.types);
  // Entwicklung im Kampf: Lohwolf Lv33 -> 34 -> Vulkanis
  await ev2(() => { G.party = []; const m = Mon.create('lohwolf', 33); m.exp = Mon.expFor(Mon.sp(m), 34) - 2; Mon.give(m); });
  fight = ev2(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 5)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, 'UI.layers.some(l => String(l.draw).includes("sil"))', 20000); await ff(page, 150); await snap(page, 'Entwicklung zu Vulkanis');
  await ev2(() => Bot.free(30000)); await fight;
  ok(await ev2(() => G.party[0].species === 'vulkanis' && G.party[0].level === 34 && G.caught.vulkanis && Mon.types(G.party[0]).join() === 'feuer,gestein'), 'LOHWOLF entwickelt sich auf Level 34 zu VULKANIS (Feuer/Gestein)');
  fight = ev2(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('sockrates', 30)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await snap(page, 'Vulkanis gegen Sockrates');
  await ev2(() => { Battle.E().hp = 1; }); await ev2(() => Bot.free(20000)); await fight;
  // ---------- 5) Neues Gebiet ----------
  const area = await ev2(async () => {
    const r = { amb: [Data.map('route6').ambient, Data.map('nebelmoor').ambient], gym: (Data.gym('gym6') || {}).leader, team: Trainers.team(Data.trainer('selma')).map(m => Mon.sp(m).types[0]).join(), shop: !!Data.shop('shop_nebelmoor') };
    for (const id of ['route6', 'nebelmoor', 'arena6', 'haus_seherin']) { World.enter(id, 9, 9, 'down'); for (let i = 0; i < 3; i++) { Engine.tick(); Engine.draw(); } }
    G.badges = ['gym1', 'gym2', 'gym3', 'gym4']; World.enter('amtshausen', 16, 17, 'down'); r.blocked = World.blocked(16, 18); G.badges.push('gym5'); World.refresh(); r.open = !World.blocked(16, 18); return r;
  });
  ok(area.amb.join() === 'fog,fog' && area.gym === 'selma' && /geist/.test(area.team) && area.shop, 'Route 6 und Nebelmoor liegen im Nebel; sechste Arena mit Leiterin Selma (Geist/Psycho)');
  ok(area.blocked && area.open, 'Das Südtor von Amtshausen öffnet sich mit der Stempelmedaille');
  await ev2(() => { World.enter('route6', 9, 3, 'down'); }); await ff(page, 100); await snap(page, 'Route 6 im Nebel');
  await ev2(() => { World.enter('nebelmoor', 13, 9, 'down'); }); await ff(page, 100); await snap(page, 'Nebelmoor');
  await ev2(() => { World.enter('arena6', 4, 8, 'up'); }); await ff(page, 20); await snap(page, 'Arena Nebelmoor');
  // Aufgabe "Die zweite Socke"
  await ev2(() => { G.badges = ['gym1', 'gym2', 'gym3', 'gym4', 'gym5']; World.enter('haus_moor', 4, 3, 'right'); }); await ff(page, 3); await ev2(() => Bot.talk('right')); await ev2(() => Bot.free());
  ok(await ev2(() => G.quests.socke === 'active'), 'Aufgabe "Die zweite Socke" angenommen');
  await ev2(() => { Mon.own('socki'); }); await ev2(() => Bot.talk('right')); await ev2(() => Bot.free());
  ok(await ev2(() => G.quests.socke === 'done' && Bag.count('profileine') >= 3), 'Mit einem angeleinten SOCKI ist die Aufgabe erledigt');
  await montage(page, 'version_1_2.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
