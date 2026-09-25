/**
 * FutureDev UX pixel audit — numbered PNGs + UI dumps for visual review.
 * Usage: node run-ux-pixel-audit.cjs [apk-path]
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/rnb/FutureDev';
const adb = String.raw`C:\Users\domen\AppData\Local\Android\Sdk\platform-tools\adb.exe`;
const SER = 'emulator-5560';
const PKG = 'de.domenicmoran.futuredev';
const OUT = path.join(ROOT, 'tmp-qa/ux-pixel-2026-09-25');
const VERSION = process.env.FUTUREDEV_APK_VERSION || '0.1.18';
const DEFAULT_APK = path.join(ROOT, `tmp-qa/apk/futuredev-v${VERSION}-x86_64-emulator.apk`);
const APK = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_APK;

const TAB_COORDS = {
  Start: [108, 2264],
  Lernen: [324, 2264],
  Hören: [540, 2264],
  Üben: [756, 2264],
  Ich: [972, 2264],
};

const findings = [];
let shotN = 0;
let lastGoodUiXml = '';

function sh(cmd, { retries = 3, delayMs = 1200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      lastErr = err;
      if (attempt + 1 < retries) sleep(delayMs);
    }
  }
  throw lastErr;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function tap(x, y) {
  sh(`"${adb}" -s ${SER} shell input tap ${Math.round(x)} ${Math.round(y)}`);
  sleep(1800);
}

function swipe(x1, y1, x2, y2, ms = 350) {
  sh(`"${adb}" -s ${SER} shell input swipe ${x1} ${y1} ${x2} ${y2} ${ms}`);
  sleep(900);
}

function scrollDown(n = 1) {
  for (let i = 0; i < n; i++) swipe(540, 1700, 540, 700, 350);
}

function scrollUp(n = 1) {
  for (let i = 0; i < n; i++) swipe(540, 700, 540, 1700, 350);
}

function parseAllNodes(xml) {
  const nodes = [];
  const re = /<node\b([^>]*)\/>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const boundsM = attrs.match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (!boundsM) continue;
    const textM = attrs.match(/\btext="([^"]*)"/);
    const descM = attrs.match(/\bcontent-desc="([^"]*)"/);
    const hintM = attrs.match(/\bhint="([^"]*)"/);
    const classM = attrs.match(/\bclass="([^"]*)"/);
    const pkgM = attrs.match(/\bpackage="([^"]*)"/);
    const resM = attrs.match(/\bresource-id="([^"]*)"/);
    const selM = attrs.match(/\bselected="([^"]*)"/);
    const x1 = +boundsM[1];
    const y1 = +boundsM[2];
    const x2 = +boundsM[3];
    const y2 = +boundsM[4];
    nodes.push({
      text: textM ? textM[1] : '',
      desc: descM ? descM[1] : '',
      hint: hintM ? hintM[1] : '',
      className: classM ? classM[1] : '',
      package: pkgM ? pkgM[1] : '',
      resourceId: resM ? resM[1] : '',
      selected: selM ? selM[1] === 'true' : false,
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
      y1,
      y2,
      x1,
      x2,
    });
  }
  return nodes;
}

function killHungUiautomator() {
  try {
    sh(`"${adb}" -s ${SER} shell pkill -f uiautomator`, { retries: 1, delayMs: 200 });
  } catch {
    /* */
  }
  sleep(400);
}

function dumpUiRaw({ allowStale = true } = {}) {
  sleep(400);
  let lastErr;
  const local = path.join(OUT, '_ui_live.xml');
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      try {
        execSync(`"${adb}" -s ${SER} shell uiautomator dump /sdcard/window_dump.xml`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        /* */
      }
      sleep(350 + attempt * 120);
      sh(`"${adb}" -s ${SER} pull /sdcard/window_dump.xml "${local.replace(/\\/g, '/')}"`, {
        retries: 3,
        delayMs: 900 + attempt * 400,
      });
      const fresh = fs.readFileSync(local, 'utf8');
      if (fresh.includes('<hierarchy') && fresh.includes(`package="${PKG}"`)) {
        lastGoodUiXml = fresh;
      }
      if (fresh.includes('<hierarchy')) return fresh;
      lastErr = new Error('empty hierarchy');
    } catch (err) {
      lastErr = err;
      if (attempt >= 4) killHungUiautomator();
      sleep(1200 + attempt * 700);
    }
  }
  if (allowStale && lastGoodUiXml) return lastGoodUiXml;
  throw lastErr ?? new Error('uiautomator dump failed');
}

