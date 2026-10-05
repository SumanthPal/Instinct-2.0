"use client";
import React, { useState, useEffect } from "react";
import { checkApiHealth } from "@/lib/api";

const Footer = () => {
  const [healthStatus, setHealthStatus] = useState("loading");

  useEffect(() => {
    const runHealthCheck = async () => {
      const status = await checkApiHealth();
      setHealthStatus(status);
    };

    runHealthCheck();
    const intervalId = setInterval(runHealthCheck, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const getStatusColor = () => {
    switch (healthStatus) {
      case "Online":
        return "bg-emerald-500";
      case "Offline":
        return "bg-red-500";
      default:
        return "bg-amber-500";
    }
  };

  return (
    <footer className="mt-auto w-full border-t border-border bg-background">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center space-y-4 px-6 py-8 text-center">
        <div className="flex items-center space-x-2">
          <div
            className={`h-2.5 w-2.5 animate-pulse rounded-full ${getStatusColor()}`}
          />
          <span className="text-xs text-muted-foreground">
            {healthStatus === "loading"
              ? "Checking status..."
              : `Status: ${healthStatus}`}
          </span>
        </div>

        <a
          href="https://airtable.com/app6eZfxp1tX3cTr1/pag44eL08NgLSEdu0/form"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Share Feedback
        </a>

        <div className="flex space-x-4 text-sm text-muted-foreground">
          <a
            href="/documents/terms-and-conditions.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Terms & Conditions
          </a>
          <a
            href="/documents/privacy-policy.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground hover:underline"
          >
            Privacy Policy
          </a>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Instinct is not affiliated with or endorsed by the University of
            California, Irvine.
          </p>
          <p>
            Questions?{" "}
            <a
              href="mailto:spallamr@uci.edu"
              className="underline hover:text-foreground"
            >
              spallamr@uci.edu
            </a>
          </p>
        </div>

        <div className="text-xs text-muted-foreground/80">
          © {new Date().getFullYear()} Instinct
        </div>
      </div>
    </footer>
  );
};

export default Footer;
