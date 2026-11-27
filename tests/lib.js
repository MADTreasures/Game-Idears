// Gemeinsame Testhelfer (Playwright). Spieltests laufen gegen Animora-Morgenrot.html (reines Spiel ohne Editor),
// Editor-Tests gegen Animora-Morgenrot-Editor.html (mit #spiel in der Adresse startet sie am Titelbild).
// Aufruf aller Tests:  node tests/run_all.js   (einzeln: node tests/t02_spielbeginn.js)
// Andere Datei testen: LM_FILE=/pfad/zur/Datei.html node tests/run_all.js
// Bildschirmfotos landen in tests/out/.
const { chromium } = require('playwright');
const path = require('path');
require('fs').mkdirSync(path.join(__dirname, 'out'), { recursive: true });
const FILE = process.env.LM_FILE || path.join(__dirname, '..', 'Animora-Morgenrot.html');
async function open(file, opts) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 700, height: 660 }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type().toUpperCase() + ' ' + m.text()); });
  await page.goto('file://' + (file || FILE));
  await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 2);
  await page.evaluate(() => { Engine.manual = true; Opt.text = 2; });
  return { browser, page, errors };
}
const ff = (page, n) => page.evaluate(n => LMDebug.ff(n), n);
const press = (page, k, n) => page.evaluate(([k, n]) => LMDebug.press(k, n), [k, n == null ? 3 : n]);
const shot = async (page, name) => { await page.evaluate(() => Engine.draw()); const el = await page.$('#lm-screen'); await el.screenshot({ path: path.join(__dirname, 'out', name) }); };
// Drückt A, bis cond (als Funktionsstring) wahr ist
const mash = (page, condSrc, max) => page.evaluate(([c, max]) => (window.Bot ? Bot.until : LMDebug.until)(new Function("return (" + c + ")"), max || 3000, "a"), [condSrc, max]);
// snap: merkt sich das aktuelle Bild; montage: schreibt alle gemerkten Bilder als ein PNG (2x, mit Beschriftung)
const snap = (page, label) => page.evaluate(label => { Engine.draw(); (window.__snaps = window.__snaps || []).push({ label, url: Shell.canvas.toDataURL() }); }, label);
async function montage(page, name, cols) {
  cols = cols || 4;
  const n = await page.evaluate(cols => {
    const d = document.createElement('div'); d.id = '__montage'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#333;display:grid;gap:6px;padding:6px;grid-template-columns:repeat(' + cols + ',320px)';
    for (const s of window.__snaps || []) { const c = document.createElement('div'); c.style.cssText = 'color:#fff;font:11px monospace'; c.innerHTML = '<img src="' + s.url + '" style="width:320px;height:288px;image-rendering:pixelated;display:block"><div>' + s.label + '</div>'; d.appendChild(c); }
    document.body.appendChild(d); const n = (window.__snaps || []).length; window.__snaps = []; return n;
  }, cols);
  const rows = Math.ceil(n / cols);
  await page.setViewportSize({ width: cols * 326 + 12, height: rows * 308 + 12 });
  const el = await page.$('#__montage'); await el.screenshot({ path: path.join(__dirname, 'out', name) });
  await page.evaluate(() => document.getElementById('__montage').remove());
  await page.setViewportSize({ width: 700, height: 660 });
}
module.exports = { open, ff, press, shot, mash, snap, montage, FILE };

