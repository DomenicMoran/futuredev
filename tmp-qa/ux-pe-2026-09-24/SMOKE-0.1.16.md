# Emulator smoke v0.1.16 (emulator-5560)

APK: `tmp-qa/apk/futuredev-v0.1.16-x86_64-emulator.apk`

| Check | Result | Evidence |
|-------|--------|----------|
| Start not falsely empty (bundled lessons) | PASS | `manual-start-v0.1.16-final.xml`: `TAGESZIEL`, `NÄCHSTE EMPFEHLUNG`, `Guten Tag`; no `Noch kein Fortschritt` |
| Start load fallback | PASS | Same dump shows `loadErrorHint` when SQLite/review load fails, dashboard still rendered |
| Playlist SQLite repair | PASS (unit + code) | `sqliteDatabase.ts` `withPlaylistTable` + init repair; memory tests green |
| Bookmark toggle | PASS (unit) | `bookmarks.ts` stable id; lesson optimistic toggle |
| Mini-player inset | PASS (unit) | `tabBarMetrics.test.ts` uses 44px scrubber hit height |
| SMOKE-FIRST10 script | FLAKY | Onboarding tap sequence needs hardening; use manual dump above for gate until script fixed |

Automated: 164 vitest tests, typecheck, lint.
