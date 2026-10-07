import Link from "next/link";
import "../../../styles/globals.css";
import { Card, Hero, Rule, SectionLabel } from "@/components/about/Section";
import Logo from "@/components/about/Logo";
import Footer from "@/components/ui/Footer";
import Navbar from "@/components/ui/Navbar";

const STEPS = [
	{ logo: "instagram", text: "We check club accounts 4 times a day." },
	{ logo: "openai", text: "AI pulls events out of captions." },
	{ logo: "postgresql", text: "Clubs, posts, and events become searchable." },
];

const FAQS = [
	["Is it affiliated with UCI?", "No, it's an independent student project."],
	["How fresh is the data?", "The scraper runs 4 times a day, rotating through clubs."],
	["Is my club missing?", "Sign in with your UCI email and submit it. We review before adding."],
];

export default function About() {
	return (
		<div className="min-h-screen overflow-x-hidden bg-background text-foreground">
			<Navbar />
			<main className="mx-auto max-w-3xl px-6 pb-20">
				<Hero
					eyebrow="About"
					title="Every UCI club, in one"
					accent="place"
					lede="451 clubs and their events, pulled from Instagram and kept fresh."
				>
					<Link
						href="/about/technical"
						className="mt-7 inline-block border-b border-[var(--accent-brand)]/40 pb-0.5 text-sm font-medium text-[var(--accent-brand)] hover:border-[var(--accent-brand)]"
					>
						Technical details →
					</Link>
				</Hero>

				<SectionLabel>Who it&apos;s for</SectionLabel>
				<div className="grid gap-5 sm:grid-cols-2">
					<Card className="p-6">
						<h3 className="mb-1.5 text-lg font-semibold">Students</h3>
						<p className="text-sm text-muted-foreground">
							Search clubs and browse upcoming events in one place.
						</p>
					</Card>
					<Card className="p-6">
						<h3 className="mb-1.5 text-lg font-semibold">Clubs</h3>
						<p className="text-sm text-muted-foreground">
							Post on Instagram as usual. Your events show up here.
						</p>
					</Card>
				</div>

				<Rule />
				<SectionLabel>How it works</SectionLabel>
				<ol className="grid gap-5 sm:grid-cols-3">
					{STEPS.map((step, i) => (
						<li key={step.logo}>
							<Card className="h-full p-5">
								<Logo name={step.logo} size={24} />
								<p className="mt-3 font-mono text-xs text-[var(--accent-brand)]">0{i + 1}</p>
								<p className="mt-1 text-sm text-foreground">{step.text}</p>
							</Card>
						</li>
					))}
				</ol>

				<Rule />
				<SectionLabel>FAQ</SectionLabel>
				<dl>
					{FAQS.map(([q, a]) => (
						<div
							key={q}
							className="grid gap-1 border-t border-border py-4 text-sm sm:grid-cols-[240px_1fr] sm:gap-6"
						>
							<dt className="font-semibold text-foreground">{q}</dt>
							<dd className="text-muted-foreground">{a}</dd>
						</div>
					))}
				</dl>

				<Rule />
				<Card className="overflow-hidden">
					<iframe
						title="Instinct podcast episode on Spotify"
						src="https://open.spotify.com/embed/episode/0xLs6q9TYf2Jmqv80ayH7r?utm_source=generator"
						width="100%"
						height="152"
						allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
						loading="lazy"
						className="block"
					/>
				</Card>
			</main>
			<Footer />
		</div>
	);
}
