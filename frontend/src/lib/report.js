export const REPORT_EMAIL = "spallamr@uci.edu";

/** mailto: link for "Something wrong?" reports, prefilled with the page URL. */
export function reportMailto({ subject, url, context = [] }) {
	const body = [...context, url && `Page: ${url}`, "", "What's wrong: "].filter((l) => l != null && l !== false).join("\n");
	return `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
