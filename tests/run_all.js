// Führt alle Tests nacheinander aus und fasst das Ergebnis zusammen:  node tests/run_all.js
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const files = fs.readdirSync(__dirname).filter(f => /^t\d\d_.*\.js$/.test(f)).sort();
let pass = 0, fail = 0; const failed = [];
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 300000 });
  const out = (r.stdout || '') + (r.stderr || ''), p = (out.match(/^(PASS |  ok   )/gm) || []).length, fl = (out.match(/^(FAIL |  FAIL )/gm) || []).length;
  const errLine = /errors: (?!keine)/.test(out) || r.status !== 0;
  pass += p; fail += fl + (errLine && !fl ? 1 : 0);
  console.log((fl || errLine ? 'FEHLER ' : 'ok     ') + f + '  (' + p + ' bestanden, ' + fl + ' fehlgeschlagen)');
  if (fl || errLine) { failed.push(f); console.log(out.split('\n').filter(l => !/^(PASS |  ok   )/.test(l)).join('\n')); }
}
console.log('\nGESAMT: ' + pass + ' bestanden, ' + fail + ' fehlgeschlagen' + (failed.length ? ' -> ' + failed.join(', ') : ''));
process.exit(fail ? 1 : 0);
