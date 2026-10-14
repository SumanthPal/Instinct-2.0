import { Fragment } from "react";
import s from "./agents.module.css";
import Logo from "./Logo";

const PROPS = {
	triage: (
		<g className={s.alert}>
			<path d="M55 12 L67 33 L43 33 Z" className={s.pink} />
			<path d="M55 19 V26 M55 29.5 V30" stroke="var(--card)" strokeWidth="2" strokeLinecap="round" />
		</g>
	),
	frontend: (
		<g>
			<rect x="42" y="22" width="26" height="24" rx="2" className={s.ink} />
			<path d="M42 27 H68" className={s.ink} />
			<path d="M44 38 H66" className={`${s.strokePurple} ${s.drawLine}`} />
			<path d="M44 37 v9 l2.6 -2.6 h3.6 Z" className={`${s.pink} ${s.cursor}`} />
		</g>
	),
	backend: (
		<g>
			<rect x="44" y="20" width="22" height="30" rx="2" className={s.ink} />
			<path d="M44 30 H66 M44 40 H66 M48 25 H54 M48 35 H54 M48 45 H54" className={s.ink} />
			<g>
				<circle cx="61" cy="25" r="2" className={`${s.sky} ${s.light}`} />
				<circle cx="61" cy="35" r="2" className={`${s.sky} ${s.light}`} />
				<circle cx="61" cy="45" r="2" className={`${s.purple} ${s.light}`} />
			</g>
		</g>
	),
	scraper: (
		<g>
			<rect x="44" y="22" width="10" height="10" className={s.ink} />
			<rect x="57" y="22" width="10" height="10" className={s.ink} />
			<rect x="44" y="35" width="10" height="10" className={s.ink} />
			<rect x="57" y="35" width="10" height="10" className={s.ink} />
			<rect x="41" y="23" width="29" height="2" className={`${s.pink} ${s.scan}`} />
		</g>
	),
	pm: (
		<g>
			<rect x="44" y="18" width="24" height="32" rx="2" className={s.ink} />
			<path d="M51 18 v-2 h10 v2" className={s.ink} />
			<path d="M57 27 H64 M57 35 H64 M57 43 H64" className={s.ink} />
			<g>
				<path d="M47 26 l2.5 2.5 l4 -4.5" className={`${s.strokePurple} ${s.tick}`} />
				<path d="M47 34 l2.5 2.5 l4 -4.5" className={`${s.strokePurple} ${s.tick}`} />
				<path d="M47 42 l2.5 2.5 l4 -4.5" className={`${s.strokePurple} ${s.tick}`} />
			</g>
		</g>
	),
	marketing: (
		<g>
			<path d="M43 30 L55 23 V45 L43 38 Z" className={s.ink} />
			<path d="M46 39 l2 7 h3 l-1.5 -6" className={s.ink} />
			<g>
				<path d="M59 29 Q62 34 59 39" className={`${s.strokePurple} ${s.wave}`} />
				<path d="M63 26 Q67 34 63 42" className={`${s.strokePurple} ${s.wave}`} />
				<path d="M67 23 Q71.5 34 67 45" className={`${s.strokePurple} ${s.wave}`} />
			</g>
		</g>
	),
};

export function Mascot({ role, size = 72 }) {
	return (
		<svg viewBox="0 0 72 56" width={size} height={(size * 56) / 72} className={s.mascot} aria-hidden="true">
			<path d="M22 22 V14" className={s.ink} />
			<circle cx="22" cy="12" r="2.5" className={s.purple} />
			<rect x="6" y="22" width="32" height="28" rx="4" className={s.face} />
			<g className={s.eyes}>
				<rect x="14" y="31" width="4" height="6" rx="1" fill="currentColor" />
				<rect x="26" y="31" width="4" height="6" rx="1" fill="currentColor" />
			</g>
			<path d="M19 43 Q22 45.5 25 43" className={s.ink} />
			{PROPS[role]}
		</svg>
	);
}

export function Diagram({ nodes, label }) {
	return (
		<figure aria-label={label} className="border border-border p-5 sm:p-8">
			<ol className={s.flow}>
				{nodes.map((n, i) => (
					<Fragment key={n.title}>
						{i > 0 && (
							<li aria-hidden="true" className={s.link}>
								<span className={s.dot} />
							</li>
						)}
						<li
							className={`${s.node} border bg-background px-3 py-2.5 ${n.accent ? "border-[var(--accent-brand)]" : "border-border"}`}
						>
							<div className="mb-1 flex items-center gap-1.5 text-foreground">
								{n.logos?.map((l) => (
									<Logo key={l} name={l} size={14} />
								))}
								{n.role && <Mascot role={n.role} size={30} />}
							</div>
							<p className="text-sm font-semibold leading-tight text-foreground">{n.title}</p>
							{n.sub && <p className="mt-0.5 break-words font-mono text-[11px] leading-snug text-muted-foreground">{n.sub}</p>}
						</li>
					</Fragment>
				))}
			</ol>
		</figure>
	);
}
