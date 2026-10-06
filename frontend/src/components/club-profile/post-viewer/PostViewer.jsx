"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { format } from "date-fns";
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiImage,
  FiInstagram,
  FiMapPin,
  FiPlus,
  FiX,
} from "react-icons/fi";
import ClubAvatar from "@/components/ClubAvatar";
import { icsHref, timeRange } from "@/components/events-calendar/calendar-utils";
import { clubAvatarUrl, safeHttpUrl } from "../clubDetailUtils";
import { frameRatio, preloadImage, useImageMeta } from "./image-meta";
import {
  cleanCaption,
  fullDate,
  postDate,
  relativeAge,
  tokenizeCaption,
} from "./post-utils";

const PHONE = "(max-width: 639px)";

function useIsPhone() {
  const [phone, setPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(PHONE).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

/* ---------- small pieces ---------- */

function AvatarRing({ club, size = 32, className = "" }) {
  return (
    <span className={`instinct-story-ring shrink-0 ${className}`} style={{ padding: 1.5 }}>
      <span className="instinct-story-ring-inner bg-transparent!" style={{ padding: 1.5 }}>
        <span
          className="relative block overflow-hidden rounded-full"
          style={{ width: size, height: size }}
        >
          <ClubAvatar src={clubAvatarUrl(club)} alt="" sizes={`${size}px`} ring={false} />
        </span>
      </span>
    </span>
  );
}

function CaptionText({ text }) {
  const tokens = useMemo(() => tokenizeCaption(text), [text]);
  return tokens.map((t, i) =>
    t.type === "text" ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: tokens never reorder
      <span key={i}>{t.text}</span>
    ) : (
      <a
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens never reorder
        key={i}
        href={t.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-[color:var(--instinct-purple)] hover:underline"
      >
        {t.text}
      </a>
    ),
  );
}

/** Image area: skeleton while loading, a quiet placeholder if missing/broken. */
function Frame({ post, status, alt, sizes, priority }) {
  if (status === "loaded") {
    return (
      <Image
        src={post.image_url}
        alt={alt}
        fill
        sizes={sizes}
        className="select-none object-contain"
        draggable={false}
        priority={priority}
        unoptimized
      />
    );
  }
  if (status === "loading") {
    return (
      <div
        data-viewer-loading=""
        className="absolute inset-0 animate-pulse bg-neutral-800"
        aria-label="Loading image"
        role="img"
      />
    );
  }
  return (
    <div
      data-viewer-missing=""
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted text-muted-foreground"
    >
      <FiImage className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
      <p className="text-xs">
        {status === "error" ? "Couldn't load this image" : "No image for this post"}
      </p>
    </div>
  );
}

function EventCard({ ev }) {
  const past = ev.endMs < Date.now();
  return (
    <li className="rounded-md border border-border px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold leading-snug text-foreground [overflow-wrap:anywhere]">
          {ev.title}
        </p>
        {past && (
          <span className="mt-px shrink-0 rounded border border-border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Past
          </span>
        )}
      </div>
      <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <FiCalendar
          className="h-3.5 w-3.5 shrink-0 text-[color:var(--instinct-purple)]"
          aria-hidden="true"
        />
        <span>
          {format(ev.start, "EEE, MMM d")} · {timeRange(ev)}
        </span>
      </p>
      {ev.location && (
        <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <FiMapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{ev.location}</span>
        </p>
      )}
      {!past && (
        <a
          href={icsHref(ev)}
          download={`${ev.title.replace(/[^\w]+/g, "-").toLowerCase()}.ics`}
          className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
        >
          <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Add to calendar
        </a>
      )}
    </li>
  );
}

function EventCards({ events, onShowEvents }) {
  if (!events?.length) return null;
  const shown = events.slice(0, 2);
  const more = events.length - shown.length;
  return (
    <section className="mt-5" aria-label="Events from this post">
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {events.length === 1 ? "Event" : `${events.length} events`}
      </h3>
      <ul className="space-y-2">
        {shown.map((ev) => (
          <EventCard key={ev.id} ev={ev} />
        ))}
      </ul>
      {more > 0 && (
        <button
          type="button"
          onClick={onShowEvents}
          className="mt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          +{more} more in Events
        </button>
      )}
    </section>
  );
}

/** Avatar + bold handle + caption, then the age ("4d"). */
function CaptionBlock({ club, handle, caption, date, avatar = true }) {
  return (
    <div className="flex gap-3">
      {avatar && <AvatarRing club={club} className="self-start" />}
      <div className="min-w-0 flex-1 pt-1 text-sm leading-[1.45] text-foreground">
        <p className="whitespace-pre-line [overflow-wrap:anywhere]">
          <Link href={`/club/${handle}`} className="mr-1.5 font-semibold hover:opacity-70">
            {handle}
          </Link>
          {caption ? (
            <CaptionText text={caption} />
          ) : (
            <span className="text-muted-foreground">No caption.</span>
          )}
        </p>
        {date && (
          <time
            dateTime={date.toISOString()}
            title={fullDate(date)}
            className="mt-2 block text-xs text-muted-foreground"
          >
            {relativeAge(date)}
          </time>
        )}
      </div>
    </div>
  );
}

function InstagramPill({ href }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 text-xs font-medium text-background hover:opacity-85"
    >
      <FiInstagram className="h-3.5 w-3.5" aria-hidden="true" />
      View on Instagram
    </a>
  );
}

function PostFooter({ date, postUrl, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {date ? (
        <time dateTime={date.toISOString()} className="text-xs text-muted-foreground">
          {fullDate(date)}
        </time>
      ) : (
        <span className="text-xs text-muted-foreground">Date unknown</span>
      )}
      <InstagramPill href={postUrl} />
    </div>
  );
}

/* ---------- desktop ---------- */

function NavButton({ side, onClick }) {
  const Icon = side === "left" ? FiChevronLeft : FiChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous post" : "Next post"}
      className={`fixed top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-900 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

function DesktopView({ view, onPrev, onNext, onClose, onShowEvents }) {
  const { post, club, handle, caption, date, postUrl, events, img, ratio } = view;
  // Frame height: as tall as the image wants, capped at 90vh, never shorter
  // than 28rem so the panel has room. Width follows the image's ratio.
  const frame = {
    "--r": ratio,
    "--maxw": "calc(100vw - 128px - var(--panel))",
    "--h": "min(90dvh, max(min(28rem, 90dvh), calc(var(--maxw) / var(--r))))",
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click; Esc and the X close for keyboard users
    // biome-ignore lint/a11y/useKeyWithClickEvents: same as above
    <div
      className="flex h-full w-full items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <Dialog.Close
        className="fixed right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-white hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Close"
      >
        <FiX className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
      </Dialog.Close>
      {onPrev && <NavButton side="left" onClick={onPrev} />}
      {onNext && <NavButton side="right" onClick={onNext} />}

      <article
        className="flex overflow-hidden rounded-[4px] border border-white/10 bg-card text-card-foreground [--panel:320px] lg:[--panel:360px] dark:border-border"
        style={frame}
      >
        <div
          className="relative shrink-0 bg-black"
          style={{ height: "var(--h)", width: "min(var(--maxw), calc(var(--h) * var(--r)))" }}
        >
          <Frame
            post={post}
            status={img.status}
            alt={caption ? caption.slice(0, 140) : `Post by ${handle}`}
            sizes="(min-width: 1024px) 70vw, 60vw"
            priority
          />
        </div>

        <div
          className="flex shrink-0 flex-col border-l border-border"
          style={{ width: "var(--panel)", height: "var(--h)" }}
        >
          <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border pl-4 pr-2">
            <AvatarRing club={club} />
            <div className="min-w-0 flex-1">
              <Link
                href={`/club/${handle}`}
                className="block truncate text-sm font-semibold text-foreground hover:opacity-70"
              >
                {handle}
              </Link>
              {club?.name && club.name !== handle && (
                <p className="truncate text-xs text-muted-foreground">{club.name}</p>
              )}
            </div>
            {postUrl && (
              <a
                href={postUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open post on Instagram"
                title="Open on Instagram"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <FiInstagram className="h-[18px] w-[18px]" aria-hidden="true" />
              </a>
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <CaptionBlock club={club} handle={handle} caption={caption} date={date} />
            <EventCards events={events} onShowEvents={onShowEvents} />
          </div>

          <PostFooter
            date={date}
            postUrl={postUrl}
            className="shrink-0 border-t border-border px-4 py-3"
          />
        </div>
      </article>
    </div>
  );
}

/* ---------- phone ---------- */

const SWIPE_X = 60;
const SWIPE_DOWN = 110;

function PhoneView({ view, index, total, onPrev, onNext, onClose, onShowEvents }) {
  const { post, club, handle, caption, date, postUrl, events, img, ratio } = view;
  const scrollRef = useRef(null);
  const moverRef = useRef(null);
  const touch = useRef(null);

  const setMover = (x, y, animate) => {
    const el = moverRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 180ms ease-out, opacity 180ms ease-out" : "none";
    el.style.transform = x || y ? `translate3d(${x}px, ${y}px, 0)` : "";
    el.style.opacity = y > 0 ? String(Math.max(0.4, 1 - y / 500)) : "";
  };

  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, top: scrollRef.current?.scrollTop || 0, axis: null, dx: 0, dy: 0 };
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy)) s.axis = "x";
      else s.axis = dy > 0 && s.top <= 0 ? "down" : "scroll";
    }
    s.dx = dx;
    s.dy = dy;
    if (s.axis === "x") {
      const edge = (dx > 0 && !onPrev) || (dx < 0 && !onNext);
      setMover(edge ? dx / 4 : dx, 0, false);
    } else if (s.axis === "down") {
      setMover(0, Math.max(0, dy), false);
    }
  };
  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    if (s.axis === "x" && s.dx <= -SWIPE_X && onNext) {
      setMover(0, 0, false);
      onNext();
    } else if (s.axis === "x" && s.dx >= SWIPE_X && onPrev) {
      setMover(0, 0, false);
      onPrev();
    } else if (s.axis === "down" && s.dy >= SWIPE_DOWN) {
      onClose();
    } else {
      setMover(0, 0, true);
    }
  };

  // New post: back to the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on post change only
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [post]);

  return (
    <div className="flex h-full flex-col bg-background text-foreground dark:bg-black">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-1">
        <Dialog.Close
          className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Back"
        >
          <FiArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Dialog.Close>
        <AvatarRing club={club} size={26} />
        <Link
          href={`/club/${handle}`}
          className="ml-2 min-w-0 flex-1 truncate text-sm font-semibold hover:opacity-70"
        >
          {handle}
        </Link>
        <span className="px-2 text-xs tabular-nums text-muted-foreground">
          <span aria-hidden="true">
            {index + 1} / {total}
          </span>
          <span className="sr-only">{`Post ${index + 1} of ${total}`}</span>
        </span>
        {postUrl && (
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open post on Instagram"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <FiInstagram className="h-[18px] w-[18px]" aria-hidden="true" />
          </a>
        )}
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div ref={moverRef} className="will-change-transform">
          <div className="relative w-full bg-black" style={{ aspectRatio: ratio }}>
            <Frame
              post={post}
              status={img.status}
              alt={caption ? caption.slice(0, 140) : `Post by ${handle}`}
              sizes="100vw"
              priority
            />
          </div>
          <div className="px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
            <CaptionBlock club={club} handle={handle} caption={caption} date={date} avatar={false} />
            <EventCards events={events} onShowEvents={onShowEvents} />
            <PostFooter date={date} postUrl={postUrl} className="mt-5 border-t border-border pt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- root ---------- */

/**
 * Instagram-style post viewer for a club's posts.
 * `index` is the open post (null = closed); `onIndexChange` moves, `onClose` closes.
 */
export default function PostViewer({
  posts,
  index,
  club,
  eventsByPost,
  total: totalCount = null,
  hasMore = false,
  onNeedMore,
  onIndexChange,
  onClose,
  onShowEvents,
}) {
  const phone = useIsPhone();
  const post = index != null ? posts?.[index] : null;
  const open = Boolean(post);
  const loaded = posts?.length || 0;
  // The club's post count when the API sent it, else what is loaded so far.
  const total = Math.max(totalCount || 0, loaded);
  const handle = club?.instagram_handle || "";
  const img = useImageMeta(post?.image_url || null);
  // "Next" pressed on the last loaded post while the next page loads.
  const pendingNext = useRef(null);

  const go = useCallback(
    (delta) => {
      if (index == null) return;
      const next = index + delta;
      if (next >= 0 && next < loaded) onIndexChange(next);
      else if (delta > 0 && next >= loaded && hasMore) {
        pendingNext.current = index;
        onNeedMore?.();
      }
    },
    [index, loaded, hasMore, onIndexChange, onNeedMore],
  );

  // Page in more posts before the viewer reaches the end of what is loaded.
  useEffect(() => {
    if (index != null && hasMore && index >= loaded - 3) onNeedMore?.();
  }, [index, loaded, hasMore, onNeedMore]);

  // Finish a pending "next" once its page arrives (or give up at the end).
  useEffect(() => {
    const from = pendingNext.current;
    if (from == null) return;
    if (index !== from) pendingNext.current = null;
    else if (from + 1 < loaded) {
      pendingNext.current = null;
      onIndexChange(from + 1);
    } else if (!hasMore) pendingNext.current = null;
  }, [index, loaded, hasMore, onIndexChange]);

  // Warm the neighbours (and one more ahead, the usual direction).
  useEffect(() => {
    if (index == null || !posts) return;
    for (const i of [index + 1, index - 1, index + 2]) preloadImage(posts[i]?.image_url);
  }, [index, posts]);

  const onKeyDown = (e) => {
    if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  };

  const contentRef = useRef(null);
  // No Radix Trigger here, so return focus by hand: to the grid tile of the
  // last post shown (it may differ from the one opened), else to whatever
  // had focus when the viewer opened.
  const openerRef = useRef(null);
  const lastIdRef = useRef(null);
  // Read during render: by the time effects run, Radix has moved focus in.
  if (open && !openerRef.current && typeof document !== "undefined") {
    openerRef.current = document.activeElement;
  }
  useEffect(() => {
    if (post) lastIdRef.current = String(post.id);
  }, [post]);
  const restoreFocus = (e) => {
    e.preventDefault();
    const id = lastIdRef.current;
    const tile = id && document.querySelector(`[data-post-tile="${CSS.escape(id)}"]`);
    const target = tile || openerRef.current;
    openerRef.current = null;
    if (target instanceof HTMLElement) target.focus({ preventScroll: Boolean(!tile) });
  };
  const view = post
    ? {
        post,
        club,
        handle,
        caption: cleanCaption(post.caption, handle),
        date: postDate(post),
        postUrl: safeHttpUrl(post.post_url),
        events: eventsByPost?.get(String(post.id)) || [],
        img,
        ratio: frameRatio(img.ratio),
      }
    : null;
  const nav = {
    onPrev: index > 0 ? () => go(-1) : null,
    onNext: index != null && (index < loaded - 1 || hasMore) ? () => go(1) : null,
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-150 dark:bg-black/80" />
        <Dialog.Content
          ref={contentRef}
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={restoreFocus}
          onKeyDown={onKeyDown}
          data-post-viewer=""
          data-post-id={post?.id}
          className="fixed inset-0 z-[81] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-150"
        >
          <Dialog.Title className="sr-only">
            {`Post by ${handle}, ${index + 1} of ${total}`}
          </Dialog.Title>
          {view &&
            (phone ? (
              <PhoneView
                view={view}
                index={index}
                total={total}
                {...nav}
                onClose={onClose}
                onShowEvents={onShowEvents}
              />
            ) : (
              <DesktopView view={view} {...nav} onClose={onClose} onShowEvents={onShowEvents} />
            ))}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
