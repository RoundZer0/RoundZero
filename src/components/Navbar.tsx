"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  getUserCredits,
  fetchUserCreditsFromDB,
  resetCreditsInMemory,
} from "@/lib/userCredits";
import GoogleSignInButton from "./GoogleSignInButton";
import {
  Zap,
  BookOpen,
  Trophy,
  Plus,
  FilePlus,
  Sparkles,
  LogOut,
  Flame,
  Clock,
  Swords,
  Search,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import AnnouncementBar from "./AnnouncementBar";
export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const [credits, setCredits] = useState<number | null>(null);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
  }, [pathname]);

  // Handle Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setIsProfileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus search input when modal opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [isSearchOpen]);

  // Live search debounced fetch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/questions?search=${encodeURIComponent(searchQuery.trim())}&pageSize=6`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.questions || []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

    if (session?.user?.email) {
      setCredits(null);
      setIsUnlimited(
        !!(session.user as typeof session.user & { isUnlimited?: boolean }).isUnlimited
      );
      fetchUserCreditsFromDB(session.user.email).then((uState) => {
        setCredits(uState.credits);
        setIsUnlimited(uState.isUnlimited);
      });
    } else {
      update();
    }

    window.addEventListener("storage", update);
    window.addEventListener("roundzero_credits_updated", update);
    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("roundzero_credits_updated", update);
    };
  }, [session?.user?.email, status]);

  useEffect(() => {
    if (!isProfileOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [isProfileOpen]);

  const isOAActive =
    pathname.startsWith("/oa/") && !pathname.includes("/results/");

  if (isOAActive) {
    return null;
  }

  const links = [
    { href: "/", label: "OA Builder", icon: Zap },
    { href: "/contest", label: "Contest", icon: Trophy, badge: "SAT" },
    { href: "/join", label: "1v1 Duel", icon: Swords },
    { href: "/potd", label: "POTD", icon: Flame },
    { href: "/questions", label: "Questions", icon: BookOpen },
    { href: "/contribute", label: "Contribute", icon: FilePlus },
    { href: "/history", label: "History", icon: Clock },
  ];

  return (
    <>
      <AnnouncementBar
        id="launch-day-special"
        message="We're live! Launch day special: unlimited OAs, today only."
        linkText="Claim your spot"
        href="/contest"
      />
      <header className="sticky top-0 z-40 w-full border-b border-[#2d2d2d] bg-[#141414]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] h-14 items-center justify-between px-3 sm:px-6 lg:px-8">
          {/* Left section: Favicon Logo + Navigation Links + Divider + Secondary Links + Pricing */}
          <div className="flex items-center gap-3.5 xl:gap-5 flex-shrink-0">
            {/* Favicon Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 transition opacity-95 hover:opacity-100 flex-shrink-0"
            >
              <img
                src="/favicon.ico"
                alt="RoundZero Logo"
                className="h-6 w-6 rounded-md object-contain"
              />
              <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                Round<span className="text-[#ffa116] font-semibold">Zero</span>
              </span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden xl:flex items-center gap-0.5 flex-shrink-0">
              <Link
                href="/"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center transition ${
                  pathname === "/"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                OA Builder
              </Link>

              <Link
                href="/contest"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition ${
                  pathname === "/contest"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                <span>Contest</span>
                <span className="rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 text-[9px] font-bold text-amber-400 font-mono">
                  SAT
                </span>
              </Link>

              <Link
                href="/join"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition ${
                  pathname === "/join"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                <Swords className="h-3.5 w-3.5 text-[#ffa116]" />
                <span>1v1 Duel</span>
              </Link>

              <Link
                href="/potd"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition ${
                  pathname === "/potd"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                <span>POTD</span>
                {((session?.user as any)?.potdStreak ?? 0) > 0 && (
                  <span className="flex items-center gap-0.5 rounded bg-amber-500/15 border border-amber-500/30 px-1 py-0.2 text-[9px] font-bold text-amber-400 font-mono">
                    <Flame className="h-2.5 w-2.5 fill-amber-400" />
                    {(session?.user as any).potdStreak}
                  </span>
                )}
              </Link>

              <Link
                href="/questions"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center transition ${
                  pathname === "/questions"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                Questions
              </Link>

              {/* Vertical divider */}
              <div className="h-4 w-px bg-white/10 mx-1 flex-shrink-0" />

              <Link
                href="/contribute"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center transition ${
                  pathname === "/contribute"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                Contribute
              </Link>

              <Link
                href="/history"
                className={`h-8 px-2.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center transition ${
                  pathname === "/history"
                    ? "text-[#ffa116] font-semibold bg-[#222222]"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#1e1e1e]"
                }`}
              >
                History
              </Link>

              {/* Highlighted Pricing Pill */}
              <Link
                href="/pricing"
                className="ml-1.5 h-8 px-3 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 text-amber-400 hover:border-amber-400 hover:brightness-110 transition shadow-sm whitespace-nowrap inline-flex items-center gap-1.5 flex-shrink-0"
              >
                <Sparkles className="h-3 w-3 text-[#ffa116]" />
                <span>Pricing</span>
              </Link>
            </nav>
          </div>

          {/* Right section: Search Ctrl+K + Streak + +New OA + User Pill Capsule */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 ml-4">
            {/* Search Pill (Ctrl+K) */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex h-8 items-center justify-between gap-2.5 rounded-full bg-[#1e1e1e] border border-[#333333] px-3 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition shadow-inner whitespace-nowrap flex-shrink-0"
              title="Search questions (Ctrl+K)"
            >
              <span className="flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[11px] text-zinc-400 font-normal">
                  Search
                </span>
              </span>
              <kbd className="rounded bg-[#141414] border border-white/10 px-1.5 py-0.2 text-[9px] font-mono text-zinc-400">
                Ctrl K
              </kbd>
            </button>

            {/* Streak Icon */}
            <Link
              href="/potd"
              className="hidden sm:flex items-center justify-center h-8 w-8 rounded-full bg-[#1e1e1e] border border-[#333333] text-amber-500 hover:border-amber-500/40 hover:bg-[#252525] transition"
              title="Daily POTD"
            >
              <Flame className="h-4 w-4 fill-amber-500/30 text-amber-500" />
            </Link>

            {/* New OA button */}
            <Link
              href="/"
              className="hidden md:inline-flex h-8 items-center gap-1 rounded-full bg-[#ffa116] px-3.5 text-xs font-bold text-[#141414] hover:bg-[#ffa116]/90 transition shadow-sm whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New OA</span>
            </Link>

            {/* User Capsule Pill (matching reference image) */}
            {status === "authenticated" && session?.user ? (
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((open) => !open)}
                  className="h-8 flex items-center gap-2 rounded-full border border-[#383838] bg-[#1e1e1e] p-1 pr-2.5 transition hover:border-zinc-500 hover:bg-[#252525] shadow-sm whitespace-nowrap"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="dialog"
                  aria-label="Open profile menu"
                >
                  {/* Avatar */}
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-6 w-6 rounded-full border border-[#ffa116]/40 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#383838] bg-[#141414] text-[11px] font-bold text-[#ffa116] flex-shrink-0">
                      {session.user.name?.[0] || "U"}
                    </div>
                  )}

                  {/* Username */}
                  <span className="hidden sm:inline text-xs font-medium text-zinc-200 max-w-[85px] truncate">
                    {session.user.name?.split(" ")[0] ||
                      session.user.email?.split("@")[0] ||
                      "User"}
                  </span>

                  {/* Coin Badge Pill */}
                  <div className="h-5 flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 text-[10px] font-mono font-bold text-amber-400 flex-shrink-0">
                    <span className="text-[11px]">🪙</span>
                    <span>
                      {isUnlimited ? "∞" : credits !== null ? credits : "..."}
                    </span>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div
                    role="dialog"
                    aria-label="Profile information"
                    className="absolute right-0 top-10 z-50 w-64 rounded-xl border border-[#383838] bg-[#1f1f1f] p-4 shadow-2xl"
                  >
                    <div className="flex items-center gap-3">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt={session.user.name || "User"}
                          className="h-11 w-11 rounded-full border border-[#ffa116]/40 object-cover"
                        />
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#383838] bg-[#282828] text-base font-bold text-[#ffa116]">
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

                    <div className="mt-3 py-2 px-3 rounded-lg bg-[#252525] border border-white/[0.06] flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Credits Remaining:</span>
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <span>🪙</span>
                        <span>
                          {isUnlimited ? "Unlimited" : credits !== null ? `${credits} Pass` : "Loading..."}
                        </span>
                      </span>
                    </div>

                    <Link
                      href="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#282828] border border-zinc-700/80 px-3 py-2 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:border-amber-500/50 transition"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>Developer Profile</span>
                    </Link>

                    <button
                      type="button"
                      onClick={async () => {
                        resetCreditsInMemory();
                        await signOut({ callbackUrl: "/" });
                      }}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[#383838] px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300"
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

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="xl:hidden flex items-center justify-center h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-[#1e1e1e] border border-transparent hover:border-[#383838] transition"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="xl:hidden border-t border-[#2d2d2d] bg-[#141414] px-4 py-3 space-y-2">
            {/* Mobile Search button */}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsSearchOpen(true);
              }}
              className="w-full flex items-center justify-between rounded-xl bg-[#1e1e1e] border border-[#383838] px-3.5 py-2 text-xs text-zinc-400"
            >
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 text-zinc-400" />
                <span>Search questions...</span>
              </span>
              <kbd className="rounded bg-[#141414] border border-white/10 px-1.5 py-0.5 text-[9px] font-mono">
                Ctrl K
              </kbd>
            </button>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-[#222222] text-[#ffa116] border border-[#383838] font-semibold"
                        : "text-zinc-400 hover:text-white hover:bg-[#1e1e1e]"
                    }`}
                  >
                    <Icon className="h-4 w-4 text-[#ffa116]" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
              <Link
                href="/pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/30"
              >
                <Sparkles className="h-4 w-4 text-[#ffa116]" />
                <span>Pricing & Passes</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Global Command Palette / Search Modal (Ctrl + K) */}
      {isSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 px-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-zinc-700/80 bg-[#1a1a1a] p-3 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#222222] border border-white/[0.08]">
              <Search className="h-4 w-4 text-[#ffa116]" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 2,800+ questions by title, topic, or company..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <kbd className="rounded bg-[#171717] border border-white/10 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                ESC
              </kbd>
            </div>

            {/* Live Search Results */}
            <div className="max-h-72 overflow-y-auto space-y-1">
              {isSearching ? (
                <div className="py-6 text-center text-xs font-mono text-zinc-500">
                  Searching questions...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(false);
                      router.push(
                        `/questions?search=${encodeURIComponent(q.title)}`,
                      );
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl text-left hover:bg-[#252525] transition group border border-transparent hover:border-white/[0.06]"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold text-white group-hover:text-[#ffa116] transition truncate">
                        {q.id}. {q.title}
                      </div>
                      <div className="text-[10px] font-mono text-zinc-400 truncate">
                        {q.tags?.slice(0, 3).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          q.difficulty === "Easy"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : q.difficulty === "Medium"
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-rose-500/15 text-rose-400"
                        }`}
                      >
                        {q.difficulty}
                      </span>
                      <ArrowRight className="h-3 w-3 text-zinc-500 group-hover:text-white transition" />
                    </div>
                  </button>
                ))
              ) : searchQuery.trim() ? (
                <div className="py-6 text-center text-xs font-mono text-zinc-500">
                  No matching questions found for &quot;{searchQuery}&quot;
                </div>
              ) : (
                <div className="py-3 px-2 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider font-mono text-zinc-500 px-1">
                    Quick Navigation
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push("/questions");
                      }}
                      className="p-2 rounded-lg bg-[#222222] text-xs text-left text-zinc-300 hover:text-white hover:bg-[#282828] transition flex items-center gap-2"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-[#ffa116]" />
                      <span>Browse All Questions</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push("/potd");
                      }}
                      className="p-2 rounded-lg bg-[#222222] text-xs text-left text-zinc-300 hover:text-white hover:bg-[#282828] transition flex items-center gap-2"
                    >
                      <Flame className="h-3.5 w-3.5 text-amber-400" />
                      <span>Today&apos;s POTD</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push("/contest");
                      }}
                      className="p-2 rounded-lg bg-[#222222] text-xs text-left text-zinc-300 hover:text-white hover:bg-[#282828] transition flex items-center gap-2"
                    >
                      <Trophy className="h-3.5 w-3.5 text-amber-400" />
                      <span>Saturday Contest</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSearchOpen(false);
                        router.push("/join");
                      }}
                      className="p-2 rounded-lg bg-[#222222] text-xs text-left text-zinc-300 hover:text-white hover:bg-[#282828] transition flex items-center gap-2"
                    >
                      <Swords className="h-3.5 w-3.5 text-[#ffa116]" />
                      <span>1v1 Code Duel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
