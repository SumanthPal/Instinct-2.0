import Logo from "./Logo";

export function Eyebrow({ children }) {
	return (
		<p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-brand)]">
			{children}
		</p>
	);
}

export function SectionLabel({ children }) {
	return (
		<h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
			{children}
		</h2>
	);
}

export function Rule() {
	return <hr className="my-14 border-border" />;
}

export function Hero({ eyebrow, title, accent, lede, children }) {
	return (
		<header className="pt-24 pb-14 sm:pt-28">
			<Eyebrow>{eyebrow}</Eyebrow>
			<h1 className="text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
				{title} <span className="text-[var(--accent-brand)]">{accent}</span>.
			</h1>
			<p className="mt-5 text-lg text-muted-foreground sm:text-xl">{lede}</p>
			{children}
		</header>
	);
}

export function Card({ className = "", children }) {
	return (
		<div className={`rounded-xl border border-border bg-card ${className}`}>
			{children}
		</div>
	);
}

// A row of steps joined by arrows; stacks vertically on small screens.
export function Flow({ steps }) {
	return (
		<ol className="flex flex-col gap-3 md:flex-row md:items-stretch">
			{steps.map((step, i) => (
				<li key={step.title} className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
					<div
						className={`flex-1 rounded-xl border p-4 ${
							step.accent
								? "border-[var(--accent-brand-solid)] bg-[color-mix(in_srgb,var(--accent-brand-solid)_12%,hsl(var(--card)))]"
								: "border-border bg-card"
						}`}
					>
						<div className="mb-3 flex h-5 items-center gap-2 text-[var(--accent-brand)]">
							{step.logo ? (
								<Logo name={step.logo} size={20} />
							) : (
								<span className="font-mono text-sm">{"{ }"}</span>
							)}
						</div>
						<p className="text-sm font-semibold text-foreground">{step.title}</p>
						<p className="mt-0.5 text-xs text-muted-foreground">{step.sub}</p>
					</div>
					{i < steps.length - 1 && (
						<span aria-hidden className="self-center text-[var(--accent-brand)] md:rotate-0 rotate-90">
							→
						</span>
					)}
				</li>
			))}
		</ol>
	);
}
