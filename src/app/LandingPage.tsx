"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import GoogleSignInButton from "@/components/GoogleSignInButton";

const ORANGE = "#ff9f0a";

/* Contest: every Saturday 9:00 PM - 10:30 PM IST. Change here if needed. */
const CONTEST_DAY = 6; // Saturday
const CONTEST_HOUR = 21;
const CONTEST_MINUTES = 90;
const IST_OFFSET = 5.5 * 60 * 60 * 1000;
const WEEK = 7 * 24 * 60 * 60 * 1000;

/* Next contest start (ms, UTC epoch) */
function nextContestStart(now: number): number {
  const ist = new Date(now + IST_OFFSET);
  const daysAhead = (CONTEST_DAY - ist.getUTCDay() + 7) % 7;
  const start =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, CONTEST_HOUR) -
    IST_OFFSET;
  return start <= now ? start + WEEK : start;
}

function useContestClock() {
  const [state, setState] = useState<{ live: boolean; ms: number } | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const next = nextContestStart(now);
      const last = next - WEEK;
      const live = now - last < CONTEST_MINUTES * 60 * 1000;
      setState({ live, ms: live ? last + CONTEST_MINUTES * 60 * 1000 - now : next - now });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}

function splitTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/* Button that links when signed in, otherwise opens Google sign-in */
function Cta({
  href,
  children,
  className,
  style,
}: {
  href: string;
  children: ReactNode;
  className: string;
  style?: CSSProperties;
}) {
  const { data: session } = useSession();
  if (session?.user) {
    return (
      <Link href={href} className={className} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <GoogleSignInButton
      callbackUrl={href}
      className={className}
      style={style}
    >
      {children}
    </GoogleSignInButton>
  );
}

const solid =
  "group flex cursor-pointer items-center justify-between gap-8 rounded-lg px-6 py-3.5 text-sm font-semibold text-black transition hover:brightness-110";

export default function LandingPage() {
  const [questions, setQuestions] = useState(0);
  const clock = useContestClock();

  useEffect(() => {
    let value = 0;
    const interval = setInterval(() => {
      value += 100;
      if (value >= 2800) {
        value = 2800;
        clearInterval(interval);
      }
      setQuestions(value);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const t = clock ? splitTime(clock.ms) : null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const countdown = t ? `${t.d > 0 ? `${t.d}d ` : ""}${pad(t.h)}:${pad(t.m)}:${pad(t.s)}` : "";
  const [showBar, setShowBar] = useState(false);
  const [barClosed, setBarClosed] = useState(false);
  const [duelSecs, setDuelSecs] = useState(252);

  useEffect(() => {
    const id = setInterval(() => setDuelSecs((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowBar(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#181818] text-[#f4f4f4]">
      {/* BACKGROUND */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />
        <div
          className="absolute left-1/2 top-[35%] h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{ background: "rgba(255,159,10,0.035)" }}
        />
      </div>

      {/* HERO */}
      <section className="relative z-10">
        <div className="mx-auto max-w-[1500px] px-5 lg:px-10">
          <div className="grid min-h-[650px] items-center gap-14 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
            <div className="relative">
              <Link
                href="#contest"
                className="mb-7 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-[#ff9f0a]/30 bg-[#ff9f0a]/[0.07] px-4 py-2 text-xs transition hover:border-[#ff9f0a]/60"
              >
                <span className="flex items-center gap-2 font-semibold" style={{ color: clock?.live ? "#30d158" : ORANGE }}>
                  <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: clock?.live ? "#30d158" : ORANGE }} />
                  {clock?.live ? "Contest live now" : "Weekly contest"}
                </span>
                <span className="text-white/70">Every Saturday, 9:00 to 10:30 PM IST</span>
                {countdown && (
                  <span className="font-mono tabular-nums text-white/50">
                    {clock?.live ? "ends in" : "starts in"} {countdown}
                  </span>
                )}
              </Link>

              <h1 className="max-w-[850px] text-[62px] font-bold leading-[0.94] tracking-[-0.055em] sm:text-[76px] md:text-[92px] lg:text-[98px]">
                Practice.
                <br />
                <span className="text-white/25">Compete.</span>
                <br />
                <span className="relative inline-block">
                  Break OAs.
                  <svg className="absolute -bottom-5 left-0 w-[92%]" viewBox="0 0 500 35" fill="none">
                    <path
                      d="M5 18 C80 8 130 27 205 15 C290 2 365 25 495 9"
                      stroke={ORANGE}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <div className="absolute right-0 top-8 hidden rotate-[-5deg] xl:block">
                <div className="font-serif text-sm italic text-white/35">yes, this one.</div>
                <svg className="mt-1 h-10 w-32" viewBox="0 0 130 40" fill="none">
                  <path d="M5 5 C35 28 70 34 120 18" stroke={ORANGE} strokeWidth="1.5" />
                  <path d="M107 12 L120 18 L108 25" stroke={ORANGE} strokeWidth="1.5" />
                </svg>
              </div>

              <p className="mt-10 max-w-xl text-sm leading-7 text-white/45 md:text-[15px]">
                Solve from a bank of <span className="font-semibold text-white">2,800+ questions</span>,
                duel a friend 1v1, take group OAs, and join the live contest every Saturday night.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Cta href="/questions" className={solid} style={{ backgroundColor: ORANGE }}>
                  Start Solving
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Cta>
                <Link
                  href="#contest"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#202020] px-6 py-3.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  Saturday contest
                </Link>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-white/30">
                <span>✓ 1v1 duels</span>
                <span>✓ Group OAs</span>
                <span>✓ Daily problem credit</span>
                <span>✓ Weekly contest</span>
              </div>
            </div>

            {/* HERO CARD: live duel */}
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="absolute -left-16 top-8 hidden -rotate-[8deg] lg:block">
                <div className="font-serif text-xs italic text-white/30">
                  let&apos;s make this
                  <br />
                  unnecessarily competitive.
                </div>
                <svg className="mt-2 h-12 w-28" viewBox="0 0 120 50" fill="none">
                  <path d="M115 5 C75 15 55 30 30 45" stroke={ORANGE} strokeWidth="1.5" />
                  <path d="M35 35 L30 45 L42 42" stroke={ORANGE} strokeWidth="1.5" />
                </svg>
              </div>

              <div className="relative rounded-2xl border border-white/[0.09] bg-[#202020] p-6 shadow-2xl shadow-black/30 md:p-7">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs text-white/55">
                    {questions.toLocaleString()}+ questions
                  </span>
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <h3 className="text-2xl font-bold tracking-[-0.03em]">Two Sum II</h3>
                  <span className="rounded-md bg-[#ff9f0a]/10 px-2 py-0.5 text-xs font-medium text-[#ff9f0a]">Medium</span>
                </div>
                <p className="mt-1.5 text-sm text-white/45">Same problem, same clock. First to pass all tests wins.</p>

                <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <DuelSide name="You" initial="Y" passed={7} lead />
                  <div className="text-center">
                    <div className="text-sm font-bold text-white/30">VS</div>
                    <div className="mt-1 font-mono text-lg font-semibold tabular-nums">
                      {pad(Math.floor(duelSecs / 60) % 60)}:{pad(duelSecs % 60)}
                    </div>
                  </div>
                  <DuelSide name="Rival" initial="R" passed={3 + (Math.floor(duelSecs / 3) % 4)} />
                </div>

                <div className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/[0.08] bg-[#191919] p-4">
                    <div className="text-xs text-white/40">Daily problem</div>
                    <div className="mt-1 text-lg font-bold" style={{ color: ORANGE }}>+1 credit</div>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-[#191919] p-4">
                    <div className="text-xs text-white/40">Contest</div>
                    <div className="mt-1 text-lg font-bold">Sat 9:00 PM</div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/[0.08] bg-[#191919] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-white/40">Unlimited OAs · 3 months</div>
                      <div className="mt-0.5 text-3xl font-bold tracking-[-0.05em]">₹99</div>
                    </div>
                    <Cta
                      href="/checkout?planId=unlimited_3months_99"
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-5 py-3 text-sm font-semibold text-black transition hover:brightness-110"
                      style={{ backgroundColor: ORANGE }}
                    >
                      Get access <span>→</span>
                    </Cta>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-7 -right-3 rotate-[4deg] rounded-lg border border-white/[0.08] bg-[#222] px-4 py-2 shadow-xl">
                <span className="font-serif text-sm italic text-white/45">cheaper than coffee.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TICKER */}
      <style>{`@keyframes rz-marquee{to{transform:translateX(-50%)}}.rz-marquee{animation:rz-marquee 32s linear infinite}@media (prefers-reduced-motion:reduce){.rz-marquee{animation:none}}`}</style>
      <div className="relative z-10 overflow-hidden border-t border-white/[0.07] bg-[#ff9f0a] py-3 text-black">
        <div className="rz-marquee flex w-max whitespace-nowrap text-sm font-bold">
          {[0, 1].map((i) => (
            <div key={i} className="flex shrink-0 items-center" aria-hidden={i === 1}>
              {[
                "Contest every Saturday, 9:00 PM IST",
                "1v1 duels",
                "Solve the daily problem, get +1 credit",
                "Group OAs",
                "2,800+ questions",
                "₹99 for 3 months",
              ].map((item) => (
                <span key={item} className="flex items-center">
                  <span className="px-6">{item}</span>
                  <span className="text-black/40">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* METRICS */}
      <section className="relative z-10 border-y border-white/[0.07]">
        <div className="mx-auto grid max-w-[1500px] md:grid-cols-2 lg:grid-cols-4">
          <Metric number="2,800+" title="Questions" description="DSA and interview problems ready to solve." />
          <Metric number="1v1" title="Duels" description="Same problem, same clock. Fastest accepted solution wins." />
          <Metric number="+1" title="Daily credit" description="Solve the problem of the day, earn an OA credit." />
          <Metric number="Sat" title="Weekly contest" description="9:00 to 10:30 PM IST, ranked live." />
        </div>
      </section>

      {/* MODES */}
      <section className="relative z-10 px-5 py-28 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <SectionLabel>Ways to play</SectionLabel>
          <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] md:text-6xl">
            Four ways to practice.
            <br />
            <span className="text-white/25">Pick your pressure.</span>
          </h2>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            <ModeCard
              tag="1v1 Duel"
              title="Challenge a friend"
              text="Share a link, get the same problem, and race. Live test progress for both sides, and the first accepted solution takes it."
              meta="2 players · live scoring"
            />
            <ModeCard
              tag="Group OA"
              title="Take an OA together"
              text="Create a room, share the invite code, and run one assessment for the whole group. Everyone gets the same questions at the same time, with a shared leaderboard."
              meta="Rooms · invite code · leaderboard"
            />
            <ModeCard
              tag="Problem of the day"
              title="Solve one, earn a credit"
              text="A fresh problem every day. Solve it and get +1 OA credit added to your account."
              meta="+1 credit per day"
              accent
            />
            <ModeCard
              tag="Weekly contest"
              title="Saturday, 9:00 to 10:30 PM"
              text="90 minutes, timed problems, one ranked leaderboard. Join live or see where you would have landed."
              meta="Every Saturday · IST"
            />
          </div>
        </div>
      </section>

      {/* CONTEST */}
      <section id="contest" className="relative z-10 border-y border-white/[0.07] px-5 py-28 lg:px-10">
        <div className="mx-auto grid max-w-[1500px] items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionLabel>Weekly contest</SectionLabel>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] md:text-6xl">
              Saturday night
              <br />
              <span className="text-white/25">is contest night.</span>
            </h2>
            <p className="mt-7 max-w-md text-sm leading-6 text-white/40">
              Every Saturday from 9:00 to 10:30 PM IST. Solve against the clock, climb the live
              leaderboard, and find out how you stack up.
            </p>
            <Cta
              href="/contest"
              className={`${solid} mt-8 w-fit`}
              style={{ backgroundColor: ORANGE }}
            >
              {clock?.live ? "Join the live contest" : "Register for Saturday"}
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Cta>
          </div>

          <div className="rounded-2xl border border-white/[0.09] bg-[#202020] p-6 md:p-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-white/45">
                <span
                  className={`h-2 w-2 rounded-full ${clock?.live ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: clock?.live ? "#30d158" : ORANGE }}
                />
                {clock?.live ? "Live now" : "Next contest starts in"}
              </div>
              <span className="text-xs text-white/30">Sat · 9:00 to 10:30 PM IST</span>
            </div>

            <div className="mt-8 grid grid-cols-4 gap-3" aria-live="off">
              {[
                ["Days", t?.d],
                ["Hours", t?.h],
                ["Min", t?.m],
                ["Sec", t?.s],
              ].map(([label, val]) => (
                <div key={label as string} className="rounded-xl border border-white/[0.07] bg-[#191919] py-5 text-center">
                  <div className="text-4xl font-bold tabular-nums tracking-[-0.05em] md:text-5xl">
                    {t ? pad(val as number) : "--"}
                  </div>
                  <div className="mt-2 text-[11px] text-white/30">{label}</div>
                </div>
              ))}
            </div>
            {clock?.live && (
              <div className="mt-4 text-center text-xs text-white/40">Time left in this contest</div>
            )}
          </div>
        </div>
      </section>

      {/* CREDITS */}
      <section id="pricing" className="relative z-10 px-5 py-28 lg:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="max-w-2xl">
            <SectionLabel>Pricing and credits</SectionLabel>
            <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] md:text-6xl">
              Pay once.
              <br />
              <span className="text-white/25">Or earn your OAs.</span>
            </h2>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            {/* PAID */}
            <div className="rounded-2xl border border-[#ff9f0a]/40 bg-[#202020] p-7 md:p-9">
              <span className="rounded-md bg-[#ff9f0a]/10 px-2.5 py-1 text-xs text-[#ff9f0a]">
                Most popular
              </span>
              <div className="mt-10">
                <div className="text-7xl font-bold tracking-[-0.08em]">₹99</div>
                <div className="mt-2 text-sm text-white/35">for 3 months</div>
              </div>
              <div className="my-8 h-px bg-white/[0.07]" />
              <div className="space-y-4">
                <Check text="Unlimited OAs, no daily limit" />
                <Check text="2,800+ questions across DSA categories" />
                <Check text="1v1 duels and group OA rooms" />
                <Check text="Weekly contest access" />
                <Check text="Create your own assessments" />
              </div>
              <Cta
                href="/checkout?planId=unlimited_3months_99"
                className="mt-9 flex w-full cursor-pointer items-center justify-between rounded-lg px-5 py-4 text-sm font-semibold text-black transition hover:brightness-110"
                style={{ backgroundColor: ORANGE }}
              >
                <span>Get Unlimited Access</span>
                <span>→</span>
              </Cta>
            </div>

            {/* EARN */}
            <div id="contribute" className="rounded-2xl border border-white/[0.08] bg-[#202020] p-7 md:p-9">
              <div className="text-xs text-white/35">Free ways to earn OA credits</div>
              <h3 className="mt-5 text-4xl font-bold tracking-[-0.05em]">
                Not paying?
                <br />
                <span className="text-white/25">Earn it.</span>
              </h3>

              <div className="mt-8 space-y-3">
                <EarnRow big="+1" title="Solve the problem of the day" text="One credit for every daily problem you solve." />
                <EarnRow big="3→1" title="Contribute 3 questions" text="Add quality interview problems and unlock one free OA." />
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Cta
                  href="/potd"
                  className="flex flex-1 cursor-pointer items-center justify-between rounded-lg px-5 py-4 text-xs font-semibold text-black transition hover:brightness-110"
                  style={{ backgroundColor: ORANGE }}
                >
                  <span>Solve today&apos;s problem</span>
                  <span>→</span>
                </Cta>
                <Link
                  href="/contribute"
                  className="flex flex-1 items-center justify-between rounded-lg border border-white/[0.1] bg-[#191919] px-5 py-4 text-xs font-medium text-white/65 transition hover:border-[#ff9f0a]/40 hover:text-white"
                >
                  <span>Contribute questions</span>
                  <span style={{ color: ORANGE }}>→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="relative z-10 border-y border-white/[0.07] px-5 py-28 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] md:text-6xl">
            Pick.
            <span className="text-white/20"> Solve.</span>
            <br />
            Repeat.
          </h2>
          <div className="mt-14 grid gap-3 md:grid-cols-3">
            <Process number="01" title="Pick" text="Choose from 2,800+ questions, challenge a friend, or join a group room." />
            <Process number="02" title="Solve" text="Write your solution, run test cases and find out where your logic breaks." />
            <Process number="03" title="Improve" text="Review results, fix your approach, and come back for the daily problem and Saturday contest." />
          </div>
        </div>
      </section>

      {/* WEEK */}
      <section className="relative z-10 px-5 py-28 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <SectionLabel>Your week</SectionLabel>
          <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] md:text-6xl">
            Something to solve
            <br />
            <span className="text-white/25">every single day.</span>
          </h2>

          <div className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
              const sat = d === "Sat";
              return (
                <div
                  key={d}
                  className={`rounded-2xl border p-5 ${sat ? "border-[#ff9f0a] bg-[#ff9f0a] text-black" : "border-white/[0.08] bg-[#202020]"}`}
                >
                  <div className={`text-sm font-bold ${sat ? "" : "text-white/60"}`}>{d}</div>
                  <div className="mt-8 text-lg font-bold leading-tight tracking-[-0.03em]">
                    {sat ? "Contest" : "Daily problem"}
                  </div>
                  <div className={`mt-1 text-xs ${sat ? "text-black/70" : "text-white/35"}`}>
                    {sat ? "9:00 to 10:30 PM" : "+1 credit"}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-xs text-white/35">1v1 duels and group OAs are open all week.</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 px-5 py-32 lg:px-10">
        <div className="mx-auto max-w-[900px] text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-[#202020] px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORANGE }} />
            <span className="text-xs text-white/40">Contest every Saturday, 9:00 PM IST</span>
          </div>

          <h2 className="mt-8 text-6xl font-bold tracking-[-0.06em] md:text-8xl">
            Ready for
            <br />
            <span style={{ color: ORANGE }}>RoundZero?</span>
          </h2>

          <p className="mx-auto mt-7 max-w-lg text-sm leading-6 text-white/35">
            2,800+ questions, duels, group OAs and a weekly contest. ₹99 for three months, or earn
            credits with the daily problem.
          </p>

          <Cta
            href="/"
            className="group mx-auto mt-9 flex w-fit cursor-pointer items-center gap-10 rounded-lg px-7 py-4 text-sm font-semibold text-black transition hover:brightness-110"
            style={{ backgroundColor: ORANGE }}
          >
            <span>Enter RoundZero</span>
            <span className="text-lg transition-transform group-hover:translate-x-1">→</span>
          </Cta>

          <div className="mt-6 font-serif text-sm italic text-white/25">
            your next accepted solution is somewhere in there.
          </div>
        </div>
      </section>
      {/* STICKY CONTEST BAR */}
      {showBar && !barClosed && (
        <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[640px] items-center gap-3 rounded-xl border border-[#ff9f0a]/40 bg-[#202020]/95 py-2.5 pl-4 pr-2 shadow-2xl shadow-black/50 backdrop-blur">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: clock?.live ? "#30d158" : ORANGE }} />
          <div className="min-w-0 flex-1 text-xs">
            <span className="font-semibold">{clock?.live ? "Contest live" : "Contest Sat 9:00 PM IST"}</span>
            <span className="ml-2 font-mono tabular-nums text-white/50">{countdown}</span>
          </div>
          <a
            href="#contest"
            className="shrink-0 rounded-lg px-4 py-2 text-xs font-semibold text-black transition hover:brightness-110"
            style={{ backgroundColor: ORANGE }}
          >
            {clock?.live ? "Join" : "Details"}
          </a>
          <button
            type="button"
            aria-label="Dismiss contest banner"
            onClick={() => setBarClosed(true)}
            className="shrink-0 cursor-pointer rounded-lg px-2.5 py-2 text-white/40 transition hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}

/* ---------- small components ---------- */

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs font-semibold" style={{ color: ORANGE }}>
      {children}
    </div>
  );
}

function DuelSide({ name, initial, passed, lead = false }: { name: string; initial: string; passed: number; lead?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={lead ? { backgroundColor: ORANGE, color: "#000" } : { backgroundColor: "rgba(255,255,255,0.1)" }}
        >
          {initial}
        </span>
        <span className="truncate text-sm font-semibold">{name}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-5xl font-bold tabular-nums tracking-[-0.06em]">{passed}</span>
        <span className="text-lg text-white/35">/8</span>
      </div>
      <div className="mt-1 text-xs text-white/40">tests passed</div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-2 flex-1 rounded-sm transition-colors duration-500"
            style={{ backgroundColor: i < passed ? (lead ? ORANGE : "rgba(255,255,255,0.45)") : "rgba(255,255,255,0.1)" }}
          />
        ))}
      </div>
    </div>
  );
}

function Metric({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="border-b border-white/[0.07] p-8 md:p-10 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className="text-5xl font-bold tracking-[-0.06em] md:text-6xl">{number}</div>
      <div className="mt-4 text-xs font-semibold">{title}</div>
      <p className="mt-2 max-w-xs text-xs leading-5 text-white/35">{description}</p>
    </div>
  );
}

function ModeCard({
  tag,
  title,
  text,
  meta,
  accent = false,
}: {
  tag: string;
  title: string;
  text: string;
  meta: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-[#202020] p-7 transition duration-300 hover:border-[#ff9f0a]/40 md:p-8 ${
        accent ? "border-[#ff9f0a]/30" : "border-white/[0.08]"
      }`}
    >
      <span className="rounded-md bg-[#ff9f0a]/10 px-2.5 py-1 text-xs text-[#ff9f0a]">{tag}</span>
      <h3 className="mt-8 text-3xl font-bold tracking-[-0.045em]">{title}</h3>
      <p className="mt-3 max-w-md text-sm leading-6 text-white/40">{text}</p>
      <div className="mt-6 border-t border-white/[0.07] pt-4 text-xs text-white/30">{meta}</div>
    </div>
  );
}

function EarnRow({ big, title, text }: { big: string; title: string; text: string }) {
  return (
    <div className="flex items-center gap-5 rounded-xl border border-white/[0.08] bg-[#191919] p-5">
      <div className="w-16 shrink-0 text-3xl font-bold tracking-[-0.06em]" style={{ color: ORANGE }}>
        {big}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-white/35">{text}</p>
      </div>
    </div>
  );
}

function Check({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/65">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-black"
        style={{ backgroundColor: ORANGE }}
      >
        ✓
      </span>
      {text}
    </div>
  );
}

function Process({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-[#1e1e1e] p-7 transition duration-300 hover:border-[#ff9f0a]/30">
      <span className="font-mono text-[10px] text-white/25">{number}</span>
      <h3 className="mt-16 text-3xl font-bold tracking-[-0.04em]">{title}</h3>
      <p className="mt-4 text-sm leading-6 text-white/35">{text}</p>
    </div>
  );
}