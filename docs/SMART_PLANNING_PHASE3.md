# Phase 3 — Explainable smart Quran scheduling (rule-based)

The new scheduling assistant is under **Today** and **Quran Plan** and uses existing study history. It has no generative AI service, paid APIs or recurring server process.

## How it works

1. Open **مساعد ترتيب الأوراد** and press **اقترح لي ترتيبًا**.
2. The read-only engine identifies **missed planned entries that lack real completed evidence**, and **due reviews backed by actual revision records linked to an existing surah unit**.
3. Suggestions respect the chosen **memorization days, revision days, usual recitation day, daily study minutes, and existing future workload**, looking up to 14 days ahead.
4. Low-rated memorization is considered for prioritization **only when a real saved rating exists**. It is never inferred from self-reported onboarding progress.
5. Every suggestion includes its factual reason, proposed weekday/date, estimated duration and **one explicit approval action**.
6. Approval uses the existing plan save path; accepting a suggestion either moves **only** the planned date of an overdue entry or adds a planned review. No completion, mastery, session or achievement is fabricated.

## Data safety

- All proposals are computed from `studyPlan`, `revisions`, `units`, and saved ratings; the computation never writes to storage or Supabase.
- The engine validates suggestions against the latest local snapshot before applying, rejects stale or invalid requests, and prevents duplicate scheduled reviews.
- A failed local save restores the original plan array. Account saves continue to use the current optimistic-concurrency state endpoint and its backup/conflict behavior.
- Existing Quran content, personal settings, completed activities and recitation proof remain unchanged.
- The assistant does **not** automatically alter any missed task, add a task, or log an achievement.

## Test plan

- `npm test` and `npm run build:pages`.
- Review real-world suggestions on a preview test account with unfinished planned entries and at least one legitimately due revision.
- Ensure existing completed items are excluded and suggestions do not duplicate scheduled reviews.
- Confirm that days exceeding your daily budget are skipped and a later permitted day is proposed.
- Verify each button has explicit confirmation; cancel leaves all data unchanged.
- Apply one suggestion and reload from the cloud. Confirm the only changed data is the planned item, and no completed activity was created.
- Verify on 390px mobile viewport, desktop and RTL; test 2-device conflict and backup safety before merging.

## Limitations / next possible improvements

- Rules are a transparent first version, **not** a claim to predict Quran mastery or provide scholarly evaluation.
- A review can be proposed only when the app has a real due revision; it does not invent reviews based on an unchecked memorization claim.
- Users still edit the ayah range or calendar manually when needed.
- No automatic plan rewriting, push reminders or background jobs.
- Preview OAuth redirect URL must be explicitly allowed in Supabase:
  `https://feature-smart-planning-phase.rihlati-quran.pages.dev/api/account/google/callback*`
