const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseRunArgs, fileSha256, prepareRun, verifyInstalledVersion, verifyInstalledArtifact, verifyLegacyDisplay, captureFreshXml, capturePng } = require('./native-evidence.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'futuredev-evidence-test-'));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('futuredev-evidence-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const apk = path.join(root, 'test.apk');
  fs.writeFileSync(apk, 'synthetic APK fixture');
  const flags = ['--serial', 'emulator-5562', '--avd', 'futuredev_audit_20260925', '--apk', apk,
    '--sha256', fileSha256(apk), '--version', '0.1.22', '--version-code', '22', '--out', 'tmp-qa/new-run', '--mode', 'upgrade'];
  return { root, apk, flags, config: parseRunArgs(flags, root) };
}

test('explicit artifact, device, fresh output, version and mode are mandatory', t => {
  const { root, flags } = fixture(t);
  assert.throws(() => parseRunArgs([], root), /Missing/);
  assert.throws(() => parseRunArgs(['test.apk'], root), /explicit/);
  assert.throws(() => parseRunArgs([...flags, '--serial', 'emulator-5560'], root), /explicit/);
  assert.throws(() => parseRunArgs(flags.map(x => x === 'emulator-5562' ? 'emulator-5562;echo bad' : x), root), /serial/);
  assert.throws(() => parseRunArgs(flags.map(x => x === 'tmp-qa/new-run' ? '../outside' : x), root), /Output/);
});

test('hash mismatch fails before even contacting device', t => {
  const { config } = fixture(t);
  let calls = 0;
  assert.throws(() => prepareRun({ ...config, sha256: '0'.repeat(64) }, () => { calls++; }), /SHA256/);
  assert.equal(calls, 0);
  assert.equal(fs.existsSync(config.out), false);
});

test('wrong AVD is rejected before any install or clearing', t => {
  const { config } = fixture(t);
  const calls = [];
  assert.throws(() => prepareRun(config, args => { calls.push(args); return args[0] === 'get-state' ? 'device' : 'unrelated_avd\nOK\n'; }), /AVD mismatch/);
  assert.deepEqual(calls.map(x => x[0]), ['get-state', 'emu']);
  assert.equal(fs.existsSync(config.out), false);
});

test('preflight writes provenance but cannot reuse an output directory', t => {
  const { config } = fixture(t);
  const adb = args => args[0] === 'get-state' ? 'device\n' : `${config.avd}\r\r\nOK\r\n`;
  prepareRun(config, adb);
  const record = JSON.parse(fs.readFileSync(path.join(config.out, 'run-manifest.json'), 'utf8'));
  assert.equal(record.status, 'started-not-passed');
  assert.equal(record.sha256, config.sha256);
  assert.throws(() => prepareRun(config, adb), /already exists/);
});

test('installed version is verified independently of caller assertion', t => {
  const { config } = fixture(t);
  verifyInstalledVersion(config, () => 'versionCode=22 minSdk=24\nversionName=0.1.22', 'fixture');
  assert.throws(() => verifyInstalledVersion(config, () => 'versionCode=21\nversionName=0.1.21', 'fixture'), /mismatch/);
});

test('same version but different installed APK bytes cannot pass artifact gate', t => {
  const { config } = fixture(t);
  fs.mkdirSync(config.out, { recursive: true });
  const adb = args => {
    if (args.includes('dumpsys')) return 'versionCode=22\nversionName=0.1.22';
    if (args.includes('path')) return 'package:/data/app/fixture/base.apk\n';
    if (args[0] === 'pull') { fs.writeFileSync(args[2], 'different APK'); return 'pulled'; }
    throw new Error('unexpected adb call');
  };
  assert.throws(() => verifyInstalledArtifact(config, adb, 'fixture'), /bytes do not match/);
});

test('coordinate walk rejects unsupported override geometry or enlarged fonts', () => {
  const makeAdb = (density, font) => args => args.includes('size') ? 'Physical size: 1080x2400' : args.includes('density') ? density : font;
  assert.equal(verifyLegacyDisplay(makeAdb('Physical density: 420', '1.0')).fontScale, 1);
  assert.throws(() => verifyLegacyDisplay(makeAdb('Physical density: 420\nOverride density: 480', '1.0')), /requires/);
  assert.throws(() => verifyLegacyDisplay(makeAdb('Physical density: 420', '2.0')), /requires/);
});

test('zero-exit failed dump never reads a stale XML file', () => {
  const calls = [];
  const oldXml = '<hierarchy><node text="OLD PASS"/></hierarchy>';
  assert.throws(() => captureFreshXml(args => {
    calls.push(args);
    if (args.includes('cat')) return oldXml;
    if (args.includes('dump')) return 'ERROR: could not get idle state.';
    return '';
  }, { attempts: 2 }), /Fresh UI capture failed/);
  assert.equal(calls.some(args => args.includes('cat')), false);
  const targets = calls.filter(args => args.includes('dump')).map(args => args.at(-1));
  assert.equal(new Set(targets).size, 2);
  assert.equal(targets.some(p => p.includes('window_dump')), false);
});

test('nonzero dump failure never pulls stale file', () => {
  let reads = 0;
  assert.throws(() => captureFreshXml(args => {
    if (args.includes('dump')) throw new Error('adb failed');
    if (args.includes('cat')) reads++;
    return '';
  }, { attempts: 1 }), /adb failed/);
  assert.equal(reads, 0);
});

test('successful dump must confirm this exact fresh path', () => {
  assert.throws(() => captureFreshXml(() => 'UI hierchary dumped to: /sdcard/window_dump.xml', { attempts: 1 }), /did not confirm/);
});

test('malformed fresh XML is not accepted and each retry has a new path', () => {
  let attempt = 0;
  const seen = [];
  const valid = '<?xml version="1.0"?><hierarchy rotation="0"><node text="fresh"/></hierarchy>';
  const result = captureFreshXml(args => {
    if (args.includes('dump')) { attempt++; seen.push(args.at(-1)); return `UI hierchary dumped to: ${args.at(-1)}`; }
    if (args.includes('cat')) return attempt === 1 ? '<hierarchy><node' : valid;
    return '';
  });
  assert.equal(result, valid);
  assert.equal(new Set(seen).size, 2);
});

test('screenshots must be fresh PNG and cannot overwrite evidence', t => {
  const { root } = fixture(t);
  const target = path.join(root, 'screen.png');
  assert.throws(() => capturePng(() => Buffer.from('not png'), target), /not a PNG/);
  assert.equal(fs.existsSync(target), false);
  const png = Buffer.from([137,80,78,71,13,10,26,10,0]);
  capturePng(() => png, target);
  assert.throws(() => capturePng(() => png, target), /EEXIST/);
});
