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

// map layout (viewBox 1100 x 640)
const N = {
	sumanth: [550, 64],
	triage: [140, 210],
	frontend: [314, 210],
	backend: [488, 210],
	scraper: [662, 210],
	pm: [836, 210],
	marketing: [1000, 210],
	chats: [150, 385],
	admin: [380, 385],
	github: [600, 385],
	vercelc: [760, 385],
	supac: [920, 385],
	instagram: [110, 560],
	runner: [270, 560],
	redis: [430, 560],
	tables: [610, 560],
	heroku: [800, 560],
	next: [990, 560],
};

const EDGES = [
	["sumanth", "triage"],
	["sumanth", "frontend"],
	["sumanth", "backend"],
	["sumanth", "scraper"],
	["sumanth", "pm"],
	["sumanth", "marketing"],
	["triage", "chats"],
	["pm", "chats"],
	["marketing", "chats"],
	["triage", "admin"],
	["frontend", "github"],
	["frontend", "vercelc"],
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

function Hub({ id, title, sub, sub2 }) {
	const [x, y] = N[id];
	return (
		<g>
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
	["triage", "monitors", [-1.5, 2]],
	["frontend", "builds UI", [0, 2]],
	["backend", "API + data", [0, 2]],
	["scraper", "Instagram", [0, 2]],
	["pm", "roadmap", [-1.5, 2]],
	["marketing", "outreach", [-2, 1.5]],
];

export function SystemMap() {
	const paths = EDGES.map(([a, b]) => [a, b, curve(a, b)]);
	return (
		<svg
			viewBox="0 0 1100 640"
			role="img"
			aria-label="Sumanth at the top directs six agents. Triage, pm and marketing talk in group chats. Triage uses the instinct-admin MCP (set_club_handle, send_scraper_command, delete_club), writes approved by Sumanth, into Supabase tables clubs, scraper_commands and scrape_runs. Frontend and backend use the GitHub, Vercel and Supabase connectors. The local scraper and command runner read Instagram, use Redis and Supabase; the Heroku API serves the Next.js site on Vercel."
			className="h-auto w-full min-w-[880px] select-none"
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

			{paths.map(([a, b, d]) => (
				<path key={`${a}-${b}`} d={d} className={s.edge} />
			))}
			<path d="M520 92 C470 200 380 300 380 371" className={`${s.edge} ${s.approve}`} />
			<text x="398" y="322" className={s.sub} style={{ fill: "var(--accent-brand)" }}>
				approves writes
			</text>

			<g className={s.dots}>
				{paths.map(([a, b, d], i) => (
					<circle key={`d-${a}-${b}`} r="2.5" className={s.dot} style={i % 3 === 1 ? { fill: "#ec4899" } : undefined}>
						<animateMotion dur={`${2.6 + (i % 4) * 0.5}s`} begin={`-${(i * 0.37) % 2.5}s`} repeatCount="indefinite" path={d} />
					</circle>
				))}
			</g>

			{/* Sumanth */}
			<g transform={`translate(${N.sumanth[0]} ${N.sumanth[1]})`}>
				<circle r="30" className={s.node} />
				<circle cy="-7" r="8" className={s.human} />
				<path d="M-15 17 C-15 5 15 5 15 17 Z" className={s.human} />
			</g>
			<text x={N.sumanth[0] + 44} y={N.sumanth[1] - 2} className={s.label}>
				Sumanth
			</text>
			<text x={N.sumanth[0] + 44} y={N.sumanth[1] + 14} className={s.sub}>
				direction · approvals · merges
			</text>

			{BOT_LIST.map(([role, sub, look], i) => (
				<g key={role}>
					<Blob bot={role} x={N[role][0]} y={N[role][1]} look={look} delay={i * 0.45} />
					<text x={N[role][0] + 30} y={N[role][1] - 2} className={s.label}>
						{role}
					</text>
					<text x={N[role][0] + 30} y={N[role][1] + 13} className={s.sub}>
						{sub}
					</text>
				</g>
			))}

			<Hub id="chats" title="Group chats" sub="dev chat · instinct!" />
			<Hub id="admin" title="instinct-admin MCP" sub="set_club_handle" sub2="send_scraper_command · delete_club" />
			<Hub id="github" title="GitHub" sub="PRs + CI" />
			<Hub id="vercelc" title="Vercel" sub="previews" />
			<Hub id="supac" title="Supabase" sub="queries" />

			<Hub id="instagram" title="Instagram" sub="club posts" />
			<Blob bot="runner" x={N.runner[0]} y={N.runner[1] - 2} scale={0.8} look={[1.5, 0]} delay={1.2} />
			<text x={N.runner[0]} y={N.runner[1] + 26} textAnchor="middle" className={s.label}>
				Local scraper
			</text>
			<text x={N.runner[0]} y={N.runner[1] + 42} textAnchor="middle" className={s.sub}>
				+ command runner
			</text>
			<Hub id="redis" title="Redis" sub="queue" />
			<Hub id="tables" title="Supabase tables" sub="clubs · scraper_commands" sub2="scrape_runs" />
			<Hub id="heroku" title="Heroku API" sub="FastAPI" />
			<Hub id="next" title="Next.js" sub="on Vercel" />
		</svg>
	);
}
