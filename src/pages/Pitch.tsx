import { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsPlatformAdmin } from "@/hooks/useIsPlatformAdmin";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import logo from "@/assets/logo.png";

type Slide = {
  kicker: string;
  title: string;
  body?: string;
  bullets?: string[];
  footnote?: string;
};

const SLIDES: Slide[] = [
  {
    kicker: "Familial",
    title: "A private social space for the people who matter most.",
    body: "No ads. No algorithm. No strangers. Just your family, your church, your circle.",
  },
  {
    kicker: "The problem",
    title: "Social media stopped being social.",
    bullets: [
      "Family photos buried under ads and strangers' outrage",
      "Algorithms decide who sees what — and when",
      "Every post becomes data someone else sells",
      "Parents don't want their kids in that room",
    ],
  },
  {
    kicker: "The idea",
    title: "Rebuild the family feed the way it should have been.",
    body: "Invite-only circles. Strictly chronological. Nothing public, nothing searchable, nothing tracked.",
  },
  {
    kicker: "What's inside",
    title: "One app instead of five.",
    bullets: [
      "Chronological feed with photos and video",
      "Group and direct messaging",
      "Shared photo albums",
      "Events with RSVPs and reminders",
      "The Family Fridge — a shared pinboard",
    ],
  },
  {
    kicker: "How it works",
    title: "Three steps to a circle.",
    bullets: [
      "Create a circle — family, church group, team",
      "Invite people by link or email",
      "Everyone posts, plans, and shares in one private place",
    ],
  },
  {
    kicker: "Trust",
    title: "Privacy isn't a setting here. It's the product.",
    bullets: [
      "No tracking, no analytics on your people",
      "Nothing is public or searchable by outsiders",
      "Your content is never sold or used for advertising",
      "Built for 13+ with child-safety rules baked in",
    ],
  },
  {
    kicker: "Who it's for",
    title: "Any group that wants a room of its own.",
    bullets: [
      "Extended families staying close across states",
      "Churches: prayer requests, photos, events, fellowship",
      "Small teams and clubs that hate group texts",
    ],
  },
  {
    kicker: "Pricing",
    title: "Simple plans, same features.",
    bullets: [
      "Free — 1 circle, up to 8 members",
      "Family — up to 2 circles, 20 members each",
      "Extended — up to 3 circles, 35 members each",
      "Extra seats: $5 for 7 more members (subscribers only)",
    ],
    footnote: "Larger organizations: custom enterprise plans available.",
  },
  {
    kicker: "Proof",
    title: "Where we are today.",
    bullets: [
      "Live on the web, iOS, and Android",
      "Families, churches, and small teams already running private circles",
      "Built and shipping fast — new features every week",
    ],
    footnote: "No ads. No tracking. No algorithm. Ever.",
  },
  {
    kicker: "The ask",
    title: "Start one circle this week.",
    body: "Pick a group, invite ten people, and see what a quiet feed feels like. Setup takes under five minutes.",
    footnote: "familialmedia.com",
  },
];

export default function Pitch({ publicAccess = false }: { publicAccess?: boolean }) {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = useIsPlatformAdmin() || publicAccess;
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [checked, setChecked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Give the admin lookup a moment before declaring "not allowed".
  useEffect(() => {
    if (authLoading) return;
    if (isAdmin) { setChecked(true); return; }
    const t = setTimeout(() => setChecked(true), 1200);
    return () => clearTimeout(t);
  }, [authLoading, isAdmin]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, SLIDES.length - 1)), []);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch { /* not supported */ }
  };

  if (!publicAccess && (authLoading || (!isAdmin && !checked))) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!publicAccess && (!user || !isAdmin)) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 text-center">
        <Helmet><meta name="robots" content="noindex,nofollow" /></Helmet>
        <h1 className="font-serif text-2xl text-foreground mb-2">Not available</h1>
        <p className="text-sm text-muted-foreground mb-6">This page is private.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
      </div>
    );
  }

  const slide = SLIDES[index];

  return (
    <div ref={containerRef} className="min-h-[100dvh] bg-background flex flex-col">
      <Helmet>
        <title>Sales Deck — Familial</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <header
        className="flex items-center justify-between px-4 py-3 border-b border-border"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Private deck</span>
        <Button variant="ghost" size="sm" onClick={toggleFullscreen} aria-label="Toggle fullscreen">
          {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <article key={index} className="w-full max-w-3xl animate-page-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <img src={logo} alt="Familial" className="h-12 sm:h-16 w-auto opacity-90" />
            <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              {slide.kicker}
            </span>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl leading-tight text-foreground mb-6">
            {slide.title}
          </h1>

          {slide.body && (
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {slide.body}
            </p>
          )}

          {slide.bullets && (
            <ul className="space-y-4 mt-2">
              {slide.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-lg sm:text-xl text-foreground/90">
                  <span className="mt-3 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {slide.footnote && (
            <p className="text-sm text-muted-foreground mt-8">{slide.footnote}</p>
          )}
        </article>
      </main>

      <footer
        className="border-t border-border px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <Button variant="outline" size="sm" onClick={prev} disabled={index === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
          </Button>

          <div className="flex items-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-6 bg-foreground" : "w-1.5 bg-border hover:bg-muted-foreground"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {index + 1} / {SLIDES.length}
            </span>
            <Button size="sm" onClick={next} disabled={index === SLIDES.length - 1}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
