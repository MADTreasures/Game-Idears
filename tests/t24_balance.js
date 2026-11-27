// Balance ("fairer Fortschritt"): Simulation der Arenaleiter-Kämpfe je Schwierigkeitsstufe und Starter.
// Der Spieler wird nachgebildet: erwartete EP aus allen Trainern des Abschnitts plus 15 wilden Kämpfen je Route, verteilt auf sein Team.
//   Profil "einfach":  fast nur der Starter (70 %), dazu die beiden geschenkten Monster (Kiesling, Flaschi) und 4 Tränke je Leiterkampf
//   Profil "erfahren": vier Monster mit Typvorteilen (Starter, Blitzel, Zwickel, Schlinger), keine Tränke
// Beide wählen stets die Attacke mit dem höchsten erwarteten Schaden und wechseln nach Typvorteil. Aufruf: node tests/t24_balance.js [Kämpfe je Paarung]
const { open, newGame } = require('./lib.js');
const N = +(process.argv[2] || 3), WILD = 15;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const { browser, page, errors } = await open();
  await newGame(page);
  const res = await page.evaluate(async ([N, WILD]) => {
    const SEG = [
      { pre: ['rival_X'], route: 'route1', tr: ['timo', 'lena', 'sepp'], gymTr: ['vroni', 'till'], leader: 'falk' },
      { pre: ['rival2_X'], route: 'route2', tr: ['otto', 'mia', 'jonas', 'kim'], gymTr: ['rolf', 'tara'], leader: 'polly' },
      { pre: [], route: 'route3', tr: ['zoe', 'hans', 'luca', 'kurt', 'maxx'], gymTr: ['karl', 'mona'], leader: 'wanda' },
      { pre: ['rival3_X'], route: 'route4', tr: ['alois', 'heidi', 'beat', 'nora', 'lars'], gymTr: ['reto', 'vreni'], leader: 'urs' },
      { pre: [], route: 'route5', tr: ['kunz', 'jo', 'ole', 'finn', 'gerda', 'rival4_X'], gymTr: ['egli', 'ida'], leader: 'stempel' }
    ];
    let potions = 0;
    const grow = (m, exp) => { const ups = Mon.addExp(m, Math.floor(exp)); for (const up of ups) for (const mv of up.learn) { if (m.moves.some(x => x.id === mv)) continue; const d = Data.move(mv), o = { id: mv, pp: d.pp }; if (m.moves.length < 4) m.moves.push(o); else { let w = 0, wp = 1e9; m.moves.forEach((x, i) => { const p = Data.move(x.id).power || 0; if (p < wp) { wp = p; w = i; } }); if ((d.power || 0) >= wp) m.moves[w] = o; } } for (;;) { const e = Mon.evolution(m, { kind: 'level' }); if (!e) break; m.species = e.to; } m.hp = Mon.maxHp(m); };
    const trExp = id => Trainers.team(Data.trainer(id)).reduce((s, e) => s + Math.floor(Mon.sp(e).expYield * e.level / 5 * 1.5 * (Game.diff().exp || 1)), 0);
    const wildExp = route => { const t = Data.map(route).encounters.find(t => t.zone === 1 && !t.method); let s = 0, w = 0; for (const sl of t.slots) { s += sl.weight * Data.mon(sl.species).expYield * ((sl.min + sl.max) / 2) / 5; w += sl.weight; } return s / w * (Game.diff().exp || 1); };
    const dmgMoves = m => m.moves.map(x => Data.move(x.id)).filter(d => d.cat !== 'status' && d.power);
    const rough = (m, E) => { if (!Mon.alive(m)) return 0; const off = Math.max(0.1, ...dmgMoves(m).map(d => d.power / 50 * Data.typeFactor(d.type, Mon.sp(E).types))), def = Math.max(0.25, ...dmgMoves(E).map(d => d.power / 50 * Data.typeFactor(d.type, Mon.sp(m).types))); return off / def * Math.pow(m.level / E.level, 2) * (0.4 + 0.6 * m.hp / Mon.maxHp(m)); };
    const bestIdx = cur => { let b = -1, bs = -1; G.party.forEach((m, i) => { if (i === cur || !Mon.alive(m)) return; const s = rough(m, Battle.E()); if (s > bs) { bs = s; b = i; } }); return b; };
    Battle.chooseAction = async () => {
      const P = Battle.P(); let best = -1, bs = -1;
      if (potions > 0 && P.hp < Mon.maxHp(P) * 0.35) { potions--; const it = Data.item(P.level < 18 ? 'trank' : P.level < 30 ? 'supertrank' : 'hypertrank'); Bag.add(it.id, 1); return { type: 'item', item: it, target: Battle.pi }; }
      P.moves.forEach((m, i) => { if (m.pp <= 0) return; const d = Data.move(m.id), s = d.cat === 'status' ? 0 : Battle.calcDamage('p', d, false, 0.92) * (d.acc ? d.acc / 100 : 1); if (s > bs) { bs = s; best = i; } });
      return { type: 'move', idx: best };
    };
    Menus.party = async o => bestIdx(o.cur); Menus.learnMove = async () => {}; Menus.evolve = async () => {};
    UI.ask = async t => { if (!/wechseln/.test(t) || !Battle.active) return false; const b = bestIdx(Battle.pi); return b >= 0 && rough(G.party[b], Battle.E()) > rough(Battle.P(), Battle.E()) * 1.3; };
    const fight = async id => {
      const save = JSON.stringify(G.party), money = G.money; G.party.forEach(m => { m.hp = Mon.maxHp(m); m.status = ''; m.moves.forEach(x => { x.pp = Data.move(x.id).pp; }); });
      const foe = Trainers.team(Data.trainer(id))[0]; G.party.sort((x, y) => rough(y, foe) - rough(x, foe));
      let done = null; Battle.start({ kind: 'trainer', trainer: Data.trainer(id), enemy: Trainers.team(Data.trainer(id)) }).then(r => { done = r; });
      for (let i = 0; i < 60000 && !done; i++) { if (i % 2 === 0) Input.pend.a = true; Engine.tick(); if (i % 400 === 0) await LMDebug.yield(); await null; }
      G.party = JSON.parse(save); G.money = money; Gfx.fade = 0; return done === 'win';
    };
    const run = async (diff, kid) => {
      const MATES = kid ? [['kiesling', 8, 0], ['flaschi', 16, 2]] : [['blitzel', 4, 0], ['zwickel', 5, 0], ['schlinger', 10, 1]], rows = [];
      for (const [st, X] of [['glutwelp', 'a'], ['quappel', 'b'], ['sprossel', 'c']]) {
        G.diff = diff; G.party = [Mon.create(st, 5)]; G.defeated = {}; G.bag = {};
        for (let s = 0; s < SEG.length; s++) {
          const seg = SEG[s]; for (const [sp, lv, at] of MATES) if (at === s) G.party.push(Mon.create(sp, lv));
          const n = G.party.length, share = kid ? (n === 1 ? [1] : n === 2 ? [0.75, 0.25] : [0.7, 0.15, 0.15]) : n === 1 ? [1] : n === 2 ? [0.6, 0.4] : n === 3 ? [0.45, 0.3, 0.25] : [0.4, 0.2, 0.25, 0.15];
          let E = WILD * wildExp(seg.route); for (const t of seg.pre.concat(seg.tr, seg.gymTr)) E += trExp(t.replace('X', X));
          const uid0 = G.party[0].uid; G.party.forEach((m, i) => grow(m, E * share[i]));
          let wins = 0; for (let k = 0; k < N; k++) { potions = kid ? 4 : 0; const order = G.party.map(m => m.uid); if (await fight(seg.leader)) wins++; G.party.sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid)); }
          const lt = Trainers.team(Data.trainer(seg.leader)), ace = Math.max(...lt.map(m => m.level)), starter = G.party.find(m => m.uid === uid0);
          rows.push({ st, leader: seg.leader, team: G.party.map(m => m.species.substr(0, 6) + m.level).join(' '), foe: lt.map(m => m.level).join('/'), wins, lv: starter.level, ace });
          const le = trExp(seg.leader); G.party.forEach((m, i) => grow(m, le * share[i]));
        }
      }
      return rows;
    };
    return { leichtE: await run(0, false), mittelK: await run(1, true), mittelE: await run(1, false), schwerE: await run(2, false) };
  }, [N, WILD]);
  const rate = rows => rows.reduce((s, r) => s + r.wins, 0) / (rows.length * N), pct = x => Math.round(x * 100) + ' %';
  for (const k of Object.keys(res)) { console.log('--- ' + k + ' (Siege von ' + N + ') ---'); for (const r of res[k]) console.log('  ' + [r.st, r.leader, r.team, 'gegen ' + r.foe, r.wins + '/' + N].join(' | ')); }
  const le = rate(res.leichtE), mk = rate(res.mittelK), me = rate(res.mittelE), se = rate(res.schwerE);
  ok(le >= 0.9, 'DUMMER LOOSER (erfahrenes Profil): ' + pct(le) + ' der Leiterkämpfe gewonnen (Soll: mindestens 90 %)');
  ok(mk >= 0.7, 'MITTEL (einfaches Profil mit Tränken): ' + pct(mk) + ' gewonnen (Soll: mindestens 70 %)');
  ok(me >= 0.45, 'MITTEL (erfahrenes Profil ohne Tränke): ' + pct(me) + ' gewonnen (Soll: mindestens 45 %)');
  ok(se < me && se < le, 'EHRENLOSER ZOCKER ist spürbar schwerer: ' + pct(se) + ' (MITTEL ' + pct(me) + ', leicht ' + pct(le) + ')');
  ok(res.mittelK.every(r => r.lv >= r.ace - 1) && res.mittelE.every(r => r.lv >= r.ace - 1), 'MITTEL: der Starter ist vor jeder Arena mindestens so stark wie das beste Monster des Leiters (höchstens 1 Level darunter)');
  const lv = res.mittelE.filter(r => r.st === 'glutwelp');
  ok(lv.every((r, i) => i === 0 || r.ace > lv[i - 1].ace), 'Die Arenen werden der Reihe nach stärker: beste Monster Lv ' + lv.map(r => r.ace).join(' < '));
  for (const s of ['glutwelp', 'quappel', 'sprossel']) { const w = res.mittelK.filter(r => r.st === s).reduce((a, r) => a + r.wins, 0); ok(w >= 5 * N * 0.6, 'MITTEL ist mit jedem Starter machbar: ' + s + ' gewinnt ' + w + ' von ' + 5 * N + ' Leiterkämpfen'); }
  console.log('errors:', errors.length ? errors.slice(0, 5).join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
