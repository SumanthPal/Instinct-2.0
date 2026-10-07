import React from "react";
import "../../../styles/globals.css";
import Navbar from "@/components/ui/Navbar";
import Footer from "@/components/ui/Footer";
import { FaLinkedin, FaGithub } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import Link from "next/link";

const About = () => {
	return (
		<div className="min-h-screen bg-background text-foreground overflow-x-hidden">
			<Navbar />

			<main className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24">
				{/* Hero Section */}
				<section className="mb-16 sm:mb-20 max-w-6xl mx-auto bg-card rounded-md border border-border p-6 sm:p-10">
					<h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-6 text-left sm:text-center">
						About Instinct
					</h1>
					<p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-8 text-center leading-relaxed">
						Instinct helps UCI students find clubs and events. It keeps an
						up-to-date index of 451 student organizations, built from what
						they actually post.
					</p>

					<div className="flex justify-center">
						<Link
							href="/about/technical"
							className="group inline-flex items-center space-x-2 text-lg sm:text-xl text-foreground hover:text-foreground transition-colors duration-200 font-medium transform hover:translate-x-1"
						>
							<span>View Technical Details</span>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-6 w-6 transform group-hover:translate-x-1 transition-transform duration-300"
								viewBox="0 0 20 20"
								fill="currentColor"
							>
								<path
									fillRule="evenodd"
									d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z"
									clipRule="evenodd"
								/>
							</svg>
						</Link>
					</div>
				</section>

				{/* Why Instinct */}
				<section className="mb-16 sm:mb-20 max-w-6xl mx-auto">
					<div className="flex items-center justify-center mb-8 sm:mb-10">
						<div className="h-px bg-border w-12 sm:w-16 mr-4"></div>
						<h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground">
							Why Instinct?
						</h2>
						<div className="h-px bg-border w-12 sm:w-16 ml-4"></div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
						<div className="bg-card rounded-md border border-border p-6">
							<h3 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">
								For Students
							</h3>
							<p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
								UCI has hundreds of clubs, and most of what they do lives on
								Instagram. Instinct pulls that into one place: search clubs by
								name, handle, or what they talk about, see their recent posts,
								and browse upcoming events on a single calendar instead of
								checking dozens of accounts.
							</p>
						</div>

						<div className="bg-card rounded-md border border-border p-6">
							<h3 className="text-xl sm:text-2xl font-semibold mb-3 text-foreground">
								For Clubs
							</h3>
							<p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
								If your club posts on Instagram, you don't have to do anything
								extra. Instinct reads your public posts, picks out the events
								you announce, and lists them alongside your profile so students
								can find you when they're looking.
							</p>
						</div>
					</div>
				</section>

				{/* How It Works */}
				<section className="mb-16 sm:mb-20 max-w-6xl mx-auto">
					<div className="flex items-center justify-center mb-8 sm:mb-10">
						<div className="h-px bg-border w-12 sm:w-16 mr-4"></div>
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							How It Works
						</h2>
						<div className="h-px bg-border w-12 sm:w-16 ml-4"></div>
					</div>

					<div className="bg-card/60 rounded-xl border border-border p-6 sm:p-8 shadow-md">
						<p className="text-base sm:text-lg text-muted-foreground leading-relaxed text-center">
							Every day, Instinct checks a rotating set of club Instagram
							accounts and saves new posts. A language model reads each caption
							and pulls out any events it mentions, with dates and times in
							Pacific time. Club profiles, posts, and events are then searchable
							on the site, so what you see stays close to what clubs are
							actually announcing.
						</p>
					</div>
				</section>
				<section className="mb-16 sm:mb-20 max-w-6xl mx-auto bg-card/60 rounded-xl border border-border p-6 sm:p-10 shadow-md">
					<div className="flex items-center justify-center mb-8 sm:mb-10">
						<div className="h-px bg-border w-12 sm:w-16 mr-4"></div>
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							Listen More About It
						</h2>
						<div className="h-px bg-border w-12 sm:w-16 ml-4"></div>
					</div>
					<div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-md">
						<iframe
							style={{ borderRadius: "12px" }}
							src="https://open.spotify.com/embed/episode/0xLs6q9TYf2Jmqv80ayH7r?utm_source=generator"
							width="100%"
							height="352"
							frameBorder="0"
							allowFullScreen=""
							allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
							loading="lazy"
						></iframe>
					</div>
				</section>

				<section className="mb-16 sm:mb-20 max-w-6xl mx-auto">
					<div className="flex items-center justify-center mb-8 sm:mb-10">
						<div className="h-px bg-border w-12 sm:w-16 mr-4"></div>
						<h2 className="text-3xl sm:text-4xl font-bold text-foreground">
							FAQs
						</h2>
						<div className="h-px bg-border w-12 sm:w-16 ml-4"></div>
					</div>

					<div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
						<details className="group bg-card rounded-md p-4 sm:p-5 border border-border">
							<summary className="cursor-pointer text-base sm:text-lg font-semibold text-foreground group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
								<span className="mr-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</span>
								Is Instinct officially affiliated with UCI?
							</summary>
							<p className="mt-3 text-muted-foreground pl-7">
								No — Instinct is an independent student-led project built by UCI
								students for the UCI community.
							</p>
						</details>

						<details className="group bg-card rounded-md p-4 sm:p-5 border border-border">
							<summary className="cursor-pointer text-base sm:text-lg font-semibold text-foreground group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
								<span className="mr-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</span>
								How often is club data updated?
							</summary>
							<p className="mt-3 text-muted-foreground pl-7">
								A scrape runs every day and works through club accounts in
								rotation, so each club is refreshed every so often rather than
								all at once. Search results pick up new posts and events after
								each run.
							</p>
						</details>

						<details className="group bg-card rounded-md p-4 sm:p-5 border border-border">
							<summary className="cursor-pointer text-base sm:text-lg font-semibold text-foreground group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
								<span className="mr-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</span>
								Can clubs request changes to their profiles?
							</summary>
							<p className="mt-3 text-muted-foreground pl-7">
								Signed-in users (with a UCI email) can submit a club that's
								missing, and submissions are reviewed before they're added. For
								corrections to an existing profile, reach out and we'll fix it.
							</p>
						</details>

						<details className="group bg-card rounded-md p-4 sm:p-5 border border-border">
							<summary className="cursor-pointer text-base sm:text-lg font-semibold text-foreground group-open:text-indigo-600 dark:group-open:text-indigo-400 transition-colors flex items-center">
								<span className="mr-2">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-5 w-5 inline-block transform transition-transform group-open:rotate-90"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5l7 7-7 7"
										/>
									</svg>
								</span>
								Is this open source?
							</summary>
							<p className="mt-3 text-muted-foreground pl-7">
								Unfortunately, no, but if you're interested in learning more
								about the project or contributing, let me know!
							</p>
						</details>
					</div>
				</section>
			</main>

			<Footer />
		</div>
	);
};

export default About;

