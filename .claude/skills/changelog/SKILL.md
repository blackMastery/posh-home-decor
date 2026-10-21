---
name: changelog
description: Create or update CHANGELOG.md in the project root from git history, grouped under date headings. Run manually before merging a branch.
disable-model-invocation: true
argument-hint: "[base-branch]"
allowed-tools: Bash(git log:*), Bash(git rev-parse:*), Bash(git merge-base:*), Bash(git diff:*), Bash(git status:*), Bash(git branch:*), Read, Edit, Write
---

# Changelog

Maintain `CHANGELOG.md` at the repository root. Entries are grouped under one `## YYYY-MM-DD` heading per day, newest day first, with one bullet per change.

## File format

```markdown
# Changelog

All notable changes to this project are recorded here, grouped by date (newest first).

<!-- changelog-last-commit: <full sha> -->

## 2026-10-20

- Product names now display with consistent formatting across all components.

## 2026-10-19

- Added product attributes, faceted shop filters, and header search.
```

The `changelog-last-commit` comment records the newest commit already covered. Always update it to the last commit you included.

## Steps

1. **Find the repo root and changelog.** Run `git rev-parse --show-toplevel` and check for `CHANGELOG.md` there.

2. **Choose the commit range.**
   - **No changelog yet (backfill):** use the whole history: `git log --reverse --no-merges --date=short --format='%H%x09%ad%x09%s%n%b%x1e'`.
   - **Changelog exists:** read the `changelog-last-commit` sha and take `<sha>..HEAD` with the same format. If the marker is missing or the sha isn't in history (e.g. after a rebase), fall back to commits on the current branch not yet on the base branch (`$ARGUMENTS`, default `main`): `git log <base>..HEAD`, and skip any whose change is already described in the file.
   - If the range is empty, check `git status`. If there are uncommitted changes, tell the user they won't be logged until committed, and stop without editing.

3. **Group by date.** Use the author date (`%ad`, short form) of each commit. Put each commit under its own date heading. If a date heading already exists in the file, add the new bullets to it instead of making a second heading for that day.

4. **Write the bullets.** One bullet per meaningful change, written for someone reading the project's history, not a copy of the commit subject:
   - Drop conventional-commit prefixes (`feat:`, `fix:`, `refactor:`...), start with a capital letter, and end with a period.
   - Describe what changed for the site or the admin side in plain language. Read the commit body, and if the subject is vague, run `git show --stat <sha>`.
   - Merge commits that touch the same thing on the same day into one bullet; split a commit into several bullets if it did unrelated things.
   - Skip noise: merge commits, formatting-only changes, lockfile bumps, reverted-then-restored work, and commits that only touch `CHANGELOG.md`.
   - Mention database migrations explicitly (e.g. "Adds a migration for item code and UPC fields.") since they need a manual `supabase db push`.
   - Prefix bullets with **Fixed:** or **Removed:** where that is clearer; otherwise no prefix.

5. **Edit the file.** Create it with the header above if it doesn't exist. Insert new date sections above older ones so days stay newest-first, keep bullets within a day in commit order, and update the `changelog-last-commit` marker. Don't rewrite existing entries unless the user asks.

6. **Report back.** Show the sections you added or changed, and remind the user to commit `CHANGELOG.md` (on its own commit or amended into the branch) before merging. Don't commit it yourself unless asked.
