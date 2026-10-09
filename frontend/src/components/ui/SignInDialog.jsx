"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiPromise = null;

function loadGsi() {
	if (window.google?.accounts?.id) return Promise.resolve();
	if (!gsiPromise) {
		gsiPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = GSI_SRC;
			script.async = true;
			script.onload = resolve;
			script.onerror = () => {
				gsiPromise = null;
				script.remove();
				reject(new Error("Failed to load Google sign-in"));
			};
			document.head.appendChild(script);
		});
	}
	return gsiPromise;
}

// Google is given the SHA-256 of the nonce and Supabase the raw value, so
// Supabase can check the ID token was minted for this sign-in attempt.
async function createNonce() {
	const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
	const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
	return { nonce, hashed };
}

// Google's ID-token flow only starts from a button Google renders itself, so
// the app's own "Sign in" buttons open this dialog instead of redirecting.
export function SignInDialog({ open, onOpenChange, onCredential }) {
	const [slot, setSlot] = useState(null);
	const [error, setError] = useState(null);
	const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

	useEffect(() => {
		if (!open || !slot) return;
		if (!clientId) {
			setError("Google sign-in is not configured.");
			return;
		}

		let cancelled = false;
		setError(null);

		Promise.all([loadGsi(), createNonce()])
			.then(([, { nonce, hashed }]) => {
				if (cancelled) return;
				window.google.accounts.id.initialize({
					client_id: clientId,
					callback: ({ credential }) => onCredential(credential, nonce),
					nonce: hashed,
					hd: "uci.edu",
				});
				window.google.accounts.id.renderButton(slot, {
					theme: document.documentElement.classList.contains("dark") ? "filled_black" : "outline",
					size: "large",
					shape: "pill",
					text: "signin_with",
					width: 280,
				});
			})
			.catch((err) => {
				console.error("Error loading Google sign-in:", err);
				if (!cancelled) setError("Couldn't load Google sign-in. Check your connection and try again.");
			});

		return () => {
			cancelled = true;
		};
	}, [open, slot, clientId, onCredential]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="w-[360px] p-6 text-center">
				<DialogTitle className="text-base font-semibold">Sign in to Instinct</DialogTitle>
				<DialogDescription className="mt-1 text-sm text-muted-foreground">
					Use your UCI Google account.
				</DialogDescription>
				{/* Google's button is an iframe whose page is light. When the OS is dark,
				    the iframe inherits a dark color-scheme from our meta tag, and Chrome
				    paints a white box behind the mismatched frame. Pinning the slot to
				    light makes the two match, so the frame stays transparent. */}
				<div ref={setSlot} className="mt-5 flex min-h-[44px] justify-center [color-scheme:light]" />
				{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
			</DialogContent>
		</Dialog>
	);
}