function pressBack() {
  sh(`"${adb}" -s ${SER} shell input keyevent 4`);
  sleep(1200);
}

function capture(label) {
  shotN += 1;
  const num = String(shotN).padStart(2, '0');
  const base = `${num}-${label}`;
  const remote = `/sdcard/ux-${base}.png`;
  sh(`"${adb}" -s ${SER} shell screencap -p ${remote}`);
  const png = path.join(OUT, `${base}.png`);
  sh(`"${adb}" -s ${SER} pull ${remote} "${png.replace(/\\/g, '/')}"`);
  const xml = dumpUiRaw();
  fs.writeFileSync(path.join(OUT, `${base}.xml`), xml, 'utf8');
  console.log('CAPTURE', base);
  return { png, xml, base };
}

function tapNode(node, label) {
  tap(node.x, node.y);
  console.log('TAP', label);
  return true;
}

function tapTextOrDesc(needle, { partial = false } = {}) {
  const xml = dumpUiRaw();
  const pred = (n) => {
    const t = n.text || '';
    const d = n.desc || '';
    if (partial) return t.includes(needle) || d.includes(needle);
    return t === needle || d === needle || d.startsWith(`${needle},`);
  };
  const hits = parseAllNodes(xml).filter(pred).sort((a, b) => a.y - b.y);
  if (!hits.length) return false;
  return tapNode(hits[0], needle);
}

function tapExact(label, { bottom = false } = {}) {
  const xml = dumpUiRaw();
  let hits = parseAllNodes(xml).filter(
    (n) => n.text === label || n.desc === label || n.desc.startsWith(`${label},`),
  );
  hits.sort((a, b) => (bottom ? b.y - a.y : a.y - b.y));
  if (!hits.length) return false;
  return tapNode(hits[0], label);
}

function tapTestId(idFragment, { bottom = false } = {}) {
  const xml = dumpUiRaw();
  const hits = parseAllNodes(xml)
    .filter((n) => n.package === PKG && n.resourceId.includes(idFragment))
    .sort((a, b) => (bottom ? b.y - a.y : a.y - b.y));
  if (!hits.length) return false;
  return tapNode(hits[0], idFragment);
}

function tapOption(label) {
  const xml = dumpUiRaw();
  let hits = parseAllNodes(xml).filter(
    (n) =>
      n.package === PKG &&
      (n.desc.startsWith(`${label}.`) || n.desc === label || n.text === label),
  );
  hits.sort((a, b) => b.desc.length - a.desc.length || a.y - b.y);
  if (hits.length) return tapNode(hits[0], label);
  return tapTextOrDesc(label, { partial: true });
}

function dismissDialogs(max = 6) {
  for (let i = 0; i < max; i++) {
    const xml = dumpUiRaw();
    if (xml.includes('alert_title')) {
      tapExact('ABBRECHEN') || tapExact('OK');
      sleep(600);
      continue;
    }
    if (xml.includes('Lesezeichen konnte nicht') || xml.includes('Speichern fehlgeschlagen')) {
      tapExact('OK');
      sleep(600);
      continue;
    }
    break;
  }
}

