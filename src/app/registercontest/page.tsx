"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

const ORANGE = "#ff9f0a";
const CONTEST_ID = "contest-1";
const CONTEST_NUMBER = 1;
const CONTEST_DAY = 6; // Saturday
const CONTEST_HOUR = 21; // 9:00 PM IST
const CONTEST_MINUTES = 90;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;
const WEEK = 7 * 24 * 60 * 60 * 1000;
const SHOW_COUNT_FROM = 25; // hide the registered counter until it looks good
const YEARS = [
  { value: "1st year", big: "1st", small: "year" },
  { value: "2nd year", big: "2nd", small: "year" },
  { value: "3rd year", big: "3rd", small: "year" },
  { value: "4th year", big: "4th", small: "year" },
  { value: "Graduated", big: "Grad", small: "passed out" },
];

function nextContestStart(now: number): number {
  const ist = new Date(now + IST_OFFSET);
  const daysAhead = (CONTEST_DAY - ist.getUTCDay() + 7) % 7;
  const start =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, CONTEST_HOUR) -
    IST_OFFSET;
  return start <= now ? start + WEEK : start;
}

const pad = (n: number) => String(n).padStart(2, "0");

function useCountdown(start: number | null) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!start) return;
    const tick = () => setMs(Math.max(0, start - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [start]);
  if (ms === null) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

async function submitRegistration(payload: Record<string, unknown>): Promise<void> {
  const res = await fetch("/api/contest/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok || res.status === 409) return;
  let msg = "Something went wrong. Please try again.";
  try {
    const data = await res.json();
    if (data?.message) msg = data.message;
  } catch {}
  throw new Error(msg);
}

const calFmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export default function ContestRegisterPage() {
  const { data: session } = useSession();
  const [start, setStart] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", college: "", year: "", reminders: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState(0);
  const [registered, setRegistered] = useState<number | null>(null);
  const countdown = useCountdown(start);
  const nameOk = form.name.trim().length >= 2;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  const collegeOk = form.college.trim().length >= 2;

  useEffect(() => setStart(nextContestStart(Date.now())), []);

  // The count is non-essential to registration, so an unavailable stats request does not block the form.
  useEffect(() => {
    fetch("/api/contest/register")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => typeof d?.registered === "number" && setRegistered(d.registered))
      .catch(() => {});
  }, []);

  function goToForm() {
    const el = document.getElementById("register-form");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }), 400);
  }

  // Prefill from session without overwriting what the user typed
  useEffect(() => {
    if (!session?.user) return;
    setForm((f) => ({
      ...f,
      name: f.name || session.user?.name || "",
      email: f.email || session.user?.email || "",
    }));
  }, [session]);

  const dateLabel = start
    ? new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(start)
    : "This Saturday";

  const set = (k: keyof typeof form, v: string | boolean) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function validate(keys: string[]) {
    const e: Record<string, string> = {};
    if (keys.includes("name") && !nameOk) e.name = "Enter your full name";
    if (keys.includes("email") && !emailOk) e.email = "Enter a valid email address";
    if (keys.includes("college") && !collegeOk) e.college = "Enter your college name";
    if (keys.includes("year") && !form.year) e.year = "Select your year";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setServerError("");
    if (step === 0) {
      if (validate(["name", "email"])) setStep(1);
      return;
    }
    if (!validate(["name", "email", "college", "year"])) return;
    setSubmitting(true);
    try {
      await submitRegistration({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        college: form.college.trim(),
        year: form.year,
        reminders: form.reminders,
        contest: CONTEST_ID,
      });
      setDone(true);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = `RoundZero Contest #${CONTEST_NUMBER}`;
  const details = "90 minutes of DSA on RoundZero. Join from the contest page.";
  const end = start ? start + CONTEST_MINUTES * 60 * 1000 : 0;

  function downloadIcs() {
    if (!start) return;
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//RoundZero//Contest//EN",
      "BEGIN:VEVENT",
      `UID:${CONTEST_ID}-${start}@roundzero`,
      `DTSTAMP:${calFmt(Date.now())}`,
      `DTSTART:${calFmt(start)}`,
      `DTEND:${calFmt(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${details}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "roundzero-contest.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  const googleCal = start
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${calFmt(start)}/${calFmt(end)}&details=${encodeURIComponent(details)}`
    : "#";

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/contest/register` : "";
  const shareText = `I just got shortlisted for ${title}. 90 minutes, ${dateLabel}, 9:00 PM IST. Think you can beat me?`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#181818] text-[#f4f4f4]">
      <style>{`@keyframes rz-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}.rz-in{animation:rz-in .35s ease both}@keyframes rz-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.rz-line{opacity:0;animation:rz-fade .5s ease forwards}@keyframes rz-pop{0%{opacity:0;transform:translateY(-10px) scale(.9)}60%{transform:translateY(2px) scale(1.04)}100%{opacity:1;transform:none}}.rz-pop{animation:rz-pop .5s .2s ease both}@keyframes rz-stamp{0%{opacity:0;transform:rotate(-12deg) scale(2.2)}70%{opacity:1;transform:rotate(-12deg) scale(.94)}100%{opacity:1;transform:rotate(-12deg) scale(1)}}.rz-stamp{opacity:0;animation:rz-stamp .45s 2.1s ease forwards}@media (prefers-reduced-motion:reduce){.rz-in,.rz-line,.rz-pop,.rz-stamp{animation:none;opacity:1}.rz-stamp{transform:rotate(-12deg)}}`}</style>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
        <div
          className="absolute left-1/2 top-[30%] h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ background: "rgba(255,159,10,0.05)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px] px-5 py-10 lg:px-10 lg:py-16">
        <Link href="/" className="text-sm text-white/45 transition hover:text-white">
          ← RoundZero
        </Link>

        <div className="mt-10 grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* LEFT: the invitation */}
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#ff9f0a]/30 bg-[#ff9f0a]/[0.07] px-4 py-2 text-xs font-semibold" style={{ color: ORANGE }}>
              <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: ORANGE }} />
              Registrations open
            </div>

            <h1 className="text-5xl font-bold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              You&apos;ve been
              <br />
              <span style={{ color: ORANGE }}>shortlisted.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-white/50">
              Contest #{CONTEST_NUMBER} is open to every student. Register now and we&apos;ll remind you before it starts.
            </p>

            {registered !== null && registered >= SHOW_COUNT_FROM && (
              <div className="mt-6 inline-flex items-center gap-2.5 text-sm text-white/55">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[#30d158]" />
                <span>
                  <span className="font-semibold text-white">{registered.toLocaleString()}</span> students already registered
                </span>
              </div>
            )}

            {/* Mail window */}
            <div className="relative mt-12">
              <div className="rz-pop absolute -top-5 right-4 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-[#2a2a2a] px-3.5 py-2 text-xs font-medium shadow-xl">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ORANGE }} />
                1 new message
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#202020] shadow-2xl shadow-black/40">
                <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-3.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
                  <span className="ml-3 text-xs text-white/35">Inbox</span>
                </div>

                <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-4">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-black"
                    style={{ backgroundColor: ORANGE }}
                  >
                    R
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">RoundZero Contests</div>
                    <div className="text-xs text-white/35">to me</div>
                  </div>
                  <span className="text-xs text-white/30">now</span>
                </div>

                <div className="p-5 md:p-6">
                  <Reveal d={0.5}>
                    <div className="text-xs text-white/35">Subject</div>
                    <div className="mt-1 text-lg font-semibold leading-snug">Online Assessment Invitation: RoundZero</div>
                  </Reveal>

                  <span className="rz-stamp absolute right-5 top-[150px] hidden rounded-md border-2 px-3 py-1 text-sm font-extrabold tracking-[0.16em] sm:block" style={{ borderColor: ORANGE, color: ORANGE }}>
                    SHORTLISTED
                  </span>

                  <Reveal d={0.9}>
                    <p className="mt-5 text-sm leading-6 text-white/65">Hi, you have been shortlisted for Contest #{CONTEST_NUMBER}.</p>
                  </Reveal>

                  <Reveal d={1.3}>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <Detail label="Date" value={dateLabel} />
                      <Detail label="Time" value="9:00 PM IST" />
                      <Detail label="Duration" value="90 minutes" />
                    </div>
                  </Reveal>

                  <Reveal d={1.7}>
                    <p className="mt-5 text-sm leading-6 text-white/45">
                      Please ensure stable internet. Cameras are optional. Vibes are mandatory.
                    </p>
                    <p className="mt-2 font-serif text-sm italic text-white/35">Good luck. You&apos;ll need it.</p>
                  </Reveal>

                  <Reveal d={2.0}>
                    <button
                      type="button"
                      onClick={goToForm}
                      className="group mt-6 flex w-full cursor-pointer items-center justify-between rounded-lg border border-[#ff9f0a]/50 bg-[#ff9f0a]/10 px-5 py-3.5 text-sm font-semibold transition hover:bg-[#ff9f0a]/20"
                      style={{ color: ORANGE }}
                    >
                      <span>Accept invitation</span>
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    </button>
                  </Reveal>
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div className="mt-8">
              <div className="mb-3 text-sm font-medium text-white/45">Contest starts in</div>
              <div className="grid grid-cols-4 gap-3" aria-label="Time until the contest starts">
                {(
                  [
                    ["Days", countdown?.d],
                    ["Hours", countdown?.h],
                    ["Min", countdown?.m],
                    ["Sec", countdown?.s],
                  ] as [string, number | undefined][]
                ).map(([label, v], i) => (
                  <div key={label} className="rounded-xl border border-white/[0.07] bg-[#1e1e1e] py-4 text-center">
                    <div
                      className="text-3xl font-bold tabular-nums tracking-[-0.05em] md:text-4xl"
                      style={i === 3 ? { color: ORANGE } : undefined}
                    >
                      {v === undefined ? "--" : pad(v)}
                    </div>
                    <div className="mt-1 text-xs text-white/35">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Perks */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {[
                ["Live leaderboard", "Watch your rank move as you solve"],
                ["College rankings", "Rep your college against the rest"],
                ["Shareable rank card", "Post your result when it ends"],
                ["Free to join", "No payment, no catch"],
              ].map(([t, d]) => (
                <div key={t} className="rounded-xl border border-white/[0.07] bg-[#1e1e1e] p-4 transition hover:border-[#ff9f0a]/30">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span style={{ color: ORANGE }}>✦</span>
                    {t}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/40">{d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: form or success */}
          <div className="lg:sticky lg:top-10">
            {done ? (
              <div className="rz-in">
                {/* Ticket */}
                <div className="relative overflow-hidden rounded-2xl border border-[#ff9f0a]/40 bg-[#202020] shadow-2xl shadow-black/30">
                  <div className="flex items-center justify-between px-6 py-4 text-black" style={{ backgroundColor: ORANGE }}>
                    <span className="text-sm font-bold tracking-[0.18em]">ADMIT ONE</span>
                    <span className="text-sm font-bold">Contest #{CONTEST_NUMBER}</span>
                  </div>
                  <div className="px-6 pb-6 pt-7">
                    <div className="text-xs text-white/35">Participant</div>
                    <div className="mt-1 truncate text-3xl font-bold tracking-[-0.04em]">{form.name.trim()}</div>
                    <div className="mt-1 truncate text-sm text-white/50">
                      {form.college.trim()} · {form.year}
                    </div>
                  </div>
                  <div className="relative">
                    <div className="border-t border-dashed border-white/15" />
                    <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-[#181818]" />
                    <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-[#181818]" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 px-6 py-5">
                    <TicketCell label="Date" value={dateLabel.replace(/^\w+,? /, "")} />
                    <TicketCell label="Time" value="9:00 PM IST" />
                    <TicketCell label="Duration" value="90 min" />
                  </div>
                </div>

                <h2 className="mt-8 text-3xl font-bold tracking-[-0.045em]">You&apos;re in, {form.name.trim().split(" ")[0]}.</h2>
                <p className="mt-2 text-sm leading-6 text-white/50">
                  See you on {dateLabel} at 9:00 PM IST.
                  {form.reminders && " We'll email you a reminder before it starts."}
                </p>

                <div className="mt-6 space-y-3">
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-between rounded-lg px-5 py-4 text-sm font-semibold text-black transition hover:brightness-110"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <span>Challenge a friend on WhatsApp</span>
                    <span>→</span>
                  </a>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <a href={googleCal} target="_blank" rel="noopener noreferrer" className={ghostBtn}>
                      Google Calendar
                    </a>
                    <button type="button" onClick={downloadIcs} className={`${ghostBtn} cursor-pointer`}>
                      Download .ics
                    </button>
                    <button type="button" onClick={copyLink} className={`${ghostBtn} cursor-pointer`}>
                      {copied ? "Copied" : "Copy link"}
                    </button>
                  </div>
                </div>

                <Link href="/questions" className="mt-6 inline-block text-sm text-white/45 transition hover:text-white">
                  Warm up with some questions first →
                </Link>
              </div>
            ) : (
              <form
                id="register-form"
                onSubmit={onSubmit}
                noValidate
                className="rounded-2xl border border-white/[0.09] bg-[#202020] p-7 shadow-2xl shadow-black/30 md:p-9"
              >
                {/* Progress */}
                <div className="flex items-center gap-2" aria-hidden="true">
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 flex-1 rounded-full transition-colors duration-500"
                      style={{ backgroundColor: i <= step ? ORANGE : "rgba(255,255,255,0.1)" }}
                    />
                  ))}
                </div>
                <div className="mt-3 text-xs font-medium text-white/40">
                  Step {step + 1} of 2 · {step === 0 ? "About you" : "Your college"}
                </div>

                <div key={step} className="rz-in">
                  <h2 className="mt-6 text-3xl font-bold tracking-[-0.045em]">
                    {step === 0 ? "Let's get you in." : "Almost there."}
                  </h2>
                  <p className="mt-2 text-sm text-white/45">
                    {step === 0 ? "Where should we send your contest reminders?" : "Your college shows up on the leaderboard."}
                  </p>

                  {step === 0 ? (
                    <div className="mt-7 space-y-4">
                      <FloatInput
                        id="reg-name"
                        label="Full name"
                        value={form.name}
                        onChange={(v) => set("name", v)}
                        error={errors.name}
                        valid={nameOk}
                        autoComplete="name"
                      />
                      <FloatInput
                        id="reg-email"
                        label="Email address"
                        type="email"
                        value={form.email}
                        onChange={(v) => set("email", v)}
                        error={errors.email}
                        valid={emailOk}
                        autoComplete="email"
                      />
                    </div>
                  ) : (
                    <div className="mt-7 space-y-6">
                      <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#191919] px-4 py-3">
                        <div className="min-w-0 text-sm">
                          <div className="truncate font-medium">{form.name.trim()}</div>
                          <div className="truncate text-xs text-white/40">{form.email.trim()}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep(0)}
                          className="ml-3 shrink-0 cursor-pointer text-xs font-medium transition hover:brightness-125"
                          style={{ color: ORANGE }}
                        >
                          Edit
                        </button>
                      </div>

                      <FloatInput
                        id="reg-college"
                        label="College name"
                        value={form.college}
                        onChange={(v) => set("college", v)}
                        error={errors.college}
                        valid={collegeOk}
                        autoComplete="organization"
                        autoFocus
                      />

                      <div>
                        <div className="mb-2.5 text-sm font-medium text-white/70">Year of study</div>
                        <div role="group" aria-label="Year of study" className="grid grid-cols-5 gap-2">
                          {YEARS.map((y) => {
                            const on = form.year === y.value;
                            return (
                              <button
                                key={y.value}
                                type="button"
                                onClick={() => set("year", y.value)}
                                aria-pressed={on}
                                className={`cursor-pointer rounded-xl border py-3 text-center transition ${
                                  on
                                    ? "border-[#ff9f0a] bg-[#ff9f0a] text-black"
                                    : "border-white/[0.1] bg-[#191919] text-white/70 hover:border-white/25"
                                }`}
                              >
                                <div className="text-base font-bold leading-none">{y.big}</div>
                                <div className={`mt-1 text-[11px] ${on ? "text-black/60" : "text-white/35"}`}>{y.small}</div>
                              </button>
                            );
                          })}
                        </div>
                        {errors.year && (
                          <p role="alert" className="mt-2 text-sm text-red-300">
                            {errors.year}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.reminders}
                        onClick={() => set("reminders", !form.reminders)}
                        className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-[#191919] px-4 py-3.5 text-left"
                      >
                        <span>
                          <span className="block text-sm font-medium">Remind me by email</span>
                          <span className="block text-xs text-white/40">So you don&apos;t miss the start</span>
                        </span>
                        <span
                          className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                          style={{ backgroundColor: form.reminders ? ORANGE : "rgba(255,255,255,0.15)" }}
                        >
                          <span
                            className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
                            style={{ left: form.reminders ? 22 : 2 }}
                          />
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                {serverError && (
                  <div role="alert" className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {serverError}
                  </div>
                )}

                <div className="mt-7 flex gap-3">
                  {step === 1 && (
                    <button
                      type="button"
                      onClick={() => setStep(0)}
                      className="cursor-pointer rounded-lg border border-white/[0.1] bg-[#191919] px-5 py-4 text-sm text-white/60 transition hover:text-white"
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="group flex flex-1 cursor-pointer items-center justify-between rounded-lg px-5 py-4 text-sm font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <span>{step === 0 ? "Continue" : submitting ? "Registering..." : "Accept invitation"}</span>
                    {submitting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                    ) : (
                      <span className="transition-transform group-hover:translate-x-1">→</span>
                    )}
                  </button>
                </div>

                <p className="mt-4 text-center text-xs text-white/30">Free to join · Saturday 9:00 to 10:30 PM IST</p>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[#191919] px-4 py-3">
      <div className="text-xs text-white/35">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

const ghostBtn =
  "rounded-lg border border-white/[0.1] bg-[#191919] px-3 py-3.5 text-center text-sm text-white/70 transition hover:border-[#ff9f0a]/40 hover:text-white";

function FloatInput({
  id,
  label,
  value,
  onChange,
  error,
  valid,
  type = "text",
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  valid?: boolean;
  type?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder=" "
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          className={`peer w-full rounded-xl border bg-[#191919] px-4 pb-2.5 pt-6 pr-12 text-base text-white outline-none transition focus:border-[#ff9f0a] focus:ring-4 focus:ring-[#ff9f0a]/15 ${
            error ? "border-red-500/60" : "border-white/[0.1]"
          }`}
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-4 top-2 text-xs text-white/40 transition-all peer-placeholder-shown:top-[18px] peer-placeholder-shown:text-base peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#ff9f0a]"
        >
          {label}
        </label>
        {valid && !error && (
          <span
            className="absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-black"
            style={{ backgroundColor: ORANGE }}
            aria-hidden="true"
          >
            ✓
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function TicketCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-white/35">{label}</div>
      <div className="mt-0.5 text-sm font-semibold">{value}</div>
    </div>
  );
}

function Reveal({ d, children }: { d: number; children: ReactNode }) {
  return (
    <div className="rz-line" style={{ animationDelay: `${d}s` }}>
      {children}
    </div>
  );
}