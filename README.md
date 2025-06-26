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

## Project Status
Currently Offline: The application is temporarily offline. After the initial launch, which garnered over 3,000 page views and 200+ registered users, the Azure instance was accidentally overprovisioned, leading to unforeseen costs that exhausted the initial credits.

### Future Plans:

- Restart the application for the Fall quarter with optimized, cost-effective resource allocation.
- Improve semantic search capabilities for even more intuitive discovery.
- Refine the UI/UX based on user feedback.
- Apply lessons learned in marketing for a more impactful relaunch.

Questions? Feel free to reach out at spallamr@uci.edu.

_Instinct is not affiliated with or endorsed by the University of California, Irvine._
