# Emulator smoke v0.1.15 (emulator-5560)

APK: `tmp-qa/apk/futuredev-v0.1.15-x86_64-emulator.apk`

| Check | Result | Evidence |
|-------|--------|----------|
| Hören overflow menu (MoreVertical) | PASS | Manual / UIAutomator |
| Legal draft hidden in release | PASS | Release APK: no `Entwurf` banner without `EXPO_PUBLIC_LEGAL_DRAFT` |
| Erklären rating copy branches | PASS | sample intro varies by rating |
| Settings notifications/telemetry disabled | PASS | Switches disabled, subtitles „Demnächst“ |
| Player „Erweitert“ collapsed default | PASS | Summary shows rate + repeat when collapsed |
| Soft-start volume ramp | PASS (unit) | `rampVolume.test.ts` — monotonic 0→1 in ~180ms; `dumpsys media_session` cannot show ramp |

Automated: `pnpm --filter @futuredev/mobile` typecheck, lint, vitest — all green (164 tests).
