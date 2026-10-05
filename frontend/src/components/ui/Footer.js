"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { checkApiHealth } from "@/lib/api";

const FEEDBACK_URL =
  "https://airtable.com/app6eZfxp1tX3cTr1/pag44eL08NgLSEdu0/form";

const STATUS_DOT = {
  Online: "bg-emerald-500",
  Offline: "bg-red-500",
};

export default function Footer() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const s = await checkApiHealth();
      if (alive) setStatus(s);
    };
    run();
    const id = setInterval(run, 60000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const link = "transition-colors hover:text-foreground";

  return (
    <footer className="mt-auto w-full border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <img src="/logo.png" alt="" className="h-6 w-6" />
            <span className="font-medium">Instinct</span>
          </Link>
          <span>© 2026</span>
          <span
            className="ml-1 inline-flex items-center gap-1.5 text-xs"
            title={status === "loading" ? "Checking API status" : `API ${status}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] || "bg-amber-500"}`}
            />
            <span className="sr-only md:not-sr-only">
              {status === "loading" ? "Checking" : status}
            </span>
          </span>
        </div>

        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href="/documents/terms-and-conditions.pdf" target="_blank" rel="noopener noreferrer" className={link}>
            Terms
          </a>
          <a href="/documents/privacy-policy.pdf" target="_blank" rel="noopener noreferrer" className={link}>
            Privacy
          </a>
          <a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" className={link}>
            Feedback
          </a>
          <a href="mailto:spallamr@uci.edu" className={link}>
            spallamr@uci.edu
          </a>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-6 text-xs text-muted-foreground/80 sm:px-6">
        Not affiliated with or endorsed by the University of California, Irvine.
      </div>
    </footer>
  );
}
