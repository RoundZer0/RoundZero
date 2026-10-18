"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  getUserCredits,
  fetchUserCreditsFromDB,
  resetCreditsInMemory,
} from "@/lib/userCredits";
import GoogleSignInButton from "./GoogleSignInButton";
import AnnouncementBar from "./AnnouncementBar";
import {
  Zap,
  BookOpen,
  Trophy,
  Plus,
  FilePlus,
  CreditCard,
  Sparkles,
  LogOut,
  Flame,
  Clock,
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  const [credits, setCredits] = useState<number | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const uState = getUserCredits();
      setCredits(uState.credits);
      setIsUnlimited(uState.isUnlimited);
    };

    if (status === "unauthenticated") {
      resetCreditsInMemory();
      update();
      return;
    }

    update();

    // Fetch authentic user credits status from DB on mount / session load
    if (session?.user?.email) {
      fetchUserCreditsFromDB(session.user.email).then((uState) => {
        setCredits(uState.credits);
        setIsUnlimited(uState.isUnlimited);
      });
    }

    window.addEventListener("storage", update);
    window.addEventListener("roundzero_credits_updated", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("roundzero_credits_updated", update);
    };
  }, [pathname, session?.user?.email, status]);

  useEffect(() => {
    if (!isProfileOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isProfileOpen]);

  const isOAActive =
    pathname.startsWith("/oa/") && !pathname.includes("/results/");

  if (isOAActive) {
    return null;
  }

  const links = [
    { href: "/", label: "OA Builder", icon: Zap },
    { href: "/contest", label: "Contest", icon: Trophy },
    { href: "/potd", label: "Daily POTD", icon: Flame },
    { href: "/questions", label: "Question Bank", icon: BookOpen },
    { href: "/contribute", label: "Contribute (+1 OA)", icon: FilePlus },
    { href: "/pricing", label: "Pricing & Passes", icon: CreditCard },
    { href: "/history", label: "History", icon: Clock },
  ];

  return (
    <>
      <AnnouncementBar
        id="launch-oct-2026"
        message="Rooms are live. Invite your team by Code."
        href="/changelog"
        linkText="See what's new"
      />
      <header className="sticky top-0 z-40 w-full border-b border-[#383838] bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 transition opacity-90 hover:opacity-100"
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white">
                Round<span className="text-[#ffa116] font-semibold">Zero</span>
              </span>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? "bg-[#282828] text-[#ffa116] border border-[#383838] font-semibold"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-[#282828]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{link.label}</span>
                  {link.href === "/potd" &&
                    ((session?.user as any)?.potdStreak ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-400 font-mono">
                        <Flame className="h-2.5 w-2.5 fill-amber-400" />
                        {(session?.user as any).potdStreak}
                      </span>
                    )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {/* Credits Display */}
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 rounded-lg bg-[#282828] border border-[#383838] px-2.5 py-1 text-xs font-mono text-zinc-300 hover:border-[#ffa116]/50 transition"
              title="Manage OA Credits"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#ffa116]" />
              <span className="text-[11px]">
                {isUnlimited
                  ? "Unlimited"
                  : `${credits !== null ? credits : 3} Credit(s)`}
              </span>
            </Link>

            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-lg bg-[#ffa116] px-3.5 py-1.5 text-xs font-semibold text-[#1a1a1a] transition hover:bg-[#ffa116]/90 border border-[#ffa116]/40"
            >
              <Plus className="h-4 w-4" />
              New OA
            </Link>

            {/* User Profile / Auth State */}
            {status === "authenticated" && session?.user ? (
              <div
                ref={profileRef}
                className="relative border-l border-[#383838] pl-2"
              >
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((open) => !open)}
                  className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-[#282828]"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="dialog"
                  aria-label="Open profile menu"
                >
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-7 w-7 rounded-full border border-[#ffa116]/40 object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#383838] bg-[#282828] text-xs font-bold text-[#ffa116]">
                      {session.user.name?.[0] || "U"}
                    </div>
                  )}
                </button>

                {isProfileOpen && (
                  <div
                    role="dialog"
                    aria-label="Profile information"
                    className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-[#383838] bg-[#1f1f1f] p-4 shadow-2xl"
                  >
                    <div className="flex items-center gap-3">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt={session.user.name || "User"}
                          className="h-12 w-12 rounded-full border border-[#ffa116]/40 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#383838] bg-[#282828] text-lg font-bold text-[#ffa116]">
                          {session.user.name?.[0] || "U"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {session.user.name || "RoundZero user"}
                        </p>
                        <p className="truncate text-xs text-zinc-400">
                          {session.user.email || "No email available"}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        resetCreditsInMemory();
                        await signOut({ callbackUrl: "/" });
                      }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#383838] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <GoogleSignInButton />
            )}
          </div>
        </div>
      </header>
    </>
  );
}