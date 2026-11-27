// Version 1.2: Die Suche nach dem Goldband für RAMBOSS – Pergament, Seherin, verlorener Kriegerorden, alter Arno,
// Kriegergruft (Felsbrocken mit Losung, drei Wächter, Flammenrätsel, Truhe) – und die drei Künste des Goldbands:
// BOLLWERK (Verteidigung +3), KRIEGSSCHREI (Gegner zittert drei Runden) und ENDSCHLAG (K.-o. mit einem Schlag, nur 1 AP).
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => {
    G.party = []; for (const id of ['hydrax', 'waldkron', 'drakor']) Mon.give(Mon.create(id, 90)); G.flags.has_starter = true; G.flags.has_dex = true; G.badges = ['gym1', 'gym2', 'gym3', 'gym4', 'gym5']; World.encCooldown = 1e9;
    window.__says = []; const o = UI.say; UI.say = function (t, opts) { window.__says.push(UI.subst(String(t))); return o.call(UI, t, opts); };
    window.__b = []; const bs = Battle.start; Battle.start = async function (cfg) { const rec = { tr: cfg.trainer && cfg.trainer.id }; window.__b.push(rec); rec.res = await bs.call(Battle, cfg); return rec.res; };
    window.__pick = async (pick, max) => { for (let i = 0; i < (max || 8000); i++) { if (!World.lock && !Battle.active && Gfx.fade === 0 && i > 8) return true; const top = UI.layers[UI.layers.length - 1]; if (top && top.o && top.o.items && pick) { const k = top.o.items.findIndex(it => pick.includes(typeof it === 'string' ? it : it.label)); if (k >= 0) top.sel = k; } if (i % 4 === 0) Input.pend.a = true; Engine.tick(); await LMDebug.yield(); } return false; };
    // Spricht das Ereignis/den NPC an der Stelle (x,y) von einem freien Nachbarfeld aus an und klickt alles durch.
    window.__use = async (id, pick) => { const e = World.ents.find(e => e.def.id === id && !e.hidden); if (!e) return 'fehlt'; let at = null; for (const [dx, dy, dir] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) if (!World.blocked(e.x + dx, e.y + dy) && World.kindAt(e.x + dx, e.y + dy) !== 'water') { at = [e.x + dx, e.y + dy, dir]; break; } if (!at) return 'kein Platz'; World.enter(World.mapId, at[0], at[1], at[2]); await LMDebug.ff(3); const n0 = window.__says.length; Input.pend.a = true; await LMDebug.ff(4); await window.__pick(pick); return window.__says.slice(n0).join(' | '); };
    window.__vis = id => World.ents.some(e => e.def.id === id && !e.hidden);
  });
  const use = (id, pick) => ev(([id, pick]) => window.__use(id, pick), [id, pick]);
  const go = async (map, x, y, dir) => { await ev(([m, x, y, d]) => { World.enter(m, x, y, d); }, [map, x, y, dir || 'down']); await ff(page, 5); };

  // ---------- 0) Daten ----------
  const data = await ev(() => { const it = Data.item('goldband'), mv = id => Data.move(id); return { teach: it.teachFor + ':' + it.teachMoves.join() + ':' + it.teachEvery, key: it.cat, sh: mv('bollwerk').effects.map(e => e.stat + e.stages + e.target).join(), ks: mv('kriegsschrei').effects.map(e => e.status).join(), es: mv('endschlag').pp + '/' + mv('endschlag').effects.map(e => e.k).join(), riegel: Data.item('kraftriegel').ap, shops: DB.shops.filter(s => s.stock.some(i => i.item === 'kraftriegel')).length, quest: !!Data.quest('goldband'), noLearn: !DB.monsters.some(m => m.learnset.some(l => ['bollwerk', 'kriegsschrei', 'endschlag'].includes(l.move))), st: STATUS.shake && STATUS.shake.turns }; });
  ok(data.teach === 'ramboss:bollwerk,kriegsschrei,endschlag:5' && data.key === 'key' && data.noLearn, 'GOLDBAND ist ein Lehr-Gegenstand nur für RAMBOSS: alle 5 Level Bollwerk, Kriegsschrei, Endschlag (kein Monster lernt sie sonst)');
  ok(data.sh === 'def3self' && data.ks === 'shake' && data.st === 3 && data.es === '1/ohko' && data.riegel === 99 && data.shops >= 3 && data.quest, 'Bollwerk = Verteidigung +3, Kriegsschrei = drei Runden Zittern, Endschlag = K.-o. mit 1 AP; KRAFTRIEGEL füllt AP auf (in ' + data.shops + ' Läden)');

  // ---------- 1) Ohne RAMBOSS gibt es keine Spur ----------
  await go('hoehle', 7, 4, 'up');
  ok(await ev(() => window.__vis('ramboss') && !window.__vis('pergament')), 'Solange RAMBOSS nicht gebändigt ist, liegt kein Pergament in der Kriegerhöhle');
  await go('haus_seherin', 3, 3, 'up'); await use('seherin');
  ok(await ev(() => !G.quests.goldband && !G.flags.gb_seherin), 'Die Seherin erwähnt das Goldband noch nicht');
  await go('route6', 15, 20, 'right'); ok(await ev(() => !window.__vis('orden')), 'Der Orden auf Route 6 ist noch nicht zu sehen');

  // ---------- 2) Pergament unter Ramboss ----------
  await ev(() => { const r = Mon.create('ramboss', 40); Mon.give(r); Mon.own('ramboss'); });
  await go('hoehle', 7, 4, 'up');
  ok(await ev(() => !window.__vis('ramboss') && window.__vis('pergament')), 'Nach dem Fang liegt dort, wo RAMBOSS sass, ein altes Pergament');
  const t1 = await use('pergament'); await snap(page, '1 Pergament in der Kriegerhöhle');
  ok(/GOLDBAND/.test(t1) && /Kugel/.test(t1) && /Nebel/.test(t1) && await ev(() => G.quests.goldband === 'active'), 'Hinweis 1 (Pergament): das GOLDBAND – "wer in die Kugel blickt, wo der Nebel wohnt" -> Aufgabe "Das Goldband" beginnt');

  // ---------- 3) Seherin ----------
  await go('haus_seherin', 3, 3, 'up'); const t2 = await use('seherin'); await snap(page, '2 Die Seherin');
  ok(/ARNO/.test(t2) && /GRUBENAU/.test(t2) && /KRIEGERORDEN/.test(t2) && /ROUTE 6/.test(t2) && /Kürbis/.test(t2) && /toten Baum/.test(t2) && await ev(() => !!G.flags.gb_seherin), 'Hinweis 2 (Seherin): Arno in Grubenau kennt den Weg; sein Kriegerorden liegt auf Route 6 zwischen Kürbis und totem Baum');
  ok(/Kürbis/.test(await use('seherin')), 'Die Seherin wiederholt den Hinweis auf Wunsch');
  // Arno ohne Orden
  await go('grubenau', 10, 10, 'down'); const t3a = await use('arno');
  ok(/Orden/.test(t3a) && /Moor/.test(t3a) && await ev(() => !G.flags.gruft_offen), 'Arno redet ohne seinen Orden nicht über die Gruft (gibt aber denselben Hinweis aufs Moor)');
  // Felsbrocken ohne Losung
  await go('route4', 17, 3, 'up'); const t3b = await use('gruftfels');
  ok(/keinen Millimeter/.test(t3b) && await ev(() => window.__vis('gruftfels') && World.blocked(17, 1)), 'Der Felsbrocken am Alpsteig versperrt den Spalt – ohne Losung bewegt er sich nicht');

  // ---------- 4) Orden auf Route 6 ----------
  await go('route6', 15, 20, 'right');
  const spot = await ev(() => { const m = World.map, nm = (x, y) => { const t = DB.tiles.find(t => t.id === m.layers.objects[y * m.w + x]); return t ? t.sprite + ' ' + t.name : ''; }; return { up: nm(16, 19), down: nm(16, 21), vis: window.__vis('orden'), way: Bot.path(15, 20) !== null || (World.p.x === 15 && World.p.y === 20), sight: World.fogSight() }; });
  ok(/pumpkin|Kürbis/i.test(spot.up) && /dead|tot/i.test(spot.down) && spot.vis && spot.way, 'Der Hinweis stimmt: bei (16,20) glänzt etwas, darüber ein Kürbis, darunter ein toter Baum (' + spot.up + ' / ' + spot.down + ')');
  await ff(page, 30); await snap(page, '3 Etwas glänzt im Moor');
  const t4 = await use('orden');
  ok(/Orden/.test(t4) && await ev(() => Bag.count('kriegerorden') === 1 && !window.__vis('orden')), 'Der KRIEGERORDEN ist gefunden');

  // ---------- 5) Arno bekommt den Orden ----------
  await go('grubenau', 10, 10, 'down'); const t5 = await use('arno'); await snap(page, '4 Arno am Weiher');
  ok(/ALPSTEIG/.test(t5) && /Nordosten/.test(t5) && /Die Faust ruht nie/.test(t5) && /STEHEN/.test(t5) && await ev(() => Bag.count('kriegerorden') === 0 && !!G.flags.gruft_offen), 'Hinweis 3 (Arno): Gruft am Alpsteig im Nordosten hinter dem Felsbrocken, Losung "Die Faust ruht nie", dazu die Lebensregel der Kämpfer');
  ok(/Losung/.test(await use('arno')), 'Arno wiederholt Weg und Losung auf Wunsch');

  // ---------- 6) Gruft: Felsbrocken, drei Wächter ----------
  await go('route4', 17, 3, 'up'); await snap(page, '5 Felsbrocken am Alpsteig'); const t6 = await use('gruftfels');
  ok(/Die Faust ruht nie/.test(t6) && await ev(() => !window.__vis('gruftfels') && !World.blocked(17, 1)), 'Mit der Losung rollt der Felsbrocken zur Seite');
  await go('route4', 17, 2, 'up'); await ev(() => LMDebug.walk('U')); await ev(() => Bot.free()); await ff(page, 10);
  ok(await ev(() => World.mapId === 'gruft' && World.p.x === 6 && World.p.y === 16), 'Dahinter liegt die KRIEGERGRUFT'); await snap(page, '6 Kriegergruft');
  ok(await ev(() => Bot.path(6, 8) === null && Bot.path(6, 14) !== null), 'Der Gang zum Flammensaal ist von den Wächtern versperrt');
  await ev(() => { window.__b.length = 0; });
  const w1 = await use('waechter1'); await ff(page, 5);
  ok(/STEHEN/.test(w1) && await ev(() => !!G.flags.gruft_w1 && !window.__vis('waechter1') && window.__b.map(b => b.tr + ':' + b.res).join() === 'gruft1:win'), 'Erster Wächter (Erz): Prüfung im Stehen bestanden, er gibt den Weg frei');
  const w2 = await use('waechter2'); await ff(page, 5);
  const w3 = await use('waechter3'); await ff(page, 5);
  ok(/SCHLAGEN/.test(w2) && /SIEGEN/.test(w3) && /Krone/.test(w3) && await ev(() => window.__b.map(b => b.tr + ':' + b.res).join() === 'gruft1:win,gruft2:win,gruft3:win' && !!G.flags.gruft_w3), 'Zweiter und dritter Wächter (Sturm, Glut): drei Kämpfe, jeder Wächter nennt seinen Teil der Lösung');
  ok(await ev(() => Bot.path(6, 8) !== null && Bot.path(6, 3) === null), 'Der Flammensaal ist frei, das Steintor zur Schatzkammer noch zu');

  // ---------- 7) Flammenrätsel ----------
  const riddle = await use('tafel_b');
  ok(/STEHEN/.test(riddle) && /SCHLAGEN/.test(riddle) && /SIEGEN/.test(riddle) && /KRONE/.test(riddle), 'Steintafel: ' + riddle.replace(/\n/g, ' ').slice(0, 170));
  const labels = await ev(() => ['schale_lorbeer', 'schale_fuss', 'schale_krone', 'schale_faust'].map(id => { const e = World.ents.find(e => e.def.id === id); return e.x + ':' + e.def.name.replace(/Feuerschale \((.*)\)/, '$1'); }).join(' | '));
  await snap(page, '7 Flammensaal');
  const wrong = await use('schale_krone', ['JA']);
  ok(/falsche Reihenfolge/.test(wrong) && await ev(() => (G.vars.gruft_seq | 0) === 0), 'Falsche Schale zuerst (KRONE): alle Flammen erlöschen');
  await use('schale_fuss', ['JA']); await use('schale_faust', ['JA']);
  ok(await ev(() => G.vars.gruft_seq === 2 && window.__vis('schale_fuss_an') && window.__vis('schale_faust_an') && !window.__vis('schale_fuss')), 'FUSS und FAUST brennen (richtige Reihenfolge wird mitgezählt)'); await snap(page, '8 Zwei Flammen brennen');
  const wrong2 = await use('schale_krone', ['JA']);
  ok(/falsche Reihenfolge/.test(wrong2) && await ev(() => G.vars.gruft_seq === 0 && window.__vis('schale_fuss') && !window.__vis('schale_fuss_an')), 'Wer sich vertut, beginnt von vorn (keine Sackgasse)');
  const no = await use('schale_fuss', ['NEIN']); ok(await ev(() => G.vars.gruft_seq === 0), 'Man kann eine Schale ansehen, ohne sie zu entzünden: ' + no.slice(0, 80));
  for (const id of ['schale_fuss', 'schale_faust', 'schale_lorbeer']) await use(id, ['JA']);
  const last = await use('schale_krone', ['JA']); await ff(page, 5); await snap(page, '9 Alle vier Flammen');
  ok(/Tor/.test(last) && await ev(() => G.vars.gruft_seq === 4 && !!G.flags.gruft_tor && !window.__vis('grufttor') && Bot.path(6, 3) !== null), 'FUSS, FAUST, LORBEER, KRONE: das Steintor öffnet sich (Schalen stehen bei x = ' + labels + ')');

  // ---------- 8) Truhe ----------
  await ev(() => Bot.goto(6, 3)); const chest = await use('truhe'); await snap(page, '10 Die Schatzkammer');
  ok(await ev(() => G.quests.goldband === 'done' && Bag.count('goldband') === 1 && Bag.count('kraftriegel') === 2 && !window.__vis('truhe')), 'In der Truhe liegt das GOLDBAND (dazu 2 Kraftriegel); die Aufgabe ist erledigt');
  ok(/ENDSCHLAG/.test(await use('tafel_c')), 'Eine Steintafel erklärt die drei Künste und den Endschlag');
  await go('haus_seherin', 3, 3, 'up'); ok(/goldenem Stirnband/.test(await use('seherin')), 'Die Seherin gratuliert');

  // ---------- 9) Das Goldband anlegen ----------
  const wear = await ev(() => { const it = Data.item('goldband'), r = G.party.find(m => m.species === 'ramboss'), other = G.party[0]; const a = Bag.useOnMon(it, other), b = Bag.useOnMon(it, r); if (b.ok) Bag.remove('goldband', 1); const c = Bag.useOnMon(it, r); return { target: Bag.targetsMon(it), a: a.ok + ' ' + a.msg, b: b.ok + ' ' + b.msg, c: c.ok + ' ' + c.msg, teach: JSON.stringify(r.teach), next: Mon.teachNext(r) }; });
  ok(wear.target && /^false .*nur Ramboss/.test(wear.a) && /^true /.test(wear.b) && /^false .*bereits/.test(wear.c), 'Das Goldband passt nur RAMBOSS: "' + wear.a.slice(6) + '" / "' + wear.b.slice(5) + '"');
  ok(wear.teach === '{"item":"goldband","from":40,"n":0}' && wear.next === 45, 'RAMBOSS (Level 40) trägt das Band; die erste Kunst kommt auf Level 45');
  await ev(() => { const r = G.party.find(m => m.species === 'ramboss'); G.party = [r]; r.exp = Mon.expFor(Mon.sp(r), 45) - 2; r.level = 44; });
  let fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 5)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await ff(page, 60); await snap(page, '11 Ramboss mit Goldband (funkelt)');
  await ev(() => Bot.free(30000)); await fight;
  ok(await ev(() => G.party[0].level === 45 && G.party[0].moves.some(m => m.id === 'bollwerk') && window.__says.some(s => /Bollwerk/.test(s))), 'Im Spiel: RAMBOSS erreicht Level 45 und lernt BOLLWERK');
  const lv = await ev(() => { const r = G.party[0], sp = Mon.sp(r), out = []; for (const L of [49, 50, 54, 55, 60]) { const ups = Mon.addExp(r, Mon.expFor(sp, L) - r.exp); out.push(L + ':' + ups.map(u => u.learn.filter(id => Data.item('goldband').teachMoves.includes(id)).map(id => id + '@' + u.level).join('+')).filter(Boolean).join('+')); } return { out: out.join(' '), next: Mon.teachNext(r), n: r.teach.n }; });
  ok(lv.out === '49: 50:kriegsschrei@50 54: 55:endschlag@55 60:' && lv.next === 0 && lv.n === 3, 'Level 50: KRIEGSSCHREI, Level 55: ENDSCHLAG, danach keine weiteren (' + lv.out + ')');
  await ev(() => { const r = G.party[0]; r.moves = ['bollwerk', 'kriegsschrei', 'endschlag', 'rempler'].map(id => ({ id, pp: Data.move(id).pp })); Mon.heal(r); Save.write(); });
  const saved = await ev(() => JSON.parse(localStorage.getItem(Save.key())).party[0]);
  ok(saved.teach && saved.teach.item === 'goldband' && saved.teach.n === 3 && saved.moves.some(m => m.id === 'endschlag'), 'Band und Attacken bleiben im Spielstand erhalten');
  const sumRun = ev(() => World.run(() => Menus.summary(G.party, 0))); await ff(page, 20); await snap(page, '12 Werte: Goldband gemeistert'); await press(page, 'right', 6); await snap(page, '13 Die drei Künste'); await press(page, 'b', 10); await sumRun;

  // ---------- 10) Die drei Künste im Kampf ----------
  fight = ev(() => World.run(async () => { const e = Mon.create('lakengraf', 60); window.__res = await Battle.start({ kind: 'wild', enemy: [e] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  const turn = async (mv, rnd) => {       // ein Zug mit festem Zufallswert; der Gegner kennt nur Rempler
    await ev(([mv, rnd]) => { const P = Battle.P(), E = Battle.E(); E.hp = Mon.maxHp(E); P.hp = Mon.maxHp(P); E.moves = [{ id: 'rempler', pp: 30 }]; window.__mv = mv; window.__n0 = window.__says.length; window.__rnd = Math.random; Math.random = () => rnd; }, [mv, rnd]);
    await press(page, 'a', 6); await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Math.max(0, Battle.P().moves.findIndex(m => m.id === window.__mv)); }); await press(page, 'a', 4);
    await mash(page, "(!Battle.active) || (UI.layers.some(l => l.o && l.o.cols === 2) && UI.layers.length <= 2 && window.__says.length > window.__n0)", 3000);
    return ev(() => { Math.random = window.__rnd; const E = Battle.E(); return { txt: window.__says.slice(window.__n0).join(' | '), est: E.status, def: Battle.ps.stages.def, hp: E.hp }; });
  };
  const s1 = await turn('bollwerk', 0.5); await snap(page, '14 Bollwerk');
  ok(s1.def === 3 && /Verteidigung von Ramboss steigt gewaltig/.test(s1.txt), 'BOLLWERK: die Verteidigung steigt mit einem Mal um drei Stufen ("' + (s1.txt.split(' | ').find(s => /gewaltig/.test(s)) || '') + '")');
  const s2 = await turn('kriegsschrei', 0.5); await snap(page, '15 Kriegsschrei: der Gegner zittert');
  let all = s2.txt, turns = [s2];
  for (let i = 0; i < 4; i++) { const t = await turn('bollwerk', 0.5); turns.push(t); all += ' | ' + t.txt; }
  const zit = (all.match(/zittert am ganzen Leib/g) || []).length, lastT = turns[turns.length - 1].txt;
  ok(/erzittert/.test(s2.txt) && zit === 3 && /Lakengraf setzt Rempler ein/.test(lastT) && turns[turns.length - 1].est === '', 'KRIEGSSCHREI: der Gegner erzittert und setzt genau drei Runden aus, danach greift er wieder an');
  const s3 = await turn('kriegsschrei', 0.5);
  ok(/nicht noch einmal einschüchtern/.test(s3.txt) && s3.est === '', 'Derselbe Gegner lässt sich kein zweites Mal einschüchtern (kein Dauer-Aussetzen)');
  const immune = await ev(() => Data.typeFactor('kampf', Mon.types(Battle.E())));
  const s4 = await turn('endschlag', 0.5); await ev(() => Bot.free(20000)); await fight; await snap(page, '16 Endschlag');
  ok(immune === 0 && /Ein K\.-o\.-Schlag!/.test(s4.txt) && await ev(() => window.__res === 'win' && G.party[0].moves.find(m => m.id === 'endschlag').pp === 0), 'ENDSCHLAG besiegt ein Geist-Monster Level 60 mit vollen LP in einem Schlag (obwohl Kampf-Attacken Geistern sonst nichts anhaben)');
  // nur einmal einsetzbar – bis zum Heilen oder Kraftriegel
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('kiesling', 50)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  await press(page, 'a', 6); await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => m.id === 'endschlag'); }); await press(page, 'a', 6); await ff(page, 40); await snap(page, '17 Keine AP mehr');
  ok(await ev(() => /Keine AP mehr/.test(UI.tb.lines.join(' ')) && Battle.E().hp === Mon.maxHp(Battle.E())), 'Ein zweiter ENDSCHLAG geht nicht: "' + await ev(() => UI.tb.lines.join(' ')) + '"');
  const refill = await ev(() => { const r = G.party[0], it = Data.item('kraftriegel'), a = Bag.useOnMon(it, r), pp = r.moves.find(m => m.id === 'endschlag').pp, b = Bag.useOnMon(it, r); return { a: a.ok + ' ' + a.msg, pp, b: b.ok, inBattle: ['leash', 'heal', 'status', 'revive', 'escape'].includes(it.cat) }; });
  ok(/^true/.test(refill.a) && refill.pp === 1 && !refill.b && refill.inBattle, 'Ein KRAFTRIEGEL füllt die AP wieder auf – auch mitten im Kampf ("' + refill.a.slice(5) + '")');
  await mash(page, "UI.layers.some(l => l.o && l.o.pitch === 10)", 600);
  await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => m.id === 'endschlag'); window.__n0 = window.__says.length; }); await press(page, 'a', 6); await ev(() => Bot.free(20000)); await fight;
  ok(await ev(() => window.__res === 'win' && window.__says.slice(window.__n0).some(s => /K\.-o\.-Schlag/.test(s)) && G.party[0].moves.find(m => m.id === 'endschlag').pp === 0), 'Danach gelingt der ENDSCHLAG wieder genau einmal');
  ok(await ev(() => { Mon.healParty(); return G.party[0].moves.find(m => m.id === 'endschlag').pp === 1; }), 'Auch das Heilzentrum lädt den ENDSCHLAG wieder auf');

  // ---------- 11) Goldknochen: sofort ein Level ----------
  const gk = await ev(() => { const it = Data.item('goldknochen'); return { lv: it.levelUp, name: it.name, target: Bag.targetsMon(it), shops: DB.shops.filter(s => s.stock.some(i => i.item === 'goldknochen')).length, quests: ['dojo', 'goldband'].filter(q => Data.quest(q).rewards.some(r => r.item === 'goldknochen')).length, have: Bag.count('goldknochen'), battle: ['leash', 'heal', 'status', 'revive', 'escape'].includes(it.cat) }; });
  ok(gk.lv === 1 && gk.target && gk.shops === 0 && gk.quests === 2 && gk.have === 1 && !gk.battle, 'GOLDKNOCHEN lässt ein Monster ein Level aufsteigen; es gibt ihn nicht zu kaufen, nur als seltene Belohnung (einer lag in der Gruft-Truhe)');
  await ev(() => { G.party = []; const m = Mon.create('zwickel', 27); m.exp = Mon.expFor(Mon.sp(m), 27) + 5; Mon.give(m); World.enter('route5', 9, 9, 'down'); window.__n0 = window.__says.length; });
  let bone = ev(() => World.run(() => Menus.useItemField(Data.item('goldknochen'))));
  await mash(page, "window.__says.slice(window.__n0).some(s => /erreicht Level 28/.test(s))", 1500); await ff(page, 30); await snap(page, '18 Goldknochen: Level 28');
  await mash(page, 'UI.layers.some(l => String(l.draw).includes("sil"))', 6000); await ff(page, 150); await ev(() => Bot.until(() => window.__says.some(s => /wurde zu Scherox/.test(s)), 4000)); await snap(page, '19 ... und gleich die Entwicklung');
  await ev(() => window.__pick(null, 20000)); await bone;
  const b1 = await ev(() => { const m = G.party[0]; return { sp: m.species, lv: m.level, exp: m.exp === Mon.expFor(Mon.sp(m), 28), mv: m.moves.map(x => x.id).join(), left: Bag.count('goldknochen') }; });
  ok(b1.sp === 'scherox' && b1.lv === 28 && b1.exp && /superkante/.test(b1.mv) && b1.left === 0, 'Im Spiel: ZWICKEL (Level 27) frisst den Goldknochen, erreicht Level 28, entwickelt sich zu SCHEROX und lernt SUPERKANTE – wie nach einem Kampf');
  await ev(() => { Bag.add('goldknochen', 1); G.party = []; Mon.give(Mon.create('nagri', 100)); window.__n0 = window.__says.length; });
  bone = ev(() => World.run(() => Menus.useItemField(Data.item('goldknochen')))); await ev(() => window.__pick(null, 4000)); await bone;
  ok(await ev(() => Bag.count('goldknochen') === 1 && window.__says.slice(window.__n0).some(s => /keine Wirkung/.test(s)) && G.party[0].level === 100), 'Auf Level 100 wirkt er nicht (und wird nicht verbraucht)');

  await montage(page, 'goldband.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
