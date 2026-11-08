# Onboarding — Phase 1 (Preview, November 2026)

The new journey wizard lives in `src/onboarding.js` and is wired through `src/account-ui.js`. It replaces **only** first-time account setup for an authenticated Google user whose own `public.user_state` record does not exist yet. Returning users with saved state are not shown this wizard.

## User experience

1. **Starting level and stage:** choose beginner, revision or mixed experience, and a beginning focus (Juz Amma, Tabarak, Qad Sami'a, or Al-Baqarah).
2. **Previous memorization (optional):** search the complete list of 114 surahs by name/number; choose surahs and exact first/last ayah for each self-reported memorized range. Leaving this blank is valid.
3. **Time and schedule:** choose revision, new memorization, or both; choose 10–180 minutes per study day and one or more weekdays. Every choice can be reviewed by returning to an earlier step before confirming.
4. **Preview and confirm:** review all chosen settings and three proposed `studyPlan` items scheduled on selected days. The first week's schedule is deliberately lightweight and editable from Quran Plan after starting.

The optional **import progress from this device** action remains separate and requires an explicit confirmation. It does not merge with the newly proposed plan. Signing out before confirmation does not write a new journey.

## Data & security guarantees

- The four-step wizard is held in memory until the user presses **اعتمد خطتي وابدأ**. Step and option changes never send a cloud write.
- `buildOnboardingPayload` starts with `makeNewUserData` (no other person's history). It stores settings in `settings.onboardingProfile` (version 1), including `knownSurahs` as **self-reported** ranges and `studyDays`.
- Proposed items are inserted by the existing `savePlanEntry` function with `status: 'planned'`. No completed revisions, `units`, `activities`, `sessions`, or `attempts` are created. Self-reported memorization never implies verification or ijazah.
- The new row is saved through the existing `expectedRevision:0` Cloudflare Pages endpoint with Supabase Auth and RLS. An already-existing cloud state will not be overwritten by the wizard.
- This feature makes no database migration, changes no account permissions and does not change Google OAuth, SMTP, or email/password registration flags.

## How to test on Preview

Preview branch: `feature/onboarding-wizard-v1`.

1. If Google Sign-in redirects to a different origin, allow this exact URL under **Supabase → Authentication → URL Configuration → Redirect URLs**:
   `https://feature-onboarding-wizard-v1.rihlati-quran.pages.dev/api/account/google/callback*`
   Use the stable Preview branch domain, not a hash-based deployment URL. Do not add broad wildcard domains.
2. Sign in with a **separate, authorized test Google account that has no saved Quran state**. Do not delete an existing journey just to repeat onboarding.
3. Test a beginner without known surahs, then a reviewing user with selected ranges, then a customized daily schedule. Confirm the proposed plan items are initially planned, not completed.
4. Verify that closing setup signs out rather than revealing another account's local guest records. Verify that the optional import flow asks before importing.
5. Test at **390px and desktop**, the browser back/forward behavior, keyboard focus, search results, long surah names, empty selection, invalid ayah ranges, and a failed network request during confirmation. Also verify a returning account resumes without onboarding.
6. After creating a test journey, check persistence across reload and devices and cross-user RLS isolation. These **live** checks are still required before merging.

## Test and rollout gates

- `npm test` (including `test/onboarding.test.js`)
- `npm run build:pages`
- Preview visual smoke test and live account test
- Confirm old accounts' `user_state` and the local guest backup are unchanged
- Manual review of proposed plan content and RTL on mobile

## Later improvements (out of Phase 1)

- Editing `onboardingProfile.knownSurahs` and personal goals from Account Settings
- Optional recitation-day and personal starting-ayah controls
- More sophisticated plan generation based on actual assessed retention rather than self-report
- Account deletion and full privacy/account management workflows
