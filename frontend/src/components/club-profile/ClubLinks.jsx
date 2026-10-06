"use client";

import { useState } from "react";
import { FaLinkedin } from "react-icons/fa";
import { FiChevronRight, FiExternalLink, FiFileText, FiLink, FiMail, FiX } from "react-icons/fi";
import {
  SiDiscord,
  SiFacebook,
  SiGithub,
  SiGoogledocs,
  SiGoogledrive,
  SiGoogleforms,
  SiGooglesheets,
  SiInstagram,
  SiLinktree,
  SiSpotify,
  SiTiktok,
  SiX,
  SiYoutube,
} from "react-icons/si";
import { useIsPhone } from "@/components/club-profile/club-events/parts";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

// Brand marks for the hosts clubs actually use (linktr.ee is ~half of all
// links, then Google Forms/Docs and Discord); everything else gets a link icon.
// Local icons, so no third-party favicon requests from the club page.
function iconFor(link) {
  const { host, href } = link;
  if (host === "linktr.ee") return SiLinktree;
  if (host === "forms.gle" || /docs\.google\.com\/forms/.test(href)) return SiGoogleforms;
  if (/docs\.google\.com\/spreadsheets/.test(href)) return SiGooglesheets;
  if (host === "docs.google.com") return SiGoogledocs;
  if (host === "drive.google.com") return SiGoogledrive;
  if (/(^|\.)discord\.(gg|com)$/.test(host) || /\/discord$/.test(link.display)) return SiDiscord;
  if (host === "youtu.be" || host.endsWith("youtube.com")) return SiYoutube;
  if (host.endsWith("tiktok.com")) return SiTiktok;
  if (host.endsWith("linkedin.com")) return FaLinkedin;
  if (host.endsWith("instagram.com")) return SiInstagram;
  if (host.endsWith("facebook.com")) return SiFacebook;
  if (host === "x.com" || host === "twitter.com") return SiX;
  if (host.endsWith("spotify.com")) return SiSpotify;
  if (host === "github.com") return SiGithub;
  if (host === "mailto") return FiMail;
  if (/\.(pdf)$/i.test(href)) return FiFileText;
  return FiLink;
}

const linkProps = { target: "_blank", rel: "noopener noreferrer nofollow ugc" };

function LinkItem({ link }) {
  const Icon = iconFor(link);
  return (
    <li>
      <a
        {...linkProps}
        href={link.href}
        className="group flex items-center gap-3 px-4 py-3 outline-none hover:bg-muted/60 focus-visible:bg-muted/60"
        data-club-link-item
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground group-hover:text-foreground">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {link.title || link.host}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{link.display}</span>
        </span>
        <FiExternalLink
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
          aria-hidden="true"
        />
      </a>
    </li>
  );
}

function LinksList({ links, handle, Title, Description, Close }) {
  return (
    <>
      <div className="relative border-b border-border px-4 pb-3 pt-4 max-sm:pt-1">
        {Close && (
          <Close
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:bg-muted"
            aria-label="Close"
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </Close>
        )}
        <Title className="text-base font-semibold">Links</Title>
        <Description className="mt-0.5 text-xs text-muted-foreground">
          {links.length} links from @{handle}&apos;s Instagram bio
        </Description>
      </div>
      <ul className="divide-y divide-border py-1">
        {links.map((l) => (
          <LinkItem key={l.key} link={l} />
        ))}
      </ul>
    </>
  );
}

/**
 * Instagram-style link row under the bio: link icon, the first link's address,
 * "and N more". One link opens directly; several open a list (dialog on
 * desktop, bottom sheet on phones).
 */
export default function ClubLinks({ links, handle, className = "" }) {
  const [open, setOpen] = useState(false);
  const phone = useIsPhone();
  if (!links?.length) return null;
  const first = links[0];
  // Like Instagram: the first link's address, not its title ("Website",
  // "Linktree" say little). Long paths (Google Forms ids) shrink to the domain.
  const label = first.display.length > 32 ? first.host : first.display;
  const more = links.length - 1;
  const rowClass = `inline-flex max-w-full items-center gap-1.5 text-left text-sm font-medium outline-none hover:underline focus-visible:underline ${className}`;
  const inner = (
    <>
      <FiLink className="instinct-text h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="instinct-text min-w-0 truncate">{label}</span>
      {more > 0 && (
        <span className="shrink-0 font-normal text-foreground">
          and {more} more
          <FiChevronRight className="ml-0.5 inline h-3.5 w-3.5 align-[-2px] text-muted-foreground" aria-hidden="true" />
        </span>
      )}
    </>
  );

  if (more === 0) {
    return (
      <a {...linkProps} href={first.href} className={rowClass} title={first.display} data-club-links="1">
        {inner}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={rowClass}
        aria-haspopup="dialog"
        data-club-links={links.length}
      >
        {inner}
      </button>
      {phone ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent data-club-links-panel>
            <LinksList links={links} handle={handle} Title={SheetTitle} Description={SheetDescription} />
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent data-club-links-panel>
            <LinksList links={links} handle={handle} Title={DialogTitle} Description={DialogDescription} Close={DialogClose} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
