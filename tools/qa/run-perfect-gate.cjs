/**
 * Legacy scripted native smoke walk, not an exhaustive product release gate.
 * Requires explicit artifact/device/provenance flags; see native-evidence.cjs.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseRunArgs, createAdbRunner, prepareRun, verifyInstalledArtifact, verifyLegacyDisplay, captureFreshXml, capturePng } = require('./native-evidence.cjs');

const ROOT = path.resolve(__dirname, '../..');
const config = parseRunArgs(process.argv.slice(2), ROOT);
const sdk = process.env.ANDROID_HOME || path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
const adb = path.join(sdk, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
const SER = config.serial;
const PKG = 'de.domenicmoran.futuredev';
const OUT = config.out;
const VERSION = config.version;
const APK = config.apk;
const runAdb = createAdbRunner(adb, SER);

const checks = [];
let overallFail = false;
const LOCK_PATH = path.join(OUT, '_gate.lock');
const TAB_COORDS = {
  Start: [108, 2264],
  Lernen: [324, 2264],
  Hören: [540, 2264],
  Üben: [756, 2264],
  Ich: [972, 2264],
};

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

/** Parse uiautomator dump: every node with bounds + text/content-desc. */
function parseNodes(xml) {
  return parseAllNodes(xml).map(({ text, desc, hint, x, y, y1, y2, x1, x2 }) => ({
    text,
    desc,
    hint,
    x,
    y,
    y1,
    y2,
    x1,
    x2,
  }));
}

function parseAllNodes(xml) {
  const nodes = [];
  // Buttons and tab controls often own an SVG child, so uiautomator emits
  // their opening tag rather than a self-closing element. Include both forms;
  // the previous matcher silently made icon-only controls unclickable in QA.
  const re = /<node\b([^>]*?)\/?\s*>/g;
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

function stabilizeUiForDump() {
  try {
    sh(`"${adb}" -s ${SER} shell input keyevent KEYCODE_WAKEUP`);
  } catch {
    /* */
  }
  collapseStatusBar();
  sleep(1200);
}

function dumpUiRaw() {
  sleep(400);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return captureFreshXml(runAdb, { attempts: 4 });
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (!/idle state|Invalid or empty|did not confirm/i.test(msg) || attempt === 3) throw err;
      stabilizeUiForDump();
    }
  }
  throw new Error('Fresh UI capture failed after idle retries');
}

function disableAnimationsForQa() {
  for (const key of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    try {
      sh(`"${adb}" -s ${SER} shell settings put global ${key} 0`);
    } catch {
      /* */
    }
  }
}

function isBottomTabNode(node) {
  return node.y1 >= 2100 || /,\s*Tab\b/.test(node.desc);
}

function dumpUiFresh() {
  return dumpUiRaw();
}

function dumpUi() {
  ensureForeground();
  return dumpUiRaw();
}

function saveDump(name, xml) {
  const target = path.join(OUT, `${name}.xml`);
  if (fs.existsSync(target)) return;
  fs.writeFileSync(target, xml, { encoding: 'utf8', flag: 'wx' });
}

function shot(name) {
  capturePng(runAdb, path.join(OUT, `${name}.png`));
}



function findNodes(xml, pred) {
  return parseNodes(xml).filter(pred);
}

function tapNode(node, label) {
  tap(node.x, node.y);
  console.log('TAP', label, node.text || node.desc, Math.round(node.x), Math.round(node.y));
  return true;
}

function tapOption(label) {
  const xml = dumpUiRaw();
  let hits = parseAllNodes(xml).filter(
    (n) =>
      n.package === PKG &&
      (n.desc.startsWith(`${label}.`) || n.desc === label || n.text === label),
  );
  hits.sort((a, b) => b.desc.length - a.desc.length || a.y - b.y);
  if (hits.length) return tapNode(hits[0], `option:${label}`);
  return tapTextOrDesc(label, { partial: true });
}

function waitForText(substr, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let xml;
    try {
      xml = dumpUiFresh();
    } catch {
      xml = dumpUiRaw();
    }
    if (xml.includes(substr) && xml.includes(`package="${PKG}"`)) return true;
    sleep(700);
  }
  return false;
}

function isLessonReaderXml(xml) {
  return xml.includes('Quiz zu dieser Lektion') && xml.includes('Sprecher');
}

function pressBack() {
  sh(`"${adb}" -s ${SER} shell input keyevent 4`);
  sleep(1200);
}

function ensureHoerenTab() {
  let xml = dumpUiRaw();
  if (
    xml.includes('Meine Wiedergabelisten') &&
    hasMainTabs(xml) &&
    !isLessonReaderXml(xml)
  ) {
    return true;
  }
  if (isLessonReaderXml(xml)) pressBack();
  if (!tabScreenSignals('Hören', xml)) {
    tabByLabel('Hören');
    sleep(1800);
    xml = dumpUiRaw();
  }
  if (
    xml.includes('Meine Wiedergabelisten') &&
    hasMainTabs(xml) &&
    !isLessonReaderXml(xml)
  ) {
    return true;
  }

  // Tab screens keep their ScrollView offset while another tab is active. Move
  // back to the known top anchor before searching down; otherwise a run begun
  // near the last course module can spend every retry swiping past playlists.
  let atListeningTop = false;
  for (let burst = 0; burst < 4 && !atListeningTop; burst++) {
    xml = dumpUiRaw();
    if (xml.includes('Prüfung &amp; Wiederholung öffnen') || xml.includes('Prüfung & Wiederholung öffnen')) {
      atListeningTop = true;
      break;
    }
    if (xml.includes('Meine Wiedergabelisten') && hasMainTabs(xml) && !isLessonReaderXml(xml)) return true;
    // One dump per burst. A per-swipe dump from the last module never finishes
    // inside the gate budget. Finger moves down, so the list moves toward the top.
    for (let swipe = 0; swipe < 8; swipe++) {
      sh(`"${adb}" -s ${SER} shell input swipe 540 900 540 2100 120`);
    }
    sleep(400);
  }
  xml = dumpUiRaw();
  if (xml.includes('Prüfung &amp; Wiederholung öffnen') || xml.includes('Prüfung & Wiederholung öffnen')) {
    atListeningTop = true;
  }
  if (!atListeningTop) {
    console.log('MISS Hören top anchor');
    saveDump('playlist-top-anchor-missing', xml);
  }

  // Playlists live inside the deliberately-collapsed "Downloads & Wiedergabelisten"
  // section, below the listening overview. Scrolling back to the top (the former
  // implementation) can never reveal them and made the smoke test report false
  // product failures without opening the section.
  for (let attempt = 0; attempt < 14; attempt++) {
    xml = dumpUiRaw();
    if (
      xml.includes('Meine Wiedergabelisten') &&
      hasMainTabs(xml) &&
      !isLessonReaderXml(xml)
    ) {
      return true;
    }

    // uiautomator dumps XML-escape the ampersand even though parsed text is
    // decoded. Inspect the raw dump for the escaped form as well.
    if (xml.includes('Downloads &amp; Wiedergabelisten') || xml.includes('Downloads & Wiedergabelisten')) {
      const toolsExpanded = xml.includes('text="−"');
      if (toolsExpanded) {
        scrollDown(1);
      } else {
        tapTestId('audio-tools-toggle') ||
          tapTextOrDesc('Downloads & Wiedergabelisten', { partial: true });
        sleep(800);
      }
    } else {
      scrollDown(1);
    }
  }
  return false;
}



