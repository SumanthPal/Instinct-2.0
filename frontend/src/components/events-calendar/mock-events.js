/**
 * MOCK DATA — local calendar mockup only. Do not ship.
 *
 * Prod has ~1 real campus-wide event right now, which can't show off a month
 * grid, so the mockup feeds the calendar plausible UCI club events shaped like
 * `GET /events?from&to` rows (PR #113): the /events/campus-wide shape (`id`,
 * `club_id`, `post_id`, `name`, naive LA `date`, `details`, `duration`,
 * `parsed`, `created_at`, `clubs{id, name, instagram_handle,
 * profile_image_path}`) plus `categories`, the club's category names.
 *
 * Dates are built relative to "today" so the mockup always lands on the
 * current week, the rest of this month, and next month.
 */
import { addDays, addMonths, format, setDate, startOfMonth, startOfWeek } from "date-fns";

const PFP = "https://pub-8e4c91981ff346a0af2d1a101b9dcc39.r2.dev/pfps";

const CLUBS = {
	acm: { name: "ACM at UCI", instagram_handle: "acm.uci", categories: ["Technology", "Academics and Honors"] },
	hack: { name: "Hack at UCI", instagram_handle: "hackatuci", categories: ["Technology"] },
	wics: { name: "Women in Information and Computer Sciences", instagram_handle: "wics_uci", categories: ["Technology", "Diversity and Inclusion"] },
	swe: { name: "Society of Women Engineers", instagram_handle: "swe_uci", categories: ["Career and Professional", "Technology"] },
	antrep: { name: "UCI ANTrepreneur Center", instagram_handle: "uciantrepreneur", categories: ["Career and Professional", "Networking"] },
	design: { name: "Design at UCI", instagram_handle: "designatuci", categories: ["Creative Arts", "Technology"] },
	asuci: { name: "Associated Students UCI", instagram_handle: "asuci", categories: ["Cultural and Social"] },
	board: { name: "Board Game Club at UCI", instagram_handle: "ucibgc", categories: ["Hobbies and Interests"] },
	isa: { name: "Indian Student Association", instagram_handle: "isa.uci", categories: ["Cultural", "International"] },
	soccer: { name: "UCI Men's Club Soccer", instagram_handle: "ucimcs", categories: ["Club Sports"] },
	outdoors: { name: "Anteater Outdoors", instagram_handle: "uci_outdoors", categories: ["Hobbies and Interests", "Fitness"] },
	habitat: { name: "Habitat for Humanity at UCI", instagram_handle: "ucihabitat", categories: ["Community Service"] },
	ck: { name: "Circle K International", instagram_handle: "ucicki", categories: ["Community Service"] },
	amsa: { name: "American Medical Student Association", instagram_handle: "amsauci", categories: ["Career and Professional", "Graduate"] },
	invest: { name: "Investment Society at UCI", instagram_handle: "ucinvest", categories: ["Career and Professional", "Networking"] },
	yoga: { name: "Yoga Club at UCI", instagram_handle: "uciyoga", categories: ["Health and Wellness", "Fitness"] },
	poetry: { name: "Poetry Collective", instagram_handle: "uci_poetry", categories: ["Creative Arts"] },
	urop: { name: "UROP", instagram_handle: "ucirvineurop", categories: ["Academics and Honors"] },
	career: { name: "UCI Division of Career Pathways", instagram_handle: "ucicareerpathways", categories: ["Career and Professional"] },
	vsa: { name: "Vietnamese Student Association", instagram_handle: "ucivsa", categories: ["Cultural", "Multicultural"] },
	sustain: { name: "UC Irvine Sustainability", instagram_handle: "ucisustainability", categories: ["Environmental"] },
	asucievp: {
		name: "Associated Students of the University of California, Irvine — Office of the Executive Vice President",
		instagram_handle: "asuci_executive_vice_president_office",
		categories: ["Political"],
	},
	rotaract: { name: "Rotaract Club of UC Irvine", instagram_handle: "rotaractuci", categories: ["Community Service", "Networking"] },
	run: { name: "Anteater Run Club", instagram_handle: "anteaterrunclub", categories: ["Fitness"] },
	disco: { name: "Associated Students UCI Programming Board", instagram_handle: "asuciprogramming", categories: ["Performance and Entertainment"] },
};

