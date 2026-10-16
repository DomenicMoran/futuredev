/**
 * Supplemental native matrix evidence (download/offline, empty player, settings backup).
 * Assumes FutureDev is already installed and foreground-ready on the target emulator.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createAdbRunner, captureFreshXml, capturePng } = require('./native-evidence.cjs');

const args = process.argv.slice(2);
const serial = args[args.indexOf('--serial') + 1] || 'emulator-5566';
const outRel = args[args.indexOf('--out') + 1];
if (!outRel) throw new Error('Required: --out <dir beneath tmp-qa>');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(ROOT, outRel);
const qaRoot = path.resolve(ROOT, 'tmp-qa');
const rel = path.relative(qaRoot, OUT);
if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
  throw new Error('Output must be beneath tmp-qa');
}
fs.mkdirSync(OUT, { recursive: true });

const PKG = 'de.domenicmoran.futuredev';
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const runAdb = createAdbRunner(adb, serial);

const checks = [];

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

function tap(x, y) {
  sh(`"${adb}" -s ${serial} shell input tap ${Math.round(x)} ${Math.round(y)}`);
  sleep(1600);
}

function dump(name) {
  const xml = captureFreshXml(runAdb, { attempts: 5 });
  fs.writeFileSync(path.join(OUT, `${name}.xml`), xml, 'utf8');
  capturePng(runAdb, path.join(OUT, `${name}.png`));
  return xml;
}

function tab(label) {
  const coords = { Start: [108, 2264], Lernen: [324, 2264], Hören: [540, 2264], Üben: [756, 2264], Ich: [972, 2264] };
  const c = coords[label];
  if (c) tap(c[0], c[1]);
}

function tapTestId(xml, idFragment) {
  const re = new RegExp(`resource-id="[^"]*${idFragment}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`);
  const m = xml.match(re);
  if (!m) return false;
  tap((+m[1] + +m[3]) / 2, (+m[2] + +m[4]) / 2);
  return true;
}

function record(name, pass, detail, evidenceBase) {
  checks.push({
    name,
    pass,
    detail,
    evidence: evidenceBase ? [`${evidenceBase}.xml`, `${evidenceBase}.png`] : [],
  });
}

// --- offline download path ---
tab('Hören');
sleep(2200);
let xml = dump('matrix-01-hoeren');
tapTestId(xml, 'audio-tools-toggle');
sleep(800);
xml = dump('matrix-02-tools-expanded');
tapTestId(xml, 'download-module-M01-00');
sleep(12000);
xml = dump('matrix-03-after-module-download');
const batchSummary = xml.includes('audio-batch-summary') || xml.includes('offline verfügbar');
const downloadStarted = batchSummary || xml.includes('Downloads laufen');
tapTestId(xml, 'audio-filter-offline');
sleep(2000);
xml = dump('matrix-04-offline-filter');
const offlineUi =
  xml.includes('audio-filter-offline') ||
  xml.includes('Offline') ||
  xml.includes('hearing-status-M01-00-01');
record(
  'Offline download or filter path',
  downloadStarted || offlineUi,
  downloadStarted ? 'module batch download triggered' : offlineUi ? 'offline filter visible' : 'could not reach download UI',
  'matrix-04-offline-filter',
);

// --- empty player ---
sh(
  `"${adb}" -s ${serial} shell am start -a android.intent.action.VIEW -d "futuredev://player" -f 0x24000000 ${PKG}`,
);
sleep(3500);
xml = dump('matrix-05-empty-player');
const emptyPlayer = xml.includes('Noch keine Wiedergabe') || xml.includes('Zur Audioübersicht');
record(
  'Empty player state',
  emptyPlayer,
  emptyPlayer ? 'empty copy visible' : 'player route did not show empty state',
  'matrix-05-empty-player',
);

// --- settings backup entry ---
sh(`"${adb}" -s ${serial} shell am start -a android.intent.action.VIEW -d "futuredev://settings" ${PKG}`);
sleep(3500);
xml = dump('matrix-06-settings');
const backupEntry = xml.includes('Backup als Datei speichern') || xml.includes('exportTitle');
record(
  'Settings backup/export entry',
  backupEntry,
  backupEntry ? 'export/backup actions listed' : 'settings screen missing backup row',
  'matrix-06-settings',
);

const summary = {
  serial,
  completedAt: new Date().toISOString(),
  checks,
  status: checks.every((c) => c.pass) ? 'pass' : 'fail',
};
fs.writeFileSync(path.join(OUT, 'matrix-extra-result.json'), JSON.stringify(summary, null, 2), 'utf8');
process.exit(summary.status === 'pass' ? 0 : 1);
