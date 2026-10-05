# Instinct: A Production-Grade Club Discovery Platform

Instinct is a full-stack web application designed to solve the problem of club discovery at UC Irvine. It automates the process of finding club events by scraping Instagram, parsing event details using AI, and presenting them in a searchable, user-friendly interface. This project was a solo endeavor, built from the ground up during my freshman year of college, evolving from a simple Python script into a scalable, cloud-native application.

[Live Site (Temporarily Offline)](www.instincts.systems)

## Key Features
- Automated Instagram Scraper: A resilient Selenium-based scraper that navigates Instagram, handles session cookies, and detects rate limits to gather club posts.

- AI-Powered Event Parsing: Utilizes OpenAI's gpt-4-mini to extract structured event data (date, time, location, summary) from unstructured, emoji-filled, and slang-heavy post captions.

- Hybrid Search Engine: Implements a powerful search combining lexical (PostgreSQL tsvector) and semantic (vector embeddings) search, weighted 60/40, for intuitive and relevant club discovery.

- UCI-Exclusive Authentication: Secure user login via Google OAuth, restricted to users with a @uci.edu email address, with a custom dashboard for signed-in users.

- Microservices Architecture: The backend is composed of containerized services deployed on Azure Container Apps, ensuring scalability and separation of concerns.

- Advanced Scraper Orchestration: A Redis-based priority queue manages scraping tasks, preventing rate-limit errors and ensuring data freshness.

- Discord Bot Management: A custom two-bot system (Fixie Bixie & Queuetie) serves as a mobile-friendly dashboard for system monitoring, task orchestration, and database management.

- CI/CD Pipeline: Automated build, test, and deployment workflows using GitHub Actions for both the frontend (Vercel) and backend (Azure Container Registry).

## System Architecture
Instinct is built on a microservices architecture to ensure scalability, resilience, and maintainability.

## The Journey: From Script to Production App
This project's evolution mirrors a journey from a hobbyist coder to a self-taught systems architect.

**V0** (The Idea): Started as a simple Python script using Selenium and storing data in local JSON files to solve a personal problem: "Where are the club events?"

**V1** (The Prototype): Grew into a web app with a Next.js frontend and FastAPI backend, deployed on Heroku. This version faced significant challenges with Heroku's ephemeral filesystem and complex secret management.

- **Rejection & Pivot**: After being rejected for support by a student organization due to concerns about maintenance and cost, the project was temporarily shelved. A subsequent attempt to form a team was unsuccessful, reinforcing the lesson that for a passion project, the most reliable path forward is often solo.

**V2** (The Re-architecture): The project was resurrected with a complete architectural overhaul.

- Database: Migrated from a file system to PostgreSQL via Supabase for structured, scalable data storage.
- Scraper: Re-engineered the scraper into an orchestrated system using a Redis priority queue to manage rate limits and schedule tasks efficiently.
- Management: Developed a Discord bot dashboard for system control, proving more flexible and accessible than traditional cloud dashboards.

**V3** (Production Grade): After receiving Azure and GCP credits from a contact at UCI's Office of Information Technology (OIT), the project was migrated to a production-grade cloud environment.

Containerization: Learned Docker to containerize all services.

Cloud Deployment: Migrated from Heroku to Azure Container Apps, overcoming challenges with Azure's lack of native docker-compose and .env support by scripting custom solutions.

CI/CD: Implemented a full CI/CD pipeline with GitHub Actions to automate deployments.

## Local database

`make db-local` starts a throwaway Postgres, applies `supabase/migrations/` and the fake data in `supabase/seed.sql`, and prints its `DATABASE_URL`. `make db-reset` wipes it and rebuilds from scratch. Neither touches the live Supabase project.

With the Supabase CLI installed it uses `supabase db start` (Postgres only, no API containers). Without the CLI it runs one `pgvector/pgvector:pg15` container with a small auth stub (`scripts/db-local-stub.sql`). Set `DOCKER="sudo docker"` if Docker needs sudo. The seed only loads into an empty database, so restarting keeps your data. Grants are stripped from the migrations until #73, so locally `anon` and `authenticated` get `permission denied` on every table, and RLS policies can't be tested locally yet.

For real data, create the gitignored `supabase/seed.local.sql`; it is loaded instead of `seed.sql`. Refresh it with a read-only, data-only dump of the public tables, never `pending_clubs` (submitter emails) or `user_liked_clubs` (user IDs). `calendar_files` only holds per-club `.ics` files built from public events, so it is included.

```bash
supabase db dump --linked --data-only -s public \
  -x public.pending_clubs,public.user_liked_clubs \
  -f supabase/seed.local.sql
```

> **Before you ever run `supabase db push` against the live project**, mark the baseline as already applied: `supabase migration repair --linked --status applied 20261004050858`. The live database already has that schema, but the baseline was made with pg_dump, so the project's migration history won't list it until you repair it, and `db push` would try to run it against prod.

## Project Status
Currently Offline: The application is temporarily offline. After the initial launch, which garnered over 3,000 page views and 200+ registered users, the Azure instance was accidentally overprovisioned, leading to unforeseen costs that exhausted the initial credits.

### Future Plans:

- Restart the application for the Fall quarter with optimized, cost-effective resource allocation.
- Improve semantic search capabilities for even more intuitive discovery.
- Refine the UI/UX based on user feedback.
- Apply lessons learned in marketing for a more impactful relaunch.

Questions? Feel free to reach out at spallamr@uci.edu.

_Instinct is not affiliated with or endorsed by the University of California, Irvine._
