# FutureDev APK v0.1.16 — first-10s user bugs

Built: 2026-09-24.

Fixes: Start false empty state, bookmark persist/UX, playlist SQLite repair, bottom chrome insets.

## Version metadata

| Source | versionName | versionCode |
|--------|-------------|-------------|
| `apps/mobile/app.json` | 0.1.16 | 16 |
| `apps/mobile/android/app/build.gradle` | 0.1.16 | 16 |

## SHA256

| ABI | Path | SHA256 |
|-----|------|--------|
| x86_64 | `tmp-qa/apk/futuredev-v0.1.16-x86_64-emulator.apk` | `0FF65147661906E4D3D46273EF3A972B38E754A39AE587807109B3F87EA8152B` |
| arm64-v8a | `tmp-qa/apk/futuredev-v0.1.16-arm64-release.apk` | `10BF2EB5E3D814B2E1CABE50504B64BF1294C12111B3A918967D21F28F6BEF5D` |

## Verification

- `pnpm --filter @futuredev/mobile` typecheck, lint, test — 164 tests pass
- Emulator manual: `manual-start-v0.1.16-final.xml` — TAGESZIEL + NÄCHSTE EMPFEHLUNG (no EmptyState)
- Release gate doc: `SMOKE-FIRST10.md` + `run-smoke-first10.ps1`