function club(key) {
	const { categories: _c, ...c } = CLUBS[key];
	return { id: `mock-${key}`, ...c, profile_image_path: `${PFP}/${c.instagram_handle}.jpg` };
}

// [where, "HH:mm" | null (all-day), minutes | days (all-day), title, clubKey, location, details]
// where = { w: weekOffset, d: dayOfWeek(0=Sun) }  or  { m: monthOffset, day: dayOfMonth }
const ROWS = [
	// This week
	[{ w: 0, d: 0 }, "10:00", 120, "Crystal Cove Beach Cleanup", "ck", "Crystal Cove State Park", "Carpools leave from the Student Center parking structure at 9:15. Gloves and bags provided."],
	[{ w: 0, d: 1 }, "12:00", 60, "ACM Weekly Meeting", "acm", "DBH 6011", "Officer updates, project team pitches, and free pizza."],
	[{ w: 0, d: 1 }, "18:00", 90, "Resume Review Night", "swe", "Engineering Hall 1200", "Bring a printed copy. Industry reviewers from Edwards and Blizzard."],
	[{ w: 0, d: 2 }, null, 3, "ZotHacks Applications Open", "hack", "Online", "Beginner-friendly hackathon applications close Thursday at midnight."],
	[{ w: 0, d: 2 }, "17:00", 60, "Intro to Figma Workshop", "design", "ICS 174", "Hands-on intro. Bring a laptop with a free Figma account."],
	[{ w: 0, d: 3 }, "08:00", 60, "Sunrise Yoga on the Lawn", "yoga", "Aldrich Park", "Mats available. All levels welcome."],
	[{ w: 0, d: 3 }, "12:00", 60, "Lunch & Learn: LinkedIn That Works", "career", "Student Center, Doheny Beach D", "Lunch provided for the first 40 RSVPs."],
	[{ w: 0, d: 3 }, "14:00", 120, "Startup Office Hours", "antrep", "ANTrepreneur Center", "Drop in with your idea; mentors on site until 4."],
	[{ w: 0, d: 3 }, "16:30", 90, "Boba & Board Games", "board", "Student Center, Crystal Cove", "Catan, Codenames, and a lot of boba."],
	[{ w: 0, d: 3 }, "15:30", 90, "Tech Talk: Building at Scale", "wics", "DBH 1100", "An engineering manager on infra, on-call, and getting your first internship."],
	[{ w: 0, d: 4 }, "19:00", 120, "Diwali Night Rehearsal", "isa", "Pacific Ballroom", "Full run-through for all dance teams."],
	[{ w: 0, d: 5 }, "17:00", 300, "Anteater Night Market", "asuci", "Ring Road", "Food trucks, student vendors, and live music."],
	[{ w: 0, d: 5 }, "18:00", 90, "Club Soccer vs. UCLA", "soccer", "Crawford Field", "Home game. Wear blue and gold."],
	[{ w: 0, d: 6 }, null, 1, "Joshua Tree Day Hike", "outdoors", "Joshua Tree National Park", "Vans leave at 6 AM. Pack water and layers."],
	[{ w: 0, d: 6 }, "09:00", 180, "Habitat Build Day", "habitat", "Santa Ana build site", "Closed-toe shoes required. Lunch provided."],
	// Next week
	[{ w: 1, d: 2 }, "12:00", 60, "Pre-Med Panel: Getting Into Med School", "amsa", "Biological Sciences III 1200", "Panel of current UCI med students and an admissions advisor."],
	[{ w: 1, d: 3 }, "19:00", 60, "Poetry Open Mic", "poetry", "Humanities Gateway 1010", "Sign-ups at the door. Snacks provided."],
	[{ w: 1, d: 4 }, "18:00", 120, "Hack Night", "hack", "ISEB 1010", "Work on anything. Mentors from Hack at UCI on hand."],
	[{ w: 1, d: 5 }, "19:00", 240, "Haunted Hill Walkthrough", "asuci", "The Hill", "Student-built haunted house. Tickets at the ASUCI booth."],
	// Week after
	[{ w: 2, d: 1 }, "16:00", 90, "Stock Pitch Competition", "invest", "SB2 1100", "Teams of three pitch a long or short. Judges from Pimco."],
	[{ w: 2, d: 6 }, null, 2, "ZotHacks 2026", "hack", "ISEB", "24-hour beginner hackathon. Meals and swag included."],
	// Next month
	[{ m: 1, day: 4 }, "11:00", 240, "Fall Career Fair", "career", "Bren Events Center", "200+ employers. Business casual."],
	[{ m: 1, day: 6 }, "18:30", 150, "Lunar Lantern Cultural Night", "vsa", "Irvine Barclay Theatre", "Performances, food, and lantern making."],
	[{ m: 1, day: 12 }, "13:00", 60, "Undergraduate Research Info Session", "urop", "Langson Library 228", "How to find a lab and apply for UROP fellowships."],
	[{ m: 1, day: 12 }, "13:30", 60, "Green Campus Tour", "sustain", "Anteater Plaza", "Walking tour of LEED buildings on campus."],
	[{ m: 1, day: 18 }, "18:00", 120, "Friendsgiving Potluck", "board", "Student Center Terrace", "Bring a dish to share. Plates provided."],
];

