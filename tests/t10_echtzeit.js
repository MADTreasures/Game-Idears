// Echtzeit-Test: echte Tastatur-Events, echte requestAnimationFrame-Schleife (kein Vorspulen).
const { chromium } = require('playwright'); require('fs').mkdirSync(require('path').join(__dirname, 'out'), { recursive: true }); const path = require('path');
const FILE = process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + FILE); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 30);
  const t0 = await page.evaluate(() => Engine.ticks); await page.waitForTimeout(1000); const t1 = await page.evaluate(() => Engine.ticks);
  ok(t1 - t0 > 40 && t1 - t0 < 70, 'Spielschleife läuft mit ca. 60 Ticks/s: ' + (t1 - t0));
  await page.evaluate(() => { Opt.text = 2; });
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(60); await page.keyboard.up(k); await page.waitForTimeout(ms || 150); };
  await tap('Enter', 400); await tap('KeyZ', 600);                       // Titel -> NEUES SPIEL
  for (let i = 0; i < 60 && !(await page.evaluate(() => UI.layers.some(l => String(l.draw).includes('NAME_PAGES')))); i++) await tap('KeyZ', 120);
  ok(await page.evaluate(() => UI.layers.some(l => String(l.draw).includes('NAME_PAGES'))), 'Namenseingabe per Tastatur erreicht');
  await tap('KeyZ'); await tap('ArrowRight'); await tap('ArrowDown'); await tap('KeyZ'); await tap('KeyX'); await tap('KeyM'); await tap('Enter', 300);
  for (let i = 0; i < 80 && !(await page.evaluate(() => World.active && !World.lock && Gfx.fade === 0)); i++) await tap('KeyZ', 120);
  ok(await page.evaluate(() => World.active && G.name === 'A'), 'Name eingegeben (A, K wieder gelöscht): ' + await page.evaluate(() => G && G.name));
  const p0 = await page.evaluate(() => World.p.x);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight'); await page.waitForTimeout(400);
  const p1 = await page.evaluate(() => World.p.x);
  ok(p1 === p0 + 2, 'Laufen mit gehaltener Pfeiltaste (bis zur Pflanze): x ' + p0 + ' -> ' + p1);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(40); await page.keyboard.up('KeyW'); await page.waitForTimeout(300);
  ok(await page.evaluate(() => World.p.dir === 'up' && World.p.y === 4), 'Kurzes Antippen dreht nur die Figur (WASD)');
  await tap('KeyM', 300); ok(await page.evaluate(() => World.lock > 0 && UI.layers.length === 1), 'M öffnet das Hauptmenü'); await tap('Escape', 300);
  ok(await page.evaluate(() => World.lock === 0), 'Escape schliesst das Menü');
  await page.screenshot({ path: path.join(__dirname, 'out', 'desktop.png') });
  console.log('errors:', errors.length ? errors.join('\n') : 'keine');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
