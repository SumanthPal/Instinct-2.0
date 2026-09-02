# Instinct 2.0 — Modernization Plan

**Status:** draft · **Created:** 2026-09-01 · **Owner:** @SumanthPal

The goal is to get the repo running locally again and leave it in a state where
it stays runnable. Two objectives, in order:

1. **It works** — `bun dev`, the FastAPI server, Redis, and the scraper all come
   up on a clean machine from documented steps.
2. **It keeps working** — one dependency manager per language, one lockfile, no
   dead deployment surface, CI that fails when the above breaks.

Everything below is grounded in an audit of the tree as of `a8f5e30`. Findings
are stated with the file that produced them so nothing here is guesswork.

---

## Decisions already made

| Question | Decision | Verified |
| --- | --- | --- |
| Python packaging | `uv` + a single root `pyproject.toml` | — |
| Python version | **3.14.7** (up from the 3.11.8 pin) | ✅ full `uv sync` succeeds, all wheels present |
| JS package manager | `bun` | — |
| Tailwind | **v4.3.3** — see note below | ✅ npm `latest` |
| Local database | Cloud Supabase (existing project, creds via `.env`) | — |
| Local Redis | Docker service in `docker-compose.yml` | — |
| PWA layer | Migrate `next-pwa` → `@serwist/next` | — |

### Note: there is no Tailwind v5

`tailwindcss` dist-tags as of this writing: `latest: 4.3.3`, `next: 4.0.0`,
`v3-lts: 3.4.19`. No v5 exists. The target is **4.3.3**, which still resolves the
v3/v4 conflict currently in `package.json` and is the real migration work.

### Python 3.14.7 is verified, not assumed

The whole dependency set was resolved *and installed* against 3.14.7 before
committing to it:

```
Resolved 97 packages · uv sync --extra discordbot → clean
pydantic 2.13.5 · pillow 12.3.0 · numpy 2.5.2 · matplotlib 3.11.1
selenium 4.48.0 · fastapi 0.141.1 · redis 8.1.0 · openai 3.7.0
```

No source builds, no missing wheels — including the C/Rust extensions
(`pydantic-core`, `pillow`, `numpy`, `matplotlib`) that usually gate a new
Python minor.

### The version jumps are large but the exposed API surface is small

Taking `latest` moves `openai` 1.74 → **3.7.0** (two majors), `redis` 5.2 → **8.1**,
and `starlette` 0.46 → **1.6.0**. Audited what the code actually calls:

- **OpenAI** — only `OpenAI(api_key=…)`, `client.embeddings.create()`, and
  `client.chat.completions.create()` (`ai_validation.py:20,26,69,137`,
  `populate_embeds.py:17,26`). All three are the stable core that survived both
  majors. Low risk.
- **Redis** — only `from_url`, `get/set/delete/exists`, `hset/hget/hgetall`,
  `lpush/lrange/ltrim`, `zadd/zrange/zrangebyscore`, `pipeline`. All core
  commands, unchanged across 5→8. Low risk.
- **Starlette/FastAPI** — reached only through FastAPI, which pins its own
  compatible range.

Tracked as a verification task in #47 rather than a blocker.

### Two model-related findings

