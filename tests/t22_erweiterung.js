// Erweiterung 1.1: Schwierigkeitsstufen, Angel im Baum, Angeln, platzender Müllsack, Bodenlos, Leinen-Aussehen,
// neue Typen und Monster, animierte Kacheln, Geschenk-Monster, Aufgaben.
const { open, ff, press, mash, snap, montage, installBot } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  // ---------- Schwierigkeitsstufe beim Spielstart ----------
  await ff(page, 20); await press(page, 'a', 10); await press(page, 'a', 30);
  await mash(page, "UI.layers.some(l => l.draw && String(l.draw).includes('NAME_PAGES'))", 3000);
  await press(page, 'start', 4); await press(page, 'a', 8);
  await mash(page, "UI.layers.some(l => l.o && l.o.items && l.o.items.includes('MITTEL'))", 4000); await ff(page, 20); await snap(page, 'Stufenwahl');
  const menu = await ev(() => { const l = UI.layers.find(l => l.o && l.o.items && l.o.items.includes('MITTEL')); return { items: l.o.items, sel: l.sel, w: l.o.w, x: l.o.x }; });
  ok(menu.items.join('|') === 'DUMMER LOOSER|MITTEL|EHRENLOSER ZOCKER', 'Drei Stufen stehen zur Wahl: ' + menu.items.join(' / '));
  ok(menu.sel === 1, 'Vorgabe ist MITTEL');
  ok(menu.x >= 0 && menu.x + menu.w <= 160, 'Auswahlfenster passt auf den Bildschirm (x=' + menu.x + ', Breite ' + menu.w + ')');
  await press(page, 'up', 4); await press(page, 'a', 20);
  await mash(page, "UI.layers.some(l => l.o && l.o.items && l.o.items.includes('JA'))", 2000); await snap(page, 'Stufe bestätigen');
  await mash(page, "World.active && !World.lock && Gfx.fade === 0", 6000); await installBot(page);
  ok(await ev(() => G.diff === 0 && Game.diff().name === 'DUMMER LOOSER'), 'Gewählte Stufe DUMMER LOOSER ist aktiv');
  // Auswirkungen der Stufen
  const eff = await ev(() => {
    const lv = () => Trainers.team(Data.trainer('falk')).map(m => m.level).join('/'), e = Mon.create('nagri', 4), it = Data.item('leine'), r = {};
    for (let d = 0; d < 3; d++) { G.diff = d; r[d] = { lv: lv(), catch: +Battle.catchChance(e, it).toFixed(3), exp: Game.diff().exp, loss: Game.diff().loss, ai: Game.diff().ai }; }
    G.diff = 0; return r;
  });
  ok(eff[0].lv === '6/7/8' && eff[1].lv === '7/8/9' && eff[2].lv === '8/9/10', 'Trainer-Level je Stufe: leicht ' + eff[0].lv + ', mittel ' + eff[1].lv + ', schwer ' + eff[2].lv);
  ok(eff[0].catch > eff[1].catch && eff[1].catch > eff[2].catch, 'Fangchance je Stufe: ' + eff[0].catch + ' > ' + eff[1].catch + ' > ' + eff[2].catch);
  ok(eff[0].exp > 1 && eff[1].exp === 1 && eff[2].exp < 1 && eff[0].loss === 0 && eff[2].loss === 0.5 && eff[0].ai === 'dumb' && eff[2].ai === 'sharp', 'EP-Faktor, Geldverlust und KI unterscheiden sich je Stufe');
  // Stufe in den Optionen ändern
  await press(page, 'start', 6);
  let items = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label || i)); for (let i = 0; i < items.indexOf('OPTIONEN'); i++) await press(page, 'down', 3);
  await press(page, 'a', 8); items = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label || i)); await snap(page, 'Optionen');
  const si = items.findIndex(s => /^STUFE/.test(s));
  ok(si >= 0 && /1\/3/.test(items[si]), 'OPTIONEN zeigen die Stufe: ' + items[si]);
  for (let i = 0; i < si; i++) await press(page, 'down', 3);
  await press(page, 'a', 30); await mash(page, "UI.layers.some(l => l.o && l.o.items && l.o.items.includes('EHRENLOSER ZOCKER'))", 600); await press(page, 'down', 3); await press(page, 'down', 3); await snap(page, 'Stufe ändern'); await press(page, 'a', 10);
  await mash(page, "UI.layers.some(l => l.o && l.o.items && l.o.items.some(s => /^STUFE/.test(s))) && UI.layers.indexOf(UI.tb) < 0", 1500);
  ok(await ev(() => G.diff === 2), 'Stufe in den OPTIONEN auf EHRENLOSER ZOCKER geändert');
  await press(page, 'b', 6); await press(page, 'b', 6); await ff(page, 5);
  // Niederlage kostet auf dieser Stufe das halbe Geld
  await ev(() => { Mon.give(Mon.create('glutwelp', 5)); G.flags.has_starter = true; G.flags.has_dex = true; G.party[0].hp = 1; G.money = 1000; World.enter('welpenhain', 12, 12, 'down'); World.encCooldown = 1e9; });
  let fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('grabator', 60)] }); await World.afterBattle(window.__res, false); }));
  await ev(() => LMDebug.until(() => !World.lock && !Battle.active && Gfx.fade === 0, 30000, 'a')); await fight;
  ok(await ev(() => window.__res === 'lose' && G.money === 500), 'EHRENLOSER ZOCKER: Niederlage kostet das halbe Geld ($' + await ev(() => G.money) + ')');
  await ev(() => { G.diff = 1; G.party[0].level = 30; G.party[0].hp = Mon.maxHp(G.party[0]); });
  // ---------- Angel im Baum ----------
  await ev(() => World.enter('welpenhain', 13, 15, 'right')); await ff(page, 3); await press(page, 'a', 6); await ff(page, 20);
  ok(await ev(() => !World.lock && !World.bob), 'Ohne Angel passiert am Ufer nichts');
  await ev(() => World.enter('welpenhain', 12, 13, 'right')); await ff(page, 3); await snap(page, 'Baum mit Angel');
  ok(await ev(() => Data.tile(World.L(World.map).objects[13 * World.map.w + 13]).sprite === 't_tree_rod'), 'Am Teich steht ein Baum, in dem eine Angel hängt');
  await press(page, 'a', 4); await ff(page, 40); await snap(page, 'Angel gefunden'); await ev(() => Bot.free());
  ok(await ev(() => Bag.count('angel') === 1 && Game.flag('got_rod')), 'Angel aus dem Baum geholt');
  ok(await ev(() => Data.tile(World.L(World.map).objects[13 * World.map.w + 13]).sprite === 't_tree' && World.blocked(13, 13)), 'Der Baum ist danach ein gewöhnlicher Baum');
  await press(page, 'a', 4); await ff(page, 40);
  ok(await ev(() => /normaler Baum/.test(UI.tb.lines.join(' ')) && Bag.count('angel') === 1), 'Zweites Mal: keine zweite Angel');
  await ev(() => Bot.free());
  // ---------- Angeln ----------
  await ev(() => { World.enter('welpenhain', 13, 15, 'right'); window.__rnd = Math.random; Math.random = () => 0.01; }); await ff(page, 3);
  await press(page, 'a', 4); await ff(page, 40); await snap(page, 'Angel ausgeworfen');
  ok(await ev(() => !!World.bob && World.bob.x === 14 && World.bob.y === 15), 'A am Ufer wirft die Angel aus (Schwimmer im Wasser)');
  await mash(page, 'World.bob && World.bob.bite', 800); await snap(page, 'Biss');
  await mash(page, 'Battle.active && Battle.v && Battle.v.eHud', 1200); await ff(page, 20); await snap(page, 'Fisch am Haken');
  const fishTab = await ev(() => World.map.encounters.find(t => t.method === 'fish').slots.map(s => s.species));
  ok(await ev(() => Battle.active && Battle.cfg.kind === 'wild') && fishTab.includes(await ev(() => Battle.E().species)), 'Biss führt zum Kampf gegen ein Monster der Angel-Tabelle: ' + await ev(() => Battle.E().species));
  await ev(() => { Math.random = window.__rnd; Battle.E().hp = 1; }); await ev(() => Bot.free(20000));
  // Angeln über den Beutel
  await press(page, 'start', 6); items = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label || i)); for (let i = 0; i < items.indexOf('BEUTEL'); i++) await press(page, 'down', 3);
  await press(page, 'a', 8); const bl = await ev(() => UI.layers.filter(l => l.o && l.o.items).pop().o.items.map(i => i.label)); for (let i = 0; i < bl.indexOf('Angel'); i++) await press(page, 'down', 3);
  await snap(page, 'Angel im Beutel'); await press(page, 'a', 8); await press(page, 'a', 8); await ff(page, 30);
  ok(await ev(() => !!World.bob || /wirft die Angel/.test(UI.tb.lines.join(' '))), 'BENUTZEN im Beutel schliesst das Menü und wirft die Angel aus');
  await ev(() => { Math.random = () => 0.999; }); await ev(() => Bot.free(4000)); await ev(() => { Math.random = window.__rnd; });
  ok(await ev(() => !Battle.active && !World.bob), 'Kein Biss: Angeln endet ohne Kampf');
  ok(await ev(() => World.map.encounters.every(t => t.method !== 'fish' || t.zone === 8) && !World.checkEncounter()), 'Angel-Tabelle löst beim Laufen keine Begegnungen aus');
  // ---------- Platzender Müllsack ----------
  await ev(() => { G.party = []; Mon.give(Mon.create('lohwolf', 40)); Bag.add('profileine', 3); });
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('gueselsack', 12)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await snap(page, 'Güselsack');
  const exp0 = await ev(() => G.party[0].exp);
  await mash(page, "/bläht/.test(UI.tb.lines.join(' '))", 2000); await ff(page, 50); await snap(page, 'platzt');
  await mash(page, "Battle.active && Battle.E().species === 'gueselmob' && UI.layers.some(l => l.o && l.o.cols === 2)", 4000); await snap(page, 'Güselmob');
  const b1 = await ev(() => ({ sp: Battle.E().species, hp: Battle.E().hp, max: Mon.maxHp(Battle.E()), seen: !!G.seen.gueselmob, active: Battle.active, fx: Mon.fxOf(Mon.sp(Battle.E())), exp: G.party[0].exp, moves: Battle.E().moves.map(m => m.id) }));
  ok(b1.active && b1.sp === 'gueselmob', 'Besiegter GÜSELSACK platzt: der Kampf geht gegen GÜSELMOB weiter');
  ok(b1.hp === Math.floor(b1.max / 2), 'Der Müll hat die Hälfte der LP (' + b1.hp + '/' + b1.max + ')');
  ok(b1.fx === 'flies' && b1.seen, 'Um GÜSELMOB schwirren Fliegen; es steht im Lexikon als gesehen');
  ok(b1.exp > exp0 && b1.moves.includes('giftdorn'), 'EP für den Sack gab es schon; der Müll hat eigene Attacken (' + b1.moves.join(',') + ')');
  // den Müll anleinen (geplatzte Gestalt bleibt)
  await press(page, 'down', 3); await press(page, 'a', 8);
  await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = top.o.items.findIndex(s => /Profi/.test(s.label || s)); Math.random = () => 0.01; }); await press(page, 'a', 6);
  await mash(page, 'Battle.v && Battle.v.leash && Battle.v.leash.on', 400); await ff(page, 30); await snap(page, 'Leine eingehakt');
  ok(await ev(() => Battle.v.leash.style === 2), 'Profileine hat ihr eigenes Aussehen (Stil 2)');
  await mash(page, 'Battle.v && Battle.v.leash && Battle.v.leash.star > 10', 900); await snap(page, 'angeleint');
  await ev(() => { Math.random = window.__rnd; }); await ev(() => Bot.free(20000)); await fight;
  ok(await ev(() => window.__res === 'caught' && G.party[1] && G.party[1].species === 'gueselmob' && !G.party[1].burstFrom && G.caught.gueselmob), 'Der geplatzte Müll lässt sich anleinen und bleibt GÜSELMOB');
  ok(await ev(() => [Data.item('leine'), Data.item('starkleine'), Data.item('profileine'), Data.item('meisterleine')].map(Battle.leashStyle).join('') === '0123'), 'Jede der vier Leinen hat ein eigenes Aussehen');
  // eigener Güselsack platzt und nimmt nach dem Kampf wieder seine Gestalt an
  await ev(() => { G.party = []; const s = Mon.create('gueselsack', 20); s.hp = 1; Mon.give(s); });
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 3)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  await ev(() => { Battle.P().hp = 0; Battle.v.pHp = 0; }); await press(page, 'a', 6); await press(page, 'a', 6);
  await mash(page, "Battle.active && Battle.P().species === 'gueselmob' && UI.layers.some(l => l.o && l.o.cols === 2) || !Battle.active", 5000);
  const own = await ev(() => Battle.active && { sp: Battle.P().species, hp: Battle.P().hp, half: Math.floor(Mon.maxHp(Battle.P()) / 2) });
  ok(own && own.sp === 'gueselmob' && own.hp <= own.half && own.hp > 0, 'Auch der eigene GÜSELSACK platzt einmal pro Kampf: ' + JSON.stringify(own));
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000)); await fight;
  ok(await ev(() => G.party[0].species === 'gueselsack' && !G.party[0].burstFrom && G.party[0].hp <= Mon.maxHp(G.party[0])), 'Nach dem Kampf ist er wieder ein GÜSELSACK');
  // ---------- Bodenlos ----------
  await ev(() => { G.party = []; Mon.give(Mon.create('lurchon', 40)); window.__atk = 0; });
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('bodenlos', 30)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await snap(page, 'Bodenlos (Loch)');
  ok(await ev(() => { const s = Mon.sp(Battle.E()).sprites; return !!DB.sprites[s.frontAtk] && !!DB.sprites[s.backAtk] && !Battle.v.eAtk; }), 'BODENLOS hat eigene Angriffsbilder; im Leerlauf ist nur das Loch zu sehen');
  await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = 0; }); await press(page, 'a', 6);
  await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => Data.move(m.id).cat === 'status'); if (top.sel < 0) top.sel = 0; }); await press(page, 'a', 6);
  const atkSeen = await mash(page, 'Battle.v && Battle.v.eAtk', 3000); await ff(page, 3); await snap(page, 'Bodenlos greift an');       // sofort prüfen: kurze Attacken zeigen das Angriffsbild nur wenige Ticks
  ok(atkSeen === true, 'Beim Angriff kommt das Monster aus dem Loch (Angriffsbild aktiv)');
  await mash(page, "Battle.active && !Battle.v.eAtk && UI.layers.some(l => l.o && l.o.cols === 2)", 3000);
  ok(await ev(() => Battle.v.eAtk === false), 'Danach verschwindet es wieder im Loch');
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000)); await fight;
  // ---------- Typen, Monster, Entwicklungen ----------
  const data = await ev(() => ({
    types: DB.types.map(t => t.name), mons: DB.monsters.length, moves: DB.moves.length, gyms: DB.gyms.map(g => Data.trainer(g.leader).name + ':' + [...new Set(Trainers.team(Data.trainer(g.leader)).map(m => Mon.sp(m).types[0]))].join('+')),
    f: [Data.typeFactor('feuer', ['plastik']), Data.typeFactor('wasser', ['plastik']), Data.typeFactor('geist', ['buero']), Data.typeFactor('boden', ['glitzer']), Data.typeFactor('kaefer', ['kaese']), Data.typeFactor('kaese', ['geist']), Data.typeFactor('buero', ['drache']), Data.typeFactor('glitzer', ['psycho']), Data.typeFactor('gestein', ['plastik', 'flug'])],
    spr: DB.monsters.every(m => DB.sprites[m.sprites.front] && DB.sprites[m.sprites.back] && DB.sprites[m.sprites.icon]),
    evo: ['piepsel', 'krabbli', 'blitzel', 'kiesling', 'tuetli', 'kaesli', 'stempli', 'glimmi'].map(id => { const m = Mon.create(id, 60), e = Mon.evolution(m, { kind: 'level' }); return e && e.to; }),
    idle: [Mon.idleOf(Data.mon('federix')), Mon.idleOf(Data.mon('bodenlos')), Mon.idleOf(Data.mon('nagri'))], fx: [Mon.fxOf(Data.mon('glutwelp')), Mon.fxOf(Data.mon('fonduro')), Mon.fxOf(Data.mon('nagri'))]
  }));
  ok(data.types.length === 20 && ['Plastik', 'Käse', 'Büro', 'Glitzer', 'Stahl'].every(t => data.types.includes(t)), '20 Typen, darunter die neuen Plastik, Käse, Büro, Glitzer und Stahl');
  ok(data.f.join(',') === '2,0.5,0,2,2,2,2,2,4', 'Typentabelle der neuen Typen: ' + data.f.join(','));
  ok(data.mons === 56 && data.spr && data.moves >= 90, '56 Monster mit vollständigen Grafiken, ' + data.moves + ' Attacken');
  ok(data.evo.join(',') === 'federix,panzerit,voltigo,brockolit,folion,fonduro,paragraf,discora', 'Neue Entwicklungen: ' + data.evo.join(', '));
  ok(data.gyms.length === 6 && /^Falk:normal/.test(data.gyms[0]) && !/boden|gestein/.test(data.gyms[0]), 'Sechs Arenen; die erste ist nicht mehr Gestein/Boden: ' + data.gyms.join(' | '));
  ok(data.idle.join(',') === 'hover,none,breathe' && data.fx.join(',') === 'ember,smell,', 'Leerlauf-Bewegungen und Dauer-Effekte je Art/Typ: ' + data.idle.join(',') + ' / ' + data.fx.join(','));
  // ---------- Animierte Kacheln, Gras, Kartenteilchen ----------
  const anim = await ev(async () => {
    World.enter('route1', 6, 2, 'right'); World.encCooldown = 1e9; const t = DB.tiles.find(t => t.sprite === 't_tallgrass'), keys = new Set(), ph = new Set();
    for (let i = 0; i < 80; i++) { World.anim = i; keys.add(World.tileKey(t, 0)); } World.anim = 0; ph.add(World.tileKey(t, 0)); ph.add(World.tileKey(t, 1));
    await LMDebug.walk('R'); const r = World.rustle && { x: World.rustle.x, y: World.rustle.y };
    const amb = ['route1', 'route3', 'route4', 'kaesingen', 'route5'].map(id => Data.map(id).ambient);
    for (const id of ['route4', 'kaesingen', 'route5', 'route3', 'tupperwil', 'amtshausen', 'grubenau']) { World.enter(id, 9, 9, 'down'); for (let i = 0; i < 3; i++) { Engine.tick(); Engine.draw(); } }
    return { frames: (t.frames || []).length, keys: keys.size, ph: ph.size, r, amb };
  });
  ok(anim.frames === 2 && anim.keys === 2 && anim.ph === 2, 'Hohes Gras ist animiert und wogt je Feld versetzt');
  ok(anim.r && anim.r.x === 7 && anim.r.y === 2, 'Beim Betreten wirbelt das Gras auf');
  ok(anim.amb.join(',') === 'leaves,flies,snow,snow,paper', 'Karten haben schwebende Teilchen: ' + anim.amb.join(', '));
  // ---------- Geschenk-Monster und Aufgaben ----------
  await ev(() => { G.party = []; Mon.give(Mon.create('sprossel', 9)); World.enter('haus_sammler', 5, 5, 'up'); }); await ff(page, 3);
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => G.party.length === 2 && G.party[1].species === 'kiesling' && G.party[1].level === 8), 'Bellstadt: ein Junge schenkt ein KIESLING (Hilfe gegen die Flug-Arena)');
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => G.party.length === 2), 'Das Geschenk gibt es nur einmal');
  await ev(() => { World.enter('tupperwil', 7, 9, 'up'); }); await ff(page, 3); await ev(() => { const e = Bot.ent('recycler'); World.p.x = e.x; World.p.y = e.y + 1; World.p.dir = 'up'; }); await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => G.party.some(m => m.species === 'flaschi' && m.level === 16)), 'Tupperwil: die Pfandflasche FLASCHI wird verschenkt');
  await ev(() => { G.badges = ['gym1', 'gym2']; G.seen.gueselmob = false; delete G.seen.gueselmob; World.enter('rathaus', 4, 2, 'up'); }); await ff(page, 3);
  await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => G.quests.muell === 'active'), 'Aufgabe "Putzaktion" angenommen');
  await ev(() => { Mon.see('gueselmob'); }); await ev(() => Bot.talk('up')); await ev(() => Bot.free());
  ok(await ev(() => G.quests.muell === 'done' && Bag.count('profileine') >= 2), 'Putzaktion erledigt, sobald ein Güselsack geplatzt ist');
  await ev(() => { G.party = []; Mon.give(Mon.create('lurchon', 60)); World.enter('route3', 31, 6, 'up'); World.encCooldown = 1e9; }); await ff(page, 3); await snap(page, 'Loch im Feld');
  ok(await ev(() => !Bot.ent('loch').hidden && World.blocked(31, 5)), 'Auf dem Löcherfeld liegt ein seltsames Loch');
  await ev(() => Bot.talk('up')); await mash(page, 'Battle.active && Battle.v && Battle.v.eHud', 3000);
  ok(await ev(() => Battle.active && Battle.E().species === 'bodenlos'), 'Das Loch ist ein BODENLOS und greift an');
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000));
  ok(await ev(() => Game.flag('loch_weg') && Bot.ent('loch').hidden), 'Danach ist das Loch verschwunden');
  ok(await ev(() => { World.enter('route5', 2, 11, 'left'); const hidden = Bot.ent('akte').hidden; G.quests.akte = 'active'; World.refresh(); return hidden && !Bot.ent('akte').hidden; }), 'Formular A38 liegt erst bei aktiver Aufgabe auf Route 5');
  await montage(page, 'erweiterung.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
