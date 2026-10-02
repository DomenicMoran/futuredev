/** Fail-closed native evidence primitives. Importing this module performs no device action. */
const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

function parseRunArgs(args, root) {
  const allowed = new Set(['serial', 'avd', 'apk', 'sha256', 'version', 'version-code', 'out', 'mode']);
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i]?.replace(/^--/, '');
    if (!args[i]?.startsWith('--') || !allowed.has(name) || values[name] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error('Required explicit flags: --serial --avd --apk --sha256 --version --version-code --out --mode (clean|upgrade)');
    }
    values[name] = args[i + 1];
  }
  for (const key of allowed) if (!values[key]) throw new Error(`Missing required --${key}`);
  if (!/^emulator-\d+$/.test(values.serial)) throw new Error('An explicitly named emulator serial is required');
  if (!/^[A-Za-z0-9_.-]+$/.test(values.avd)) throw new Error('Invalid expected AVD name');
  if (!/^[a-fA-F0-9]{64}$/.test(values.sha256)) throw new Error('Invalid SHA256');
  if (!/^\d+\.\d+\.\d+$/.test(values.version) || !/^\d+$/.test(values['version-code'])) throw new Error('Invalid expected APK version');
  if (!['clean', 'upgrade'].includes(values.mode)) throw new Error('Mode must be clean or upgrade');
  const out = path.resolve(root, values.out);
  const qaRoot = path.resolve(root, 'tmp-qa');
  const relative = path.relative(qaRoot, out);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Output must be a new directory beneath this repo tmp-qa');
  return { ...values, apk: path.resolve(root, values.apk), out, sha256: values.sha256.toLowerCase() };
}

function fileSha256(file) {
  const fd = fs.openSync(file, 'r');
  const hash = nodeCrypto.createHash('sha256');
  const chunk = Buffer.alloc(1024 * 1024);
  try {
    let size;
    while ((size = fs.readSync(fd, chunk, 0, chunk.length, null)) > 0) hash.update(chunk.subarray(0, size));
    return hash.digest('hex');
  } finally { fs.closeSync(fd); }
}

function createAdbRunner(adb, serial) {
  return (args, encoding = 'utf8') => execFileSync(adb, ['-s', serial, ...args], {
    encoding, timeout: 45000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function prepareRun(config, runAdb) {
  if (fs.existsSync(config.out)) throw new Error('Evidence directory already exists; choose a fresh output directory');
  if (fileSha256(config.apk) !== config.sha256) throw new Error('APK SHA256 mismatch; no device modification performed');
  if (String(runAdb(['get-state'])).trim() !== 'device') throw new Error('Selected emulator is not ready');
  const avd = String(runAdb(['emu', 'avd', 'name'])).split('\n').map(line => line.trim()).filter(line => line && line !== 'OK')[0];
  if (avd !== config.avd) throw new Error(`AVD mismatch: expected ${config.avd}, observed ${avd}`);
  fs.mkdirSync(config.out, { recursive: true });
  fs.writeFileSync(path.join(config.out, 'run-manifest.json'), JSON.stringify({
    ...config, startedAt: new Date().toISOString(), status: 'started-not-passed',
    scope: 'legacy scripted smoke checks; not exhaustive visual or accessibility acceptance',
  }, null, 2), { flag: 'wx' });
}

function verifyInstalledVersion(config, runAdb, packageName) {
  const result = String(runAdb(['shell', 'dumpsys', 'package', packageName]));
  const name = result.match(/\bversionName=([^\s]+)/)?.[1];
  const code = result.match(/\bversionCode=(\d+)/)?.[1];
  if (name !== config.version || code !== config['version-code']) {
    throw new Error(`Installed APK version mismatch: ${name}/${code}; expected ${config.version}/${config['version-code']}`);
  }
}

function verifyInstalledArtifact(config, runAdb, packageName) {
  verifyInstalledVersion(config, runAdb, packageName);
  const packages = String(runAdb(['shell', 'pm', 'path', packageName])).split('\n').map(x => x.trim()).filter(Boolean);
  if (packages.length !== 1 || !packages[0].startsWith('package:/')) throw new Error('Expected one installed base APK, not an unknown/split package');
  const target = path.join(config.out, 'installed-base.apk');
  if (fs.existsSync(target)) throw new Error('Installed artifact evidence already exists');
  runAdb(['pull', packages[0].slice('package:'.length), target]);
  if (fileSha256(target) !== config.sha256) throw new Error('Installed APK bytes do not match the requested SHA256');
}

function verifyLegacyDisplay(runAdb) {
  const sizeOutput = String(runAdb(['shell', 'wm', 'size']));
  const densityOutput = String(runAdb(['shell', 'wm', 'density']));
  const fontScale = Number(String(runAdb(['shell', 'settings', 'get', 'system', 'font_scale'])).trim());
  const size = [...sizeOutput.matchAll(/(?:Physical|Override) size:\s*(\d+)x(\d+)/g)].at(-1);
  const density = [...densityOutput.matchAll(/(?:Physical|Override) density:\s*(\d+)/g)].at(-1);
  if (!size || size[1] !== '1080' || size[2] !== '2400' || density?.[1] !== '420' || fontScale !== 1) {
    throw new Error('Legacy coordinate walk requires 1080x2400, density 420, font scale 1. No install/clear performed.');
  }
  return { sizeOutput, densityOutput, fontScale };
}

function captureFreshXml(runAdb, { attempts = 3, uuid = nodeCrypto.randomUUID } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    const remote = `/sdcard/futuredev-evidence-${uuid()}.xml`;
    try {
      // Never pull a historical fixed path after failure, even if adb exit code was zero.
      const output = String(runAdb(['shell', 'uiautomator', 'dump', remote]));
      if (!/UI (?:hierchary|hierarchy) dumped to:/.test(output) || !output.includes(remote)) {
        throw new Error('uiautomator did not confirm this fresh dump');
      }
      const xml = String(runAdb(['shell', 'cat', remote]));
      if (!/^\s*(?:<\?xml[^>]*>\s*)?<hierarchy\b/.test(xml) || !xml.trimEnd().endsWith('</hierarchy>') || !xml.includes('<node')) {
        throw new Error('Invalid or empty fresh UI hierarchy');
      }
      return xml;
    } catch (error) { lastError = error; }
    finally {
      try { runAdb(['shell', 'rm', '-f', remote]); } catch { /* own ephemeral remote file only */ }
    }
  }
  throw new Error(`Fresh UI capture failed: ${lastError?.message ?? 'unknown failure'}`, { cause: lastError });
}

function capturePng(runAdb, target) {
  const data = runAdb(['exec-out', 'screencap', '-p'], null);
  if (!Buffer.isBuffer(data) || !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new Error('Fresh screenshot is not a PNG');
  }
  fs.writeFileSync(target, data, { flag: 'wx' });
}

module.exports = { parseRunArgs, fileSha256, createAdbRunner, prepareRun, verifyInstalledVersion, verifyInstalledArtifact, verifyLegacyDisplay, captureFreshXml, capturePng };
