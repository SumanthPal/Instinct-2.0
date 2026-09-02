# Parallelizing the modernization work

Companion to [modernization-plan.md](./modernization-plan.md) (what to do) and
[workflow.md](./workflow.md) (how work moves through the repo). This one says *who can do
what at the same time as whom*, and why.

**The ownership table below is authoritative.** One lane owns a file — check it before
briefing any agent. Wave 1 shipped a brief that gave `Procfile` to two lanes at once; it
only stayed cheap because it was caught mid-run.

The constraint is not agent count. It is **file contention** — two worktrees
editing `frontend/package.json` produce a conflict that costs more to resolve
than the work saved. The lanes below are drawn so that each one owns a disjoint
set of files.

---

## Contention hotspots

Everything else in this repo is naturally separable. These are not.

### Resolved by Waves 0–1

| File | Was wanted by | How it resolved |
| --- | --- | --- |
| `frontend/package.json` | #29, #32, #37, #38, #39 | Serialized inside Lane B. Worked. |
| `pyproject.toml` | #27, #28, #43, #44 | #27 created it; #43/#44 append their own `[tool.*]` tables — additive, safe |
| `backend/app/**` | #28 relocated all of it | Lane A ran alone; nothing else touched backend Python |

### Live for Wave 2 onward

| File | Wanted by | Resolution |
| --- | --- | --- |
| `backend/src/instinct/db/queries.py` | #53 (storage), #36 (scraper) | Same lane (F) |
| `tools/logger.py`, `tools/redis_queue.py` | #55, possibly #36 | **Check before briefing.** If #36 needs either, move #55 to Wave 3 |
| `frontend/src/lib/supabase.js` | #52 | Lane G alone; no other frontend work in Wave 2 |
| every file | #43's format pass | Runs alone in Wave 3, in its **own commit** |

### The one that actually bit

`Procfile` was written into **both** Lane A's and Lane D's briefs. Lane A edited it
for the new package layout while Lane D deleted it as dead Heroku config. Caught
mid-run only because the orchestrator was watching `lane.sh status`; the fix was a
scope correction and a revert commit.

Two modify/delete conflicts also reached the merge — `backend/supervisord.conf`
(A modified, D deleted) and `frontend/.gitignore` (B modified, D deleted). Both
resolved in favour of the delete, but both were avoidable by reading this table
when the briefs were written.

**Check the ownership table when briefing, not when merging.**

---

## Waves

Merge each wave to `main` before starting the next. Within a wave, lanes run in
parallel worktrees; issues within a lane run serially.

**Status as of 2026-09-02: Waves 0 and 1 are merged. 32 issues closed, 13 open.**

### ✅ Wave 0 — foundations · MERGED

| Lane | Issues | Model | Outcome |
| --- | --- | --- | --- |
| **W0-py** | #27 | strong | ✅ uv + `pyproject.toml`, Python 3.14.7, both `requirements.txt` deleted |
| **W0-js** | #29 | cheap | ✅ `bun.lock` committed, `package-lock.json` deleted |

### ✅ Wave 1 — restructure · MERGED (PRs #57, #58, #59)

| Lane | Issues | Model | Outcome |
| --- | --- | --- | --- |
| **A** backend | #28 → #31 → #50(be) → #47 | strong | ✅ `backend/src/instinct/`, **0** `sys.path` hacks, imports under empty env |
| **B** frontend | #37 → #32 → #38 → #50(fe) | strong | ✅ Tailwind 4.3.3, Serwist, `@supabase/ssr` 0.12.5 |
| **D** infra | #41 → #35 → #40 → #34 | cheap | ✅ real `.gitignore`, Redis in compose, −2,632 lines of dead deploy surface |

**Lane C was deliberately absent** — #33 and #34 looked like an easy cheap lane but
collided with Lane B. Folded in; see *Reassignments*.

### ✅ Wave 1.5 — unplanned, serial (PR #60)

Wave 1 left `docker compose up` broken: #28 moved the package but every launcher
still referenced `backend/app`. Closed #51, #42, #33 in one branch, plus a
`Makefile` (`make up` / `make down`).

This wave was not in the plan. **Cross-lane integration gaps are predictable —
budget for one after any wave that moves files.**

### ⏭️ Wave 2 — scraper and hygiene · 2 parallel lanes  ← NEXT