- `ai_validation.py:70` pins `gpt-4.1-mini-2025-04-14`, a dated snapshot from
  April 2025. Worth moving to a current model (#47).
- `text-embedding-3-small` (`ai_validation.py:26,138`, `populate_embeds.py:27`)
  is **load-bearing**: stored vectors in Supabase were generated with it.
  Changing the embedding model invalidates every existing embedding and forces a
  full re-index. Do not touch it as part of a routine dependency bump.

## Tracking

All 20 tasks are GitHub issues (#27–#46), grouped by milestone:

- [Phase 1: Toolchain](https://github.com/SumanthPal/Instinct-2.0/milestone/1) — #27–#29
- [Phase 2: Runs locally](https://github.com/SumanthPal/Instinct-2.0/milestone/2) — #30–#36
- [Phase 3: Dependency health](https://github.com/SumanthPal/Instinct-2.0/milestone/3) — #37–#39
- [Phase 4: Sustainable](https://github.com/SumanthPal/Instinct-2.0/milestone/4) — #40–#46

Filter with `gh issue list --milestone "Phase 2: Runs locally"` or by the
`area:backend` / `area:frontend` / `area:infra` / `area:tooling` labels.

## Security check — done, clean

`backend/.gitignore` lists `instinct-459021-c6c9b84da7c1.json`, the filename
shape of a GCP service account key. Checked against full history:

```
git log --all --diff-filter=A --name-only -- '*instinct-*.json' '*service-account*.json' '*credential*.json'
```

No match — the key was never committed, so nothing needs rotating. Noted here
because the repository is public and the question is worth re-asking whenever a
credential filename shows up in a `.gitignore`.

---

---

## Current state — audit findings

### Python

- **Two divergent dependency files.** Root `requirements.txt` lists 23
  hand-picked packages; `backend/requirements.txt` is a ~170-line `pip freeze`.
  They disagree on versions (`openai` 1.77.0 vs 1.74.0, `redis` 6.0.0 vs 5.2.1,
  `pydantic` 2.11.4 vs 2.10.6, `psutil` 6.0.0 vs 7.0.0). Nothing says which is
  authoritative.
- **Junk in the freeze.** `backend/requirements.txt` carries dev tooling and
  transitive noise as if it were intent: `ipython`, `jupyter_*`, `nbconvert`,
  `nbformat`, `pipreqs`, `yarg`, `docopt`, `backcall`, `pickleshare`, `appnope`.
- **Stub/duplicate packages.** `dotenv==0.9.9` alongside `python-dotenv`,
  `discord==2.3.2` alongside `discord.py`, `bs4==0.0.2` alongside
  `beautifulsoup4`, `psutils==3.3.9` alongside `psutil`. The first of each pair
  is a placeholder package, not the real one.
- **Unused heavy dependencies.** No import of `boto3`, `botocore`, `s3transfer`,
  `azure-core`, `azure-storage-blob`, `pypdf`, `puremagic` anywhere under
  `backend/`. The only cloud SDK actually imported is `google-cloud-storage`
  (`backend/app/db/queries.py:20-21`).
- **Three mutually incompatible import roots.** `backend/app/server.py:1-5` uses
  `from tools.…` / `from db.…` (needs `backend/app` on the path);
  `backend/utils/helpers.py:6` uses `import app.tools.logger` (needs `backend/`);
  `backend/app/tools/redis_queue.py:11` and `scraper_rotation.py:14` patch
  `sys.path` at runtime to paper over the difference. There is no installable
  package.
- **Version target is stale.** `runtime.txt` pins `python-3.11.8`; all three
  Dockerfiles pin `python:3.11.8-slim`. Local `python3` is 3.14.7.

### Import-time landmines

These make the backend unimportable — not just unrunnable — without a full env,
which is why nothing can currently be tested in isolation:

- `backend/app/db/supabase_client.py:11-12` **raises** `EnvironmentError` at
  module import when `SUPABASE_URL` / `SUPABASE_KEY` are unset.
- `backend/app/tools/logger.py:14-19` calls `redis.from_url(os.getenv('REDIS_URL'))`
  at import. With the var unset this is `from_url(None)`. It also `print()`s the
  Redis URL, credentials included.
- `backend/app/server.py:3` imports `ScraperRotation` at module top, pulling
  Selenium, the Redis queue, and the whole scraper stack into the web process.

### Frontend

- **No lockfile discipline.** `package-lock.json` present, no `node_modules`,
  no `packageManager` field, no engines constraint.
- **`next-pwa` ^5.6.0 with Next 16.1.4.** `next-pwa` is unmaintained and
  predates the App Router; `frontend/next.config.mjs` wraps the whole config in
  it. This is the most likely hard build failure.
- **Hardcoded dead API URL.** `frontend/src/lib/api.js:8` points at
  `https://instinct-web-45256917921.us-central1.run.app` with three previous
  URLs commented out above it. There is no way to point the frontend at a local
  backend without editing source.
- **Tailwind v3/v4 conflict.** `tailwindcss` ^3.4.17 (devDep) and
  `@tailwindcss/postcss` ^4.0.16 (dep) are both installed;
  `frontend/postcss.config.js` uses the v3 plugin form. One of these is wrong.
- **Deprecated / placeholder packages.** `@shadcn/ui` ^0.0.4 (npm placeholder),
  `shadcn-ui` ^0.9.4 (renamed to `shadcn`), `supabase` ^2.22.6 (the CLI, listed
  as a runtime *dependency*), `@supabase/auth-helpers-nextjs` ^0.10.0
  (superseded by `@supabase/ssr`, which is *also* installed).
- **Three overlapping UI systems.** `@chakra-ui/react` + `@emotion/*`,
  `@headlessui/react`, and Tailwind/shadcn all ship in the bundle.
- **Dead files.**
  - `next.config.mjs` at the repo root — a second, conflicting Next config
    outside the Next project. Only `frontend/next.config.mjs` is read.
  - `frontend/clubs/page.js` — outside `src/app`, so never routed. A different
    5-line file already lives at `frontend/src/app/clubs/page.js`.
  - `frontend/src/app/middleware.js` — Next only loads middleware from the
    project root or `src/`. Its own first line reads
    `// middleware.js (should be at the root of your project)`. Auth session
    refresh is currently not running.
  - `frontend/jsconfig.json` maps `@/components/ui` → `src/ui`, which does not
    exist.
- **Next 16 API drift to verify:** `viewport` is set inside the `metadata`
  export (`frontend/src/app/layout.js:31`) rather than as its own `viewport`
  export; `images.domains` is used rather than `remotePatterns`; the `lint`
  script calls `next lint`. Each of these changed in recent Next majors —
  confirm against the 15→16 upgrade notes rather than assuming.

### Infrastructure

- **No Redis anywhere in compose.** `docker-compose.yml` defines `web`,
  `scraper`, and `discord`, all of which need `REDIS_URL`, and no `redis`
  service to satisfy it.
- **`dump.rdb` is committed** — a 185 KB stale Redis snapshot at the repo root.
- **Root `.gitignore` is two lines** (`dump.rdb`, `/.vscode`). No
  `__pycache__`, `.venv`, `node_modules`, or `.env`. Only `backend/.gitignore`
  and `frontend/.gitignore` provide real coverage, and only for their subtrees.
- **Port mismatch.** `backend/Dockerfile.web` exposes and serves 8080 (Cloud
  Run), while `docker-compose.yml` sets `PORT=8000`, maps `8000:8000`, and
  overrides the command to `python app/server.py`. The Dockerfile `CMD` is dead
  in local use.
- **Dead deployment surface.** From the Azure and Heroku eras, none of it
  currently exercised: `push-to-prod-azure.sh`, `web-app-config.json`,
  `healthcheck.sh`, `Dockerfile.scraper.debug`, `backend/Dockerfile.diagnostic`,
  `backend/docker-compose.azure.yml`, `backend/cloudbuild.yaml`,
  `backend/deploy.sh`, `backend/supervisord.conf`, `backend/shell-scripts/*`
  (4 Azure scripts), `Procfile`, `runtime.txt`. `scraper.yaml` is 0 bytes.
- **No CI.** There is no `.github/` directory, despite the README advertising
  "a full CI/CD pipeline with GitHub Actions."
- **No tests.** `pytest` and `pytest-mock` are in the freeze; there are zero
  test files.

---

## Plan

Four phases. Phase 2 is the one that satisfies the original ask; phases 3–4 are
what stop this from rotting again.

### Phase 1 — Toolchain migration

Swap the package managers before touching anything else, so every later change
is made against a locked, reproducible environment.

| Issue | Task | Acceptance |
| --- | --- | --- |
| [#27](https://github.com/SumanthPal/Instinct-2.0/issues/27) | Root `pyproject.toml` + `uv.lock`, deps derived from actual imports | `uv sync` succeeds; both `requirements.txt` and `runtime.txt` deleted |
| [#28](https://github.com/SumanthPal/Instinct-2.0/issues/28) | Make `backend/app` a real installable package | No `sys.path.append` anywhere; `uv run python -c "import instinct.server"` works from any cwd |
| [#29](https://github.com/SumanthPal/Instinct-2.0/issues/29) | `npm` → `bun` in `frontend/` | `bun.lock` committed, `package-lock.json` deleted, `bun install && bun run build` clean |

Dependency set for #27, derived from imports rather than the freeze:
`beautifulsoup4`, `discord.py`, `email-validator`, `fastapi`, `google-cloud-storage`,
`httpx`, `ics`, `matplotlib`, `numpy`, `openai`, `pillow`, `psutil`, `pydantic`,
`python-dateutil`, `python-dotenv`, `pytz`, `redis`, `requests`, `schedule`,
`selenium`, `supabase`, `typing-extensions`, `uvicorn`, `webdriver-manager`.
`matplotlib` + `numpy` are used only by `backend/app/tools/bot/job_bot.py` and
belong in an optional `discord` extra.

### Phase 2 — Make it run locally

| Issue | Task | Acceptance |
| --- | --- | --- |
| [#30](https://github.com/SumanthPal/Instinct-2.0/issues/30) | `.env.example` for backend and frontend, every var documented | A new clone runs from `cp .env.example .env` + filling in secrets |
| [#31](https://github.com/SumanthPal/Instinct-2.0/issues/31) | Remove import-time crashes (Supabase, Redis logger) | `import` of any backend module succeeds with an empty environment; failure happens at first use, with a clear message |
| [#32](https://github.com/SumanthPal/Instinct-2.0/issues/32) | `next-pwa` → `@serwist/next` | `bun run build` produces a service worker; app installable |
| [#33](https://github.com/SumanthPal/Instinct-2.0/issues/33) | `API_BASE_URL` → `NEXT_PUBLIC_API_BASE_URL` | Frontend talks to `http://localhost:8000` with no source edits |
| [#34](https://github.com/SumanthPal/Instinct-2.0/issues/34) | Delete dead frontend files; move middleware to `frontend/src/middleware.js` | Auth session refresh actually runs; no orphan configs |
| [#35](https://github.com/SumanthPal/Instinct-2.0/issues/35) | Add `redis` service + named volume to compose; delete committed `dump.rdb` | `docker compose up redis` and the backend connects |
| [#36](https://github.com/SumanthPal/Instinct-2.0/issues/36) | Scraper runs locally | Documented Chrome/cookie setup; one club scrapes end to end |

**Env vars to document** (#30) — backend: `SUPABASE_URL`, `SUPABASE_KEY`, `REDIS_URL`,
`OPENAI`, `PORT`, `GCP_URL`, `GC_CREDENTIAL`, `BUCKET_NAME`, `USER_ID`,
`INSTAGRAM_USERNAME`, `INSTAGRAM_PASSWORD`, `COOKIE_1`, `COOKIE_2`, `CHROME_BIN`,
`GOOGLE_CHROME_BIN`, `CHROMEDRIVER_PATH`, `DOCKER_ENV`, plus the Discord set
(`JOB_BOT_TOKEN`, `JOB_BOT_PREFIX`, `JOB_BOT_CHANNEL_ID`,
`JOB_BOT_ERROR_CHANNEL_ID`, `JOB_BOT_ADMIN_ROLE_ID`, `AUX_BOT_TOKEN`,
`AUX_BOT_PREFIX`, `AUX_BOT_CHANNEL_ID`, `AUX_BOT_ADMIN_ROLE_ID`, `SERVER_ID`).
Frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_BASE_URL`.

Note the naming: `OPENAI` should become `OPENAI_API_KEY`, and `SUPABASE_KEY`
should say which key it is. Rename as part of #30 while the blast radius is
still one file.

**The Supabase names are forced, not chosen (#50).** Supabase is retiring the
`anon` and `service_role` keys by end of 2026 — about four months out. The
replacements are `sb_publishable_…` and `sb_secret_…`, so the variables become
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. `SUPABASE_URL`
is unchanged.

That migration also surfaced a security problem worth fixing first:
`server.py:165,224` authenticate the Discord bot to this project's own API with
`f"Bearer {db.SUPABASE_KEY}"` — the **`service_role` key doubles as the internal
API token**. Anything that can read that token has full RLS-bypassing database
access. #50 splits out a separate `INTERNAL_API_TOKEN` before rotating anything.

### Phase 3 — Dependency health

| Issue | Task | Acceptance |
| --- | --- | --- |
| [#37](https://github.com/SumanthPal/Instinct-2.0/issues/37) | Resolve the Tailwind v3/v4 conflict | Exactly one Tailwind major; `postcss.config.js` matches it |
| [#38](https://github.com/SumanthPal/Instinct-2.0/issues/38) | Drop deprecated/placeholder packages | `@shadcn/ui`, `shadcn-ui`, `supabase` (CLI as dep), `@supabase/auth-helpers-nextjs` gone; auth on `@supabase/ssr` only |
| [#39](https://github.com/SumanthPal/Instinct-2.0/issues/39) | Audit overlapping UI libraries | Chakra/Emotion either justified or removed; bundle size recorded before/after |

### Phase 4 — Keep it working

| Issue | Task | Acceptance |
| --- | --- | --- |
| [#40](https://github.com/SumanthPal/Instinct-2.0/issues/40) | Prune the dead Azure/Heroku deployment surface | Only files describing how the project is *actually* deployed remain |
| [#41](https://github.com/SumanthPal/Instinct-2.0/issues/41) | Real root `.gitignore` | `__pycache__`, `.venv`, `node_modules`, `.env*`, `*.rdb` covered |
| [#42](https://github.com/SumanthPal/Instinct-2.0/issues/42) | Dockerfiles on `uv`; fix the 8000/8080 mismatch | Images build; `docker compose up` serves on one documented port |
| [#43](https://github.com/SumanthPal/Instinct-2.0/issues/43) | Lint + format: `ruff` (Python), Biome or ESLint flat config (frontend) | `uv run ruff check` and the JS linter both pass |
| [#44](https://github.com/SumanthPal/Instinct-2.0/issues/44) | Test baseline | `pytest` runs; smoke tests for the Supabase client, Redis queue, and one API route |
| [#45](https://github.com/SumanthPal/Instinct-2.0/issues/45) | CI on GitHub Actions | PRs run lint + build for both halves; badge in README |
| [#46](https://github.com/SumanthPal/Instinct-2.0/issues/46) | Rewrite `README.md`; add `CLAUDE.md` | README describes the current stack and real local setup, not the Azure history |

---

## Ordering constraints

- **#27 → #28 → #31**: the package layout has to be fixed before import-time
  cleanup is worth doing, and both must land before tests (#44) are possible.
- **#29 → #32 → #33 → #37**: all touch `package.json` / `next.config.mjs`;
  serialize these to avoid conflicts.
- **#35 before #36**: the scraper cannot be verified without Redis.
- **#40 last in its lane** — deleting deployment files is easiest to review once
  nothing else is in flight.

## Explicitly out of scope

Relaunching to production, Azure→GCP cost work, semantic search quality, and
UI/UX changes. This plan stops at "a clean clone runs, and CI proves it."
