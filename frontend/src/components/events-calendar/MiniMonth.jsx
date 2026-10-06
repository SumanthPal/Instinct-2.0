"use client";

import { addMonths, format, isSameDay, isSameMonth } from "date-fns";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { dayKey, monthGrid } from "./calendar-utils";

export default function MiniMonth({ month, onMonthChange, selected, now, busyDays, onSelect }) {
	const days = monthGrid(month);
	return (
		<div>
			<div className="mb-2 flex items-center justify-between pl-1">
				<p className="text-[13px] font-semibold tracking-tight text-foreground">{format(month, "MMMM yyyy")}</p>
				<div className="flex">
					<button
						type="button"
						aria-label="Previous month"
						onClick={() => onMonthChange(addMonths(month, -1))}
						className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<FiChevronLeft className="h-3.5 w-3.5" />
					</button>
					<button
						type="button"
						aria-label="Next month"
						onClick={() => onMonthChange(addMonths(month, 1))}
						className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
					>
						<FiChevronRight className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
			<div className="grid grid-cols-7 text-center text-[10px] font-medium text-muted-foreground">
				{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed weekday header
					<span key={i} className="py-1">
						{d}
					</span>
				))}
			</div>
			<div className="grid grid-cols-7">
				{days.map((day) => {
					const today = now && isSameDay(day, now);
					const sel = isSameDay(day, selected);
					const inMonth = isSameMonth(day, month);
					const busy = busyDays.has(dayKey(day));
					return (
						<button
							type="button"
							key={dayKey(day)}
							onClick={() => onSelect(day)}
							className="group relative flex h-8 items-center justify-center"
							aria-label={format(day, "EEEE, MMMM d")}
						>
							<span
								className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] tabular-nums ${
									today
										? "cal-today-dot font-semibold"
										: sel
											? "bg-muted font-semibold text-foreground ring-1 ring-border"
											: inMonth
												? "text-foreground group-hover:bg-muted"
												: "text-muted-foreground/50 group-hover:bg-muted"
								}`}
							>
								{day.getDate()}
							</span>
							{busy && (
								<span className="absolute bottom-0.5 h-[3px] w-[3px] rounded-full bg-muted-foreground/70" />
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