// Edge cases for ?mock=stress: a 12-event day, pre-8 AM and post-10 PM
// events, one crossing midnight, and very long titles / club names.
const STRESS_ROWS = [
	[{ w: 0, d: 3 }, "06:00", 60, "Sunrise Run Club 5K", "run", "Aldrich Park", "Easy pace, all levels."],
	[{ w: 0, d: 3 }, "06:30", 90, "Early Bird Calculus Review", "urop", "Rowland Hall 104", "Math 2B midterm prep."],
	[{ w: 0, d: 3 }, "10:00", 60, "Annual Interdisciplinary Undergraduate Research Symposium and Poster Showcase: Opening Keynote and Welcome Remarks", "asucievp", "Student Center, Pacific Ballroom C and D (enter through the side door by the bookstore)", "A very long description to check wrapping. ".repeat(4).trim()],
	[{ w: 0, d: 3 }, "13:00", 30, "Quick Officer Sync", "acm", "DBH 4011", "Fifteen-minute standup."],
	[{ w: 0, d: 3 }, "19:00", 60, "Pancake Fundraiser for Disaster Relief in Partnership with Circle K and Rotaract", "rotaract", "Anteater Plaza", "All proceeds donated."],
	[{ w: 0, d: 3 }, "21:30", 120, "Late Night Study Jam", "board", "Science Library 2nd floor", "Quiet floor, snacks at 11."],
	[{ w: 0, d: 3 }, "23:00", 120, "Midnight Breakfast", "asuci", "Brandywine Commons", "Runs past midnight."],
	[{ w: 0, d: 4 }, null, 2, "InternationalStudentOrientationWelcomeWeekCelebration2026", "asucievp", "Everywhere", "One unbroken word to test truncation."],
	[{ w: 0, d: 5 }, "22:30", 90, "Silent Disco on Ring Road", "disco", "Ring Road", "Headphones provided."],
];

function pad(n) {
	return String(n).padStart(2, "0");
}

/** Club list (with categories) for the club search box. */
export function mockClubs() {
	return Object.keys(CLUBS).map((k) => ({ ...club(k), categories: CLUBS[k].categories }));
}

export function buildMockEvents(now = new Date(), { stress = false } = {}) {
	const weekStart = startOfWeek(now, { weekStartsOn: 0 });
	return (stress ? [...ROWS, ...STRESS_ROWS] : ROWS).map((row, i) => {
		const [where, time, len, name, clubKey, location, details] = row;
		const day =
			"w" in where
				? addDays(weekStart, where.w * 7 + where.d)
				: setDate(startOfMonth(addMonths(now, where.m)), where.day);
		const allDay = time === null;
		const date = `${format(day, "yyyy-MM-dd")}T${allDay ? "00:00" : time}:00`;
		const Duration = allDay
			? { days: len, hours: 0, minutes: 0 }
			: { days: 0, hours: Math.floor(len / 60), minutes: len % 60 };
		const duration = allDay
			? `${len} day${len > 1 ? "s" : ""}`
			: `${pad(Duration.hours)}:${pad(Duration.minutes)}:00`;
		const c = club(clubKey);
		return {
			id: `mock-${pad(i + 1)}`,
			club_id: c.id,
			post_id: `mock-post-${i + 1}`,
			name,
			date,
			details,
			duration,
			parsed: { Date: date, Name: name, Details: details, Location: location, Duration },
			created_at: `${format(addDays(day, -7), "yyyy-MM-dd")}T09:00:00+00:00`,
			clubs: c,
			categories: CLUBS[clubKey].categories,
		};
	});
}
