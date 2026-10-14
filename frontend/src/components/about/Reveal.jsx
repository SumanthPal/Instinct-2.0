"use client";

import { useEffect, useRef, useState } from "react";

const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const inView = (el) => el.getBoundingClientRect().top < window.innerHeight * 0.92;

// Fades + lifts the About page's sections (and list items) in as they scroll into view.
// Server HTML is fully visible; only below-the-fold items are hidden, and only after hydration.
export function RevealRoot() {
	useEffect(() => {
		if (reduced() || !("IntersectionObserver" in window)) return;
		const main = document.querySelector("main");
		if (!main) return;
		const targets = [];
		const collect = (el) => {
			for (const c of el.children) {
				if (c.dataset.reveal === "skip") continue;
				if (c.tagName === "UL" || c.tagName === "OL") {
					for (const li of c.children) targets.push(li);
				} else if (c.tagName === "DIV" && c.children.length > 1 && !c.className.includes("grid")) {
					collect(c);
				} else {
					targets.push(c);
				}
			}
		};
		collect(main);
		const hidden = targets.filter((el) => !inView(el));
		for (const el of hidden) {
			el.style.opacity = "0";
			el.style.transform = "translateY(12px)";
		}
		const io = new IntersectionObserver(
			(entries) => {
				let n = 0;
				for (const e of entries) {
					if (!e.isIntersecting) continue;
					const el = e.target;
					io.unobserve(el);
					el.style.transition = `opacity 450ms ease-out ${n * 60}ms, transform 450ms ease-out ${n * 60}ms`;
					el.style.opacity = "";
					el.style.transform = "";
					n++;
				}
			},
			{ rootMargin: "0px 0px -8% 0px" },
		);
		for (const el of hidden) io.observe(el);
		return () => io.disconnect();
	}, []);
	return null;
}

// Wraps the system map: lines draw in and blobs pop when it scrolls into view.
export function MapReveal({ className = "", children }) {
	const ref = useRef(null);
	const [state, setState] = useState("static");
	useEffect(() => {
		const el = ref.current;
		if (!el || reduced() || !("IntersectionObserver" in window)) return;
		setState("pending");
		const io = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting) {
					setState("in");
					io.disconnect();
				}
			},
			{ threshold: 0.25 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);
	return (
		<div ref={ref} data-reveal="skip" data-state={state} className={className}>
			{children}
		</div>
	);
}
