# Account Center — Phase 2

Branch: `feature/account-center-phase2`. This phase changes the account UI and existing account-state API response only. It does not add database tables or alter Supabase/Auth configuration.

## Main sections

- **Account overview:** authenticated user's name/email, RLS-protected cloud state, exact last confirmed `user_state.updated_at`, access to preferences, sync/backup, privacy, switching accounts and signing out.
- **Manage my journey:** edit current Quran stage, self-reported level, goal (review/memorize/both), daily minutes (10–180), separate weekdays for memorization and revision, usual recitation weekday, and self-reported prior surah/ayah ranges. Changes are *staged in memory* until Save.
- **Sync & backup:** server-side `updated_at`, state revision, manual GET of authenticated server state with revision comparison, existing JSON backup export. Cloud conflict **never overwrites** a newer revision from another device; prompts to export and reload.
- **Privacy & data:** describe owner-only cloud state and separate guest local storage; export account JSON. **Actual deletion is not available** until an audited, owner-authorized server endpoint and real deletion tests are implemented. No destructive UI control pretends to work.

## Safety and persistence

`buildSettingsUpdate` creates a copy of the authenticated account data and changes only `settings`. It never alters `units`, `activities`, `studyPlan`, `sessions`, `revisions`, `tasks`, or any saved evidence of recitation or memorization. Self-reported known surahs are metadata only.

Changes use the existing `accountClient.save(doc)` method and `PUT /api/account/state` with `expectedRevision`, followed by existing per-user RLS. The modal indicates a pending save until the cloud confirms it. If the cloud reports a conflict, it stops writing and offers a backup.

The API adds optional `updatedAt` to GET/PUT state responses, derived from the server-controlled row's `updated_at`. Existing callers can ignore it.

## QA checklist

1. Run `npm test` and `npm run build:pages`; all previous suites must pass along with `test/account-center.test.js`.
2. Test on a Google account that **already has a real journey**, to verify it opens the overview rather than onboarding. Start with a JSON backup for safety.
3. Edit goals and separate weekdays; verify existing planned and completed records remain unchanged. Reload from server and verify preferences persisted.
4. Test custom minutes/range errors and check that invalid inputs are rejected without a cloud write.
5. Open the account from phone-sized 390px and desktop, inspect scroll/focus/RTL, and switch account safely.
6. Verify the server last-save timestamp changes only after a successful write, and distinguish pending/success/conflict.
7. Make edits on two authorized test devices to create a revision conflict. The app must refuse to overwrite remote data.
8. Verify backup JSON can be downloaded and contains current user data without exposing another user's state.
9. Verify the account deletion control is visibly unavailable and does **not** delete a user; no misleading success state.
10. Confirm the branch Preview has an exact approved Google OAuth redirect URL in Supabase before interactive login. Recommended allowlist entry:
   `https://feature-account-center-phase.rihlati-quran.pages.dev/api/account/google/callback*`

## Not yet included

- An actual account deletion backend: needs server-side Auth Admin privileges, strong recent re-auth verification, session cleanup, and real test accounts. The destructive control must remain disabled until that is implemented and tested.
- A published full privacy policy and terms text reviewed for launch.
- No automatic rewrite of previously planned Quran activities after a preference change; edit each via Quran Plan.
- Full visual/mobile and live two-account QA, required before merging Phase 2 into production.
