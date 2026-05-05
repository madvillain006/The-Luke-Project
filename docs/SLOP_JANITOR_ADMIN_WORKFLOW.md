# Slop-Janitor Administrative Workflow

This repo is configured so future cleanup and feature work can be driven through
durable Codex plans instead of long one-off prompt chains.

## What Was Added

- `.agent/PLANS.md` defines Luke-specific ExecPlan rules for Codex and
  `slop-janitor`.
- `scripts/luke-slop-janitor.ps1` is a guarded local launcher for
  `slop-janitor`.
- `runs/` is ignored because `slop-janitor` writes terminal logs and state files
  there for inspection.
- The `slop-janitor` skills were installed globally under
  `C:\Users\conor\.codex\skills` for future Codex projects.

Restart Codex after the global install so the newly installed skills are loaded
in future sessions.

## Important Constraint

`slop-janitor` requires a clean git worktree before it starts. If Luke has
pre-existing modified, deleted, or untracked files, the local launcher refuses
to run and prints `git status --short -uall`.

This is intentional. Luke has live trading paths and a lot of concurrent work.
Commit, stash, or intentionally discard unrelated work before starting an
automated janitor run.

## External Prerequisites

The upstream project requires:

- Python 3.11 or newer.
- Rust `cargo` on PATH.
- A separate clone of `grp06/slop-janitor`.
- A separate clone of the open-source `openai/codex` repo.
- `CODEX_WORKSPACE` pointing at the Codex Rust workspace, normally
  `...\codex\codex-rs`.
- `slop-janitor auth login` completed for the account used by Codex.

At setup refresh on 2026-05-05, `slop-janitor` was installed from
`grp06/slop-janitor`, Rust/cargo was installed with rustup, and
`CODEX_WORKSPACE` was set to `C:\Users\conor\tools\codex\codex-rs`.

The first Codex app-server build did not complete on this machine. The default
parallel cargo build failed with Windows paging-file/memory exhaustion, and a
low-memory retry with one cargo job timed out after 20 minutes. Rerun the auth
status command below before assuming goal mode is fully runnable.

## Recommended Setup Commands

Use a tools directory outside Luke so third-party source does not become part of
this repo:

```powershell
git clone https://github.com/grp06/slop-janitor.git C:\Users\conor\tools\slop-janitor
git clone https://github.com/openai/codex.git C:\Users\conor\tools\codex
setx CODEX_WORKSPACE C:\Users\conor\tools\codex\codex-rs
python -m pip install -e C:\Users\conor\tools\slop-janitor
slop-janitor auth --codex-workspace C:\Users\conor\tools\codex\codex-rs login
```

If the first Codex Rust build exhausts memory, retry with a narrower build:

```powershell
$env:CARGO_BUILD_JOBS='1'
$env:CARGO_INCREMENTAL='0'
$env:CARGO_PROFILE_DEV_DEBUG='0'
$env:RUSTFLAGS='-C debuginfo=0'
slop-janitor auth --codex-workspace C:\Users\conor\tools\codex\codex-rs status
```

After opening a new terminal, confirm:

```powershell
slop-janitor auth --codex-workspace C:\Users\conor\tools\codex\codex-rs status
cargo --version
```

## Luke Usage

Run from the repo root only after `git status --short -uall` is clean:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\luke-slop-janitor.ps1 -Mode janitor -Prompt "Find the best low-risk cleanup that reduces residue without changing trading behavior."
```

For larger work with an explicit brief:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\luke-slop-janitor.ps1 -Mode builder -Prompt "Implement the approved operator-state simplification plan." -Slices 3
```

For goal-plan mode:

1. In Codex, ask for `$create-goals` to create `.agent/goals/<id-slug>/`.
2. Review or edit the goal artifacts.
3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\luke-slop-janitor.ps1 -Mode goals
```

## Operator Role

Your work becomes mostly administrative when you keep the repo ready for the
runner:

- keep the worktree clean before autonomous runs
- approve or edit the plan artifacts
- review checkpoint commits
- inspect `runs/*.log` and `runs/*.state.json`
- require tests and sacred-route smoke evidence before calling anything ready

Do not delegate live trade execution, broker endpoint calls, Agent-04 personal
health changes, or PM2 reloads without an explicit operator decision.