Re-planned. The original Wave 2 (**E** containers #42, **F** scraper #36) is
obsolete: #42 shipped in Wave 1.5, and #53 became a **blocker** for #36.

| Lane | Issues | Model | Owns |
| --- | --- | --- | --- |
| **F** scraper | #53 → #36 | **strong** | `tools/insta_scraper.py`, `tools/scraper/`, new `instinct/storage.py`, `db/queries.py` |
| **G** hygiene | #30 → #52 → #55 | cheap | `.env.example`, `frontend/src/lib/supabase.js`, `tools/logger.py`, `tools/redis_queue.py` |

**Why #53 and #36 share a lane.** Image mirroring now happens *inside* the scraper
rather than as a standalone backfill (2026-09-02 decision — a fresh CDN URL arrives
with every scrape). So `instinct/storage.py` must exist before the scraper runs at
scale, or it repopulates `image_path` with paths to objects that were never
uploaded. Same files, hard ordering, one lane.

**Check before starting:** #55 touches `tools/logger.py` and `tools/redis_queue.py`.
If lane F needs either, move #55 to Wave 3 rather than splitting ownership.

**Consider splitting lane F by model.** #53 is well-specified and mechanical enough
for a cheap model; #36 is not — it is live-site work against anti-bot measures that
cannot be verified from the issue text alone.

### Wave 3 — quality · 3 parallel lanes

| Lane | Issues | Model | Notes |
| --- | --- | --- | --- |
| **H** lint | #43 | cheap | Keep the repo-wide format pass as its **own commit** |
| **I** tests | #44 | strong | Possible only because #31 made modules importable |
| **J** UI audit | #39 | strong | Bundle analysis + judgment on Chakra/Emotion |
| **K** scraper refactor | #61 | strong | Structure-only move of `insta_scraper.py`; **needs #36 merged and a working scraper** |

### Wave 4 — deploy and close out · serial

#54 (Oracle topology) + #56 (arm64 images) → #45 (CI — needs #43/#44) → #46 (docs).

#50 stays open until the legacy Supabase keys are disabled in the dashboard; the
code on both sides is done.

---

## What Waves 0–1 cost

| Wave | Lanes | Wall time | Notes |
| --- | --- | --- | --- |
| 0 | 2 | ~1 session | as predicted |
| 1 | 3 | ~1 session | as predicted |
| 1.5 | 1 | ~1 session | **unplanned** — integration gap |

The parallelism worked. The estimate missed only the integration wave.

**Cost did not.** Wave 1 ran three `opus-5` lanes with `opus-5` reviewers at 3–5
rounds each and burned roughly a month of credits in an afternoon. The tiering in
this document is correct; it was not followed. Lane D was mechanical and reviewed
by opus for no benefit. **Use the cheap tier where the table says cheap.**

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

### Which models

| Tier | Model | Use for |
| --- | --- | --- |
| **cheap** | `meta-ai/muse-spark-1.2-contributor` | mechanical lanes — explicit file list, deterministic acceptance |
| **strong** | `anthropic/claude-sonnet-5` or `claude-opus-5` | judgment, cross-file reasoning, live external services |
| **reviewer** | always a **strong** model, even on a cheap lane | a cheap reviewer rubber-stamps, which defeats the tiering |

`muse-spark-1.2-contributor` verified working 2026-09-02:

```
$ pi --model meta-ai/muse-spark-1.2-contributor -p "Reply with exactly the word READY."
READY
```

Two gotchas that will cost time otherwise:

- The id uses **dots** — `muse-spark-1.2-contributor`, not `1-2`. A wrong id fails
  at lane launch.
- `pi auth check --provider meta-ai` reports **`not_ready` even though the model
  works**. Do not gate on it; smoke-test with `pi -p` instead.

Its 1M context is not the reason to choose it — issues here are written
self-contained so a cold agent never needs half the tree — but it is comfortable
for a lane like #36 that wants a 1,041-line file and its abandoned twin in view at
once.

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

### How lanes are actually run

Via the [`herdr-waves` skill](../.claude/skills/herdr-waves/SKILL.md): one git
worktree per lane, a `pi` agent in each under a model chosen per lane, and a
reviewer subagent that `pi` dispatches and iterates against until clean. Models
come from `pi --list-models` and are not limited to one provider.

The bottleneck is **context, not model quality**. An agent starting cold in a fresh
worktree knows nothing about this repo, which is why #27–#56 carry exact file paths,
line numbers, and acceptance criteria — they are written to be handed over verbatim.
See [workflow.md](./workflow.md) for how to write one.

Two operational notes from Wave 1:

- `lane.sh brief` and `say` **block** until the agent replies, so briefing several
  lanes in one call times out after the first. Send each in its own backgrounded call.
- A `brief`/`say` that appears to time out has usually **still been delivered**. Check
  `lane.sh tail` or the lane's git log before re-sending, or the agent runs it twice.

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

## Throughput — actual, then remaining

**Actual, Waves 0–1.5:** 3 waves, 8 lanes, 45 commits, 32 issues closed.
The parallel structure held; the estimate missed only the unplanned integration
wave (1.5), which is now a standing expectation rather than a surprise.

**Remaining:**

| Wave | Lanes | Critical path |
| --- | --- | --- |
| 2 | 2 | **F** (#53 → #36) — the scraper is the long pole |
| 3 | 3 | **I** (#44 tests) |
| 4 | serial | #54/#56 → #45 → #46 |

Lane F is the ceiling. #36 is the least deterministic task in the repo — live-site
work against anti-bot measures, where correctness cannot be judged from the issue
text. Give it the best model and start it first.

### Note on the scraper's actual state (2026-09-02)

Assessed before planning Wave 2, so #36 is not scoped blind:

- **There are two scrapers.** `tools/insta_scraper.py` (1,041 lines) is live;
  `tools/scraper/` (6 modules, ~630 lines) is a started-and-abandoned refactor
  that **nothing imports** — including duplicates of the same dead selectors.
  Decide which survives before touching either.
- **About a third of the selector surface is certainly dead** — the obfuscated
  class names (`_ab2z`, `button._acan._acao…`, `span[class*='x1lliihq']`), which
  Instagram regenerates every build.
- **The rest is structural and probably fine** — `//a[contains(@href,'/p/')]`,
  `//time[@datetime]`, `//img[@src[contains(.,'cdninstagram.com')]]`,
  `div[aria-label="Close"]`, `article img`.
- **`_ab2z` is the login-error detector** in `instagram_auth.py`. With it dead, the
  code cannot distinguish wrong-password from rate-limited from checkpoint —
  a plausible contributor to the original rate-limit trouble.

So #36 is a **selector-hardening and dead-code-removal task**, not a rewrite.

**Decided 2026-09-02:** `tools/scraper/` is deleted; `insta_scraper.py` survives and
is refactored properly in **#61** — but *after* #36 proves the scraper runs. You
cannot safely refactor code you cannot run, and with no tests yet (#44) any breakage
during a 1,041-line move would be unattributable.

#36 carries one down payment on that refactor: it touches every selector anyway, so
it lands them all in a single `selectors.py`. The volatile surface gets confined
immediately; the rest of the restructuring waits for a working baseline.
