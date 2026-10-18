"use client";
import {
  DrawablyArrow,
  DrawablyCircle,
  DrawablyUnderline,
  DrawablyHighlight,
} from "drawably/react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

const ORANGE = "#ff9f0a";

function getSignInCallbackUrl(): string {
  if (typeof window === "undefined") return "/";

  const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!callbackUrl) return "/";

  try {
    const url = new URL(callbackUrl, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export default function LandingPage() {
  const [questions, setQuestions] = useState(0);

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

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#181818] text-[#f4f4f4]">

      {/* =========================================================
          BACKGROUND
      ========================================================= */}

      <div className="pointer-events-none fixed inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />

        <div
          className="absolute left-1/2 top-[35%] h-[500px] w-[500px] -translate-x-1/2 rounded-full blur-[140px]"
          style={{
            background: "rgba(255,159,10,0.035)",
          }}
        />
      </div>

      {/* =========================================================
          NAVBARS
      ========================================================= */}

      


      {/* =========================================================
          HERO
      ========================================================= */}

      <section className="relative z-10">

        <div className="mx-auto max-w-[1500px] px-5 lg:px-10">

          {/* TOP META */}

          


          {/* HERO GRID */}

          <div className="grid min-h-[650px] items-center gap-14 py-20 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">

            {/* LEFT */}

            <div className="relative">

              {/* SMALL LABEL */}

              <div className="mb-7 flex items-center gap-2">

                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: ORANGE }}
                />

                <span className="text-xs font-medium text-white/45">
                  Built for people who actually want to get better at DSA.
                </span>

              </div>


              {/* MAIN HEADING */}

              <h1 className="max-w-[850px] text-[62px] font-bold leading-[0.94] tracking-[-0.055em] sm:text-[76px] md:text-[92px] lg:text-[98px]">

                Practice.

                <br />

                <span className="text-white/25">
                  Build.
                </span>

                <br />

                <span className="relative inline-block">

                  Break OAs.

                  {/* handwritten underline */}

                  <svg
                    className="absolute -bottom-5 left-0 w-[92%]"
                    viewBox="0 0 500 35"
                    fill="none"
                  >
                    <path
                      d="M5 18 C80 8 130 27 205 15 C290 2 365 25 495 9"
                      stroke={ORANGE}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>

                </span>

              </h1>


              {/* HANDWRITTEN NOTE */}

              <div className="absolute right-0 top-8 hidden rotate-[-5deg] xl:block">

                <div className="font-serif text-sm italic text-white/35">
                  yes, this one.
                </div>

                <svg
                  className="mt-1 h-10 w-32"
                  viewBox="0 0 130 40"
                  fill="none"
                >
                  <path
                    d="M5 5 C35 28 70 34 120 18"
                    stroke={ORANGE}
                    strokeWidth="1.5"
                  />

                  <path
                    d="M107 12 L120 18 L108 25"
                    stroke={ORANGE}
                    strokeWidth="1.5"
                  />
                </svg>

              </div>


              {/* DESCRIPTION */}

              <p className="mt-10 max-w-xl text-sm leading-7 text-white/45 md:text-[15px]">

                Solve from a bank of{" "}
                <span className="font-semibold text-white">
                  2,800+ questions
                </span>
                , create your own online assessments, and practice with
                real interview-style problems.

              </p>


              {/* CTA */}

              <div className="mt-8 flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: getSignInCallbackUrl() })}
                  className="group flex items-center gap-8 rounded-lg px-6 py-3.5 text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
                  style={{ backgroundColor: ORANGE }}
                >
                  Start Solving

                  <span className="transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </button>

                <Link
                  href="#pricing"
                  className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-[#202020] px-6 py-3.5 text-sm text-white/70 transition hover:border-white/20 hover:text-white"
                >
                  View ₹99 Plan
                </Link>

              </div>


              {/* MINI TRUST */}

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] text-white/25">

                <span>✓ 2,800+ Questions</span>
                <span>✓ Unlimited OAs</span>
                <span>✓ Community Powered</span>

              </div>

            </div>


            {/* =================================================
                RIGHT HERO CARD
            ================================================= */}

            <div className="relative mx-auto w-full max-w-[500px]">

              {/* FLOATING ANNOTATION */}

              <div className="absolute -left-16 top-8 hidden -rotate-[8deg] lg:block">

                <div className="font-serif text-xs italic text-white/30">
                  let&apos;s make this
                  <br />
                  unnecessarily competitive.
                </div>

                <svg
                  className="mt-2 h-12 w-28"
                  viewBox="0 0 120 50"
                  fill="none"
                >
                  <path
                    d="M115 5 C75 15 55 30 30 45"
                    stroke={ORANGE}
                    strokeWidth="1.5"
                  />

                  <path
                    d="M35 35 L30 45 L42 42"
                    stroke={ORANGE}
                    strokeWidth="1.5"
                  />
                </svg>

              </div>


              {/* MAIN CARD */}

              <div className="relative rounded-2xl border border-white/[0.09] bg-[#202020] p-5 shadow-2xl shadow-black/30 md:p-6">

                {/* CARD HEADER */}

                <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">

                  <div className="flex items-center gap-2">

                    <span className="h-2 w-2 rounded-full bg-[#ff9f0a]" />

                    <span className="font-mono text-[10px] tracking-[0.14em] text-white/35">
                      ARENA / LIVE
                    </span>

                  </div>

                  <span className="font-mono text-[9px] text-white/20">
                    01
                  </span>

                </div>


                {/* QUESTION COUNT */}

                <div className="py-8">

                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">
                    Question Bank
                  </div>

                  <div className="relative mt-2 inline-block">

                    <div className="text-7xl font-bold tracking-[-0.08em] md:text-8xl">
                      {questions.toLocaleString()}+
                    </div>

                    {/* orange rough circle */}

                    <svg
                      className="pointer-events-none absolute -left-4 -top-4 h-[125%] w-[112%]"
                      viewBox="0 0 450 130"
                      fill="none"
                    >
                      <path
                        d="M25 65 C18 25 100 7 220 10 C350 12 430 35 425 68 C420 105 330 120 220 118 C105 116 30 105 25 65Z"
                        stroke={ORANGE}
                        strokeWidth="2"
                        strokeDasharray="7 6"
                        opacity="0.7"
                      />
                    </svg>

                  </div>

                  <div className="mt-3 text-xs text-white/25">
                    and still growing.
                  </div>

                </div>


                {/* STATS */}

                <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">

                  <DashboardRow
                    label="Question Bank"
                    value="2,800+"
                  />

                  <DashboardRow
                    label="OA Attempts"
                    value="Unlimited"
                  />

                  <DashboardRow
                    label="Test Engine"
                    value="Ready"
                  />

                </div>


                {/* PRICE */}

                <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#191919] p-5">

                  <div className="flex items-end justify-between">

                    <div>

                      <div className="text-[9px] uppercase tracking-[0.2em] text-white/25">
                        Unlimited OAs
                      </div>

                      <div className="mt-1 text-4xl font-bold tracking-[-0.05em]">
                        ₹99
                      </div>

                    </div>

                    <div className="pb-1 text-right">

                      <div className="text-xs font-medium text-white/60">
                        3 months
                      </div>

                      <div className="mt-1 text-[9px] text-white/25">
                        NO DAILY LIMIT
                      </div>

                    </div>

                  </div>


                  <button
                    type="button"
                    onClick={() => signIn('google', { callbackUrl: getSignInCallbackUrl() })}
                    className="mt-5 flex w-full items-center justify-between rounded-lg px-4 py-3 text-xs font-semibold text-black transition hover:brightness-110 cursor-pointer"
                    style={{ backgroundColor: ORANGE }}
                  >

                    <span>
                      Get Unlimited Access
                    </span>

                    <span>
                      →
                    </span>

                  </button>

                </div>

              </div>


              {/* SMALL FLOATING TAG */}

              <div className="absolute -bottom-7 -right-3 rotate-[4deg] rounded-lg border border-white/[0.08] bg-[#222] px-4 py-2 shadow-xl">

                <span className="font-serif text-xs italic text-white/40">
                  cheaper than coffee.
                </span>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          STATS
      ========================================================= */}

      <section className="relative z-10 border-y border-white/[0.07]">

        <div className="mx-auto grid max-w-[1500px] md:grid-cols-3">

          <Metric
            number="2,800+"
            title="Questions"
            description="DSA and interview problems ready to solve."
          />

          <Metric
            number="∞"
            title="OAs"
            description="Practice and build assessments without limits."
          />

          <Metric
            number="3 → 1"
            title="Contribution"
            description="Contribute three questions and unlock one free OA."
          />

        </div>

      </section>


      {/* =========================================================
          PRICING
      ========================================================= */}

      <section
        id="pricing"
        className="relative z-10 px-5 py-28 lg:px-10"
      >

        <div className="mx-auto max-w-[1200px]">

          <div className="max-w-2xl">

            <div
              className="text-[10px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: ORANGE }}
            >
              Simple pricing
            </div>

            <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] md:text-6xl">
              Pay once.
              <br />
              <span className="text-white/25">
                Practice for months.
              </span>
            </h2>

          </div>


          <div className="mt-14 grid gap-5 lg:grid-cols-2">


            {/* PAID PLAN */}

            <div className="rounded-2xl border border-[#ff9f0a]/40 bg-[#202020] p-7 md:p-9">

              <div className="flex items-center justify-between">

                <span className="rounded-md bg-[#ff9f0a]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#ff9f0a]">
                  Most Popular
                </span>

                <span className="font-mono text-[9px] text-white/20">
                  PLAN_01
                </span>

              </div>


              <div className="mt-10">

                <div className="text-7xl font-bold tracking-[-0.08em]">
                  ₹99
                </div>

                <div className="mt-2 text-sm text-white/35">
                  for 3 months
                </div>

              </div>


              <div className="my-8 h-px bg-white/[0.07]" />


              <div className="space-y-4">

                <Check text="Unlimited OAs" />
                <Check text="2,800+ Questions" />
                <Check text="Unlimited practice" />
                <Check text="Multiple DSA categories" />
                <Check text="Create your own assessments" />

              </div>


              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: getSignInCallbackUrl() })}
                className="mt-9 flex w-full items-center justify-between rounded-lg px-5 py-4 text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
                style={{ backgroundColor: ORANGE }}
              >

                <span>
                  Get Unlimited Access
                </span>

                <span>
                  →
                </span>

              </button>

            </div>


            {/* CONTRIBUTE */}

            <div
              id="contribute"
              className="relative rounded-2xl border border-white/[0.08] bg-[#202020] p-7 md:p-9"
            >

              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/25">
                Community Program
              </div>


              <h3 className="mt-7 text-4xl font-bold tracking-[-0.05em] md:text-5xl">
                Give 3.
                <br />
                <span className="text-white/25">
                  Get 1 free.
                </span>
              </h3>


              <div className="relative mt-10 inline-block">

                <div
                  className="text-8xl font-bold leading-none tracking-[-0.1em]"
                  style={{ color: ORANGE }}
                >
                  3
                </div>

                <svg
                  className="pointer-events-none absolute -left-5 -top-5 h-[130%] w-[140%]"
                  viewBox="0 0 150 140"
                  fill="none"
                >
                  <path
                    d="M20 70 C15 30 50 10 90 15 C130 20 145 55 135 90 C125 125 65 135 30 110 C10 95 10 80 20 70Z"
                    stroke={ORANGE}
                    strokeWidth="2"
                    strokeDasharray="6 5"
                    opacity="0.65"
                  />
                </svg>

              </div>


              <span className="ml-5 inline-block font-mono text-xs leading-5 text-white/35">
                QUALITY
                <br />
                QUESTIONS
              </span>


              <div className="mt-8 text-xl font-semibold">
                Contribute 3 questions
                <span className="text-white/30">
                  {" "}
                  →{" "}
                </span>
                get a free OA.
              </div>


              <p className="mt-5 max-w-md text-sm leading-6 text-white/35">
                Have a good interview problem? Add it to the question bank.
                Help the community and earn an OA.
              </p>


              <Link
                href="/contribute"
                className="mt-8 flex w-full items-center justify-between rounded-lg border border-white/[0.1] bg-[#191919] px-5 py-4 text-xs font-medium text-white/65 transition hover:border-[#ff9f0a]/40 hover:text-white"
              >

                <span>
                  Contribute Questions
                </span>

                <span
                  className="text-base"
                  style={{ color: ORANGE }}
                >
                  →
                </span>

              </Link>

            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          HOW IT WORKS
      ========================================================= */}

      <section className="relative z-10 border-y border-white/[0.07] px-5 py-28 lg:px-10">

        <div className="mx-auto max-w-[1500px]">

          <div
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: ORANGE }}
          >
            How it works
          </div>

          <h2 className="mt-4 text-4xl font-bold tracking-[-0.05em] md:text-6xl">
            Pick.
            <span className="text-white/20"> Solve.</span>
            <br />
            Repeat.
          </h2>


          <div className="mt-14 grid gap-3 md:grid-cols-3">

            <Process
              number="01"
              title="Pick"
              text="Choose from 2,800+ questions or build an OA from the question bank."
            />

            <Process
              number="02"
              title="Solve"
              text="Write your solution, run test cases and find out where your logic breaks."
            />

            <Process
              number="03"
              title="Improve"
              text="Review your results, fix your approach and take another shot."
            />

          </div>

        </div>

      </section>


      {/* =========================================================
          COLLABORATIVE ROOMS
      ========================================================= */}

      <section className="relative z-10 border-y border-white/[0.07] px-5 py-28 lg:px-10">

        <div className="mx-auto max-w-[1500px]">

          <div
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: ORANGE }}
          >
            Collaborative Rooms
          </div>

          <h2 className="mt-4 text-4xl font-bold tracking-[-0.045em] md:text-6xl">
            Create rooms.
            <br />
            <span className="text-white/25">
              Solve together.
            </span>
          </h2>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">

            <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#ff9f0a]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#ff9f0a]">
                  Create
                </span>
                <span className="font-mono text-[9px] text-white/20">
                  ROOM_01
                </span>
              </div>

              <div className="mt-6">
                <h3 className="text-2xl font-bold tracking-[-0.05em]">
                  Create a room
                </h3>
                <p className="mt-2 text-sm text-white/35">
                  Generate an invite code and share it with friends, teammates, or competitors to start a joint assessment.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#ff9f0a]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#ff9f0a]">
                  Compete
                </span>
                <span className="font-mono text-[9px] text-white/20">
                  MODE_02
                </span>
              </div>

              <div className="mt-6">
                <h3 className="text-2xl font-bold tracking-[-0.05em]">
                  Compete in real-time
                </h3>
                <p className="mt-2 text-sm text-white/35">
                  Everyone gets the same questions at the same time. Track progress and scores as you solve.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#202020] p-6">
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#ff9f0a]/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#ff9f0a]">
                  Learn
                </span>
                <span className="font-mono text-[9px] text-white/20">
                  MODE_03
                </span>
              </div>

              <div className="mt-6">
                <h3 className="text-2xl font-bold tracking-[-0.05em]">
                  Learn from others
                </h3>
                <p className="mt-2 text-sm text-white/35">
                  See different approaches, discuss solutions, and improve together after the assessment ends.
                </p>
              </div>
            </div>

          </div>

        </div>

      </section>


      {/* =========================================================
          FINAL CTA
      ========================================================= */}

      <section className="relative z-10 px-5 py-32 lg:px-10">

        <div className="mx-auto max-w-[900px] text-center">

          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-[#202020] px-3 py-1.5">

            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: ORANGE }}
            />

            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
              Arena ready
            </span>

          </div>


          <h2 className="mt-8 text-6xl font-bold tracking-[-0.06em] md:text-8xl">

            Ready for
            <br />

            <span style={{ color: ORANGE }}>
              RoundZero?
            </span>

          </h2>


          <p className="mx-auto mt-7 max-w-lg text-sm leading-6 text-white/35">
            2,800+ questions. Unlimited OAs. ₹99 for three months.
            Or contribute three questions and get an OA for free.
          </p>


          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: getSignInCallbackUrl() })}
            className="group mx-auto mt-9 flex w-fit items-center gap-10 rounded-lg px-7 py-4 text-sm font-semibold text-black transition hover:brightness-110 cursor-pointer"
            style={{ backgroundColor: ORANGE }}
          >

            <span>
              Enter RoundZero
            </span>

            <span className="text-lg transition-transform group-hover:translate-x-1">
              →
            </span>

          </button>


          <div className="mt-6 font-serif text-sm italic text-white/20">
            your next accepted solution is somewhere in there.
          </div>

        </div>

      </section>


      {/* =========================================================
          FOOTER
      ========================================================= */}

      

    </main>
  );
}


