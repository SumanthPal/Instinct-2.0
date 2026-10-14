import s from "./agents.module.css";

const SHAPES = {
	square: <rect x="-20" y="-20" width="40" height="40" rx="13" />,
	tilted: <rect x="-19" y="-19" width="38" height="38" rx="11" transform="rotate(-14)" />,
	circle: <circle r="21" />,
	cloud: (
		<g>
			<circle cx="-9" cy="4" r="14" />
			<circle cx="9" cy="4" r="14" />
			<circle cx="0" cy="-8" r="13" />
			<rect x="-19" y="2" width="38" height="16" rx="8" />
		</g>
	),
	triangle: <path d="M0 -23 C5 -23 24 12 21 18 C18 22 -18 22 -21 18 C-24 12 -5 -23 0 -23 Z" />,
	drop: <path d="M0 -17 C7 -8 14 -1 14 6 A14 14 0 0 1 -14 6 C-14 -1 -7 -8 0 -17 Z" />,
};

export const BOTS = {
	triage: { shape: "square", color: "#14b8a6", tilt: 0 },
	frontend: { shape: "tilted", color: "#8b5cf6", tilt: -14 },
	backend: { shape: "square", color: "#3b82f6", tilt: 8, round: true },
	scraper: { shape: "cloud", color: "#f59e0b", tilt: 0 },
	pm: { shape: "circle", color: "#8b5e3c", tilt: 0 },
	marketing: { shape: "triangle", color: "#ec4899", tilt: 0 },
	runner: { shape: "drop", color: "#6b7280", tilt: 0 },
};

export function Blob({ bot, x = 0, y = 0, scale = 1, look = [0, 2], delay = 0 }) {
	const b = BOTS[bot];
	const round = b.round;
	return (
		<g transform={`translate(${x} ${y}) scale(${scale})`}>
			<g className={s.bob} style={{ animationDelay: `${delay}s` }} fill={b.color}>
				<g transform={`rotate(${b.tilt})`}>{SHAPES[b.shape]}</g>
				<g className={s.look} style={{ "--lx": `${look[0]}px`, "--ly": `${look[1]}px`, animationDelay: `${delay}s` }}>
					<g className={s.blink} style={{ animationDelay: `${delay * 1.7}s` }} fill="#fff">
						{round ? (
							<>
								<ellipse cx="-6" cy="-1" rx="4.5" ry="5" />
								<ellipse cx="6" cy="-1" rx="4.5" ry="5" />
							</>
						) : (
							<>
								<rect x="-8" y="-8" width="5" height="12" rx="2.5" transform={`rotate(${b.tilt - 8} -5 -2)`} />
								<rect x="3" y="-8" width="5" height="12" rx="2.5" transform={`rotate(${b.tilt - 8} 5 -2)`} />
							</>
						)}
					</g>
				</g>
			</g>
		</g>
	);
}

// map layout (viewBox 1100 x 640); order chosen to keep lines from crossing
const N = {
	sumanth: [550, 64],
	marketing: [140, 210],
	pm: [300, 210],
	triage: [460, 210],
	frontend: [630, 210],
	backend: [800, 210],
	scraper: [980, 210],
	chats: [170, 385],
	admin: [380, 385],
	vercelc: [580, 385],
	github: [740, 385],
	supac: [900, 385],
	next: [110, 560],
	heroku: [280, 560],
	tables: [470, 560],
	redis: [680, 560],
	runner: [840, 560],
	instagram: [1000, 560],
};

const EDGES = [
	["sumanth", "marketing"],
	["sumanth", "pm"],
	["sumanth", "triage"],
	["sumanth", "frontend"],
	["sumanth", "backend"],
	["sumanth", "scraper"],
	["marketing", "chats"],
	["pm", "chats"],
	["triage", "chats"],
	["triage", "admin"],
	["frontend", "vercelc"],
	["frontend", "github"],
	["backend", "github"],
	["backend", "supac"],
	["scraper", "runner"],
	["admin", "tables"],
	["supac", "tables"],
	["vercelc", "next"],
	["instagram", "runner"],
	["runner", "redis"],
	["runner", "tables"],
	["tables", "heroku"],
	["heroku", "next"],
];

const pt = (k, out) => {
	const [x, y] = N[k];
	const off = { sumanth: 34, chats: 14, admin: 14, github: 14, vercelc: 14, supac: 14 }[k] ?? 26;
	return [x, out ? y + off : y - (k in { instagram: 1, runner: 1, redis: 1, tables: 1, heroku: 1, next: 1 } ? 14 : off)];
};