function tapCreatePlaylist() {
  if (tapTestId('playlist-create-button')) return true;
  if (tapTextOrDesc('Neue Playlist anlegen', { partial: true })) return true;
  if (tapExact('Neue Playlist')) return true;
  const xml = dumpUiRaw();
  const hits = parseAllNodes(xml).filter(
    (n) =>
      n.package === PKG &&
      (n.desc === 'Neue Playlist' ||
        n.desc === 'Neue Playlist anlegen' ||
        n.text === 'Neue Playlist'),
  );
  hits.sort((a, b) => a.y - b.y);
  if (hits.length) return tapNode(hits[0], 'Neue Playlist');
  const title = parseAllNodes(xml).find((n) => n.package === PKG && n.text === 'Meine Wiedergabelisten');
  if (title) {
    tap(Math.min(title.x2 + 48, 1020), title.y);
    return true;
  }
  return false;
}

function tapLessonStickyListen() {
  const xml = dumpUiRaw();
  const stickyListen = parseAllNodes(xml)
    .filter(
      (n) =>
        n.package === PKG &&
        n.y1 > 1400 &&
        n.y2 < 2360 &&
        !isBottomTabNode(n) &&
        (n.desc === 'Hören' || n.text === 'Hören'),
    )
    .sort((a, b) => b.y - a.y);
  if (stickyListen.length) return tapNode(stickyListen[0], 'lesson-sticky-Hören');
  return false;
}

function startMiniPlayerForGate() {
  try {
    ensureForeground();
    for (let i = 0; i < 4; i++) dismissNativeAlert();
    sh(
      `"${adb}" -s ${SER} shell am start -a android.intent.action.VIEW -d "futuredev://lesson/M01-00-02" -f 0x24000000 ${PKG}`,
    );
    sleep(5500);
    dismissDialogs(4);
    collapseStatusBar();
    const xml = dumpUiRaw();
    const stickyHoeren = xml.match(/content-desc="Hören"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
    if (stickyHoeren) {
      const y = (+stickyHoeren[2] + +stickyHoeren[4]) / 2;
      if (y > 400 && y < 2360) {
        tap((+stickyHoeren[1] + +stickyHoeren[3]) / 2, y);
      } else if (!tapLessonStickyListen()) {
        tap(792, 2232);
      }
    } else if (!tapLessonStickyListen()) {
      tap(792, 2232);
    }
    sleep(8000);
    pressBack();
    sleep(800);
    if (isLessonReaderXml(dumpUiRaw())) pressBack();
    sleep(800);
    try {
      sh(`"${adb}" -s ${SER} shell am start -n ${PKG}/.MainActivity`);
    } catch (err) {
      console.log('WARN main activity', err.message);
    }
    sleep(2000);
    tabByLabel('Start');
    sleep(2500);
    const after = dumpUiRaw();
    return hasMiniPlayerSignals(after) || mediaPlaybackActive();
  } catch (err) {
    console.log('WARN startMiniPlayerForGate', err.message);
    return mediaPlaybackActive();
  }
}

function hasMainTabs(xml) {
  return (
    xml.includes('Start, Tab') ||
    (xml.includes(`package="${PKG}"`) &&
      xml.includes('content-desc="Start"') &&
      xml.includes('content-desc="Lernen"') &&
      xml.includes('content-desc="Hören"') &&
      xml.includes('content-desc="Ich"'))
  );
}



function isStartDashboard(xml) {
  if (isOnboardingXml(xml)) return false;
  return hasMainTabs(xml);
}

function waitForEnabledDesc(desc, timeoutMs = 12000) {
  const esc = desc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const xml = dumpUiRaw();
    if (new RegExp(`content-desc="${esc}"[^>]*enabled="true"`).test(xml)) return true;
    sleep(450);
  }
  return false;
}

function tapExact(label, { bottom = false } = {}) {
  const xml = dumpUiRaw();
  let hits = findNodes(
    xml,
    (n) =>
      (n.text === label || n.desc === label || n.desc.startsWith(`${label},`)) &&
      n.text.length <= label.length + 2,
  );
  if (!hits.length) {
    hits = findNodes(xml, (n) => n.text === label || n.desc === label || n.desc.startsWith(`${label},`));
  }
  if (!hits.length) {
    console.log('MISS exact', label);
    return false;
  }
  hits.sort((a, b) => (bottom ? b.y - a.y : a.y - b.y));
  return tapNode(hits[0], label);
}

