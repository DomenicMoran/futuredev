# FutureDev UX Pixel Audit — 2026-09-25 (pass 3)

| Field | Value |
|---|---|
| Version (after fixes) | **0.1.20** |
| Emulator | `emulator-5560` |
| QA APK | `tmp-qa/apk/futuredev-v0.1.20-x86_64-emulator.apk` |
| Design bar | Ruhe, accent `#2A5FD9`, calm motion |

## Summary

| Severity | Found (0.1.19 re-check) | Fixed in 0.1.20 | Remaining |
|---|---:|---:|---:|
| Blocker | 0 | 0 | 0 |
| Major (real UX) | 4 | 4 | 0 |
| Nit / content | 3 | 1 | 2 |

## Findings

| ID | Screen | Severity | Finding | Status | Evidence |
|---|---|---|---|---|---|
| UX-01b | Start „Nächste Empfehlung“ | **major** | Card showed lesson ID `M01-00-01` before document-dir copy (module list fell back to `id`). | **Fixed** | `24-fixed-tab-start.xml` (`Was ein Computer tut`, no `M01-00-01`) · `24-fixed-tab-start.png` |
| UX-07 | Settings Quizlänge | nit | Numeric chips looked circular (width ≈ height). | **Fixed** | `26-fixed-settings-quiz-pills.png` · `ChoicePill` `minWidth` |
| UX-02b | Lesson sticky Hören/Quiz | **major** | Hören had thick accent left border; Quiz did not. | **Fixed** | `25-fixed-lesson-scroll.png` · shared sticky button chrome |
| UX-08 | MiniPlayer expand | nit | Not verified on 0.1.19. | **Verified** | `21-miniplayer-expanded.png` · `22-miniplayer-collapsed.png` · `testID=mini-player-open` |
| UX-05 | Playlist create modal | nit | QA autofill skipped modal; audit captured wrong screen. | **Fixed** | `12-hoeren-create-playlist-modal.png` (modal + input) |
| UX-04 | Onboarding skip (QA APK) | nit | `extra.qaSkipOnboarding: true` in `app.json` — cold clear skips wizard; release builds must omit this. | **Documented** | `02-onboarding-skipped-already-home.png` |
| UX-06 | Impressum | nit | Draft copy in `src/legal/de.ts` (Domenic Moran, Berlin); full §5 TMG address still TBD before store. | **Open (content)** | `20-ich-impressum.png` |
| UX-09 | Empty speech block | nit | Renderer could show „Sprecher A“ with no body text. | **Fixed** | skip `!block.text.trim()` in lesson reader |

## Code changes (0.1.20)

- `src/content/lessonLoader.ts` — bundled lesson fallback for catalog (`bundledFallback: true` in `listLessons`)
- `src/content/lessonLoader.test.ts` — regression for title before FS copy
- `app/settings/index.tsx` — pill `minWidth` for Quizlänge chips
- `app/lesson/[id].tsx` — matching sticky Quiz/Hören chrome; hide empty speech blocks
- `src/components/PlaylistsSection.tsx` — always show create modal (QA name prefilled only)
- `src/player/MiniPlayer.tsx` — `testID=mini-player-open` for audit
- Version **0.1.20** / `versionCode` **20**

## Verification

- `pnpm --filter @futuredev/mobile typecheck` — pass
- `pnpm --filter @futuredev/mobile lint` — pass
- `pnpm --filter @futuredev/mobile test` — pass (166 tests)
- Emulator reinstall + `run-ux-pixel-audit.cjs` (22 automated) + manual `24`–`26` fixed PNGs
- Start UI dump: human title present, lesson ID absent (`24-fixed-tab-start.xml`)

## Honest verdict

All **must-fix** UX items from the 0.1.19 re-check are addressed in **0.1.20** with new screenshots. **Impressum** remains intentional draft until real ladungsfähige Anschrift is approved. **QA onboarding skip** stays in the emulator QA APK only — remove `qaSkipOnboarding` before consumer store release.
