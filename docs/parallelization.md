# Parallelizing the modernization work

Companion to [modernization-plan.md](./modernization-plan.md). That document says
*what* to do; this one says *who can do it at the same time as whom*, and why.

The constraint is not agent count. It is **file contention** — two worktrees
editing `frontend/package.json` produce a conflict that costs more to resolve
than the work saved. The lanes below are drawn so that each one owns a disjoint
set of files.

---

## The two contention hotspots

Everything else in this repo is naturally separable. These two files are not:

| File | Wanted by | Resolution |
| --- | --- | --- |
| `frontend/package.json` | #29, #32, #37, #38, #39 | One lane owns it. All five run **serially inside Lane B**. |
| `pyproject.toml` | #27, #28, #43, #44 | #27 creates it in Wave 0. #43/#44 append their own `[tool.*]` table in Wave 3 — additive, different sections, safe. |

A third, subtler one: **#28 relocates every file under `backend/app/`**. Any
backend edit made in parallel with #28 will conflict with a rename. Nothing else
touches backend Python until #28 has merged. This is why it is in Wave 1 alone.

---

## Waves

Merge each wave to `main` before starting the next. Within a wave, lanes run in
parallel worktrees; issues within a lane run serially.

### Wave 0 — foundations · 2 parallel lanes

Nothing else can start until these land — they define the toolchain everything
else is built against.

| Lane | Issues | Model | Why |
| --- | --- | --- | --- |
| **W0-py** | #27 | strong | Dependency selection and the 3.14 target. Already de-risked (resolution + install verified), but the pruning judgment — which of the ~170 frozen packages are real — is the whole task. |
| **W0-js** | #29 | **cheap** | Purely mechanical: `bun install`, commit `bun.lock`, delete `package-lock.json`, add `packageManager`. |

Disjoint: one touches Python only, the other `frontend/` only.

### Wave 1 — restructure · 3 parallel lanes

| Lane | Issues | Model | Owns |
| --- | --- | --- | --- |
| **A** backend structure | #28 → #31 → #50(backend) → #47 | **strong** | all of `backend/app/**`, `Procfile`, `supervisord.conf` |
| **B** frontend deps | #37 → #32 → #38 → #50(frontend) | **strong** | `frontend/package.json`, `postcss.config.js`, `tailwind.config.js`, `styles/globals.css`, `frontend/next.config.mjs`, `src/middleware.js`, `src/lib/supabase*.js` |
| **D** infra | #41 → #35 → #40 | **cheap** | `.gitignore`, `docker-compose.yml`, `dump.rdb`, all Azure/Heroku files |

**Lane C is deliberately absent.** #33 (API base URL) and #34 (dead files) look
like an easy cheap-model lane, but both collide with Lane B: #34 moves
`src/app/middleware.js`, which #38 rewrites, and #33 edits CORS in `server.py`,
which Lane A is relocating. Folded into B and A respectively — see *Reassignments*.

### Wave 2 — services · 2 parallel lanes

| Lane | Issues | Model | Needs |
| --- | --- | --- | --- |
| **E** containers | #42 | cheap | #27, #28 |
| **F** scraper | #36 | **strong** | #28, #35 |

#36 is strong-model work: Selenium 4.31→4.48, Chrome/driver path normalization,
and Instagram session handling. It is the least deterministic task in the repo.

### Wave 3 — quality · 3 parallel lanes

| Lane | Issues | Model | Notes |
| --- | --- | --- | --- |
| **G** lint | #43 | cheap | Config is cheap; keep the repo-wide format pass as its **own commit** |
| **H** tests | #44 | strong | Needs the import-time fixes from #31 to be possible at all |
| **I** UI audit | #39 | strong | Bundle analysis + judgment on Chakra/Emotion |

### Wave 4 — close out · serial

#45 (CI — needs #43 and #44 to exist) → #46 (docs — describes whatever the rest settled on).

---

## Reassignments from the original plan

Two issues moved lanes once the conflict matrix was drawn:

- **#34** (dead frontend files) → split. The middleware move goes into **Lane B**
  next to #38, which rewrites that same file's auth library. The rest (delete
  root `next.config.mjs`, delete `frontend/clubs/`, fix `jsconfig.json`) is
  independent and can ride in **Lane D**.
- **#33** (API base URL) → the `api.js` change rides in **Lane B**; the CORS
  hardcoding in `server.py:31-37` belongs to **Lane A**.