function tapTestId(idFragment, { bottom = false } = {}) {
  const xml = dumpUiRaw();
  const re = new RegExp(
    `resource-id="[^"]*${idFragment}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
  );
  const m = xml.match(re);
  if (m) {
    tap((+m[1] + +m[3]) / 2, (+m[2] + +m[4]) / 2);
    console.log('TAP testID', idFragment);
    return true;
  }
  const hits = parseAllNodes(xml)
    .filter((n) => n.package === PKG && n.resourceId.includes(idFragment))
    .sort((a, b) => (bottom ? b.y - a.y : a.y - b.y));
  if (!hits.length) {
    console.log('MISS testID', idFragment);
    return false;
  }
  return tapNode(hits[0], idFragment);
}

function tapTextOrDesc(needle, { partial = false } = {}) {
  const xml = dumpUiRaw();
  const pred = (n) => {
    const t = n.text || '';
    const d = n.desc || '';
    if (partial) return t.includes(needle) || d.includes(needle);
    return t === needle || d === needle || d.startsWith(`${needle},`);
  };
  let hits = findNodes(xml, pred);
  if (!partial) {
    hits = hits.filter((n) => n.text === needle || n.desc === needle || n.desc.startsWith(`${needle},`));
  }
  hits.sort((a, b) => a.y - b.y);
  if (!hits.length) {
    console.log('MISS', needle);
    return false;
  }
  return tapNode(hits[0], needle);
}

function tapRegexDesc(re) {
  const xml = dumpUi();
  const hits = findNodes(xml, (n) => re.test(n.desc) || re.test(n.text));
  if (!hits.length) {
    console.log('MISS', re.toString());
    return false;
  }
  return tapNode(hits[0], re.toString());
}

/** Focus app EditText before adb input text (avoids launcher search stealing focus). */
function tapAppEditText({ labelPartial = 'Name', resourceFragment = '' } = {}) {
  ensureForeground();
  const xml = dumpUi();
  if (!xml.includes(`package="${PKG}"`)) {
    console.log('MISS EditText', 'app not foreground');
    return false;
  }
  let hits = parseAllNodes(xml).filter(
    (n) =>
      n.package === PKG &&
      n.className === 'android.widget.EditText' &&
      (resourceFragment ? n.resourceId.includes(resourceFragment) : true) &&
      (!labelPartial ||
        n.hint.includes(labelPartial) ||
        n.text.includes(labelPartial) ||
        n.desc.includes(labelPartial)),
  );
  if (!hits.length && resourceFragment) {
    hits = parseAllNodes(xml).filter(
      (n) => n.package === PKG && n.className === 'android.widget.EditText' && n.resourceId.includes(resourceFragment),
    );
  }
  hits.sort((a, b) => a.y - b.y);
  if (!hits.length) {
    console.log('MISS EditText', labelPartial || resourceFragment);
    return false;
  }
  return tapNode(hits[0], `EditText:${labelPartial || resourceFragment}`);
}

function clearFocusedField() {
  sh(`"${adb}" -s ${SER} shell input keyevent 122`);
  for (let i = 0; i < 40; i++) sh(`"${adb}" -s ${SER} shell input keyevent 67`);
}



function inputTextSafe(text) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const focused = parseAllNodes(dumpUiRaw()).find(
      (n) => n.package === PKG && n.className === 'android.widget.EditText' && n.resourceId.includes('playlist-name-input'),
    );
    if (focused) tapNode(focused, 'playlist-name-input');
    else if (
      !tapTestId('playlist-name-input') &&
      !tapAppEditText({ resourceFragment: 'playlist-name-input', labelPartial: '' })
    ) {
      /* focus retry */
    }
    sleep(800 + attempt * 200);
    clearFocusedField();
    sleep(250);
    const escaped = text.replace(/ /g, '%s');
    sh(`"${adb}" -s ${SER} shell input text "${escaped}"`);
    sleep(1200);
    let xml = dumpUiRaw();
    if (xml.includes(text)) return true;
    try {
      sh(`"${adb}" -s ${SER} shell cmd clipboard set-text "${text}"`);
    } catch {
      /* API */
    }
    sleep(400);
    if (
      !tapTestId('playlist-name-input') &&
      !tapAppEditText({ resourceFragment: 'playlist-name-input' })
    ) {
      /* paste retry */
    }
    sleep(500);
    clearFocusedField();
    sh(`"${adb}" -s ${SER} shell input keyevent 279`);
    sleep(1200);
    xml = dumpUiRaw();
    if (xml.includes(text)) return true;
  }
  return false;
}

function dismissNativeAlert() {
  const xml = dumpUiRaw();
  if (!xml.includes('alert_title') && !xml.includes('android:id/button3')) return false;
  if (tapExact('ABBRECHEN') || tapTextOrDesc('ABBRECHEN')) return true;
  if (tapExact('OK') || tapTextOrDesc('OK')) return true;
  pressBack();
  return true;
}

function collapseStatusBar() {
  try {
    sh(`"${adb}" -s ${SER} shell cmd statusbar collapse`);
  } catch {
    // Back would dismiss an open in-app modal (playlist name). Leave it.
  }
  sleep(500);
}

function dismissDialogs(max = 8) {
  for (let i = 0; i < max; i++) {
    let xml;
    try {
      xml = dumpUiRaw();
    } catch (err) {
      console.log('WARN dismissDialogs dump failed', err.message);
      break;
    }
    if (
      xml.includes('Name der Playlist') ||
      xml.includes('playlist-save-button') ||
      xml.includes('playlist-name-input')
    ) {
      break;
    }
    if (
      xml.includes('notification_panel') ||
      xml.includes('notification_stack_scroller') ||
      (xml.includes('com.android.systemui') && !xml.includes(`package="${PKG}"`))
    ) {
      collapseStatusBar();
      continue;
    }
    if (xml.includes('alert_title')) {
      dismissNativeAlert();
      sleep(700);
      continue;
    }
    const hasAppAlert =
      xml.includes('fehlgeschlagen') ||
      (xml.includes('text="OK"') && xml.includes(`package="${PKG}"`));
    if (!xml.includes('package="com.android') && !xml.includes('permissioncontroller')) {
      if (!hasAppAlert && !xml.includes('Allow') && !xml.includes('zulassen')) break;
    }
    const dismissLabels = [
      'OK',
      "Don't allow",
      'Nicht zulassen',
      'Allow',
      'Zulassen',
    ];
    let tapped = false;
    for (const label of dismissLabels) {
      if (tapExact(label) || (label.length > 6 && tapTextOrDesc(label, { partial: true }))) {
        tapped = true;
        break;
      }
    }
    if (!tapped) {
      if (xml.includes('Lesezeichen konnte nicht')) tapExact('OK');
      else if (xml.includes('Speichern fehlgeschlagen')) tapExact('OK');
      else break;
    }
    sleep(600);
  }
}

function isLauncherXml(xml) {
  return (
    xml.includes('nexuslauncher') ||
    (xml.includes('com.android.launcher') && !xml.includes(`package="${PKG}"`))
  );
}

function relaunchApp() {
  sh(`"${adb}" -s ${SER} shell am force-stop ${PKG}`);
  sleep(800);
  sh(`"${adb}" -s ${SER} shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  sleep(4500);
  dismissDialogs(4);
}

function ensureForeground() {
  for (let i = 0; i < 8; i++) {
    const xml = dumpUiRaw();
    if (xml.includes(`package="${PKG}"`)) return true;
    dismissDialogs(3);
    relaunchApp();
  }
  return false;
}

function ensureAppInForeground() {
  for (let i = 0; i < 8; i++) {
    const xml = dumpUiRaw();
    if (xml.includes(`package="${PKG}"`)) return xml;
    if (isLauncherXml(xml) || !xml.includes(`package="${PKG}"`)) relaunchApp();
    else dismissDialogs(2);
  }
  return dumpUiRaw();
}

function record(name, pass, detail = '') {
  checks.push({ name, pass, detail });
  if (!pass) overallFail = true;
  console.log(pass ? 'PASS' : 'FAIL', name, detail);
}

function isOnboardingXml(xml) {
  return (
    xml.includes('Wofür lernst du?') ||
    xml.includes('Wie möchtest du starten?') ||
    xml.includes('Wie viel Zeit hast du täglich?')
  );
}

function isHomeXml(xml) {
  return isStartDashboard(xml);
}

function finishOnboarding() {
  ensureForeground();
  for (let perm = 0; perm < 6; perm++) {
    const xml = dumpUiRaw();
    if (
      xml.includes('permissioncontroller') ||
      (xml.includes('Allow') && !xml.includes(`package="${PKG}"`)) ||
      xml.includes('Zulassen')
    ) {
      tapExact('Allow') ||
        tapTextOrDesc('Zulassen', { partial: true }) ||
        tapTextOrDesc('While using', { partial: true });
      sleep(1200);
    } else break;
  }
  for (let waitHome = 0; waitHome < 15; waitHome++) {
    sleep(2000);
    const xml = ensureAppInForeground();
    if (isHomeXml(xml) && !isOnboardingXml(xml)) {
      console.log('SKIP onboarding — main tabs visible');
      return;
    }
  }
  let xml = ensureAppInForeground();
  if (isHomeXml(xml) && !isOnboardingXml(xml)) return;
  waitForText('Wofür lernst du') || waitForText('Wie möchtest du starten') || waitForText('Lesen zuerst');
  xml = ensureAppInForeground();
  if (isHomeXml(xml) && !isOnboardingXml(xml)) return;
  if (xml.includes('Wofür lernst du')) {
    tapOption('Freies Interesse') ||
      tapOption('Berufsbegleitend upskillen') ||
      tapOption('Berufswechsel') ||
      tap(540, 2014);
    sleep(1500);
    waitForText('Wie möchtest du starten', 25000);
    ensureAppInForeground();
  }
  waitForText('Lesen zuerst', 20000);
  ensureAppInForeground();
  tapOption('Lesen zuerst') || tap(540, 1217);
  sleep(800);
  scrollDown(2);
  tapOption('Morgens') || tapOption('Abends') || tapOption('Unterwegs') || tap(540, 2044);
  sleep(1200);
  waitForEnabledDesc('Weiter', 20000);
  ensureAppInForeground();
  tapTestId('onboarding-step2-weiter', { bottom: true }) ||
    tapExact('Weiter', { bottom: true }) ||
    tap(540, 2217);
  sleep(2000);
  xml = dumpUiRaw();
  saveDump('onboarding-step3', xml);
  if (isHomeXml(xml)) {
    saveDump('onboarding-final', xml);
    return;
  }
  if (!xml.includes('Wie viel Zeit')) {
    tapExact('Weiter', { bottom: true }) || tapTestId('onboarding-step2-weiter', { bottom: true });
    sleep(1500);
    xml = dumpUiRaw();
    if (isHomeXml(xml)) {
      saveDump('onboarding-final', xml);
      return;
    }
  }
  tapOption('40 Minuten') ||
    tapOption('20 Minuten') ||
    tapOption('60 Minuten') ||
    tapOption('90 Minuten') ||
    tapOption('10 Minuten');
  sleep(8000);
  dismissDialogs(8);
  let onHome = false;
  for (let attempt = 0; attempt < 20; attempt++) {
    ensureForeground();
    xml = dumpUiRaw();
    onHome = isHomeXml(xml);
    if (onHome) break;
    if (xml.includes('Grundlagen-Check') || xml.includes('Ohne Check mit den Grundlagen starten')) {
      tapTextOrDesc('Ohne Check mit den Grundlagen starten', { partial: true }) ||
        tapTextOrDesc('Später – alle Module ansehen', { partial: true }) ||
        tap(540, 1374);
      sleep(4000);
      continue;
    }
    if (isOnboardingXml(xml) && xml.includes('Wie viel Zeit')) {
      tapOption('20 Minuten') || tapOption('40 Minuten') || tapOption('10 Minuten');
      sleep(4000);
    }
    sleep(2500);
  }
  saveDump('onboarding-final', xml);
  if (!onHome) {
    throw new Error('Onboarding did not complete — see onboarding-final.xml');
  }
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
  return tapTextOrDesc(label) || tapRegexDesc(new RegExp(`^${label}, Tab`));
}

function tabNodeSelected(xml, label) {
  return parseAllNodes(xml).some(
    (n) =>
      n.package === PKG &&
      n.y1 > 2100 &&
      n.selected &&
      (n.desc === label || n.desc.startsWith(`${label},`) || n.text === label),
  );
}

function tabScreenSignals(label, xml) {
  if (label === 'Start') return isStartDashboard(xml);
  if (label === 'Lernen') {
    return (
      /Grundlagen der Informatik|Module|Nächste Lektion|Was ein Computer tut/i.test(xml) &&
      hasMainTabs(xml)
    );
  }
  if (label === 'Hören') {
    return (
      xml.includes('Meine Wiedergabelisten') ||
      xml.includes('Neue Playlist anlegen') ||
      xml.includes('playlist-create-button')
    );
  }
  if (label === 'Üben') {
    return (
      xml.includes('Karteikarten') ||
      xml.includes('Prüfungen') ||
      xml.includes('Heutige Wiederholung') ||
      xml.includes('Heute nichts fällig')
    );
  }
  if (label === 'Ich') {
    return (
      xml.includes('Einstellungen') ||
      xml.includes('Rechtliches') ||
      xml.includes('Lesezeichen') ||
      xml.includes('Jobreife') ||
      xml.includes('Portfolio')
    );
  }
  return false;
}

/** Tap tab and wait until selection or unique screen content (fresh dumps only). */
function waitForTab(label, attempts = 8) {
  for (let i = 0; i < attempts; i++) {
    if (isLessonReaderXml(dumpUiRaw())) popToTabRoot();
    ensureForeground();
    tabByLabel(label);
    sleep(2200 + i * 200);
    dismissDialogs(1);
    const xml = dumpUiRaw();
    if (tabNodeSelected(xml, label) || tabScreenSignals(label, xml)) return xml;
  }
  return dumpUiRaw();
}

function deepLinkLesson() {
  sh(
    `"${adb}" -s ${SER} shell am start -a android.intent.action.VIEW -d "futuredev://lesson/M01-00-02" -f 0x24000000 ${PKG}`,
  );
  sleep(2500);
  dismissDialogs(2);
}

function openLessonForGate() {
  for (let attempt = 0; attempt < 2; attempt++) {
    deepLinkLesson();
    const deadline = Date.now() + 8000;
    let xml = dumpUiRaw();
    while (Date.now() < deadline && !isLessonReaderXml(xml)) {
      sleep(700);
      xml = dumpUiRaw();
    }
    if (isLessonReaderXml(xml)) return true;
    tabByLabel('Lernen');
    sleep(3000);
    dismissDialogs(2);
    xml = dumpUiRaw();
    const lessonRow = parseAllNodes(xml)
      .filter(
        (n) =>
          n.package === PKG &&
          n.y1 > 400 &&
          n.y2 < 2100 &&
          (n.text === 'Was ein Computer tut' || n.desc.includes('Was ein Computer tut')),
      )
      .sort((a, b) => a.y - b.y);
    if (lessonRow.length && tapNode(lessonRow[0], 'lernen-lesson-row')) {
      sleep(5500);
      xml = dumpUiRaw();
      if (isLessonReaderXml(xml)) return true;
    }
    if (tapTextOrDesc('Was ein Computer tut', { partial: true })) {
      sleep(5500);
      xml = dumpUiRaw();
      if (isLessonReaderXml(xml)) return true;
    }
  }
  return isLessonReaderXml(dumpUiRaw());
}

function hasLessonStickyChrome(xml) {
  if (!isLessonReaderXml(xml)) return false;
  const nodes = parseAllNodes(xml).filter((n) => n.package === PKG);
  const stickyBand = nodes.filter((n) => n.y1 > 1800 && n.y2 < 2380);
  const hasListen = stickyBand.some(
    (n) =>
      n.desc === 'Hören' ||
      n.text === 'Hören' ||
      n.desc.includes('Hören') ||
      n.desc.includes('Quiz zu dieser Lektion') ||
      n.text.includes('Quiz zu dieser Lektion'),
  );
  const hasBookmark =
    xml.includes('Lesezeichen') ||
    nodes.some((n) => n.desc.includes('Lesezeichen') || n.text.includes('Lesezeichen'));
  return hasListen || hasBookmark;
}

function visibleBookmarkNodes(xml) {
  return parseAllNodes(xml)
    .filter(
      (node) =>
        node.package === PKG &&
        (node.desc === 'Lesezeichen setzen' || node.desc === 'Lesezeichen entfernen') &&
        node.y1 >= 700 &&
        node.y2 - node.y1 >= 72 &&
        node.y2 <= 1800,
    )
    .sort((a, b) => a.y - b.y);
}

function grantRuntimePermissions() {
  try {
    sh(`"${adb}" -s ${SER} shell pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
  } catch {
    /* API < 33 or already granted */
  }
}

function popToTabRoot() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const xml = dumpUiRaw();
    if (isLessonReaderXml(xml)) {
      pressBack();
      continue;
    }
    if (hasMainTabs(xml) && isStartDashboard(xml)) return;
    if (hasMainTabs(xml)) {
      tabByLabel('Start');
      sleep(2000);
      if (isStartDashboard(dumpUiRaw())) return;
    }
    pressBack();
  }
  tabByLabel('Start');
  sleep(2000);
}

function installFresh() {
  if (!fs.existsSync(APK)) throw new Error(`APK missing: ${APK}`);
  sh(`"${adb}" -s ${SER} wait-for-device`);
  disableAnimationsForQa();
  try {
    sh(`"${adb}" -s ${SER} shell input keyevent KEYCODE_WAKEUP`);
  } catch {
    /* */
  }
  sh(`"${adb}" -s ${SER} shell am force-stop ${PKG}`);
  sh(`"${adb}" -s ${SER} install -r "${APK.replace(/\\/g, '/')}"`);
  verifyInstalledArtifact(config, runAdb, PKG);
  if (config.mode === 'clean') sh(`"${adb}" -s ${SER} shell pm clear ${PKG}`);
  grantRuntimePermissions();
  sleep(2000);
  sh(`"${adb}" -s ${SER} shell monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  sleep(9000);
  grantRuntimePermissions();
  dismissDialogs(8);
  if (!ensureForeground()) {
    sh(`"${adb}" -s ${SER} shell am start -n ${PKG}/.MainActivity`);
    sleep(5000);
    dismissDialogs(6);
  }
}

function writeGateMd(ci) {
  const lines = [
    '# Native smoke walk (legacy scenarios)',
    '',
    'These scripted checks do not certify every screen, pixel, accessibility state, or native race.',
    '',
    `Version: **${VERSION}**`,
    `APK: \`${APK}\``,
    `Emulator: \`${SER}\``,
    `Run: ${new Date().toISOString()}`,
    '',
    `SHA256: ${config.sha256}`,
    `Version code: ${config['version-code']}; mode: ${config.mode}; AVD: ${config.avd}`,
    '',
    '## Caller-supplied CI metadata (not independently verified by this script)',
    '',
    `| Check | Result |`,
    `|---|---|`,
    `| typecheck | ${ci.typecheck} |`,
    `| lint | ${ci.lint} |`,
    `| test | ${ci.test} |`,
    '',
    '## FIRST10',
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
  ];
  for (const c of checks.filter((x) => x.section === 'first10')) {
    lines.push(`| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} | ${c.detail || ''} |`);
  }
  lines.push('', '## MOTION walk', '', '| Screen | Result |', '|---|---|');
  for (const c of checks.filter((x) => x.section === 'motion')) {
    lines.push(`| ${c.name} | ${c.pass ? 'PASS' : 'FAIL'} |`);
  }
  lines.push('', '## Blocking dialogs', '');
  const block = checks.find((x) => x.name === 'No blocking system dialog');
  lines.push(block ? (block.pass ? 'None observed during walk.' : `FAIL: ${block.detail}`) : 'n/a');
  lines.push('', '---', '', `## Scripted smoke result: **${overallFail ? 'FAIL' : 'PASS'}**`, '');
  fs.writeFileSync(path.join(OUT, 'PERFECT-GATE.md'), lines.join('\n'), 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'ERGEBNIS.md'),
    `# Native scripted smoke\n\nScripted smoke result: **${overallFail ? 'FAIL' : 'PASS'}**\n\nSee PERFECT-GATE.md\n`,
    'utf8',
  );
}

function recordFirst10(name, pass, detail) {
  checks.push({ section: 'first10', name, pass, detail });
  if (!pass) overallFail = true;
  console.log(pass ? 'PASS' : 'FAIL', '[FIRST10]', name, detail);
}

function recordMotion(name, pass) {
  checks.push({ section: 'motion', name, pass, detail: '' });
  if (!pass) overallFail = true;
  console.log(pass ? 'PASS' : 'FAIL', '[MOTION]', name);
}

function mediaPlaybackActive() {
  try {
    const out = String(runAdb(['shell', 'dumpsys', 'media_session']));
    return /state=PlaybackState\s*\{[^}]*state=3/.test(out) || /\bstate=3\b/.test(out);
  } catch {
    return false;
  }
}

function hasMiniPlayerSignals(xml) {
  return (
    xml.includes('mini-player-play-toggle') ||
    xml.includes('mini-player-open') ||
    xml.includes('Pause') ||
    xml.includes('Wiedergabe') ||
    xml.includes('Fortsetzen ab') ||
    xml.includes('Jetzt weiterhören') ||
    findNodes(xml, (n) => n.package === PKG && (n.desc === 'Pause' || n.desc === 'Wiedergabe')).length > 0
  );
}

// --- main: all preflight checks precede install, clear, taps, and permissions ---
prepareRun(config, runAdb);
process.on('exit', code => {
  const result = path.join(OUT, 'run-result.json');
  if (!fs.existsSync(result)) {
    fs.writeFileSync(result, JSON.stringify({ status: 'incomplete-or-failed', exitCode: code, sha256: config.sha256, serial: SER, checks }, null, 2), { flag: 'wx' });
  }
});
// This historical coordinate walk is valid only for its original geometry.
// Other device/font configurations use the separately documented native matrix.
fs.writeFileSync(path.join(OUT, 'device-config.json'), JSON.stringify(verifyLegacyDisplay(runAdb), null, 2), { flag: 'wx' });
if (fs.existsSync(LOCK_PATH)) {
  const prev = Number(fs.readFileSync(LOCK_PATH, 'utf8').trim());
  if (Number.isFinite(prev) && prev > 0) {
    try {
      process.kill(prev, 0);
      console.error(`Gate already running (pid ${prev}). Exit.`);
      process.exit(2);
    } catch {
      /* stale lock */
    }
  }
}
fs.writeFileSync(LOCK_PATH, String(process.pid), 'utf8');
const releaseLock = () => {
  try {
    if (fs.existsSync(LOCK_PATH) && fs.readFileSync(LOCK_PATH, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(LOCK_PATH);
    }
  } catch {
    /* ignore */
  }
};
process.on('exit', releaseLock);
process.on('SIGINT', () => {
  releaseLock();
  process.exit(130);
});

console.log('APK', APK);
installFresh();
sleep(10000);
finishOnboarding();
ensureForeground();

let xml = dumpUiRaw();
for (let i = 0; i < 20; i++) {
  if (isStartDashboard(xml)) break;
  sleep(2000);
  xml = dumpUiRaw();
}
tabByLabel('Start');
sleep(2000);
xml = dumpUiRaw();
for (let i = 0; i < 15; i++) {
  if (isStartDashboard(xml)) break;
  sleep(2000);
  xml = dumpUiRaw();
}
saveDump('first10-01-start', xml);
dismissDialogs(3);

const startOk = isStartDashboard(xml);
recordFirst10('Start not empty', startOk, startOk ? '' : 'missing dashboard signals');

if (!ensureHoerenTab()) {
  recordFirst10('Playlist create+row', false, 'Hören tab / playlists section not reachable');
} else {
dismissDialogs(1);
waitForText('Meine Wiedergabelisten', 20000);

const playlistName = 'perfectgate018';

let playlistModal = false;
for (let attempt = 0; attempt < 5; attempt++) {
  ensureHoerenTab();
  tapCreatePlaylist();
  sleep(3500);
  xml = dumpUiRaw();
  // Check for the modal immediately. Waiting for a row first was a deadlock:
  // the row cannot exist until the modal is saved, and retrying ensureHoerenTab
  // under the modal overlay hides the tab bar and spins on the top-anchor loop.
  if (
    xml.includes(playlistName) ||
    xml.includes(`playlist-row-${playlistName}`) ||
    xml.includes('Name der Playlist') ||
    xml.includes('playlist-name-input')
  ) {
    playlistModal = true;
    break;
  }
}
xml = dumpUiRaw();
playlistModal =
  playlistModal ||
  xml.includes('Name der Playlist') ||
  xml.includes('playlist-name-input') ||
  xml.includes('perfectgate018');
xml = dumpUi();
saveDump('first10-02-hoeren', xml);
if (!playlistModal && xml.includes('Name der Playlist')) playlistModal = true;

if (xml.includes(playlistName) || xml.includes(`playlist-row-${playlistName}`)) {
  recordFirst10('Playlist create+row', true, playlistName);
} else if (!playlistModal) {
  recordFirst10('Playlist create+row', false, 'could not open create modal');
} else {
  ensureForeground();
  saveDump('first10-02-playlist-modal', dumpUi());
  let xmlModal = dumpUiRaw();
  let rowAlready =
    xmlModal.includes(`playlist-row-${playlistName}`) ||
    (xmlModal.includes('Meine Wiedergabelisten') && xmlModal.includes(playlistName));
  if (!rowAlready && !xmlModal.includes(playlistName)) {
    inputTextSafe(playlistName);
  }
  if (!rowAlready) {
    for (let i = 0; i < 3; i++) {
      xmlModal = dumpUiRaw();
      if (xmlModal.includes(playlistName) && !xmlModal.includes('playlist-save-button')) {
        rowAlready = true;
        break;
      }
      if (!xmlModal.includes(playlistName)) {
        inputTextSafe(playlistName);
        sleep(600);
        continue;
      }
      if (xmlModal.includes('playlist-save-button') || xmlModal.includes('Name der Playlist')) {
        tapTestId('playlist-save-button') ||
          tapExact('Speichern') ||
          tapTextOrDesc('Speichern') ||
          tap(850, 1320);
        sleep(3500);
      } else {
        sleep(500);
      }
    }
    collapseStatusBar();
    for (let closeModal = 0; closeModal < 8; closeModal++) {
      xml = dumpUiRaw();
      if (!xml.includes('Name der Playlist') && !xml.includes('playlist-save-button')) break;
      sleep(600);
    }
    if (xml.includes('alert_title') || xml.includes('Speichern fehlgeschlagen')) {
      tapExact('OK');
      sleep(500);
    }
  }
  ensureHoerenTab();
  let playlistOk = rowAlready;
  for (let verify = 0; verify < 3 && !playlistOk; verify++) {
    xml = dumpUi();
    if (
      xml.includes(`playlist-row-${playlistName}`) ||
      (xml.includes('Meine Wiedergabelisten') && xml.includes(playlistName))
    ) {
      playlistOk = true;
      break;
    }
    collapseStatusBar();
    ensureHoerenTab();
    scrollUp(4);
    sleep(1000);
  }
  saveDump('first10-03-playlist', xml);
  shot('05-playlist');
  recordFirst10(
    'Playlist create+row',
    playlistOk,
    playlistOk ? playlistName : 'missing row, empty list, or save error',
  );
  // Keep the upgrade AVD clean: this is synthetic QA state, not user data.
  // The delete action can sit behind the sticky mini-player until the page is
  // advanced, so only tap after accessibility reports it above the overlay.
  let playlistCleaned = false;
  if (playlistOk) {
    for (let attempt = 0; attempt < 6; attempt++) {
      xml = dumpUiRaw();
      if (!xml.includes(`playlist-row-${playlistName}`)) {
        playlistCleaned = true;
        break;
      }
      const remove = parseAllNodes(xml).find(
        (node) =>
          node.package === PKG &&
          node.desc === `Playlist löschen: ${playlistName}` &&
          node.y2 < 1870,
      );
      if (remove) {
        tapNode(remove, 'cleanup test playlist');
        sleep(1000);
      } else {
        sh(`"${adb}" -s ${SER} shell input swipe 540 1500 540 850 400`);
        sleep(800);
      }
    }
    if (!playlistCleaned) {
      xml = dumpUiRaw();
      playlistCleaned = !xml.includes(`playlist-row-${playlistName}`);
    }
  }
  recordFirst10('QA playlist cleanup', playlistCleaned, playlistCleaned ? '' : 'synthetic playlist remains');
}
}

const lessonOpen = openLessonForGate();
sleep(lessonOpen ? 2500 : 0);
dismissDialogs(6);
let bookmarkVerified = false;
if (lessonOpen) {
  // Exercise the actual visible toggle (and restore its original value) rather
  // than searching for a success toast that this screen does not render.
  const beforeNodes = visibleBookmarkNodes(dumpUiRaw());
  const before = beforeNodes.find((node) => node.y >= 800 && node.y <= 1500) ?? beforeNodes[0];
  if (before) {
    const beforeRemove = beforeNodes.filter((node) => node.desc === 'Lesezeichen entfernen').length;
    tapNode(before, 'lesson-bookmark-toggle');
    sleep(1200);
    const afterNodes = visibleBookmarkNodes(dumpUiRaw());
    const after =
      afterNodes.find((node) => Math.abs(node.y - before.y) < 90 && node.desc !== before.desc) ??
      afterNodes.find((node) => Math.abs(node.y - before.y) < 90);
    const afterRemove = afterNodes.filter((node) => node.desc === 'Lesezeichen entfernen').length;
    bookmarkVerified = Boolean(
      (after && after.desc !== before.desc) || afterRemove !== beforeRemove,
    );
    if (bookmarkVerified && after) {
      tapNode(after, 'restore-lesson-bookmark');
      sleep(1000);
      const restoredNodes = visibleBookmarkNodes(dumpUiRaw());
      const restored = restoredNodes.find((node) => Math.abs(node.y - after.y) < 90);
      const restoredRemove = restoredNodes.filter((node) => node.desc === 'Lesezeichen entfernen').length;
      bookmarkVerified = Boolean(
        (restored && restored.desc === before.desc) || restoredRemove === beforeRemove,
      );
    }
  }
  dismissDialogs(8);
}
xml = dumpUi();
saveDump('first10-04-bookmark', xml);
recordFirst10(
  'Bookmark toggle round-trip',
  lessonOpen && bookmarkVerified && !xml.includes('Lesezeichen konnte nicht'),
  bookmarkVerified ? 'state changed and restored' : 'toggle did not round-trip',
);

if (isLessonReaderXml(xml)) pressBack();
sleep(1200);
tabByLabel('Ich');
sleep(2000);
xml = dumpUi();
saveDump('first10-05-ich', xml);
recordFirst10(
  'Ich reachable after bookmark',
  xml.includes('Block') ||
    xml.includes('Lesezeichen') ||
    xml.includes('Profil') ||
    xml.includes('Einstellungen') ||
    (xml.includes('content-desc="Ich"') && xml.includes('selected="true"')),
  '',
);

openLessonForGate();
sleep(3000);
dismissDialogs(6);
scrollDown(12);
sleep(1200);
xml = dumpUi();
saveDump('first10-06-lesson-scroll', xml);
const stickyOk = !xml.includes('Lesezeichen konnte nicht') && hasLessonStickyChrome(xml);
recordFirst10('Lesson scroll above sticky', stickyOk, stickyOk ? 'quiz + sticky chrome' : 'sticky missing');

tabByLabel('Start');
sleep(2500);
ensureForeground();
popToTabRoot();

// MOTION walk screenshots — exclusive fresh dumps; never trust stale Hören snapshot
const motionScreens = ['Start', 'Lernen', 'Hören', 'Üben', 'Ich'];

for (const tab of motionScreens) {
  xml = waitForTab(tab);
  if (isLauncherXml(xml)) {
    relaunchApp();
    finishOnboarding();
    xml = waitForTab(tab);
  }
  const slug = tab.toLowerCase().replace('ü', 'ue').replace('ö', 'oe');
  saveDump(`motion-${slug}`, xml);
  shot(`motion-${slug}`);
  const blocked =
    xml.includes('com.android.permissioncontroller') &&
    (xml.includes('Allow') || xml.includes('zulassen') || xml.includes('Senden'));
  const tabOk =
    !blocked &&
    xml.includes(PKG) &&
    !isLauncherXml(xml) &&
    !xml.includes('Lesezeichen konnte nicht') &&
    !xml.includes('Speichern fehlgeschlagen') &&
    !isLessonReaderXml(xml) &&
    (tabNodeSelected(xml, tab) || tabScreenSignals(tab, xml));
  recordMotion(tab, tabOk);
}

let miniStarted = false;
try {
  miniStarted = startMiniPlayerForGate();
} catch (err) {
  console.log('WARN startMiniPlayerForGate', err.message);
}
sleep(3000);
try {
  dismissDialogs(3);
} catch (err) {
  console.log('WARN dismissDialogs after mini', err.message);
}
try {
  xml = dumpUiRaw();
  shot('motion-mini-player');
  saveDump('motion-mini-player', xml);
} catch (err) {
  console.log('WARN motion-mini-player capture', err.message);
  xml = '';
}
const miniOk = miniStarted || hasMiniPlayerSignals(xml) || mediaPlaybackActive();
recordMotion('MiniPlayer after play', miniOk);

let stickyLanded = false;
for (let attempt = 0; attempt < 2; attempt++) {
  if (openLessonForGate()) {
    sleep(3500);
    dismissDialogs(6);
    for (let i = 0; i < 4; i++) dismissNativeAlert();
    scrollDown(10);
    sleep(1000);
    xml = dumpUiRaw();
    if (isLessonReaderXml(xml) && hasLessonStickyChrome(xml)) {
      stickyLanded = true;
      break;
    }
  }
}
if (!stickyLanded) {
  xml = dumpUiRaw();
}
shot('motion-lesson-sticky');
saveDump('motion-lesson-sticky', xml);
const motionStickyOk =
  !xml.includes('Lesezeichen konnte nicht') && isLessonReaderXml(xml) && hasLessonStickyChrome(xml);
recordMotion('Lesson sticky chrome', motionStickyOk);

dismissDialogs(8);
const finalXml = dumpUi();
const dialogBlock =
  (finalXml.includes('permissioncontroller') && finalXml.includes('Allow')) ||
  finalXml.includes('Speichern fehlgeschlagen') ||
  finalXml.includes('Lesezeichen konnte nicht');
record('No blocking system dialog', !dialogBlock, dialogBlock ? 'dialog or error alert' : '');

const ci = {
  typecheck: process.env.PERFECT_CI_TYPECHECK || 'NOT_RUN',
  lint: process.env.PERFECT_CI_LINT || 'NOT_RUN',
  test: process.env.PERFECT_CI_TEST || 'NOT_RUN',
};
writeGateMd(ci);
fs.writeFileSync(path.join(OUT, 'run-result.json'), JSON.stringify({ status: overallFail ? 'failed' : 'scripted-smoke-passed', sha256: config.sha256, serial: SER, completedAt: new Date().toISOString(), checks }, null, 2), { flag: 'wx' });
process.exit(overallFail ? 1 : 0);