// Seiten-seitige Bot-Helfer (werden per installBot in die Seite geladen)
async function installBot(page) {
  await page.evaluate(() => {
    window.Bot = {
      // Wegsuche (Dijkstra) auf der aktuellen Karte; meidet Warps, Schritt-Ereignisse und (teuer) hohes Gras.
      path(tx, ty, o) {
        o = o || {}; const m = World.map, W = m.w, H = m.h, p = World.p, dist = new Map(), prev = new Map(), key = (x, y) => y * W + x;
        const stepEv = (x, y) => World.ents.some(e => e.kind === 'event' && !e.hidden && e.def.trigger === 'step' && e.x === x && e.y === y && World.page(e));
        const pq = [[0, p.x, p.y]]; dist.set(key(p.x, p.y), 0);
        while (pq.length) {
          pq.sort((a, b) => a[0] - b[0]); const [d, x, y] = pq.shift();
          if (x === tx && y === ty) break;
          for (const [c, dx, dy] of [['U', 0, -1], ['D', 0, 1], ['L', -1, 0], ['R', 1, 0]]) {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const target = nx === tx && ny === ty;
            if (World.blocked(nx, ny) || World.kindAt(nx, ny) === 'ledge') continue;
            if (!target && (World.warpAt(nx, ny, 'step') || stepEv(nx, ny))) continue;
            const nd = d + 1 + (World.zoneAt(nx, ny) && !o.grassOk ? 30 : 0), k = key(nx, ny);
            if (!dist.has(k) || nd < dist.get(k)) { dist.set(k, nd); prev.set(k, [x, y, c]); pq.push([nd, nx, ny]); }
          }
        }
        if (!prev.has(key(tx, ty))) return null;
        let s = '', x = tx, y = ty; while (x !== p.x || y !== p.y) { const pr = prev.get(key(x, y)); s = pr[2] + s; x = pr[0]; y = pr[1]; }
        return s;
      },
      // Drückt A, bis kein Script/Kampf mehr läuft.
      async free(max) { return Bot.until(() => !World.lock && !Battle.active && Gfx.fade === 0 && !World.p.moving, max || 20000); },
      // Wie LMDebug.until mit A-Taste, wählt im Kampf aber gezielt die stärkste Attacke.
      async until(cond, max) {
        for (let i = 0; i < (max || 3000); i++) {
          if (cond()) return true;
          if (i % 4 === 0) {
            const top = UI.layers[UI.layers.length - 1];
            if (Battle.active && top && top.o && top.o.items && top.o.pitch === 10 && !top.o.title) { // Attackenmenü
              const P = Battle.P(); let best = 0, bp = -1; P.moves.forEach((m, k) => { const d = Data.move(m.id); if (m.pp > 0 && d.power > bp) { bp = d.power; best = k; } }); top.sel = best;
            } else if (Battle.active && top && top.o && top.o.cols === 2) top.sel = 0;
            // Erzwungener Wechsel (eigenes Monster besiegt): im Teammenü abwechselnd nach unten und A, bis ein kampffähiges gewählt ist.
            const forced = Battle.active && top && !top.o && top.draw && String(top.draw).includes('drawMonRow') && !Mon.alive(Battle.P());
            if (forced && (Bot._alt = !Bot._alt)) Input.pend.down = true; else Input.pend.a = true;
          }
          Engine.tick(); await LMDebug.yield();
        }
        return !!cond();
      },
      // Läuft zum Ziel; Kämpfe und Dialoge unterwegs werden mit A durchgeklickt. Liefert true bei Ankunft.
      async goto(tx, ty, o) {
        const map = World.mapId;
        for (let tries = 0; tries < 400; tries++) {
          if (World.lock || Battle.active) { await Bot.free(); if (World.mapId !== map) return false; }
          const p = World.p; if (p.x === tx && p.y === ty) return true;
          const path = Bot.path(tx, ty, o); if (!path) { await LMDebug.ff(20); continue; }
          await LMDebug.walk(path[0]); await LMDebug.ff(1);
          if (World.mapId !== map) return World.p.x === tx && World.p.y === ty;
        }
        return false;
      },
      async step(c) { await LMDebug.walk(c); await LMDebug.ff(2); },
      // Geht durch die Tür der aktuellen Karte, die zur Karte toMap führt. Liefert true, wenn man danach dort ist.
      async door(toMap) { const w = World.map.warps.find(w => w.toMap === toMap); if (!w || !(await Bot.goto(w.x, w.y + 1))) return false; await Bot.step('U'); await Bot.free(); await LMDebug.ff(10); return World.mapId === toMap; },
      // Verlässt einen Innenraum über die Fussmatte. Liefert die neue Karten-ID.
      async out() { const w = World.map.warps.find(w => w.kind === 'push'); await Bot.goto(w.x, w.y); await Bot.step('D'); await Bot.free(); await LMDebug.ff(10); return World.mapId; },
      // Läuft über den Kartenrand in Richtung dir (north|south|west|east) auf die Nachbarkarte toMap.
      async edge(dir, toMap) {
        const m = World.map, cells = []; for (let i = 0; i < (dir === 'east' || dir === 'west' ? m.h : m.w); i++) { const x = dir === 'east' ? m.w - 1 : dir === 'west' ? 0 : i, y = dir === 'south' ? m.h - 1 : dir === 'north' ? 0 : i; if (!World.cellSolid(x, y)) cells.push([x, y]); }
        for (const [x, y] of cells) { if (await Bot.goto(x, y)) { await Bot.step({ east: 'R', west: 'L', north: 'U', south: 'D' }[dir]); await Bot.free(); await LMDebug.ff(5); } if (World.mapId === toMap) return true; }
        return false;
      },
      ent(id) { return World.ents.find(e => e.def.id === id); },
      async talk(dir) { if (dir) World.p.dir = dir; await LMDebug.press('a', 3); },
      text() { return UI.tb.lines.join(' ') + ' ' + UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items.map(i => typeof i === 'string' ? i : i.label).join('/')).join(' ## '); },
      st() { return JSON.stringify({ map: World.mapId, x: World.p.x, y: World.p.y, lock: World.lock, battle: Battle.active, party: G.party.map(m => m.species + ':' + m.level + ':' + m.hp), money: G.money, bag: G.bag, badges: G.badges }); }
    };
  });
}
module.exports.installBot = installBot;

// Startet ein neues Spiel und klickt das Intro durch, bis der Spieler im Zimmer steht.
async function newGame(page) {
  await ff(page, 20); await press(page, 'a', 10);
  const items = await page.evaluate(() => UI.layers.filter(l => l.o && l.o.items).map(l => l.o.items)[0]);
  const idx = items.indexOf('NEUES SPIEL'); for (let i = 0; i < idx; i++) await press(page, 'down', 3);
  await press(page, 'a', 30);
  if (idx > 0) { await press(page, 'up', 3); await press(page, 'a', 30); }   // Sicherheitsfrage "Trotzdem neues Spiel?" -> JA
  await mash(page, "UI.layers.some(l => l.draw && String(l.draw).includes('NAME_PAGES'))", 3000);
  await press(page, 'start', 4); await press(page, 'a', 8);                 // Standardname
  await mash(page, "World.active && !World.lock && Gfx.fade === 0", 8000);   // Rivalenname, Schwierigkeitsstufe (Vorgabe MITTEL), Abschlusstext
  await installBot(page);
}
module.exports.newGame = newGame;
