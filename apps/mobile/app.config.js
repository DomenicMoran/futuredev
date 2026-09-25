/* eslint-disable @typescript-eslint/no-require-imports -- Expo app.config is CommonJS. */
/** @type {import('expo/config').ExpoConfig} */
const appJson = require('./app.json');

/**
 * Emulator-QA-APKs: `FUTUREDEV_QA_EMULATOR=1` vor `expo prebuild` / Gradle setzen.
 * Arm64-Release nie mit diesem Flag — `app.json` extra bleibt qaSkipOnboarding/qaEmulatorBuild false.
 */
module.exports = () => {
  const qaEmulator = process.env.FUTUREDEV_QA_EMULATOR === '1';
  const extra = { ...appJson.expo.extra };
  if (qaEmulator) {
    extra.qaSkipOnboarding = true;
    extra.qaEmulatorBuild = true;
  }
  return {
    ...appJson.expo,
    extra,
  };
};
