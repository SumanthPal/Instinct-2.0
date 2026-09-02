# Working process: from an idea to merged code

How work enters this repo and moves through it. Written from what actually happened during
Waves 0–1, including the parts that went wrong.

The organizing fact: **most work here is done by agents starting cold in a fresh worktree.**
An agent has no memory of prior conversations, no idea what another lane is doing, and no
way to ask a follow-up question cheaply. Everything below follows from that.

---

## 1. Filing an issue

**The issue body is the contract.** It is pasted verbatim into an agent's `TASK.md`. If a
fact is not in the issue, the agent will guess — and a plausible guess is worse than a
question, because it looks like work.

Every issue needs four things:

| Element | Why |
| --- | --- |
| **Exact file paths and line numbers** | `server.py:165` costs nothing to write and saves an agent a search that may find the wrong thing |
| **Evidence for the claim** | Paste the error, the count, the config line. An assertion you did not verify becomes an agent's premise |
| **A checklist of tasks** | The agent reports against it; unchecked boxes are how partial work stays visible |
| **A runnable acceptance check** | Not "auth works" — `cd frontend && env -i PATH=$PATH bun run build` |

Also state, when relevant: which files the issue **must not** touch, what it depends on,
and anything that must happen in a specific order *inside* the issue.

### Verify before you write

Several issues in this repo were initially wrong because a claim went in unverified:

- "Migrate Tailwind to v5" — **there is no v5.** One `npm view` would have caught it.
- "Dedupe three `@supabase/supabase-js` ranges" — they all resolved to one version already.
- "Post images were never mirrored" — read off a 2-row sample; the real count was
  **18,820 of 18,820**. This one changed a storage decision.

Check registries, run the command, query the database. A wrong issue costs an agent's whole
run.

### Issue numbers are not plan numbers

GitHub shares one counter across issues and PRs. This repo was already at #26, so
"task 1" in the plan became **#27**. When writing issues that cross-reference each other,
create them first, capture the real numbers, then substitute — or every `#3` points at
somebody's old pull request.

---

## 2. Triage: which lane, which wave

Before an issue can be worked, it needs a **lane**, and the lane needs to own every file the
issue touches.

**Read the ownership table in [parallelization.md](./parallelization.md) first.** One lane
owns a file. Not "mostly owns" — owns.

The failure this prevents, from Wave 1: `Procfile` was listed in *both* Lane A's and Lane
D's brief. Lane A edited it for the new package layout while Lane D deleted it as dead
Heroku config. Caught mid-run only because the orchestrator was watching; the fix was a
scope correction to Lane A and a revert commit. **Check the table when the brief is written,
not when the merge conflicts.**

An issue that touches two lanes' files gets **split**, with each half named explicitly in
both briefs. #50 was split this way: backend Supabase sites to Lane A, `src/lib/supabase*.js`
to Lane B, with each brief naming the files the *other* lane owned.

### Respect ordering notes inside the issue

If an issue body says "do this after the other phases land," do not sequence it into an
early wave. #40 said exactly that and was scheduled into Wave 1 anyway; it happened to work
out because the only overlap was one file. That was luck, not design.

---

## 3. Choosing a model

The split is **not difficulty**. It is whether the task has a **closed form** — whether the
correct output is fully determined by the issue text.

| | Model | Examples |
| --- | --- | --- |
| Explicit file list, mechanical, deterministic check | cheap (`haiku`) | #29, #40, #41, #42, #45 |
| Judgment, cross-file reasoning, invents structure, live services | strong (`opus`/`sonnet`) | #28, #31, #36, #37, #44 |

Two rules that matter more than the exact pick:

- **Review with a strong model even on a cheap lane.** A cheap reviewer rubber-stamps, which
  defeats the tiering.
- **A cheap lane that returns `BLOCKED` twice gets re-run on a strong model**, not retried.

**Cost is real.** Wave 1 ran three `opus-5` lanes with `opus-5` reviewers doing 3–5 rounds
each and burned a month of credits in an afternoon. Reserve the strong tier for lanes that
genuinely need it; most of this repo's remaining work does not.

