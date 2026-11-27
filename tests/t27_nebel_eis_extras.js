// Version 1.2: Nebel-Mechanik (Sichtweite, Laterne, Monster aus dem Nebel), Eisgrotte (Rutschrätsel), neue Gegenstände,
// neue Statusveränderungen (Geblendet, Angst), mehr Attacken, Quiz, Kampfschule, Rudelführer und Mimik im Kampf.
const { open, ff, press, mash, snap, montage, newGame } = require('./lib.js');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page);
  await ev(() => {
    G.party = []; Mon.give(Mon.create('vulkanis', 50)); G.flags.has_starter = true; G.flags.has_dex = true; G.badges = ['gym1', 'gym2', 'gym3', 'gym4', 'gym5']; World.encCooldown = 1e9;
    window.__says = []; const o = UI.say; UI.say = function (t, opts) { window.__says.push(UI.subst(String(t))); return o.call(UI, t, opts); };
    // Zählt dunkle Bildpunkte (die zwei dunkelsten Farben) nah am Spieler und weit weg (Spieler steht immer bei 72,72).
    window.__dark = () => { UI.bannerT = 0; Engine.draw(); const c = Shell.canvas, d = c.getContext('2d').getImageData(0, 0, 160, 144).data, lum = i => d[i] + d[i + 1] + d[i + 2]; let near = 0, far = 0, far5 = 0, mid = 0; const pts = []; for (let y = 0; y < 144; y++) for (let x = 0; x < 160; x++) { if (lum((y * 160 + x) * 4) > 330) continue; const r = Math.hypot(x - 72, y - 72) / 16; if (r < 1.9) near++; if (r > 3.7) far++; if (r > 4.7) far5++; if (r > 2.5 && r < 3.3) mid++; if (r > 3.7) pts.push(x + '/' + y); } return { near, far, far5, mid, pts: pts.slice(0, 6).join(' ') }; };
    // Stellt den Spieler neben ein Ereignis (freies Nachbarfeld) und dreht ihn hin.
    window.__beside = id => { const e = World.ents.find(e => e.def.id === id); for (const [dx, dy, dir] of [[1, 0, 'left'], [-1, 0, 'right'], [0, 1, 'up'], [0, -1, 'down']]) { const x = e.x + dx, y = e.y + dy; if (!World.blocked(x, y) && World.kindAt(x, y) !== 'water') { World.enter(World.mapId, x, y, dir); return true; } } return false; };
    // Drückt A, bis kein Script mehr läuft; wählt in Auswahlmenüs die Einträge aus "pick" (Text), sonst den ersten.
    window.__pick = async (pick, max) => { for (let i = 0; i < (max || 8000); i++) { if (!World.lock && !Battle.active && Gfx.fade === 0 && i > 8) return true; const top = UI.layers[UI.layers.length - 1]; if (top && top.o && top.o.items && pick) { const k = top.o.items.findIndex(it => pick.includes(typeof it === 'string' ? it : it.label)); if (k >= 0) top.sel = k; } if (i % 4 === 0) Input.pend.a = true; Engine.tick(); await LMDebug.yield(); } return false; };
  });

  // ---------- 1) Nebel ----------
  const fogData = await ev(() => ({ r6: Data.map('route6').fogSight, moor: Data.map('nebelmoor').fogSight, tab: (Data.map('route6').encounters.find(t => t.method === 'fog') || { slots: [] }).slots.map(s => s.species).join(), other: DB.maps.filter(m => m.fogSight > 0).map(m => m.id).join(), light: Data.item('laterne').light }));
  ok(fogData.r6 === 2 && fogData.moor === 3 && fogData.other === 'route6,nebelmoor' && fogData.light === 1, 'Nebel-Karten: Route 6 (Sichtweite 2) und Nebelmoor (Sichtweite 3); die Laterne gibt +1');
  ok(/nebling/.test(fogData.tab) && /spukel/.test(fogData.tab), 'Route 6 hat eine eigene Begegnungstabelle "Aus dem Nebel": ' + fogData.tab);
  await ev(() => { World.enter('route6', 9, 12, 'down'); }); await ff(page, 40);
  const free = await ev(() => { for (let y = 10; y < 20; y++) for (let x = 6; x < 14; x++) if (!World.blocked(x, y) && !World.zoneAt(x, y) && World.kindAt(x, y) !== 'water') return [x, y]; return null; });
  await ev(([x, y]) => { World.enter('route6', x, y, 'down'); }, free); await ff(page, 40);
  const d3 = await ev(() => ({ s: World.fogSight(), px: window.__dark() })); await snap(page, 'Nebel ohne Laterne (Sicht 2)');
  await ev(() => { Data.map('route6').fogSight = 0; }); const d0 = await ev(() => window.__dark()); await snap(page, 'Zum Vergleich: dieselbe Stelle ohne Nebel'); await ev(() => { Data.map('route6').fogSight = 2; });
  ok(d3.s === 2 && d3.px.far === 0 && d3.px.near > 100, 'Im Nebel sieht man nur die nächste Umgebung: nah ' + d3.px.near + ' dunkle Bildpunkte, ab 4 Feldern Entfernung ' + d3.px.far + ' ' + d3.px.pts);
  ok(d0.far > 1000 && d0.mid > d3.px.mid * 2, 'Ohne Nebel wäre dort die Karte zu sehen (weit weg ' + d0.far + ' dunkle Bildpunkte, mittlere Entfernung ' + d0.mid + ' statt ' + d3.px.mid + ')');
  // Laterne vom Verirrten
  await ev(() => { World.enter('route6', 9, 0, 'down'); }); await ff(page, 5); await ev(() => LMDebug.walk('D')); await snap(page, 'Am Eingang wartet der Verirrte');
  ok(await ev(() => { const e = World.ents.find(e => e.def.id === 'wanderer'); World.p.dir = 'right'; return World.p.x === 9 && World.p.y === 1 && e.x === 10 && e.y === 1; }), 'Der Verirrte steht direkt am Eingang der Route 6 neben dem Weg (auch im dichten Nebel nicht zu übersehen)'); await ff(page, 5);
  await press(page, 'a', 4); await ev(() => window.__pick()); const lant = await ev(() => ({ has: Bag.count('laterne'), flag: !!G.flags.laterne_geschenk, txt: window.__says.filter(s => /Laterne/.test(s)).length }));
  ok(lant.has === 1 && lant.flag && lant.txt > 0, 'Der Verirrte schenkt die LATERNE');
  await press(page, 'a', 4); await ev(() => window.__pick()); ok(await ev(() => Bag.count('laterne') === 1), 'Die Laterne gibt es nur einmal');
  await ev(([x, y]) => { World.enter('route6', x, y, 'down'); }, free); await ff(page, 40);
  const d5 = await ev(() => ({ s: World.fogSight(), px: window.__dark() })); await snap(page, 'Nebel mit Laterne (Sicht 3)');
  ok(d5.s === 3 && d5.px.mid > d3.px.mid * 2 && d5.px.far > 100 && d5.px.far5 === 0, 'Mit Laterne reicht die Sicht 3 Felder weit (mittlere Entfernung: ' + d5.px.mid + ' statt ' + d3.px.mid + ' dunkle Bildpunkte)');
  // Monster tauchen aus dem Nebel auf – auch ausserhalb des Grases
  const enc = await ev(() => { World.encCooldown = 0; const r = Math.random; Math.random = () => 0; const zone = World.zoneAt(World.p.x, World.p.y), hit = World.checkEncounter(); Math.random = r; return { zone, hit }; });
  await ff(page, 30); const shade = await ev(() => World.shade && World.shade.key); await snap(page, 'Ein Schatten nähert sich');
  await mash(page, "window.__says.some(s => /Aus dem Nebel/.test(s))", 400); await snap(page, 'Aus dem Nebel taucht etwas auf');
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await snap(page, 'Kampf gegen Nebel-Monster');
  const encB = await ev(() => ({ sp: Battle.E().species, lv: Battle.E().level }));
  ok(enc.zone === 0 && enc.hit && shade === 'mon_nebling_front' && encB.sp === 'nebling' && encB.lv >= 32, 'Auf freiem Feld (kein Gras) taucht ein Schatten auf und greift an: ' + encB.sp + ' Lv.' + encB.lv);
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000));
  const noFog = await ev(() => { World.enter('route5', 9, 9, 'down'); let c = null; for (let y = 3; y < 15 && !c; y++) for (let x = 3; x < 15 && !c; x++) if (!World.blocked(x, y) && !World.zoneAt(x, y)) c = [x, y]; World.enter('route5', c[0], c[1], 'down'); World.encCooldown = 0; const r = Math.random; Math.random = () => 0; const hit = World.checkEncounter(); Math.random = r; return { hit, s: World.fogSight() }; });
  ok(!noFog.hit && noFog.s === 0, 'Auf Karten ohne Nebel gibt es ausserhalb des Grases weiterhin keine Begegnungen');
  await ev(() => { World.enter('nebelmoor', 13, 9, 'down'); World.encCooldown = 0; }); await ff(page, 40); await snap(page, 'Nebelmoor mit Laterne');
  ok(await ev(() => { const r = Math.random; Math.random = () => 0; const hit = World.checkEncounter(); Math.random = r; return !hit && World.fogSight() === 4; }), 'In der Stadt Nebelmoor ist es neblig, aber dort lauern keine Monster');

  // ---------- 2) Eisgrotte ----------
  await ev(() => { World.encCooldown = 1e9; World.enter('kaesingen', 23, 2, 'up'); }); await ff(page, 10); await snap(page, 'Eingang zur Eisgrotte');
  await ev(() => LMDebug.walk('U')); await ev(() => Bot.free()); await ff(page, 10);
  ok(await ev(() => World.mapId === 'eisgrotte' && World.p.x === 6 && World.p.y === 11), 'Von Käsingen führt ein Höhleneingang in die EISGROTTE'); await snap(page, 'Eisgrotte');
  await ev(() => { window.__slide = async c => { const d = { U: 'up', D: 'down', L: 'left', R: 'right' }[c]; World.p.dir = d; Input.set(d, true); await LMDebug.ff(1); Input.set(d, false); await LMDebug.until(() => !World.p.moving, 600); await LMDebug.ff(2); return World.p.x + ',' + World.p.y; }; });
  // Spielregeln als Modell (dieselben Abfragen wie die Engine): ein Zug = eine Richtung; auf Eis gleitet man bis zum Hindernis.
  await ev(() => {
    const D = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }, stop = (x, y) => World.blocked(x, y) || !!World.warpAt(x, y, 'step');
    const move = (x, y, c) => { const [dx, dy] = D[c]; let nx = x + dx, ny = y + dy, slid = 0; if (stop(nx, ny)) return [x, y, 0]; x = nx; y = ny; while (World.kindAt(x, y) === 'ice') { slid = 1; nx = x + dx; ny = y + dy; if (stop(nx, ny)) break; x = nx; y = ny; } return [x, y, slid]; };
    // kürzeste Wege nach Anzahl Rutschpartien (Schritte auf festem Boden zählen nicht)
    const bfs = (sx, sy) => { const dist = { [sx + ',' + sy]: { n: 0, p: '' } }, dq = [[sx, sy]]; while (dq.length) { const [x, y] = dq.shift(), d = dist[x + ',' + y]; for (const c of 'UDLR') { const [nx, ny, s] = move(x, y, c), k = nx + ',' + ny; if (!dist[k] || dist[k].n > d.n + s) { dist[k] = { n: d.n + s, p: d.p + c }; if (s) dq.push([nx, ny]); else dq.unshift([nx, ny]); } } } return dist; };
    const stuck = (sx, sy) => { const from = bfs(sx, sy); return { n: Object.keys(from).length, bad: Object.keys(from).filter(k => { const [x, y] = k.split(',').map(Number); return !bfs(x, y)['6,11']; }) }; };
    window.__ice = { bfs, stuck };
  });
  const up = await ev(async () => [await window.__slide('U'), await window.__slide('U')]);
  ok(up[0] === '6,10' && /^6,[3-8]$/.test(up[1]), 'Ein Schritt aufs Eis und man gleitet weiter, bis etwas im Weg ist: von ' + up[0] + ' geradeaus bis ' + up[1] + ' (die Truhe liegt bei 6,1)');
  const solve = await ev(() => { World.enter('eisgrotte', 6, 11, 'up'); const g = window.__ice.bfs(6, 11)['6,2']; return { sol: g && g.p, n: g && g.n, st: window.__ice.stuck(6, 11), ice: [...Array(13)].map((_, y) => [...Array(13)].filter((_, x) => World.kindAt(x, y) === 'ice').length).reduce((a, b) => a + b, 0) }; });
  ok(solve.sol && solve.n >= 5, 'Das Rätsel ist lösbar; die beste Lösung braucht ' + solve.n + ' Rutschpartien (' + solve.sol + '), ' + solve.ice + ' Eisfelder');
  ok(solve.st.bad.length === 0 && solve.st.n > 20, 'Keine Sackgasse: von allen ' + solve.st.n + ' erreichbaren Feldern kommt man zum Eingang zurück' + (solve.st.bad.length ? ' (fest: ' + solve.st.bad.join(' ') + ')' : ''));
  await ff(page, 5);
  const trail = []; for (const c of solve.sol) trail.push(await ev(c => window.__slide(c), c));
  ok(trail[trail.length - 1] === '6,2', 'Die Lösung im echten Spiel nachgespielt: ' + trail.join(' > ')); await snap(page, 'Vor der Eistruhe');
  await ev(() => { World.p.dir = 'up'; }); const bag0 = await ev(() => [Bag.count('topbeleber'), Bag.count('kraftfutter')]);
  await press(page, 'a', 4); await ev(() => window.__pick());
  const bag1 = await ev(() => [Bag.count('topbeleber'), Bag.count('kraftfutter'), !!G.flags.eisgrotte]);
  ok(bag1[0] === bag0[0] + 1 && bag1[1] === bag0[1] + 1 && bag1[2], 'In der Eistruhe liegen ein TOP-BELEBER und KRAFTFUTTER');
  const home = await ev(async () => { const st = window.__ice.stuck(World.p.x, World.p.y), way = window.__ice.bfs(World.p.x, World.p.y)['6,11']; for (const c of way.p) await window.__slide(c); const at = World.p.x + ',' + World.p.y; await LMDebug.walk('D'); await Bot.free(); await LMDebug.ff(10); return { bad: st.bad.length, at, way: way.p, map: World.mapId, pos: World.p.x + ',' + World.p.y }; });
  ok(home.bad === 0 && home.at === '6,11' && home.map === 'kaesingen' && home.pos === '23,2', 'Auch mit geöffneter Truhe gibt es keine Sackgasse; Rückweg über das Eis (' + home.way + ') und hinaus nach Käsingen');

  // ---------- 3) Neue Gegenstände ----------
  const items = await ev(() => {
    const r = {}, m = Mon.create('nagri', 20), max = Mon.maxHp(m);
    m.hp = 0; r.rev = Bag.useOnMon(Data.item('beleber'), m).ok && m.hp === Math.floor(max / 2); m.hp = 0; r.top = Bag.useOnMon(Data.item('topbeleber'), m).ok && m.hp === max; r.topAlive = !Bag.useOnMon(Data.item('topbeleber'), m).ok;
    for (const k of Object.keys(m.iv)) m.iv[k] = 3; const hp0 = Mon.maxHp(m); r.iv = Bag.useOnMon(Data.item('kraftfutter'), m).ok && Object.values(m.iv).every(v => v === 5) && Mon.maxHp(m) >= hp0;
    for (const k of Object.keys(m.iv)) m.iv[k] = 15; r.ivMax = !Bag.useOnMon(Data.item('kraftfutter'), m).ok;
    r.shops = ['topbeleber', 'leckerli', 'duftspray', 'heimleine'].map(id => id + ':' + DB.shops.filter(s => s.stock.some(i => i.item === id)).length).join(' ');
    r.names = ['topbeleber', 'leckerli', 'duftspray', 'heimleine', 'kraftfutter', 'laterne'].map(id => Data.item(id).name).join(', ');
    return r;
  });
  ok(items.rev && items.top && items.topAlive, 'BELEBER weckt mit halben LP, TOP-BELEBER mit vollen LP; bei wachen Monstern wirkt er nicht');
  ok(items.iv && items.ivMax, 'KRAFTFUTTER hebt alle Anlagen um 2 (höchstens bis 15)');
  ok(!/:0/.test(items.shops), 'Neue Gegenstände (' + items.names + ') sind in Läden erhältlich: ' + items.shops);
  // Duftspray und Heimleine im Feld
  await ev(() => { World.enter('route5', 9, 9, 'down'); World.encCooldown = 0; Bag.add('duftspray', 1); Bag.add('heimleine', 2); }); await ff(page, 5);
  const sprayRun = ev(() => World.run(() => Menus.useItemField(Data.item('duftspray')))); await ev(() => window.__pick()); await sprayRun;
  const spray = await ev(() => { const c = World.encCooldown, r = Math.random; Math.random = () => 0; let hits = 0; const z = (() => { for (let y = 1; y < World.map.h - 1; y++) for (let x = 1; x < World.map.w - 1; x++) if (World.zoneAt(x, y) && !World.blocked(x, y)) return [x, y]; })(); World.enter('route5', z[0], z[1], 'down'); for (let i = 0; i < 20; i++) if (World.checkEncounter()) hits++; Math.random = r; return { c, hits, left: World.encCooldown, n: Bag.count('duftspray') }; });
  ok(spray.c === 120 && spray.hits === 0 && spray.left === 100 && spray.n === 0, 'DUFTSPRAY hält wilde Monster 120 Schritte lang fern (auch im hohen Gras), wird verbraucht');
  await ev(() => { World.encCooldown = 1e9; G.respawn = { map: 'kaesingen', x: 5, y: 9, dir: 'down' }; World.enter('haus_amt1', 3, 4, 'down'); }); await ff(page, 5);
  let homeRun = ev(() => World.run(() => World.goHome(Data.item('heimleine')))); await ev(() => window.__pick()); await homeRun;
  ok(await ev(() => World.mapId === 'haus_amt1' && Bag.count('heimleine') === 2), 'HEIMLEINE wirkt nicht in Gebäuden (wird dort nicht verbraucht)');
  await ev(() => { World.enter('route6', 9, 3, 'down'); }); await ff(page, 5);
  homeRun = ev(() => World.run(() => World.goHome(Data.item('heimleine')))); await ev(() => window.__pick()); await homeRun; await ff(page, 20);
  ok(await ev(() => World.mapId === 'kaesingen' && World.p.x === 5 && World.p.y === 9 && Bag.count('heimleine') === 1), 'HEIMLEINE bringt den Spieler vom Moor zurück zum letzten Heilzentrum (Käsingen)'); await snap(page, 'Heimleine: zurück in Käsingen');
  // Leckerli im Kampf
  await ev(() => { Bag.add('leckerli', 2); Bag.add('leine', 3); });
  let fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('kiesling', 40)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  const c0 = await ev(() => Battle.catchChance(Battle.E(), Data.item('leine')));
  await ev(() => { UI.layers[UI.layers.length - 1].sel = 2; }); await press(page, 'a', 8);
  await ev(async () => { for (let i = 0; i < 1500 && !(Battle.bait > 1); i++) { const top = UI.layers[UI.layers.length - 1]; if (top && top.o && top.o.items) { const k = top.o.items.findIndex(it => /Leckerli/i.test(typeof it === 'string' ? it : it.label)); if (k >= 0) top.sel = k; } if (i % 4 === 0) Input.pend.a = true; Engine.tick(); await LMDebug.yield(); } });
  await mash(page, "window.__says.some(s => /zutraulich/.test(s))", 600);
  const c1 = await ev(() => ({ bait: Battle.bait, c: Battle.catchChance(Battle.E(), Data.item('leine')), n: Bag.count('leckerli'), txt: window.__says.filter(s => /zutraulich/.test(s)).length })); await snap(page, 'Leckerli geworfen');
  ok(c1.bait === 1.6 && Math.abs(c1.c - Math.min(1, c0 * 1.6)) < 1e-9 && c1.n === 1 && c1.txt > 0, 'LECKERLI aus dem Beutel: das wilde Monster wird zutraulich, die Fangchance steigt von ' + (c0 * 100).toFixed(1) + ' % auf ' + (c1.c * 100).toFixed(1) + ' %');
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 3000);

  // ---------- 4) Neue Statusveränderungen im selben Kampf ----------
  const stat = await ev(() => ({ st: Object.keys(STATUS).join(), tags: STATUS.blind.tag + '/' + STATUS.fear.tag, imm: ['geist', 'glitzer', 'buero'].map(t => t + ':' + (Data.type(t).immune || []).join('+')).join(' ') }));
  ok(/blind/.test(stat.st) && /fear/.test(stat.st) && /sleep/.test(stat.st) && /para/.test(stat.st), 'Statusveränderungen: ' + stat.st + ' (neu: Geblendet ' + stat.tags + ')');
  const turn = async (setup, rnd) => {       // ein Zug mit festem Zufallswert; liefert LP-Verlust des Gegners und die Texte
    await ev(([s, rnd]) => { new Function(s)(); const P = Battle.P(), E = Battle.E(); E.hp = Mon.maxHp(E); P.hp = Mon.maxHp(P); E.moves = [{ id: 'rempler', pp: 30 }]; for (const sd of [Battle.ps, Battle.es]) for (const k of Object.keys(sd.stages)) sd.stages[k] = 0; window.__n0 = window.__says.length; window.__rnd = Math.random; Math.random = () => rnd; }, [setup, rnd]);
    await press(page, 'a', 6); await ev(() => { const top = UI.layers[UI.layers.length - 1], P = Battle.P(); top.sel = Math.max(0, P.moves.findIndex(m => m.id === window.__mv)); }); await press(page, 'a', 4);
    await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2) && UI.layers.length <= 2 && window.__says.length > window.__n0", 3000);
    return ev(() => { Math.random = window.__rnd; const E = Battle.E(); return { dmg: Mon.maxHp(E) - E.hp, txt: window.__says.slice(window.__n0).join(' | '), pst: Battle.P().status, est: E.status }; });
  };
  await ev(() => { const P = Battle.P(); P.moves = [{ id: 'rempler', pp: 30 }, { id: 'buh', pp: 20 }, { id: 'blendwerk', pp: 20 }]; window.__mv = 'rempler'; });
  const tOk = await turn("Battle.P().status = ''; Battle.E().status = '';", 0.6);
  const tBlind = await turn("const P = Battle.P(); P.status = 'blind'; P.sleep = 5;", 0.6); await snap(page, 'Geblendet');
  ok(tOk.dmg > 0 && tBlind.dmg === 0 && tBlind.pst === 'blind', 'GEBLENDET halbiert die Trefferchance: derselbe Angriff trifft sonst (' + tOk.dmg + ' Schaden) und geht geblendet daneben');
  const tFear = await turn("const P = Battle.P(); P.status = 'fear'; P.sleep = 5;", 0.3); await snap(page, 'Angst');
  const tFear2 = await turn("const P = Battle.P(); P.status = 'fear'; P.sleep = 5;", 0.6);
  ok(tFear.dmg === 0 && /Angst|zittert|traut/.test(tFear.txt) && tFear2.dmg > 0, 'ANGST: das Monster traut sich manchmal nicht anzugreifen (' + (tFear.txt.split(' | ').find(s => /Angst|zittert|traut/.test(s)) || '') + ')' + (tFear2.dmg > 0 ? '' : ' / ohne Schreck: ' + tFear2.txt));
  await ev(() => { window.__mv = 'buh'; }); const tBuh = await turn("Battle.P().status = ''; Battle.E().status = '';", 0.1);
  ok(tBuh.est === 'fear', 'Die Attacke BUH! macht dem Gegner Angst'); await snap(page, 'Gegner hat Angst');
  const wear = await ev(() => { const E = Battle.E(); E.status = 'blind'; E.sleep = 1; const P = Battle.P(); P.status = 'blind'; P.sleep = 9; return true; });
  await ev(() => { window.__mv = 'rempler'; }); const tWear = await turn("", 0.99);
  ok(wear && /klar sehen/.test(tWear.txt), 'Blendung klingt nach einigen Runden von selbst ab');
  await ev(() => { Battle.P().status = 'fear'; Battle.P().sleep = 9; Battle.E().hp = 1; window.__mv = 'rempler'; }); await ev(() => Bot.free(20000)); await fight;
  ok(await ev(() => G.party[0].status === ''), 'Blendung und Angst enden spätestens mit dem Kampf');
  // Immunitäten: Geister kennen keine Angst, Glitzer lässt sich nicht blenden
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('lakengraf', 40)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  await ev(() => { const P = Battle.P(); P.moves = [{ id: 'rempler', pp: 30 }, { id: 'buh', pp: 20 }, { id: 'blendwerk', pp: 20 }]; window.__mv = 'buh'; });
  const tImm = await turn("Battle.E().status = '';", 0.1);
  ok(tImm.est === '', 'Geist-Monster sind gegen Angst immun: ' + (tImm.txt.split(' | ').find(s => /wirk|immun|Angst/i.test(s)) || tImm.txt));
  await ev(() => { Battle.E().hp = 1; window.__mv = 'rempler'; G.party[0].moves = Mon.create('vulkanis', 50).moves; }); await ev(() => Bot.free(20000)); await fight;

  // ---------- 5) Attacken ----------
  const mv = await ev(() => {
    const used = new Set(); DB.monsters.forEach(m => m.learnset.forEach(l => used.add(l.move))); DB.items.forEach(i => (i.teachMoves || []).forEach(id => used.add(id)));      // auch Attacken aus Lehr-Gegenständen (Goldband) zählen
    const fx = s => DB.moves.filter(m => (m.effects || []).some(e => e.k === 'status' && e.status === s)).length;
    return {
      n: DB.moves.length, unused: DB.moves.filter(m => !used.has(m.id)).map(m => m.id), unsorted: DB.monsters.filter(m => m.learnset.some((l, i) => i > 0 && l.level < m.learnset[i - 1].level)).map(m => m.id),
      perType: DB.types.map(t => DB.moves.filter(m => m.type === t.id).length), minType: DB.types.map(t => t.id + ':' + DB.moves.filter(m => m.type === t.id).length).sort((a, b) => a.split(':')[1] - b.split(':')[1]).slice(0, 3).join(' '),
      status: ['poison', 'burn', 'para', 'sleep', 'freeze', 'blind', 'fear'].map(s => s + ':' + fx(s)).join(' '),
      few: DB.monsters.filter(m => m.learnset.length < 6).map(m => m.id), noDmg: DB.monsters.filter(m => { const a = Mon.create(m.id, 5), b = Mon.create(m.id, 50); return !a.moves.some(x => Data.move(x.id).power > 0) || b.moves.length < 4 || !b.moves.some(x => Data.move(x.id).power > 0); }).map(m => m.id),
      late: ['vulkanis', 'hydrax', 'waldkron', 'drakor', 'ramboss'].map(id => { const l = Data.mon(id).learnset.filter(l => l.level >= 36 && Data.move(l.move).power >= 90); return id + ':' + (l[0] ? Data.move(l[0].move).name + '@' + l[0].level : '-'); }).join(' '),
      stab: DB.monsters.filter(m => !m.learnset.some(l => Data.move(l.move).power > 0 && m.types.concat((m.hurt || {}).types || []).includes(Data.move(l.move).type))).map(m => m.id),
      texts: DB.moves.filter(m => !m.desc || !m.name).length
    };
  });
  ok(mv.n >= 134 && mv.unused.length === 0, mv.n + ' Attacken, jede wird von mindestens einem Monster gelernt' + (mv.unused.length ? ' (unbenutzt: ' + mv.unused.join() + ')' : ''));
  ok(mv.unsorted.length === 0 && mv.few.length === 0 && mv.noDmg.length === 0, 'Jedes Monster lernt mindestens 6 Attacken in aufsteigender Reihenfolge und kann auf Level 5 und 50 angreifen' + (mv.few.length || mv.noDmg.length ? ' (' + mv.few.concat(mv.noDmg).join() + ')' : ''));
  ok(Math.min(...mv.perType) >= 4 && mv.stab.length === 0, 'Jeder der ' + mv.perType.length + ' Typen hat mindestens 4 Attacken (am wenigsten: ' + mv.minType + '); jedes Monster lernt eine Attacke seines eigenen Typs' + (mv.stab.length ? ' (ohne: ' + mv.stab.join() + ')' : ''));
  ok(!/:0/.test(mv.status), 'Für jede Statusveränderung gibt es Attacken: ' + mv.status);
  ok(!/:-/.test(mv.late) && mv.texts === 0, 'Starke Attacken kommen spät: ' + mv.late);

  // ---------- 6) Quiz ----------
  const facts = await ev(() => ({ feuer: Data.typeFactor('feuer', ['plastik']), wasser: Data.typeFactor('wasser', ['plastik']), elektro: Data.typeFactor('elektro', ['plastik']), ramboss: Data.mon('ramboss').needLeash }));
  ok(facts.feuer === 2 && facts.wasser < 2 && facts.elektro < 2 && facts.ramboss === 'meisterleine', 'Die Quizantworten stimmen mit den Spielregeln überein (Feuer gegen Plastik, Meisterleine für Ramboss)');
  await ev(() => { World.enter('haus_amt1', 3, 4, 'down'); }); await ff(page, 5); await ev(() => window.__beside('quiz')); await ff(page, 3);
  const money0 = await ev(() => G.money);
  await press(page, 'a', 4); await ev(() => window.__pick()); await snap(page, 'Quiz: falsche Antworten');
  ok(await ev(() => G.quests.quiz === 'active' && G.vars.quiz === 0), 'Quiz mit drei falschen Antworten: kein Preis, man darf wiederkommen');
  await press(page, 'a', 4); await mash(page, "UI.layers.some(l => l.o && l.o.items && l.o.items.includes('Feuer'))", 1500); await snap(page, 'Quizfrage');
  await ev(() => window.__pick(['Feuer', 'Wird Typ Wasser', 'Meisterleine']));
  const quiz = await ev(() => ({ q: G.quests.quiz, v: G.vars.quiz, lk: Bag.count('leckerli'), money: G.money }));
  ok(quiz.q === 'done' && quiz.v === 3 && quiz.lk >= 5 && quiz.money === money0 + 1000, 'Quiz mit drei richtigen Antworten bestanden: 5 Leckerli und 1000 Taler');
  await press(page, 'a', 4); await ev(() => window.__pick()); ok(await ev(() => G.money) === money0 + 1000, 'Das Quiz lässt sich nicht ein zweites Mal gewinnen');

  // ---------- 7) Kampfschule ----------
  await ev(() => {
    window.__b = []; const o = Battle.start; Battle.start = async function (cfg) { const sum = () => G.party.reduce((a, m) => a + m.hp, 0), rec = { tr: cfg.trainer && cfg.trainer.id, hp0: sum() }; window.__b.push(rec); const r = await o.call(Battle, cfg); rec.hp1 = sum(); rec.res = r; return r; };
    G.party = []; Mon.give(Mon.create('nagri', 3)); World.enter('amtshausen', 9, 11, 'down');
  }); await ff(page, 5); await ev(() => window.__beside('kira')); await ff(page, 3);
  await press(page, 'a', 4); await ev(() => Bot.free(30000));
  const lose = await ev(() => ({ b: window.__b.map(b => b.tr + ':' + b.res).join(), map: World.mapId, q: G.quests.dojo, hp: G.party[0].hp === Mon.maxHp(G.party[0]) }));
  ok(lose.b === 'dojo1:lose' && lose.map === 'amtshausen' && lose.q === 'active' && lose.hp, 'Kampfschule verloren: kein Rauswurf ins Heilzentrum, das Team wird aufgepäppelt, man darf wiederkommen');
  await ev(() => { window.__b.length = 0; G.party = []; for (const id of ['hydrax', 'waldkron', 'drakor']) Mon.give(Mon.create(id, 80)); G.party[0].hp -= 40; window.__max0 = G.party.reduce((a, m) => a + Mon.maxHp(m), 0); window.__beside('kira'); }); await ff(page, 3);
  const tb0 = await ev(() => Bag.count('topbeleber'));
  await press(page, 'a', 4); await ev(() => Bot.free(60000)); await snap(page, 'Kampfschule bestanden');
  const win = await ev(() => ({ b: window.__b.map(b => b.tr + ':' + b.res).join(), cont: window.__b.length === 3 && window.__b[1].hp0 === window.__b[0].hp1 && window.__b[2].hp0 === window.__b[1].hp1 && window.__b[0].hp0 === window.__max0 - 40 && window.__b[1].hp0 < window.__max0, q: G.quests.dojo, tb: Bag.count('topbeleber'), lv: window.__b.length === 3 ? ['dojo1', 'dojo2', 'dojo3'].map(id => Math.max(...Data.trainer(id).team.map(t => t.level))).join('/') : '' }));
  ok(win.b === 'dojo1:win,dojo2:win,dojo3:win' && win.cont, 'Kampfschule: drei Trainer hintereinander (bis Level ' + win.lv + '), ohne Heilung dazwischen' + (win.cont ? '' : ' ' + JSON.stringify(win) + ' ' + await ev(() => JSON.stringify(window.__b) + ' ' + Bot.st())));
  ok(win.q === 'done' && win.tb === tb0 + 2, 'Belohnung der Kampfschule: 2 Top-Beleber und Kraftfutter');
  await ev(() => { window.__b.length = 0; Mon.healParty(); }); await press(page, 'a', 4); await ev(() => Bot.free(60000));
  ok(await ev(() => window.__b.length === 3 && window.__b.every(b => b.res === 'win')) && await ev(() => Bag.count('topbeleber')) === tb0 + 2, 'Die Kampfschule lässt sich wiederholen (zum Trainieren), die Belohnung gibt es einmal');

  // ---------- 8) Rudelführer ----------
  const alphas = await ev(() => ['route1:alpha_nagrotz', 'route3:alpha_gueselmob', 'route4:alpha_glaziel'].map(s => { const [map, id] = s.split(':'), e = Data.map(map).events.find(e => e.id === id); return e ? map + '(' + e.x + ',' + e.y + ')' : 'FEHLT'; }).join(' '));
  ok(!/FEHLT/.test(alphas), 'Drei Rudelführer warten auf den Routen: ' + alphas);
  await ev(() => { G.party = []; Mon.give(Mon.create('vulkanis', 40)); World.enter('route1', 5, 6, 'down'); }); await ff(page, 5); await ev(() => window.__beside('alpha_nagrotz')); await ff(page, 3); await snap(page, 'Rudelführer auf Route 1');
  const says0 = await ev(() => window.__says.length);
  await press(page, 'a', 4); await ev(() => window.__pick(['NEIN']));
  ok(await ev(() => !G.flags.alpha_nagrotz && window.__b.every(b => b.tr)), 'Vor dem Kampf wird gefragt; bei NEIN passiert nichts');
  await ev(() => { window.__b.length = 0; }); await press(page, 'a', 4);
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 3000); await snap(page, 'Kampf gegen den Rudelführer');
  const al = await ev(() => ({ sp: Battle.E().species, lv: Battle.E().level, iv: Object.values(Battle.E().iv).every(v => v === 15), noFlee: Battle.cfg.noFlee, intro: window.__says.find(s => /Rudelführer .* stellt sich/.test(s)) || '' }));
  ok(al.sp === 'nagrotz' && al.lv === 10 && al.iv && al.noFlee && al.intro, 'Rudelführer NAGROTZ Lv.10 mit besten Anlagen: ' + al.intro);
  await ev(() => { UI.layers[UI.layers.length - 1].sel = 3; }); await press(page, 'a', 30); await snap(page, 'Flucht unmöglich');
  ok(await ev(() => Battle.active && window.__says.some(s => /Flucht unmöglich/.test(s))), 'Vor einem Rudelführer kann man nicht fliehen: ' + await ev(() => window.__says.find(s => /Flucht unmöglich/.test(s))));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2) && UI.layers.length <= 2", 600);
  await ev(() => { Battle.E().hp = 1; }); const lk0 = await ev(() => Bag.count('leckerli')); await ev(() => Bot.free(30000));
  const alAfter = await ev(() => ({ flag: !!G.flags.alpha_nagrotz, lk: Bag.count('leckerli'), gone: !World.ents.some(e => e.def.id === 'alpha_nagrotz' && !e.hidden), free: !World.blocked(30, 7) }));
  ok(alAfter.flag && alAfter.lk === lk0 + 3 && alAfter.gone && alAfter.free, 'Nach dem Sieg räumt der Rudelführer seinen Platz und hinterlässt 3 Leckerli');

  // ---------- 9) Mimik und Animation ----------
  const expr = await ev(() => ({ all: DB.monsters.every(m => DB.sprites[m.sprites.blink] && DB.sprites[m.sprites.ouch]), diff: DB.monsters.filter(m => { const f = DB.sprites[m.sprites.front], b = DB.sprites[m.sprites.blink], h = DB.sprites[m.sprites.ouch]; return b.w === f.w && b.h === f.h && h.w === f.w && b.px.join() !== f.px.join() && h.px.join() !== f.px.join() && h.px.join() !== b.px.join(); }).length, hero: ['tr_hero_back', 'tr_hero_back_b', 'tr_hero_back_c'].every(k => DB.sprites[k]) }));
  ok(expr.all && expr.diff === 56 && expr.hero, 'Alle 56 Monster haben eigene Bilder fürs Blinzeln und für "getroffen"; der Spieler hat Wurf-Bilder');
  await ev(() => { window.__keys = {}; const g = Gfx.get; Gfx.get = function (k, a, b) { window.__keys[k + (b ? '#' + b : '')] = (window.__keys[k + (b ? '#' + b : '')] || 0) + 1; return g.apply(Gfx, arguments); }; });
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('kiesling', 45)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500);
  for (let i = 0; i < 40; i++) { await ff(page, 10); await ev(() => Engine.draw()); }
  const k1 = await ev(() => Object.assign({}, window.__keys)); await snap(page, 'Kampf: Leerlauf');
  ok(k1['tr_hero_back_b'] > 0 || k1['tr_hero_back_c'] > 0, 'Der Spieler holt beim Losschicken sichtbar aus (Wurf-Bilder werden gezeigt)');
  ok(k1['mon_kiesling_front_blink'] > 0, 'Das gegnerische Monster blinzelt im Leerlauf');
  await press(page, 'a', 6); await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Math.max(0, Battle.P().moves.findIndex(m => Data.move(m.id).power > 0)); window.__seen = { ouch: 0, white: 0, sq: 0 }; window.__rnd = Math.random; Math.random = () => 0.5; });      // fester Zufall: der Angriff trifft sicher
  await press(page, 'a', 2);
  await ev(async () => { for (let i = 0; i < 400; i++) { Engine.tick(); Engine.draw(); const v = Battle.v; if (v.eOuch > 0) window.__seen.ouch++; if (v.eFlash > 0) window.__seen.white++; if (v.pSq || v.eSq) window.__seen.sq++; if (i === 0) window.__shotAt = -1; if (v.eOuch > 0 && window.__shotAt < 0) { window.__shotAt = i; (window.__snaps = window.__snaps || []).push({ label: 'Getroffen: Mimik', url: Shell.canvas.toDataURL() }); } await LMDebug.yield(); } });
  const k2 = await ev(() => { Math.random = window.__rnd; return { keys: window.__keys, seen: window.__seen }; });
  ok(k2.keys['mon_kiesling_front_hurt'] > 0 && k2.seen.ouch > 0, 'Nach einem Treffer verzieht der Gegner das Gesicht');
  ok(Object.keys(k2.keys).some(k => /#white$/.test(k)) && k2.seen.white > 0 && k2.seen.sq > 0, 'Treffer blitzen weiss auf; Angreifer holen mit Stauchen und Strecken aus');
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2) && UI.layers.length <= 2", 3000);
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000)); await fight;

  // ---------- 10) Zwickel -> Scherox, der Krabbenkönig ----------
  const crab = await ev(() => { const z = Data.mon('zwickel'), s = Data.mon('scherox'), mv = Data.move('superkante'), f = DB.sprites[s.sprites.front]; return { evo: z.evolutions[0].to + '@' + z.evolutions[0].level, kind: s.kind, mv: mv ? mv.name + ' ' + mv.type + ' ' + mv.power + (mv.effects.some(e => e.k === 'crit') ? ' crit' : '') : '', hand: Data.move('handkante').power, at: (s.learnset.find(l => l.move === 'superkante') || {}).level, notZ: !z.learnset.some(l => l.move === 'superkante'), spr: ['front', 'back', 'icon', 'blink', 'ouch'].every(k => DB.sprites[s.sprites[k]]), crown: f.px.slice(6, 9).join('|') }; });
  ok(crab.evo === 'scherox@28' && crab.kind === 'Krabbkönig' && crab.spr, 'ZWICKEL entwickelt sich auf Level 28 zu SCHEROX (' + crab.kind + ') mit eigenen Bildern samt Mimik');
  ok(crab.mv === 'Superkante kampf 85 crit' && crab.hand === 50 && crab.at === 28 && crab.notZ && /3003/.test(crab.crown), 'Nur SCHEROX lernt die SUPERKANTE (Kampf, Stärke 85 statt 50 der Handkante, oft Volltreffer) – direkt bei der Entwicklung; im Bild trägt es eine Krone');
  await ev(() => { G.party = []; const m = Mon.create('zwickel', 27); m.exp = Mon.expFor(Mon.sp(m), 28) - 2; Mon.give(m); World.enter('route5', 9, 9, 'down'); });
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 5)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, 'UI.layers.some(l => String(l.draw).includes("sil"))', 20000); await ff(page, 150); await ev(() => Bot.until(() => window.__says.some(s => /wurde zu Scherox/.test(s)), 4000)); await snap(page, 'Zwickel wird zu Scherox');
  await ev(() => Bot.free(30000)); await fight;
  ok(await ev(() => G.party[0].species === 'scherox' && G.party[0].level === 28 && G.party[0].moves.some(m => m.id === 'superkante')), 'Im Spiel: ZWICKEL erreicht Level 28, wird zu SCHEROX und lernt SUPERKANTE (' + await ev(() => G.party[0].moves.map(m => Data.move(m.id).name).join(', ')) + ')');
  // ein älteres Zwickel (z.B. aus einem alten Spielstand, schon über Level 28) entwickelt sich beim nächsten Levelaufstieg und lernt die Attacke nach
  await ev(() => { G.party = []; const m = Mon.create('zwickel', 31); m.exp = Mon.expFor(Mon.sp(m), 32) - 2; Mon.give(m); });
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('nagri', 5)] }); await World.afterBattle(window.__res, false); }));
  await ev(() => Bot.free(40000)); await fight;
  ok(await ev(() => G.party[0].species === 'scherox' && G.party[0].level === 32 && G.party[0].moves.some(m => m.id === 'superkante')), 'Ein ZWICKEL aus einem alten Spielstand (Level 31) entwickelt sich beim nächsten Levelaufstieg und lernt die SUPERKANTE nach');
  fight = ev(() => World.run(async () => { window.__res = await Battle.start({ kind: 'wild', enemy: [Mon.create('scherox', 30)] }); await World.afterBattle(window.__res, false); }));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2)", 2500); await ff(page, 30); await snap(page, 'Scherox gegen Scherox');
  // eigene Animation der Superkante: eine grosse Schere saust zum Gegner und schnappt zu
  await ev(() => { window.__keys = {}; window.__rnd = Math.random; Math.random = () => 0.5; });
  await press(page, 'a', 6); await ev(() => { const top = UI.layers[UI.layers.length - 1]; top.sel = Battle.P().moves.findIndex(m => m.id === 'superkante'); }); await press(page, 'a', 2);
  await ev(async () => { let shots = 0; const n0 = window.__says.length; for (let i = 0; i < 1500; i++) { if (i > 40 && window.__says.length > n0 && (!Battle.active || (UI.layers.some(l => l.o && l.o.cols === 2) && UI.layers.length <= 2))) break; Engine.tick(); const a = window.__keys['fx_claw_open'] || 0, b = window.__keys['fx_claw_shut'] || 0; Engine.draw(); const a2 = window.__keys['fx_claw_open'] || 0, b2 = window.__keys['fx_claw_shut'] || 0; if ((shots === 0 && a2 > a && a2 > 11) || (shots === 1 && b2 > b && b2 > 2) || (shots === 2 && b2 > b && b2 > 12)) { shots++; (window.__snaps = window.__snaps || []).push({ label: shots === 1 ? 'Superkante: die Schere saust heran' : shots === 2 ? 'Superkante: Schnapp, sie schliesst sich' : 'Superkante: ... und schlägt zu', url: Shell.canvas.toDataURL() }); } await LMDebug.yield(); } Math.random = window.__rnd; });
  const ck = await ev(() => ({ open: window.__keys['fx_claw_open'] || 0, shut: window.__keys['fx_claw_shut'] || 0, anim: Data.move('superkante').anim, only: DB.moves.filter(m => m.anim === 'claw').map(m => m.id).join(), hurt: Mon.maxHp(Battle.E()) - Battle.E().hp }));
  ok(ck.anim === 'claw' && ck.only === 'superkante' && ck.open >= 14 && ck.shut >= 18 && ck.hurt > 0, 'Die SUPERKANTE hat eine eigene Animation (nur sie): eine Schere holt aus, saust über den Gegner (' + ck.open + ' Bilder offen), schliesst sich und schlägt geschlossen zu (' + ck.shut + ' Bilder), ' + ck.hurt + ' Schaden' + (ck.open ? '' : ' DIAG ' + await ev(() => JSON.stringify({ tb: UI.tb.lines, layers: UI.layers.map(l => l.o && l.o.items ? l.o.items.join('/') + '@' + l.sel : 'x'), moves: Battle.P().moves, says: window.__says.slice(-6), active: Battle.active }))));
  await mash(page, "Battle.active && UI.layers.some(l => l.o && l.o.cols === 2) && UI.layers.length <= 2", 3000);
  await ev(() => { Battle.E().hp = 1; }); await ev(() => Bot.free(20000)); await fight;
  // Figuren auf der Karte blinzeln
  await ev(() => { window.__keys = {}; World.enter('welpenhain', 4, 11, 'down'); }); await ff(page, 5);
  const blink = await ev(async () => { let shot = false; for (let i = 0; i < 230; i++) { Engine.tick(); const before = window.__keys['c_hero_d0_blink'] || 0; Engine.draw(); if (!shot && (window.__keys['c_hero_d0_blink'] || 0) > before) { shot = true; (window.__snaps = window.__snaps || []).push({ label: 'Spieler blinzelt', url: Shell.canvas.toDataURL() }); } await LMDebug.yield(); } return { hero: window.__keys['c_hero_d0_blink'] || 0, open: window.__keys['c_hero_d0'] || 0, n: Object.keys(DB.sprites).filter(k => /^c_.*_d0_blink$/.test(k)).length, pass: !!DB.sprites.tr_hero_blink }; });
  ok(blink.hero > 0 && blink.open > blink.hero * 10 && blink.n >= 20 && blink.pass, 'Der Spieler blinzelt, wenn er stehen bleibt (' + blink.hero + ' von ' + (blink.hero + blink.open) + ' Bildern); ' + blink.n + ' Figuren haben ein Blinzel-Bild');
  await montage(page, 'nebel_eis_extras.png', 6);
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
