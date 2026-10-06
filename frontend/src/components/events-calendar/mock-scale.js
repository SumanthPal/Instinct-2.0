/**
 * MOCK DATA — `?mock=scale` only. Rows match GET /events (PR #113).
 * Deterministic synthetic campus load:
 * ~450 fake clubs and ~1,000 events per month (weekdays ~35–50, a few peak
 * days at 52–60, weekends lighter). `density` multiplies every day's count.
 * Generated per month on demand (seeded by year+month) so the fetch layer
 * can page it like a real range API.
 */
import { addDays, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { toneFor } from "./calendar-utils";

function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

const ADJ = ["Anteater", "Irvine", "Zot", "Pacific", "Golden", "Blue", "Aldrich", "Coastal", "Sunset", "Eastside", "Newport", "Crystal", "Bren", "Peter's", "Ring Road", "Campus", "Student", "Undergraduate", "Global", "First-Gen"];
const FIELD = ["Robotics", "Chess", "Film", "Hiking", "Data Science", "Design", "Debate", "Dance", "Photography", "Climbing", "Investing", "Consulting", "Pre-Law", "Pre-Med", "Nursing", "Cybersecurity", "Game Dev", "Astronomy", "Poetry", "Jazz", "Tennis", "Surf", "Cooking", "Gardening", "Mental Health", "Sustainability", "Esports", "Taiwanese", "Korean", "Filipino", "Latinx", "Persian", "Armenian", "Muslim", "Christian", "Hillel", "Marketing", "Biotech", "Neuroscience", "Economics", "Public Health", "Linguistics", "Anime", "K-Pop", "Board Game", "Running", "Volleyball", "Badminton", "Quiz Bowl", "Theater"];
const KIND = ["Club", "Society", "Association", "Collective", "Union", "Network", "Team", "Guild"];
// Field -> real club category names (GET /categories), 1–2 per club.
const FIELD_CATS = [
	[/Investing|Consulting|Marketing/, ["Career and Professional", "Networking"]],
	[/Pre-|Nursing|Biotech/, ["Career and Professional", "Graduate"]],
	[/Robotics|Data|Cyber|Game Dev/, ["Technology"]],
	[/Design/, ["Technology", "Creative Arts"]],
	[/Debate|Quiz|Astronomy|Neuro|Economics|Linguistics/, ["Academics and Honors"]],
	[/Public Health|Mental Health/, ["Health and Wellness"]],
	[/Taiwanese|Korean|Filipino|Latinx|Persian|Armenian/, ["Cultural", "Multicultural"]],
	[/Muslim|Christian|Hillel/, ["Religious and Spiritual"]],
	[/Dance|Jazz|Theater|K-Pop/, ["Performance and Entertainment"]],
	[/Film|Photography|Poetry/, ["Creative Arts"]],
	[/Tennis|Surf|Volleyball|Badminton|Running|Climbing/, ["Club Sports", "Fitness"]],
	[/Sustainability|Gardening/, ["Environmental"]],
	[/Chess|Board|Anime|Esports|Cooking|Hiking/, ["Hobbies and Interests"]],
];
const EXTRA = ["Community Service", "Cultural and Social", "International", "Diversity and Inclusion", "Peer Support", "Political", "Media", "Greek Life", "LGBTQ+", "Education"];
function fieldCats(field, r) {
	const hit = FIELD_CATS.find(([re]) => re.test(field));
	const cats = hit ? [...hit[1]] : [pick(r, EXTRA)];
	if (cats.length === 1 && r() < 0.25) {
		const extra = pick(r, EXTRA);
		if (!cats.includes(extra)) cats.push(extra);
	}
	return cats;
}

let CLUBS = null;
export function scaleClubs() {
	if (CLUBS) return CLUBS;
	const r = rng(452);
	const seen = new Set();
	CLUBS = [];
	while (CLUBS.length < 450) {
		const field = pick(r, FIELD);
		const name = `${pick(r, ADJ)} ${field} ${pick(r, KIND)}`;
		if (seen.has(name)) continue;
		seen.add(name);
		const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
		CLUBS.push({ id: `sc-${CLUBS.length}`, name, instagram_handle: handle, profile_image_path: null, categories: fieldCats(field, r) });
	}
	return CLUBS;
}

/**
 * Handles a demo user has starred (?user=demo): a mix of busy and quiet
 * clubs. `n` > 14 (?stars=150) spreads picks evenly to exercise the
 * 100-handle request chunking.
 */
export function scaleStarred(n = 14) {
	const c = scaleClubs();
	if (n <= 14) return [0, 1, 3, 7, 12, 20, 33, 48, 75, 110, 160, 230, 300, 401].slice(0, n).map((i) => c[i].instagram_handle);
	return Array.from({ length: Math.min(n, c.length) }, (_, i) => c[Math.floor((i * c.length) / Math.min(n, c.length))].instagram_handle);
}

const TITLES = {
	social: ["Boba Social", "Game Night", "Beach Day", "Movie Night", "Potluck", "Mixer", "Karaoke Night", "Sunset Hike", "Open Mic", "Picnic in Aldrich", "Bowling Night", "Paint & Sip"],
	academic: ["Study Session", "Workshop: Intro to Python", "Speaker Series", "Paper Reading Group", "Hack Night", "Tutoring Hours", "Research Talk", "Midterm Review", "Lab Tour", "Workshop: Figma Basics"],
	career: ["Resume Review", "Mock Interviews", "Info Session", "Networking Night", "Alumni Panel", "Case Workshop", "LinkedIn Headshots", "Internship Q&A"],
	general: ["General Meeting", "Officer Meeting", "Volunteer Shift", "Fundraiser", "Board Elections", "Town Hall", "New Member Orientation", "Committee Meeting"],
};
const PLACES = ["DBH 6011", "ISEB 1010", "Student Center, Pacific Ballroom", "Aldrich Park", "ARC Courts", "Humanities Gateway 1010", "Anteater Plaza", "SSL 290", "Engineering Hall 1200", "Langson Library 228", "Science Library 3rd floor", "Social Ecology II 1306", "Bren Hall 1414", "Student Center, Doheny Beach D", "Crawford Field", "Online"];
// [startHour, endHour, weight]
const SLOTS = [
	[7, 8, 3],
	[8, 11, 12],
	[11, 14, 25],
	[14, 17, 20],
	[17, 20, 30],
	[20, 22, 8],
	[22, 23, 2],
];
const DUR = [30, 45, 60, 60, 60, 90, 90, 120, 120, 180];
const PER_WEEKDAY = [10, 34, 44, 48, 44, 36, 14]; // Sun..Sat

function weighted(r, list, w) {
	const total = list.reduce((s, x) => s + w(x), 0);
	let x = r() * total;
	for (const it of list) {
		x -= w(it);
		if (x <= 0) return it;
	}
	return list[list.length - 1];
}

const pad = (n) => String(n).padStart(2, "0");
const CACHE = new Map();

/** Raw API-shaped rows for one calendar month. */
export function scaleMonth(monthDate, density = 1) {
	const key = `${format(monthDate, "yyyy-MM")}x${density}`;
	if (CACHE.has(key)) return CACHE.get(key);
	const clubs = scaleClubs();
	const r = rng(Number(format(monthDate, "yyyyMM")) * 7 + density);
	const first = startOfMonth(monthDate);
	const last = endOfMonth(monthDate);
	const days = [];
	for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
	const peaks = new Set([4, 13, 22].map((i) => i + Math.floor(r() * 3)));
	const rows = [];
	days.forEach((day, di) => {
		const wd = getDay(day);
		let n = PER_WEEKDAY[wd] + Math.floor(r() * 9) - 4;
		if (peaks.has(di) && wd > 0 && wd < 6) n = 52 + Math.floor(r() * 9);
		n = Math.round(n * density);
		for (let i = 0; i < n; i++) {
			// power-law club activity: low indexes host most events
			const club = clubs[Math.min(clubs.length - 1, Math.floor(clubs.length * r() ** 2.2))];
			const { categories, ...clubRow } = club;
			const name = pick(r, TITLES[r() < 0.8 ? toneFor(categories) : pick(r, Object.keys(TITLES))]);
			const allDay = r() < 0.02;
			const id = `sc-${format(day, "yyyyMMdd")}-${pad(i)}`;
			let date;
			let Duration;
			let duration;
			if (allDay) {
				date = `${format(day, "yyyy-MM-dd")}T00:00:00`;
				Duration = { days: 1 + Math.floor(r() * 3), hours: 0, minutes: 0 };
				duration = `${Duration.days} day${Duration.days > 1 ? "s" : ""}`;
			} else {
				const [a, b] = weighted(r, SLOTS, (s) => s[2]);
				const h = a + Math.floor(r() * (b - a));
				const m = pick(r, [0, 0, 15, 30, 30, 45]);
				date = `${format(day, "yyyy-MM-dd")}T${pad(h)}:${pad(m)}:00`;
				const len = pick(r, DUR);
				Duration = { days: 0, hours: Math.floor(len / 60), minutes: len % 60 };
				duration = `${pad(Duration.hours)}:${pad(Duration.minutes)}:00`;
			}
			const location = pick(r, PLACES);
			const details = `${name} hosted by ${club.name}.`;
			rows.push({
				id,
				club_id: club.id,
				post_id: `post-${id}`,
				name,
				date,
				details,
				duration,
				parsed: { Date: date, Name: name, Details: details, Location: location, Duration },
				created_at: `${format(addDays(day, -5), "yyyy-MM-dd")}T17:00:00+00:00`,
				clubs: clubRow,
				categories,
			});
		}
	});
	rows.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : x.id < y.id ? -1 : 1));
	CACHE.set(key, rows);
	return rows;
}
