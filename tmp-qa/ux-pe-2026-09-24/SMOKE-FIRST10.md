# SMOKE-FIRST10 — release gate (FutureDev mobile)

**FAIL the release** if any mandatory check below fails. Run after fresh install + cold start on `emulator-5560` (or CI agent with AVD).

APK under test: `tmp-qa/apk/futuredev-v0.1.16-x86_64-emulator.apk` (adjust version in script).

## Mandatory (automated via `run-smoke-first10.ps1`)

| ID | Check | Pass criteria |
|----|-------|---------------|
| F1 | Start not falsely empty | With bundled content loaded, UI dump on Start must **not** contain `Noch kein Fortschritt` / `Willkommen bei FutureDev` empty copy when `Tagesziel` or `Nächste Empfehlung` is present |
| F2 | Start shows curriculum signal | After onboarding, within 15s on Start tab: dump contains `Tagesziel` **or** `Nächste Empfehlung` **or** `Weiter` |
| F3 | Playlist create + reload | Create playlist `SmokeFirst10`, reopen Hören tab: dump contains `SmokeFirst10` |
| F4 | Bookmark toggle persists | Open first lesson, tap `Lesezeichen gesetzt`, open Ich tab: dump contains `Block` under bookmarks section |
| F5 | Mini-player above tab bar | With audio queue active, parse bounds: mini-player row bottom ≤ tab bar content top (y); gap ≤ 8px |

## Manual (if automation skipped)

- Lesson sticky Hören/Quiz: last speech block fully scrollable above sticky bar (no text under buttons).
- Playlist add-from-lesson overflow on Hören.

## Commands

```powershell
cd C:\rnb\FutureDev\tmp-qa\ux-pe-2026-09-24
.\run-smoke-first10.ps1
```

Exit code **0** = pass, **1** = fail (do not ship).