function curve(a, b) {
	const [x1, y1] = pt(a, true);
	let [x2, y2] = pt(b, false);
	if (N[a][1] === N[b][1]) {
		// same row: arc underneath
		const [ax, ay] = N[a];
		[x2, y2] = N[b];
		const dir = x2 > ax ? 1 : -1;
		return `M${ax + dir * 14} ${ay + 6} C${ax + dir * 40} ${ay + 34} ${x2 - dir * 40} ${y2 + 34} ${x2 - dir * 14} ${y2 + 6}`;
	}
	const my = (y1 + y2) / 2;
	return `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
}

function Hub({ id, title, sub, sub2, i = 0 }) {
	const [x, y] = N[id];
	return (
		<g className={s.fade} style={{ "--i": i }}>
			<circle cx={x} cy={y} r="6" className={s.node} />
			<text x={x} y={y + 26} textAnchor="middle" className={s.label}>
				{title}
			</text>
			{sub && (
				<text x={x} y={y + 42} textAnchor="middle" className={s.sub}>
					{sub}
				</text>
			)}
			{sub2 && (
				<text x={x} y={y + 56} textAnchor="middle" className={s.sub}>
					{sub2}
				</text>
			)}
		</g>
	);
}

const BOT_LIST = [
	["marketing", "outreach", [0.5, 2]],
	["pm", "roadmap", [-1, 2]],
	["triage", "monitors", [-1.5, 2]],
	["frontend", "builds UI", [-0.5, 2]],
	["backend", "API + data", [0.5, 2]],
	["scraper", "Instagram", [-1.5, 2]],
];

export function SystemMap() {
	const paths = EDGES.map(([a, b]) => [a, b, curve(a, b)]);
	return (
		<svg
			viewBox="0 0 1100 640"
			role="img"
			aria-label="The admin at the top directs six agents. Triage, pm and marketing talk in group chats. Triage uses the instinct-admin MCP (set_club_handle, send_scraper_command, delete_club), writes approved by admin, into Supabase tables clubs, scraper_commands and scrape_runs. Frontend and backend use the GitHub, Vercel and Supabase connectors. The local scraper and command runner read Instagram, use Redis and Supabase; the Heroku API serves the Next.js site on Vercel."
			className="h-auto w-full select-none"
		>
			<text x="20" y="214" className={s.group}>
				agents
			</text>
			<text x="20" y="389" className={s.group}>
				connectors
			</text>
			<text x="20" y="530" className={s.group}>
				services
			</text>

			{paths.map(([a, b, d], i) => (
				<path key={`${a}-${b}`} d={d} pathLength="1" className={`${s.edge} ${s.draw}`} style={{ "--i": i }} />
			))}
			<g className={s.fade} style={{ "--i": 12 }}>
				<path d="M524 92 C500 200 390 290 383 371" className={`${s.edge} ${s.approve}`} />
				<text x="396" y="336" className={s.sub} style={{ fill: "var(--accent-brand)" }}>
					approves writes
				</text>
			</g>

			<g className={s.dots}>
				{paths.map(([a, b, d], i) => (
					<circle key={`d-${a}-${b}`} r="2.5" className={s.dot} style={i % 3 === 1 ? { fill: "#ec4899" } : undefined}>
						<animateMotion dur={`${2.6 + (i % 4) * 0.5}s`} begin={`-${(i * 0.37) % 2.5}s`} repeatCount="indefinite" path={d} />
					</circle>
				))}
			</g>

			{/* admin */}
			<g className={s.pop}>
			<g transform={`translate(${N.sumanth[0]} ${N.sumanth[1]})`}>
				<circle r="30" className={s.node} />
				<circle cy="-7" r="8" className={s.human} />
				<path d="M-15 17 C-15 5 15 5 15 17 Z" className={s.human} />
			</g>
			<text x={N.sumanth[0] + 44} y={N.sumanth[1] - 2} className={s.label}>
				admin
			</text>
			<text x={N.sumanth[0] + 44} y={N.sumanth[1] + 14} className={s.sub}>
				direction · approvals · merges
			</text>
			</g>

			{BOT_LIST.map(([role, sub, look], i) => (
				<g key={role} className={s.pop} style={{ "--i": i + 1 }}>
					<Blob bot={role} x={N[role][0]} y={N[role][1]} look={look} delay={i * 0.45} />
					<text x={N[role][0] + 30} y={N[role][1] - 2} className={s.label}>
						{role}
					</text>
					<text x={N[role][0] + 30} y={N[role][1] + 13} className={s.sub}>
						{sub}
					</text>
				</g>
			))}

			<Hub i={7} id="chats" title="Group chats" sub="dev chat · instinct!" />
			<Hub i={8} id="admin" title="instinct-admin MCP" sub="set_club_handle" sub2="send_scraper_command · delete_club" />
			<Hub i={9} id="github" title="GitHub" sub="PRs + CI" />
			<Hub i={10} id="vercelc" title="Vercel" sub="previews" />
			<Hub i={11} id="supac" title="Supabase" sub="queries" />

			<Hub i={12} id="instagram" title="Instagram" sub="club posts" />
			<g className={s.fade} style={{ "--i": 13 }}>
			<Blob bot="runner" x={N.runner[0]} y={N.runner[1] - 2} scale={0.8} look={[1.5, 0]} delay={1.2} />
			<text x={N.runner[0]} y={N.runner[1] + 26} textAnchor="middle" className={s.label}>
				Local scraper
			</text>
			<text x={N.runner[0]} y={N.runner[1] + 42} textAnchor="middle" className={s.sub}>
				+ command runner
			</text>
			</g>
			<Hub i={13} id="redis" title="Redis" sub="queue" />
			<Hub i={14} id="tables" title="Supabase tables" sub="clubs · scraper_commands" sub2="scrape_runs" />
			<Hub i={15} id="heroku" title="Heroku API" sub="FastAPI" />
			<Hub i={16} id="next" title="Next.js" sub="on Vercel" />
		</svg>
	);
}

const TIERS = [
	{
		title: "Connectors",
		items: [
			["Group chats", "dev chat · instinct!"],
			["instinct-admin MCP", "set_club_handle · send_scraper_command · delete_club", true],
			["GitHub", "PRs + CI"],
			["Vercel", "previews"],
			["Supabase", "queries"],
		],
	},
	{
		title: "Services",
		items: [
			["Instagram", "club posts"],
			["Local scraper", "+ command runner, Redis queue"],
			["Supabase tables", "clubs · scraper_commands · scrape_runs"],
			["Heroku API", "FastAPI"],
			["Next.js", "on Vercel"],
		],
	},
];

function Branch() {
	return (
		<svg viewBox="0 0 20 16" className={s.branch} aria-hidden="true">
			<path d="M0 0 C0 9 6 12 18 12" className={s.edge} />
		</svg>
	);
}

// Mobile: one vertical spine from admin down through agents, connectors, services.
export function VerticalMap() {
	let i = 0;
	return (
		<div className={s.vmap}>
			<div className={s.spine} aria-hidden="true">
				<span className={s.spineDot} />
				<span className={s.spineDot} />
				<span className={s.spineDot} />
			</div>
			<div className={`${s.vitem} relative flex items-center gap-3`} style={{ "--i": i++ }}>
				<svg viewBox="-32 -32 64 64" width="40" height="40" className="absolute -left-[40px]" aria-hidden="true">
					<circle r="30" className={s.node} />
					<circle cy="-7" r="8" className={s.human} />
					<path d="M-15 17 C-15 5 15 5 15 17 Z" className={s.human} />
				</svg>
				<div className="pl-3">
					<p className="text-sm font-semibold text-foreground">admin</p>
					<p className="font-mono text-[11px] text-muted-foreground">direction · approvals · merges</p>
				</div>
			</div>

			<div className="relative mt-9">
				<span className={s.tierNode} />
				<p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Agents</p>
				<ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4">
					{BOT_LIST.map(([role, sub], k) => (
						<li key={role} className={`${s.vitem} flex flex-col items-center text-center`} style={{ "--i": i++ }}>
							<svg viewBox="-26 -26 52 52" width="44" height="44" aria-hidden="true">
								<Blob bot={role} look={[0, 2]} delay={k * 0.45} />
							</svg>
							<p className="mt-1 font-mono text-xs font-semibold text-foreground">{role}</p>
							<p className="text-[11px] text-muted-foreground">{sub}</p>
						</li>
					))}
				</ul>
			</div>

			{TIERS.map((tier) => (
				<div key={tier.title} className="relative mt-9">
					<span className={s.tierNode} />
					<p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{tier.title}</p>
					<ul className="mt-3 space-y-3">
						{tier.items.map(([name, sub, approve]) => (
							<li key={name} className={`${s.vitem} relative`} style={{ "--i": i++ }}>
								<Branch />
								<p className="text-sm font-semibold leading-tight text-foreground">{name}</p>
								<p className="break-words font-mono text-[11px] leading-snug text-muted-foreground">{sub}</p>
								{approve && (
									<p className="mt-0.5 font-mono text-[11px] text-[var(--accent-brand)]">writes approved by admin</p>
								)}
							</li>
						))}
					</ul>
				</div>
			))}
		</div>
	);
}
