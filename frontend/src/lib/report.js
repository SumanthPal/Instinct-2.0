const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export const REPORT_EMAIL = "spallamr@uci.edu";

/** mailto: link for "Something wrong?" reports, prefilled with the page URL. */
export function reportMailto({ subject, url, context = [], note = "" }) {
	const body = [...context, url && `Page: ${url}`, "", `What's wrong: ${note}`]
		.filter((l) => l != null && l !== false)
		.join("\n");
	return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Values match the backend's `reports.category` check (#149). `only` limits a category to some report kinds. */
export const REPORT_CATEGORIES = [
	{ id: "wrong_info", label: "Wrong info", hint: "Name, description, links or details are off." },
	{ id: "wrong_time_place", label: "Wrong time or place", hint: "Which day, time or room is right?", only: ["club", "event"] },
	{ id: "broken_image", label: "Broken image", hint: "Which image doesn't load or is the wrong one?" },
	{
		id: "wrong_instagram",
		label: "Instagram changed or moved",
		hint: "What's the new handle, if you know it?",
		only: ["club", "event"],
	},
	{ id: "other", label: "Other", hint: "Tell us what you noticed." },
];

/** Backend caps note at 2000 and page_url at 500 characters. */
export const REPORT_NOTE_MAX = 1000;
const PAGE_URL_MAX = 500;

export class ReportError extends Error {
	constructor(kind, status) {
		super(kind);
		this.kind = kind; // "rate_limited" | "failed"
		this.status = status;
	}
}

/**
 * POST /reports (#149). Body: { kind: "club" | "event" | "site", category,
 * club_id?, event_id?, page_url, note, email? }; club_id is required for kind
 * "club" and omitted for "site". 201 on success; 429 after 5 reports per IP in
 * 10 minutes; 400 for an unknown club and 422 for a bad body show as "failed".
 */
export async function submitReport(payload) {
	if (payload.kind === "club" && !payload.club_id) throw new ReportError("failed", 0);
	let res;
	try {
		res = await fetch(`${API_BASE_URL}/reports`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...payload, page_url: payload.page_url.slice(0, PAGE_URL_MAX) }),
		});
	} catch {
		throw new ReportError("failed", 0);
	}
	if (res.status === 429) throw new ReportError("rate_limited", 429);
	if (!res.ok) throw new ReportError("failed", res.status);
	return res.json().catch(() => ({}));
}