- **#50** (Supabase key deprecation) → **split across both**, because it touches
  both halves. Backend sites (`supabase_client.py`, `queries.py`,
  `populate_embeds.py`) go to **Lane A**; frontend sites (`src/lib/supabase.js`,
  `src/lib/supabase-server.js`) go to **Lane B**. The `INTERNAL_API_TOKEN` split
  must happen in Lane A **before** either half renames a key — see #50.

---

## Model tiering

The split is not by difficulty but by **whether the task has a closed form**. A
cheap model is reliable when the correct output is fully determined by the issue
text; it degrades when the task requires holding the whole repo in mind.

**Cheap-model safe** — #29, #30, #33, #34, #35, #40, #41, #42, #43, #45, #46.
Each has an explicit file list and a mechanical acceptance check. #40 in
particular is a pure deletion against a list already enumerated in the issue.

**Needs a strong model** — #27, #28, #31, #36, #37, #39, #44, #47, #50:

- **#28** rewrites every import in the backend. A wrong move is silent until runtime.
- **#37** Tailwind v4 changes utility class names across every component; the codemod covers most but not all.
- **#31** is a lifecycle redesign (import-time → first-use), not a find-and-replace.
- **#36** involves a live external service with anti-bot measures.
- **#44** requires inventing test seams in code that currently has none.
- **#50** carries a live credential rotation and a privilege-separation fix; a
  half-applied rename locks you out of your own database.

### On running Gemini here

I can't dispatch Gemini from inside Claude Code — subagents run Claude models
only (Haiku 4.5 is the cheap tier). Two ways to use a cheaper model:

1. **External, per worktree** — the worktree layout below is model-agnostic. Run
   `gemini` (or any CLI) in `../instinct-wt/<lane>/`, pointed at the issue body
   as the prompt. This is what the bootstrap script is built for.
2. **In Claude Code** — `Agent(subagent_type: "general-purpose", model: "haiku")`
   per cheap lane.

Either way the real bottleneck is context, not model quality: an agent starting
cold in a fresh worktree knows nothing about this repo. **The issue body is the
contract.** That is why #27–#47 carry exact file paths, line numbers, and
acceptance criteria — they are written to be handed to a cold agent verbatim.

---

## Worktree workflow

Worktrees live **outside** the repo so they are never caught by builds, `ruff`,
or the `.gitignore` work in #41.

```
../instinct-wt/
├── w0-py/     # branch: chore/27-uv-python314
├── w0-js/     # branch: chore/29-bun
├── lane-a/    # branch: refactor/28-package-layout
├── lane-b/    # branch: chore/37-tailwind-v4
└── lane-d/    # branch: chore/41-gitignore
```

Cut a lane:

```
git fetch origin
git worktree add -b chore/37-tailwind-v4 ../instinct-wt/lane-b origin/main
```

Give the agent the issue as its brief:

```
cd ../instinct-wt/lane-b
gh issue view 37 > TASK.md
<your agent> "$(cat TASK.md)"
```

Append this to every `TASK.md` — it is what keeps parallel lanes from colliding:

> Read `docs/modernization-plan.md` and `docs/parallelization.md` first. Stay
> strictly inside this issue's file scope — other lanes are editing other files
> in parallel; the ownership table is in `docs/parallelization.md`. Do not
> reformat files you are not otherwise changing (that is #43). Meet every
> checkbox or stop and report which one you could not and why. Run the
> acceptance check before claiming done. Use `uv` (Python 3.14.7) and `bun` —
> never `pip` or `npm`.

Close a lane out with a PR that says `Closes #<issue>`, then
`git worktree remove ../instinct-wt/lane-b` once merged.

### Rules that keep merges cheap

1. **One lane owns a file.** Check the ownership table before starting.
2. **Rebase on `main` at the start of every wave**, never mid-wave.
3. **Formatting passes are their own commit** (#43) — otherwise every other
   diff in flight becomes unreviewable.
4. **Merge a whole wave before opening the next.** Partial waves reintroduce the
   contention the lanes were drawn to avoid.
5. **A lane that cannot meet its acceptance criteria stops and reports** rather
   than expanding scope into another lane's files.

---

## Realistic throughput

| Wave | Wall time (parallel) | Serial equivalent |
| --- | --- | --- |
| 0 | 1 lane-session | 2 |
| 1 | 3 lane-sessions (Lane A is longest) | 7 |
| 2 | 1 | 2 |
| 3 | 1 | 3 |
| 4 | 2 (serial) | 2 |
| **Total** | **~8 sessions** | **~16** |

The ceiling is Lane A: #28 → #31 → #47 is the longest dependent chain in the
project and gates Waves 2 and 3. If you want to shorten the critical path, that
is the only place worth attacking — start #28 first and give it the best model.
