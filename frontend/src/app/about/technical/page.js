import Link from "next/link";
import "../../../../styles/globals.css";
import { Card, Flow, Hero, Rule, SectionLabel } from "@/components/about/Section";
import Logo from "@/components/about/Logo";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";

const FACTS = [
	["Search", "Postgres full-text, pg_trgm for typos"],
	["Events", "OpenAI structured output, LA time"],
	["Scraping", "4 runs a day, clubs in rotation"],
	["Scale", "451 clubs indexed"],
];

const PIPELINE = [
	{ logo: "instagram", title: "Caption", sub: "+ post date, LA time" },
	{ title: "Prompt + schema", sub: "strict JSON schema" },
	{ logo: "openai", title: "Model", sub: "pinned, gpt-6-luna", accent: true },
	{ title: "Rules + checks", sub: "shape check, durations" },
	{ logo: "postgresql", title: "Postgres", sub: "event saved" },
];

const GUARDRAILS = [
	["Schema", "Strict JSON schema. Every reply has the same fields and types."],
	["Rules", "Start time only: 1 hour. No time: 00:00 + whole days. Applied in code too."],
	["Date context", "Post date sent in LA time with its weekday, so “this Friday” resolves the same way."],
	["Validation", "Refusals or off-shape replies are errors, not empty results."],
	["No silent drops", "Failed parses stay unparsed and retry next run."],
	["Pinned model", "gpt-6-luna."],
];

const HARNESS = [
	{ logo: "supabase", title: "Frozen post set", sub: "saved once, reused" },
	{ logo: "openai", title: "Side by side", sub: "prompts × models", accent: true },
	{ title: "Metrics + diffs", sub: "read-only, never writes" },
];

const METRICS = [
	"zero duration %",
	"timed zero duration %",
	"midnight starts %",
	"all-day whole days %",
	"bad output",
	"API errors",
	"side-by-side diffs",
];

const STACK = [
	["Frontend", [["nextdotjs", "Next.js", "App Router, PWA"], ["react", "React", "UI, v19"], ["tailwindcss", "Tailwind CSS", "Styling, v4"]]],
	[
		"Backend",
		[
			["fastapi", "FastAPI", "REST API"],
			["python", "Python", "API + scraper"],
			["redis", "Redis", "Scrape queue"],
			["selenium", "Selenium", "Instagram scraper"],
			["instagram", "Instagram", "Source of posts"],
			["openai", "OpenAI", "Caption → events"],
		],
	],
	["Data & auth", [["supabase", "Supabase", "Postgres + auth"], ["postgresql", "PostgreSQL", "FTS + pg_trgm"], ["google", "Google", "@uci.edu sign-in"]]],
	[
		"Infra",
		[
			["vercel", "Vercel", "Hosts the site"],
			["heroku", "Heroku", "Hosts the API"],
			["cloudflare", "Cloudflare R2", "Image storage"],
			["docker", "Docker", "API + scraper images"],
			["githubactions", "GitHub Actions", "CI + API deploy"],
		],
	],
];

function SubHead({ title, file }) {
	return (
		<h3 className="mt-7 mb-3 text-sm font-semibold text-foreground">
			{title}
			{file && <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{file}</span>}
		</h3>
	);
}

