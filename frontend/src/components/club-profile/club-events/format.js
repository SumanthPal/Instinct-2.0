import { addDays, differenceInCalendarDays, format, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { timeRange } from "@/components/events-calendar/calendar-utils";

/** Last calendar day an event touches (all-day ends are exclusive). */
export const lastDay = (ev) => (ev.allDay ? addDays(ev.end, -1) : ev.end);
export const isMultiDay = (ev) => !isSameDay(ev.start, lastDay(ev));

const dayLabel = (d, now) => format(d, isSameYear(d, now) ? "EEE, MMM d" : "EEE, MMM d, yyyy");

/** "Thu, Oct 15 · 6 – 8 PM", "Sat, Oct 24 – Sun, Oct 25", "Sat, Oct 24 · All day" */
export function whenLine(ev, now) {
	if (isMultiDay(ev)) {
		const tail = ev.allDay ? "" : ` · from ${format(ev.start, "h:mm a")}`;
		return `${dayLabel(ev.start, now)} – ${dayLabel(lastDay(ev), now)}${tail}`;
	}
	return `${dayLabel(ev.start, now)} · ${ev.allDay ? "All day" : timeRange(ev)}`;
}

/** Line under a list row's title; the date block beside it carries the date. */
export function metaLine(ev) {
	let when;
	if (isMultiDay(ev)) {
		const end = lastDay(ev);
		when = isSameMonth(ev.start, end)
			? `${format(ev.start, "EEE")} – ${format(end, "EEE")}`
			: `${format(ev.start, "MMM d")} – ${format(end, "MMM d")}`;
		when += ev.allDay ? ` · ${differenceInCalendarDays(end, ev.start) + 1} days` : ` · from ${format(ev.start, "h:mm a")}`;
	} else {
		when = `${format(ev.start, "EEE")} · ${ev.allDay ? "All day" : timeRange(ev)}`;
	}
	return ev.location ? `${when} · ${ev.location}` : when;
}

/** Short relative tag for an upcoming event ("Today", "In 9 days"), or null. */
export function relLabel(ev, now) {
	if (!now || ev.endMs <= now.getTime()) return null;
	if (ev.startMs <= now.getTime()) return isMultiDay(ev) ? `On now · until ${format(lastDay(ev), "EEE")}` : "Happening now";
	const d = differenceInCalendarDays(ev.start, now);
	if (d === 0) return "Today";
	if (d === 1) return "Tomorrow";
	if (d < 7) return `This ${format(ev.start, "EEEE")}`;
	if (d < 14) return `In ${d} days`;
	return null;
}

/** Groups a sorted list by start month: [{ key, label, events }]. */
export function groupByMonth(list, now) {
	const out = [];
	for (const ev of list) {
		const last = out[out.length - 1];
		if (last && isSameMonth(last.events[0].start, ev.start) && isSameYear(last.events[0].start, ev.start)) last.events.push(ev);
		else out.push({ key: format(ev.start, "yyyy-MM"), label: format(ev.start, isSameYear(ev.start, now) ? "MMMM" : "MMMM yyyy"), events: [ev] });
	}
	return out;
}
