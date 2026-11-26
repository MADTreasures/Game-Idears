// Das ausgelieferte Grundspiel muss die Editor-Validierung ohne Fehler bestehen.
const { chromium } = require('playwright'); const path = require('path');
const FILE = process.env.LM_FILE || path.join(__dirname, '..', 'Leinenmeister.html');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + FILE); await page.waitForFunction(() => typeof Engine !== 'undefined' && Engine.ticks > 5);
  const issues = await page.evaluate(() => Editor.validate().map(i => i.level + ': ' + i.msg));
  const errs = issues.filter(i => i.indexOf('error') === 0);
  console.log((errs.length ? 'FAIL ' : 'PASS ') + 'Validierung des Grundspiels: ' + errs.length + ' Fehler, ' + (issues.length - errs.length) + ' Hinweise');
  for (const i of issues) console.log('   ' + i);
  const robust = await page.evaluate(() => { const d = JSON.parse(JSON.stringify(DB)); d.monsters.push(null); d.maps[0].npcs.push(null); d.items.push(null); try { Data.init(d); return DB.monsters.every(Boolean) && DB.maps[0].npcs.every(Boolean); } catch (e) { return String(e); } });
  console.log((robust === true ? 'PASS ' : 'FAIL ') + 'Defekte (null-)Einträge werden beim Laden verworfen: ' + robust);
  console.log('errors:', errors.join('\n') || 'keine'); if (errs.length || robust !== true) process.exitCode = 1;
  await browser.close();
})();