export default function TechnicalAbout() {
	return (
		<div className="min-h-screen overflow-x-hidden bg-background text-foreground">
			<Navbar />
			<main className="mx-auto max-w-6xl px-6 pb-20">
				<div className="mx-auto max-w-3xl">
					<Hero
						eyebrow="Technical details"
						title="How Instinct is"
						accent="built"
						lede="Next.js, FastAPI, Postgres, and a scraper that runs 4× a day."
					>
						<Link
							href="/about"
							className="mt-7 inline-block border-b border-[var(--accent-brand)]/40 pb-0.5 text-sm font-medium text-[var(--accent-brand)] hover:border-[var(--accent-brand)]"
						>
							← Back to About
						</Link>
					</Hero>
				</div>

				<SectionLabel>Architecture</SectionLabel>
				<div className="overflow-x-auto rounded-2xl border border-border bg-[#0d0d0f] p-4 sm:p-6">
					{/* biome-ignore lint/performance/noImgElement: static SVG diagram */}
					<img
						src="/architecture.svg"
						alt="Site: Google sign-in, Next.js on Vercel, FastAPI on Heroku, Supabase Postgres. Scraper, 4 times a day: launchd on a Mac, Redis queue, Selenium on Instagram, OpenAI event parser, writing posts and events to Postgres and images to Cloudflare R2."
						className="mx-auto h-auto w-full min-w-[720px]"
					/>
				</div>

				<Rule />
				<SectionLabel>Key facts</SectionLabel>
				<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
					{FACTS.map(([k, v]) => (
						<Card key={k} className="p-5">
							<p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent-brand)]">{k}</p>
							<p className="text-sm text-foreground">{v}</p>
						</Card>
					))}
				</div>

				<Rule />
				<SectionLabel>How events get extracted</SectionLabel>
				<p className="text-sm text-muted-foreground">
					An LLM reads each caption. Guardrails keep its output consistent and stop quality slipping over time.
				</p>
				<SubHead title="Pipeline" file="tools/ai_validation.py" />
				<Flow steps={PIPELINE} />
				<SubHead title="Guardrails" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{GUARDRAILS.map(([k, v]) => (
						<Card key={k} className="p-5">
							<p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--accent-brand)]">{k}</p>
							<p className="text-sm text-foreground">{v}</p>
						</Card>
					))}
				</div>
				<p className="mt-4 text-xs text-muted-foreground">
					Why the duration rules: 272 of 2,282 events in prod had zero duration (~12%). Repeatability comes from the
					schema, rules, and evals; no temperature is sent, since gpt-6-luna only accepts the default.
				</p>

				<Rule />
				<SectionLabel>Evaluation</SectionLabel>
				<p className="text-sm text-muted-foreground">
					Before changing the model or prompt, run both on the same frozen posts and compare.
				</p>
				<SubHead title="Harness" file="scripts/eval_event_parser.py" />
				<Flow steps={HARNESS} />
				<SubHead title="Reported per variant" />
				<ul className="flex flex-wrap gap-2">
					{METRICS.map((m) => (
						<li key={m} className="rounded-lg border border-border bg-card px-2.5 py-1.5 font-mono text-xs text-foreground">
							{m}
						</li>
					))}
				</ul>
				<p className="mt-4 text-xs text-muted-foreground">
					Used to compare gpt-4.1-mini with gpt-6-luna. Run by hand, not in CI; no results are committed. 17 unit
					tests in tests/test_event_parser.py cover the schema, rules, retries, and an offline dry run of the harness.
				</p>

				<Rule />
				<SectionLabel>Stack</SectionLabel>
				{STACK.map(([cat, tools]) => (
					<div key={cat} className="grid gap-4 border-t border-border py-5 md:grid-cols-[140px_1fr] md:gap-6">
						<span className="pt-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{cat}</span>
						<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							{tools.map(([logo, name, desc]) => (
								<li key={name} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3">
									<span className="grid h-8 w-8 flex-none place-items-center rounded-md border border-border bg-background text-foreground">
										<Logo name={logo} size={18} />
									</span>
									<span>
										<span className="block text-sm font-semibold">{name}</span>
										<span className="text-xs text-muted-foreground">{desc}</span>
									</span>
								</li>
							))}
						</ul>
					</div>
				))}

				<Rule />
				<SectionLabel>Next up</SectionLabel>
				<ul className="flex flex-wrap gap-2.5">
					{["Faster, sturdier scraper", "Better event extraction", "UI polish"].map((x) => (
						<li
							key={x}
							className="rounded-full border border-[var(--accent-brand)]/40 bg-[color-mix(in_srgb,var(--accent-brand-solid)_12%,transparent)] px-3.5 py-1.5 text-sm text-[var(--accent-brand)]"
						>
							{x}
						</li>
					))}
				</ul>
			</main>
			<Footer />
		</div>
	);
}
