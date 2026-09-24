# Motion smoke v0.1.17

APK: `tmp-qa/apk/futuredev-v0.1.17-x86_64-emulator.apk`  
Emulator: `emulator-5560`  
Evidence: PNGs in this folder (`12-mini-player.png`, `06-lesson-v2.png`, onboarding shots, etc.)

| Surface | Result | Notes |
|---|---|---|
| Motion kit (PressableFeedback, FadeInUp, SlideInBottom, useMotionDuration) | PASS | Unit tests green (`useMotionDuration.test.ts`, `motion.test.ts`) |
| Onboarding step enter (FadeInUp) | PASS | Step 2/3 UI captured (`02-onboarding-step2.png`, `11-ich.png` daily-goal step) |
| Start tab cards / greeting | PASS | `12-mini-player.png` — Start with Tagesziel, Empfehlung, Wochenübersicht |
| Lernen module list enter | PARTIAL | Wired in code (`FadeInUp` + `ModuleCard` press); list screenshot blocked by onboarding reset in late adb pass |
| Lesson sticky actions (PressableFeedback) | PASS | `06-lesson-v2.png`, `07-lesson-sticky-v2.png` — Hören / Quiz bar visible |
| Hören rows / continue card | FAIL | Tab/deep-link automation landed on onboarding or lesson; no clean Hören capture this run |
| Üben cards / CTAs | FAIL | Not reached in automated walk (same blocker) |
| Ich profile / links | FAIL | Not reached in automated walk |
| MiniPlayer SlideInBottom | FAIL | Playback not started; no mini-player strip in captures |
| Player Erweitert accordion animate | PASS (code) | Height/opacity `Animated` in `PlayerAdvancedControls.tsx`; not screen-recorded |
| Tab icon press feedback | SKIP | Lucide fill kept; tab `PressableFeedback` omitted (layout risk) |

## Verdict

**First-glance presence raised** on Start and lesson sticky chrome versus pre-motion builds (enter stagger + press feedback wired app-wide). Hören / Üben / Ich / MiniPlayer still need a clean manual pass or fixed smoke script (onboarding completion + dismiss system dialogs) before calling those surfaces PASS.

Not perfect: automation did not reliably finish onboarding once, and bookmark error dialog blocked tab taps mid-run.
