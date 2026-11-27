// Weltreise: mit einem starken Team vom Startdorf durch alle Gebiete bis zur fünften Medaille.
// Prüft Wege, nahtlose Kartenränder, Türen, Wächter, Heilzentren, Arenen, Rivalenkämpfe – und dass auf jeder Karte alles erreichbar ist.
const { open, ff, snap, montage, newGame } = require('./lib.js');
const T0 = Date.now(), ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; }, lap = n => console.log('  (' + n + ': ' + ((Date.now() - T0) / 1000).toFixed(0) + ' s)');
(async () => {
  const { browser, page, errors } = await open();
  const ev = (f, a) => page.evaluate(f, a);
  await newGame(page); lap('Spielstart');
  // ---------- statische Prüfung: Erreichbarkeit auf allen Karten ----------
  const reach = await ev(() => {
    const bad = [], solid = (m, x, y) => x < 0 || y < 0 || x >= m.w || y >= m.h || Data.solidAt(m, x, y), kind = (m, x, y) => { for (const l of ['objects', 'deco', 'ground']) { const t = Data.tile(m.layers[l][y * m.w + x]); if (t && t.kind) return t.kind; } return ''; };
    for (const m of DB.maps) {
      const start = [];
      for (const o of DB.maps) for (const w of o.warps) if (w.toMap === m.id) start.push([w.toX, w.toY]);
      for (const d in m.connections) for (let i = 0; i < (d === 'east' || d === 'west' ? m.h : m.w); i++) { const x = d === 'east' ? m.w - 1 : d === 'west' ? 0 : i, y = d === 'south' ? m.h - 1 : d === 'north' ? 0 : i; if (!solid(m, x, y)) start.push([x, y]); }
      if (m.id === DB.meta.startMap) start.push([DB.meta.startX, DB.meta.startY]);
      if (!start.length) { bad.push(m.id + ': kein Zugang'); continue; }
      const seen = new Set(), st = start.slice(), blockers = new Set(m.npcs.filter(n => !(n.visibleIf || []).length).map(n => n.x + ',' + n.y).concat(m.events.filter(e => e.solid && !(e.visibleIf || []).length && !e.once).map(e => e.x + ',' + e.y)));
      while (st.length) { const [x, y] = st.pop(), k = x + ',' + y; if (seen.has(k) || solid(m, x, y) || blockers.has(k)) continue; seen.add(k); st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); }
      const near = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)) || (kind(m, x + dx, y + dy) === 'counter' && seen.has((x + 2 * dx) + ',' + (y + 2 * dy))));
      for (const w of m.warps) if (!seen.has(w.x + ',' + w.y)) bad.push(m.id + ': Übergang ' + w.id + ' (' + w.x + ',' + w.y + ') nicht erreichbar');
      for (const n of m.npcs) if (!near(n.x, n.y) && !seen.has(n.x + ',' + n.y)) bad.push(m.id + ': NPC ' + n.id + ' (' + n.x + ',' + n.y + ') nicht ansprechbar');
      for (const e of m.events) if (e.trigger === 'push' || e.trigger === 'enter') continue; else if (e.trigger === 'step' ? !seen.has(e.x + ',' + e.y) : !near(e.x, e.y) && !seen.has(e.x + ',' + e.y)) bad.push(m.id + ': Ereignis ' + e.id + ' (' + e.x + ',' + e.y + ') nicht erreichbar');
      for (const n of m.npcs) if (solid(m, n.x, n.y)) bad.push(m.id + ': NPC ' + n.id + ' steht in einem Hindernis');
    }
    return { bad, maps: DB.maps.length, npcs: DB.maps.reduce((s, m) => s + m.npcs.length, 0), towns: DB.maps.filter(m => m.kind === 'outdoor').map(m => m.name) };
  });
  ok(reach.bad.length === 0, 'Auf allen ' + reach.maps + ' Karten sind Übergänge, Personen und Ereignisse erreichbar' + (reach.bad.length ? ': ' + reach.bad.slice(0, 8).join(' | ') : ''));
  ok(reach.towns.length === 13 && ['TUPPERWIL', 'GRUBENAU', 'KÄSINGEN', 'AMTSHAUSEN', 'NEBELMOOR'].every(t => reach.towns.includes(t)), 'Welt: ' + reach.towns.join(', '));
  ok(reach.npcs >= 110, 'Es gibt deutlich mehr Menschen: ' + reach.npcs + ' Personen (vorher 24)');
  lap('Erreichbarkeit');
  // ---------- Durchlauf ----------
  await ev(() => {
    Mon.give(Mon.create('lohwolf', 80)); Mon.give(Mon.create('lurchon', 80)); G.flags.has_starter = true; G.flags.has_dex = true; G.flags.rival_left = true; G.vars.starter = 1; World.encCooldown = 1e9;
    window.Tour = {
      async heal(id) { if (!(await Bot.door(id))) return 'Heilzentrum nicht erreichbar @' + Bot.st(); G.party[0].hp = 1; await Bot.goto(3, 3); await Bot.talk('up'); await Bot.free(); const full = G.party.every(m => m.hp === Mon.maxHp(m)) && G.respawn.map === id; await Bot.out(); return full ? 'ok' : 'nicht geheilt'; },
      async gym(id, gymId) { if (!(await Bot.door(id))) return 'Arena nicht erreichbar @' + Bot.st(); if (!(await Bot.goto(4, 2))) return 'Leiter nicht erreichbar @' + Bot.st(); await Bot.talk('up'); await Bot.free(60000); await LMDebug.ff(20); await Bot.free(); const g = Data.gym(gymId), ok = G.badges.includes(gymId) && g.trainers.every(t => G.defeated[t]) && G.defeated[g.leader]; await Bot.out(); return ok ? 'ok' : 'keine Medaille ' + JSON.stringify(G.badges); },
      async shop(id) { if (!(await Bot.door(id))) return 'Laden nicht erreichbar'; await Bot.goto(1, 3); await Bot.talk('up'); await LMDebug.until(() => /KAUFEN/.test(Bot.text()), 600, 'a'); const r = /KAUFEN/.test(Bot.text()); await LMDebug.press('b', 8); await LMDebug.press('b', 8); await Bot.free(); await Bot.out(); return r ? 'ok' : 'kein Verkäufer'; },
      async edge(dir, to) { return (await Bot.edge(dir, to)) ? 'ok' : 'Rand nicht erreichbar @' + Bot.st(); },
      blocked(dir) { const m = World.map; for (let i = 0; i < (dir === 'east' || dir === 'west' ? m.h : m.w); i++) { const x = dir === 'east' ? m.w - 1 : dir === 'west' ? 0 : i, y = dir === 'south' ? m.h - 1 : dir === 'north' ? 0 : i; if (!World.cellSolid(x, y) && Bot.path(x, y)) return 'offen'; } return 'ok'; }
    };
    World.enter('welpenhain', 4, 11, 'down');
  });
  await ff(page, 5);
  const steps = [
    ['edge', 'east', 'route1', 'Welpenhain -> Route 1'], ['edge', 'east', 'bellstadt', 'Route 1 -> Bellstadt'], ['heal', 'heilzentrum', null, 'Heilzentrum Bellstadt'], ['shop', 'shop', null, 'Leinenladen Bellstadt'],
    ['blocked', 'north', null, 'Bellstadt: Nordtor ohne Federmedaille gesperrt'], ['gym', 'arena', 'gym1', 'Arena Bellstadt (Flug): Trainer, Leiter Falk, Federmedaille'],
    ['edge', 'north', 'route2', 'Bellstadt -> Route 2 (Wächter gibt den Weg frei)'], ['edge', 'north', 'tupperwil', 'Route 2 -> Tupperwil'], ['heal', 'heil2', null, 'Heilzentrum Tupperwil'], ['shop', 'shop2', null, 'Dosenladen Tupperwil'],
    ['blocked', 'east', null, 'Tupperwil: Osttor ohne Recyclemedaille gesperrt'], ['gym', 'arena2', 'gym2', 'Arena Tupperwil (Plastik): Leiterin Polly, Recyclemedaille'],
    ['edge', 'east', 'route3', 'Tupperwil -> Route 3'], ['edge', 'east', 'grubenau', 'Route 3 -> Grubenau'], ['heal', 'heil3', null, 'Heilzentrum Grubenau'], ['shop', 'shop3', null, 'Kramladen Grubenau'],
    ['blocked', 'north', null, 'Grubenau: Bergpfad ohne Buddelmedaille gesperrt'], ['gym', 'arena3', 'gym3', 'Arena Grubenau (Boden/Gestein): Leiterin Wanda, Buddelmedaille'],
    ['edge', 'north', 'route4', 'Grubenau -> Route 4'], ['edge', 'north', 'kaesingen', 'Route 4 -> Käsingen'], ['heal', 'heil4', null, 'Heilzentrum Käsingen'], ['shop', 'shop4', null, 'Käselädeli Käsingen'],
    ['blocked', 'west', null, 'Käsingen: Westtor ohne Löchermedaille gesperrt'], ['gym', 'arena4', 'gym4', 'Arena Käsingen (Käse): Leiter Urs, Löchermedaille'],
    ['edge', 'west', 'route5', 'Käsingen -> Route 5'], ['edge', 'west', 'amtshausen', 'Route 5 -> Amtshausen'], ['heal', 'heil5', null, 'Heilzentrum Amtshausen'], ['shop', 'shop5', null, 'Amtskiosk Amtshausen'],
    ['blocked', 'south', null, 'Amtshausen: Südtor ohne Stempelmedaille gesperrt'], ['gym', 'arena5', 'gym5', 'Arena Amtshausen (Büro/Glitzer): Dr. Stempel, Stempelmedaille'],
    ['edge', 'south', 'route6', 'Amtshausen -> Route 6 (Nebelpfad)'], ['edge', 'south', 'nebelmoor', 'Route 6 -> Nebelmoor'], ['heal', 'heil6', null, 'Heilzentrum Nebelmoor'], ['shop', 'shop6', null, 'Nebelkrämer Nebelmoor'],
    ['gym', 'arena6', 'gym6', 'Arena Nebelmoor (Geist/Psycho): Leiterin Selma, Spukmedaille']
  ];
  let alive = true;
  for (const [f, a, b, label] of steps) {
    if (!alive) { ok(false, label + ' (übersprungen)'); continue; }
    const t0 = Date.now(); let slow = null;
    const watch = setTimeout(async () => { try { slow = await ev(() => Bot.st() + ' | ' + Bot.text().substr(0, 160) + ' | Menü: ' + JSON.stringify((UI.layers[UI.layers.length - 1] || {}).o || {}).substr(0, 200)); console.log('  LANGSAM bei "' + label + '": ' + slow); } catch (e) {} }, 45000);
    const r = await ev(([f, a, b]) => Tour[f](a, b), [f, a, b]); clearTimeout(watch);
    ok(r === 'ok', label + (r === 'ok' ? '' : ': ' + r) + '  [' + ((Date.now() - t0) / 1000).toFixed(0) + ' s]'); if (r !== 'ok') { alive = false; await snap(page, label); }
    if (f === 'edge') { await ff(page, 40); await snap(page, a + ' ' + b); lap(label); }
  }
  const end = await ev(() => ({ badges: G.badges.length, champ: !!G.flags.champion, rivals: ['rival2_a', 'rival3_a', 'rival4_a'].filter(t => G.defeated[t]).length, def: Object.keys(G.defeated).length, ml: Bag.count('meisterleine'), stock: Data.shop('shop_amtshausen').stock.filter(s => Cond.all(s.cond)).some(s => s.item === 'meisterleine') }));
  ok(end.badges === 6 && end.champ, 'Alle sechs Medaillen erhalten – der Spieler ist LEINENMEISTER');
  ok(end.rivals === 3, 'Der Rivale hat unterwegs dreimal herausgefordert (Route 2, 4 und 5)');
  ok(end.ml === 1 && end.stock, 'Belohnung der letzten Arena: Meisterleine; der Kiosk verkauft sie jetzt');
  ok(end.def >= 25, 'Unterwegs ' + end.def + ' Trainer besiegt');
  lap('Durchlauf'); await montage(page, 'weltreise.png', 5); lap('Bildtafel');
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
