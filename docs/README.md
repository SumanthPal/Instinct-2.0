# Instinct 2.0 — Docs

| Document | What it covers |
| --- | --- |
| [workflow.md](./workflow.md) | **Start here to contribute.** How work enters the repo and moves through it: filing an issue, lane assignment, model choice, verification, merging. |
| [modernization-plan.md](./modernization-plan.md) | Audit of the tree and the four-phase plan to get it running and keep it running. Records every decision and what was rejected. |
| [parallelization.md](./parallelization.md) | The file-ownership table and wave/lane structure. **Check before starting any work** — one lane owns a file. |

## Where things are tracked

All work is GitHub issues, grouped by milestone:

- [Phase 1: Toolchain](https://github.com/SumanthPal/Instinct-2.0/milestone/1) — uv, package layout, bun
- [Phase 2: Runs locally](https://github.com/SumanthPal/Instinct-2.0/milestone/2) — env, imports, storage, scraper
- [Phase 3: Dependency health](https://github.com/SumanthPal/Instinct-2.0/milestone/3) — Tailwind, deprecated packages
- [Phase 4: Sustainable](https://github.com/SumanthPal/Instinct-2.0/milestone/4) — deploy, lint, tests, CI, docs

```bash
gh issue list --milestone "Phase 2: Runs locally"
gh issue list --label area:backend
```

## The short version

1. **Verify the premise** before filing — a wrong issue costs an agent's entire run
2. **Check the ownership table** in `parallelization.md` — one lane owns a file
3. **Write the acceptance check as a command**, not a description
4. **Run that check yourself** before trusting a `DONE`
5. **A human merges.** Always

## Planned

- `history.md` — the V0→V3 retrospective, moved out of the root README (#46)
- `ai-native-architecture.md` — Phase 5: agent orchestration, Instagram Graph API, approval queue
- Local setup lands in the root `README.md` with #46