function grantRuntimePermissions() {
  try {
    sh(`"${adb}" -s ${SER} shell pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
  } catch {
    /* */
  }
}

function relaunchApp() {
  sh(`"${adb}" -s ${SER} shell am force-stop ${PKG}`);
  sleep(800);
  sh(`"${adb}" -s ${SER} shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  sleep(4500);
  dismissDialogs(4);
}

function ensureForeground() {
  for (let i = 0; i < 6; i++) {
    if (dumpUiRaw().includes(`package="${PKG}"`)) return true;
    relaunchApp();
  }
  return false;
}

function hasMainTabs(xml) {
  return xml.includes('content-desc="Start"') && xml.includes('content-desc="Lernen"');
}

function isOnboardingXml(xml) {
  return (
    xml.includes('Wofür lernst du?') ||
    xml.includes('Wie möchtest du starten?') ||
    xml.includes('Wie viel Zeit hast du täglich?')
  );
}

function isHomeXml(xml) {
  return hasMainTabs(xml) && !isOnboardingXml(xml);
}

function isLessonReaderXml(xml) {
  return xml.includes('Quiz zu dieser Lektion') && xml.includes('Sprecher');
}

function tabByLabel(label) {
  ensureForeground();
  const xml = dumpUiRaw();
  const tabHits = parseAllNodes(xml)
    .filter(
      (n) =>
        n.package === PKG &&
        (n.desc === label || n.desc.startsWith(`${label},`) || n.text === label) &&
        n.y1 > 2100,
    )
    .sort((a, b) => Math.abs(a.x - TAB_COORDS[label]?.[0]) - Math.abs(b.x - TAB_COORDS[label]?.[0]));
  if (tabHits.length) return tapNode(tabHits[0], `tab:${label}`);
  const coords = TAB_COORDS[label];
  if (coords) {
    tap(coords[0], coords[1]);
    return true;
  }
  return tapTextOrDesc(label);
}

function waitForText(substr, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const xml = dumpUiRaw();
    if (xml.includes(substr)) return true;
    sleep(700);
  }
  return false;
}

function deepLinkLesson() {
  sh(
    `"${adb}" -s ${SER} shell am start -a android.intent.action.VIEW -d "futuredev://lesson/M01-01-01" -f 0x24000000 ${PKG}`,
  );
  sleep(5500);
  dismissDialogs(3);
}

function installFresh() {
  sh(`"${adb}" -s ${SER} install -r "${APK.replace(/\\/g, '/')}"`);
  sh(`"${adb}" -s ${SER} shell pm clear ${PKG}`);
  grantRuntimePermissions();
  sh(`"${adb}" -s ${SER} shell am force-stop ${PKG}`);
  sh(`"${adb}" -s ${SER} shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  sleep(1200);
  capture('cold-start-splash');
  sleep(8000);
  grantRuntimePermissions();
  dismissDialogs(6);
  ensureForeground();
}

function runOnboardingCaptures() {
  let xml = dumpUiRaw();
  if (isHomeXml(xml)) {
    capture('onboarding-skipped-already-home');
    return;
  }
  waitForText('Wofür lernst du', 25000);
  capture('onboarding-step1');
  tapOption('Freies Interesse') || tap(540, 2014);
  sleep(1500);
  waitForText('Wie möchtest du starten', 20000);
  capture('onboarding-step2');
  tapOption('Lesen zuerst') || tap(540, 1217);
  sleep(800);
  scrollDown(2);
  tapOption('Morgens') || tap(540, 2044);
  sleep(1200);
  tapTestId('onboarding-step2-weiter', { bottom: true }) || tapExact('Weiter', { bottom: true });
  sleep(2000);
  waitForText('Wie viel Zeit', 20000);
  capture('onboarding-step3');
  tapOption('20 Minuten') || tapOption('40 Minuten');
  sleep(8000);
  dismissDialogs(6);
  for (let i = 0; i < 12; i++) {
    xml = dumpUiRaw();
    if (isHomeXml(xml)) break;
    sleep(2000);
  }
  capture('start-dashboard-after-onboarding');
}

function walkMainTabs() {
  for (const tab of ['Start', 'Lernen', 'Hören', 'Üben', 'Ich']) {
    tabByLabel(tab);
    sleep(2200);
    dismissDialogs(2);
    capture(`tab-${tab.toLowerCase().replace('ü', 'ue').replace('ö', 'oe')}`);
  }
}

function lernenLessonFlow() {
  tabByLabel('Lernen');
  sleep(2500);
  deepLinkLesson();
  sleep(3500);
  capture('lernen-lesson-top');
  if (!tapTextOrDesc('Lesezeichen', { partial: true })) tapTextOrDesc('Lesezeichen gesetzt', { partial: true });
  sleep(1500);
  capture('lernen-bookmark-toggle');
  scrollDown(14);
  sleep(1200);
  capture('lernen-lesson-scrolled-sticky');
}

function hoerenFlow() {
  tabByLabel('Hören');
  sleep(3000);
  scrollUp(5);
  capture('hoeren-playlists');
  tapTestId('playlist-create-button') || tapTextOrDesc('Neue Playlist', { partial: true });
  sleep(2500);
  capture('hoeren-create-playlist-modal');
  pressBack();
  sleep(1500);
  if (tapTextOrDesc('Lektion abspielen', { partial: true })) {
    sleep(6000);
    tabByLabel('Start');
    sleep(2500);
    capture('start-with-miniplayer');
  }
}

function ubenSections() {
  tabByLabel('Üben');
  sleep(2500);
  capture('ueben-top');
  scrollDown(3);
  capture('ueben-scrolled');
  if (tapTextOrDesc('Karteikarten', { partial: true })) {
    sleep(2500);
    capture('ueben-karteikarten');
    pressBack();
    sleep(1500);
  }
}

function ichProfileFlow() {
  tabByLabel('Ich');
  sleep(2500);
  capture('ich-profile');
  if (tapTextOrDesc('Lesezeichen', { partial: true })) {
    sleep(2000);
    capture('ich-lesezeichen');
    pressBack();
    sleep(1200);
  }
  if (tapTextOrDesc('Notizen', { partial: true })) {
    sleep(2000);
    capture('ich-notizen');
    pressBack();
    sleep(1200);
  }
  if (tapTextOrDesc('Einstellungen', { partial: true })) {
    sleep(2500);
    capture('ich-settings');
    scrollDown(2);
    capture('ich-settings-scrolled');
    if (tapTextOrDesc('Tagesziel', { partial: true }) || tapTextOrDesc('Lernintensität', { partial: true })) {
      sleep(2000);
      capture('ich-settings-intensity');
      pressBack();
    }
    pressBack();
    sleep(1200);
  }
  if (tapTextOrDesc('Rechtliches', { partial: true })) {
    sleep(2000);
    capture('ich-rechtliches');
    if (tapTextOrDesc('Impressum', { partial: true })) {
      sleep(2500);
      capture('ich-impressum');
      pressBack();
    }
    pressBack();
  }
}

function miniPlayerExpand() {
  tabByLabel('Start');
  sleep(2000);
  const xml = dumpUiRaw();
  if (xml.includes('mini-player') || xml.includes('Wiedergabe') || xml.includes('Pause')) {
    tapTextOrDesc('Wiedergabe', { partial: true }) || tap(540, 2050);
    sleep(2500);
    capture('miniplayer-expanded');
    pressBack();
    sleep(1500);
    capture('miniplayer-collapsed');
  }
}

function emptyPlaylistError() {
  tabByLabel('Hören');
  sleep(2500);
  const row = parseAllNodes(dumpUiRaw()).find(
    (n) => n.package === PKG && n.desc.includes('Playlist') && n.y1 > 400 && n.y2 < 2000,
  );
  if (row) {
    tapNode(row, 'empty-playlist');
    sleep(2000);
    capture('hoeren-playlist-detail-empty');
  }
}

function writeAuditStub() {
  const md = [
    '# FutureDev UX Pixel Audit',
    '',
    `Date: 2026-09-25`,
    `Version: ${VERSION}`,
    `Emulator: ${SER}`,
    `APK: \`${APK}\``,
    '',
    '## Screens captured',
    '',
    '| # | Screen | PNG |',
    '|---|---|---|',
  ];
  const pngs = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).sort();
  for (const p of pngs) {
    md.push(`| ${p.slice(0, 2)} | ${p.slice(3, -4)} | \`${p}\` |`);
  }
  md.push('', '## Findings', '', '| ID | Screen | Severity | Finding | Status |', '|---|---|---|---|---|');
  md.push('| — | — | — | _Visual review pending_ | — |');
  md.push('');
  fs.writeFileSync(path.join(OUT, 'AUDIT.md'), md.join('\n'), 'utf8');
}

// --- main ---
fs.mkdirSync(OUT, { recursive: true });
console.log('AUDIT OUT', OUT);
console.log('APK', APK);
installFresh();
runOnboardingCaptures();
walkMainTabs();
lernenLessonFlow();
hoerenFlow();
ubenSections();
ichProfileFlow();
miniPlayerExpand();
emptyPlaylistError();
writeAuditStub();
console.log('DONE shots', shotN);