/* =========================================================
   NAV ITEM
========================================================= */

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <a
      href="#"
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition ${
        active
          ? "bg-[#252525] text-white"
          : "text-white/45 hover:bg-[#222] hover:text-white"
      }`}
    >
      <span
        className={active ? "text-[#ff9f0a]" : "text-white/35"}
      >
        {icon}
      </span>

      {label}
    </a>
  );
}


/* =========================================================
   DASHBOARD ROW
========================================================= */

function DashboardRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-4">

      <span className="text-xs text-white/35">
        {label}
      </span>

      <span className="font-mono text-[10px] text-white/65">
        {value}
      </span>

    </div>
  );
}


/* =========================================================
   METRIC
========================================================= */

function Metric({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-white/[0.07] p-8 md:border-b-0 md:border-r md:p-10 last:border-r-0">

      <div className="text-5xl font-bold tracking-[-0.06em] md:text-6xl">
        {number}
      </div>

      <div className="mt-4 text-xs font-semibold">
        {title}
      </div>

      <p className="mt-2 max-w-xs text-xs leading-5 text-white/25">
        {description}
      </p>

    </div>
  );
}


/* =========================================================
   CHECK
========================================================= */

function Check({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-white/65">

      <span
        className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-black"
        style={{ backgroundColor: ORANGE }}
      >
        ✓
      </span>

      {text}

    </div>
  );
}


/* =========================================================
   PROCESS
========================================================= */

function Process({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-[#1e1e1e] p-7 transition duration-300 hover:border-[#ff9f0a]/30">

      <div className="flex items-center justify-between">

        <span className="font-mono text-[10px] text-white/20">
          {number}
        </span>

        <span
          className="text-xs opacity-0 transition group-hover:opacity-100"
          style={{ color: ORANGE }}
        >
          →
        </span>

      </div>

      <h3 className="mt-16 text-3xl font-bold tracking-[-0.04em]">
        {title}
      </h3>

      <p className="mt-4 text-sm leading-6 text-white/30">
        {text}
      </p>

    </div>
  );
}