---

## 4. Running the work

See the [`herdr-waves` skill](../.claude/skills/herdr-waves/SKILL.md) for mechanics. The
contract in short:

1. Cut a worktree per lane from `origin/main`
2. Brief the agent with the issue body plus the lane contract
3. The agent implements, commits, dispatches its **own** reviewer, and iterates until clean
4. It signals completion by writing `.lane-status`: `RUNNING` → `REVIEW` → `DONE`/`BLOCKED`
5. **No lane pushes, opens a PR, or merges.** That is a human gate.

Two operational notes learned the hard way:

- `lane.sh brief` and `say` **block** until the agent replies, so briefing several lanes in
  one call times out after the first. Send them one per backgrounded call.
- When a `brief`/`say` appears to time out, **the prompt was usually still delivered.** Check
  `lane.sh tail` or the lane's git log before re-sending, or the agent executes it twice.

---

## 5. Verifying before the human gate

A lane reporting `DONE` is a claim, not a result. For each lane:

- [ ] Run the issue's acceptance check **yourself**
- [ ] `git diff --name-only origin/main...HEAD` — does it touch **only** files this lane owns?
- [ ] Check for file-level overlap between lanes (`comm -12` on sorted file lists)
- [ ] Read what the reviewer actually said, not just the final status
- [ ] Confirm no stray files: `.env`, `logs/`, `TASK.md`, `.lane-status`

**Do not take a lane's word for its acceptance.** Lane B's status read "bun run build
passes." The build failed outright with no environment set; it passed only with credentials
supplied, and the status never said so. That became #52.

**Check for secrets before every push.** Lane A's worktree held a `.env` with a live OpenAI
key, and `.env` was *not* gitignored on that branch — the ignore rule lived in an unmerged
lane. One `git add -A` would have published it. Run:

```bash
git log --all --name-only --pretty=format: | sort -u | grep -iE '(^|/)\.env($|\.)'
git grep -lE "sk-proj-|sb_secret_" origin/main..HEAD
```

---

## 6. Cross-lane handoffs

Parallel lanes create integration gaps that belong to nobody. Lane A moved every backend
module; Lane D owned `docker-compose.yml` and had no way to know. The result would have been
a broken `docker compose up` with neither lane at fault.

**A lane that discovers work outside its scope writes it into its `NOTE=` rather than doing
it.** The orchestrator turns each handoff into a new issue before the wave is handed over.
Wave 1 produced #51 and #52 this way.

Never let a lane fix something outside its ownership set "while it's in there." That is how
two lanes end up editing one file.

---

## 7. Merging

- One PR per lane, body stating what changed, **what was verified**, and what was not
- Name the conflicts and the intended resolution explicitly
- State the merge order when it matters — in Wave 1, the lane that *deleted* files had to go
  last, since it collided with the two that modified them
- The human merges. Always.

Unverified work gets said so in the PR. "Live auth not exercised — needs real credentials"
is useful. Silence reads as "verified," and that is how a false claim reaches `main`.

---

## 8. Recording decisions

Anything that changes the shape of the system goes into
[modernization-plan.md](./modernization-plan.md) with:

- **What was decided**
- **What was rejected, and why** — "Supabase Storage (ingress/egress limits)" stops the
  question being reopened in three months
- **How it was verified** — `uv sync` against 3.14.7 succeeded; the Redis free tier fits
  because every key is `ltrim`-capped

Corrections go in the same document as the original claim. The image-loss estimate was wrong
by two orders of magnitude; the plan now carries the corrected number and how it was
measured, not a quiet edit.

---

## Quick reference

**New idea →** verify the premise → file an issue with paths, evidence, checklist, acceptance
→ assign a lane from the ownership table → pick a model by closed-form-ness → run it →
**verify the claims yourself** → open a PR naming conflicts and unverified items → human
merges → record the decision.

**Found something outside your scope →** file an issue, link it, move on.
