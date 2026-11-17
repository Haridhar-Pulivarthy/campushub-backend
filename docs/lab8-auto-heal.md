# Lab 8: Auto-Healing CI

`.github/workflows/ci.yml` runs four jobs on pushes and pull requests to
`main`:

| Job                 | Runs when                             | Permissions                               | What it does                                                                                                                                       |
| ------------------- | ------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend`           | always                                | read                                      | `npm ci`, lint, auto-heal policy tests, Jest (`--ci`). Saves Jest output as the `jest-results` artifact (`test-results.log`) even when tests fail. |
| `client`            | always                                | read                                      | `npm ci` and lint in `client/`.                                                                                                                    |
| `auto-heal`         | Jest failed on a same-repository PR   | read                                      | One AI repair attempt, then lint, typecheck, and the full Jest suite on the patched code.                                                          |
| `auto-heal-publish` | `auto-heal` produced a verified patch | `contents: write`, `pull-requests: write` | Pushes `fix/auto-heal-<run_id>` and opens a PR into the original PR's branch.                                                                      |

## When auto-heal runs

All of these must hold:

- The event is `pull_request` (never `pull_request_target`) and the PR branch
  is in this repository, not a fork.
- The `backend` job's Jest step failed. Its outcome is passed through the job
  output `test_outcome`. A failed install or lint skips Jest, so it does not
  trigger auto-heal, and the `client` job is never involved.
- The PR branch does not start with `fix/auto-heal-`, so repair PRs cannot
  start repair loops.
- Jest also fails on the exact PR head commit. CI tests the merge commit, so
  the job re-runs Jest on the head commit before making a paid request.

## What the repair may do

`scripts/auto-heal/repair.ts` makes one request to the Anthropic Messages API
per run, using the official SDK and one selected model. It sends the Jest log
from the head-commit run (not the merge-commit CI log), the PR diff, all of
`src/` (tests included, read-only), `shared/api.d.ts`, `docs/openapi.yaml`, and
`CLAUDE.md`. The answer is structured JSON with a diagnosis and whole-file
replacements. Nothing the model writes is executed as a command.

Edits are accepted only for existing, tracked `src/**/*.ts` application files,
at most three. Rejected:

- tests (`__tests__/`, `*.test.ts`, `*.spec.ts`) and `src/test/`
- `src/config/`, `.d.ts` files, and every file outside `src/`: configuration,
  dependencies, workflows, docs, and scripts
- new, deleted, or renamed files
- new `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, or `@ts-expect-error`
  comments

If any edit breaks the policy, the whole answer is discarded. The rules live in
`scripts/auto-heal/policy.ts` and are tested by `npm run test:scripts`.
`check-changes.ts` checks the working tree again after verification and again
in the publish job after the patch is applied.

The repair scripts are checked out from the PR's base commit (`.heal-tools/`),
and their dependencies (including the Anthropic SDK) are installed there from
the base lockfile. A PR cannot change the code or packages that hold the API
key or enforce the policy.
The API key is set only on the repair step. Lint, typecheck, and Jest run the
patched code without the key or a Git token.

## Publishing

A repair is published only if lint, typecheck, and Jest all pass and an allowed
`src/` diff exists. The publish job runs no project code. It first aborts if
the original PR is closed or its head has moved past the tested failing SHA.
Otherwise it applies the verified patch, commits it to
`fix/auto-heal-<run_id>`, and opens a PR whose base is the original PR's
branch, never `main`.

Re-running the workflow run keeps the same `run_id`, so it reuses the branch and
PR. A new commit is added on top of the existing branch tip (a fast-forward,
never a force push), and the PR body is updated. An identical repair is a
no-op.

The PR body lists the original PR, the failing SHA, the workflow run, the
model's diagnosis, and the actual verification results. Its human-review
section starts as **Pending**.

PRs opened with `GITHUB_TOKEN` do not trigger workflow runs. That is why
verification runs before the PR is opened.

## Setup

1. **Secret:** go to Settings → Secrets and variables → Actions → New
   repository secret and add `ANTHROPIC_API_KEY`. The scripts never print it.
2. **Allow PR creation:** go to Settings → Actions → General → Workflow
   permissions and enable "Allow GitHub Actions to create and approve pull
   requests". Leave the default token permission as read-only; the publish job
   requests write access for itself. Without this setting, the publish job
   pushes the branch and then fails with a pointer to this setting.
3. **Optional variables** (Settings → Secrets and variables → Actions →
   Variables):
   - `AUTO_HEAL_MODEL` (default `claude-opus-5-5`)
   - `AUTO_HEAL_EFFORT` (`low` | `medium` | `high` | `xhigh` | `max`, default
     `high`)

   Only the selected model is used. There is no fallback model: if it declines
   or finds no safe fix, the run ends without a repair.

## Local checks (no API calls)

```sh
npm run test:scripts   # edit-policy unit tests (node:test)
npm run typecheck      # includes tsc -p scripts
npm run lint           # includes scripts/
```

`repair.ts` also accepts `AUTO_HEAL_DRY_RUN_RESPONSE=<file.json>`, a canned
answer in the response schema. With it, the script builds the real prompt
(saved as `OUT_DIR/prompt.md`) and applies the policy without calling the API.
This mode is for local simulation only; the workflow never sets it.

The runner image is pinned to `ubuntu-26.04`, the image used by the first
passing run (Part 1).
