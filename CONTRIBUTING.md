# Contributing

Setup, commands, conventions and the definition of done are in [AGENTS.md](AGENTS.md). This page only covers how changes move into `master`.

## Branches

- Branch from `master`. Name it `type/short-description`, e.g. `fix/fas-callback-ip` or `feat/plan-activation-countdown`.
- Keep one concern per branch. Rebase on `master` before opening the PR.
- Do not push to `master` directly.

## Pull requests

- Title in Conventional Commits form (`feat(flight-plans): ...`).
- Describe what changed and why, how you checked it (typecheck, lint, tests, build) and anything an operator must do before deploying (new env vars, `npm ci`, migrations).
- CI must pass: it runs the same gates as AGENTS.md plus `npm audit`.
- Changes to anything listed under "Contracts that must not change" in AGENTS.md need a note in the PR and a matching update of `docs/API.md`.
- User-visible or operator-relevant changes also get an entry in `CHANGELOG.md`.
