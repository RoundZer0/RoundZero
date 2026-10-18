'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import { Calendar, Flame, Trophy, CheckCircle2 } from 'lucide-react';

interface SubmissionHeatmapProps {
  calendar?: Record<string, number>;
  totalSubmissions?: number;
  activeDays?: number;
  longestStreak?: number;
  currentStreak?: number;
}

interface DayCellData {
  dateStr: string;
  formattedDate: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
  isToday: boolean;
  isFuture: boolean;
}

interface MonthData {
  key: string;
  name: string;
  year: number;
  month: number;
  weeks: (DayCellData | null)[][];
}

const MONTH_NAMES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export default function SubmissionHeatmap({
  calendar = {},
  totalSubmissions = 0,
  activeDays = 0,
  longestStreak = 0,
  currentStreak = 0,
}: SubmissionHeatmapProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipCountRef = useRef<HTMLSpanElement>(null);
  const tooltipDateRef = useRef<HTMLSpanElement>(null);
  const tooltipCaretRef = useRef<HTMLDivElement>(null);

  // Generate 12 distinct calendar months ending with the current month
  const months: MonthData[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth(); // 0-indexed

    const result: MonthData[] = [];

    // Loop through 12 months (from 11 months ago to current month)
    for (let offset = 11; offset >= 0; offset--) {
      let m = todayMonth - offset;
      let y = todayYear;
      while (m < 0) {
        m += 12;
        y -= 1;
      }

      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const firstDayOfWeek = new Date(y, m, 1).getDay(); // 0 = Sun ... 6 = Sat

      const weeksList: (DayCellData | null)[][] = [];
      let currentWeek: (DayCellData | null)[] = [];

      // Initial padding: fill empty rows in first week before day 1
      for (let pad = 0; pad < firstDayOfWeek; pad++) {
        currentWeek.push(null);
      }

      for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const d = new Date(y, m, dayNum);
        d.setHours(0, 0, 0, 0);

        const yearStr = d.getFullYear();
        const monthStr = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

        const isToday = d.getTime() === today.getTime();
        const isFuture = d.getTime() > today.getTime();

        // Strict guard: Future dates can NEVER have positive count or active levels
        const count = isFuture ? 0 : calendar[dateStr] || 0;

        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (!isFuture) {
          if (count >= 10) level = 4;
          else if (count >= 6) level = 3;
          else if (count >= 3) level = 2;
          else if (count >= 1) level = 1;
        }

        const formattedDate = d.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        currentWeek.push({
          dateStr,
          formattedDate,
          count,
          level,
          isToday,
          isFuture,
        });

        if (currentWeek.length === 7) {
          weeksList.push(currentWeek);
          currentWeek = [];
        }
      }

      // Trailing padding: if the last week is not full, fill remainder with null
      if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
          currentWeek.push(null);
        }
        weeksList.push(currentWeek);
      }

      result.push({
        key: `${y}-${m}`,
        name: MONTH_NAMES[m],
        year: y,
        month: m,
        weeks: weeksList,
      });
    }

    return result;
  }, [calendar]);

  // High-performance hover: calculates position relative to outer card with boundary clamping
  // Triggers 0 React re-renders and never causes scrollbar or clipping
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-heatmap-day]');
    const tooltip = tooltipRef.current;
    const card = cardRef.current;
    if (!tooltip || !card) return;

    if (!target) {
      tooltip.style.opacity = '0';
      return;
    }

    const countAttr = target.getAttribute('data-count') || '0';
    const dateAttr = target.getAttribute('data-date') || '';
    const count = parseInt(countAttr, 10);

    if (tooltipCountRef.current) {
      tooltipCountRef.current.textContent =
        count === 0 ? 'No submissions' : `${count} submission${count === 1 ? '' : 's'}`;
      tooltipCountRef.current.className =
        count > 0 ? 'font-semibold text-emerald-400' : 'font-medium text-zinc-300';
    }
    if (tooltipDateRef.current) {
      tooltipDateRef.current.textContent = `on ${dateAttr}`;
    }

    const cardRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const targetCenterX = targetRect.left - cardRect.left + targetRect.width / 2;
    const targetTopY = targetRect.top - cardRect.top;

    const tooltipWidth = tooltip.offsetWidth || 180;
    const halfW = tooltipWidth / 2;
    const cardWidth = cardRect.width;

    // Clamp tooltip center so it never overflows the card on left or right
    const minX = halfW + 12;
    const maxX = cardWidth - halfW - 12;
    const clampedX = Math.max(minX, Math.min(maxX, targetCenterX));

    // Dynamic caret offset pointing directly to the target tile
    const caretOffset = targetCenterX - clampedX;
    if (tooltipCaretRef.current) {
      tooltipCaretRef.current.style.transform = `translateX(${caretOffset}px)`;
    }

    // Position above tile with 8px margin
    const y = targetTopY - 8;
    tooltip.style.transform = `translate3d(${clampedX - halfW}px, ${y}px, 0) translateY(-100%)`;
    tooltip.style.opacity = '1';
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.style.opacity = '0';
    }
  }, []);

  const getDayColor = (level: 0 | 1 | 2 | 3 | 4) => {
    switch (level) {
      case 1:
        return 'bg-[#0e4429] hover:bg-[#125835]';
      case 2:
        return 'bg-[#006d32] hover:bg-[#00873d]';
      case 3:
        return 'bg-[#26a641] hover:bg-[#2bc24c] shadow-[0_0_6px_rgba(38,166,65,0.4)]';
      case 4:
        return 'bg-[#39d353] hover:bg-[#4ae564] shadow-[0_0_8px_rgba(57,211,83,0.6)]';
      case 0:
      default:
        return 'bg-[#242424] hover:bg-zinc-600';
    }
  };

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl border border-zinc-800/90 bg-[#141414] p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-5 overflow-visible"
    >
      {/* Floating Tooltip anchored to outer card with boundary clamping */}
      <div
        ref={tooltipRef}
        style={{ opacity: 0, transform: 'translate3d(0, 0, 0)' }}
        className="pointer-events-none absolute left-0 top-0 z-50 transition-opacity duration-100 ease-out"
      >
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-1.5 rounded-md bg-[#1c1c20]/95 px-2.5 py-1 text-[11px] font-sans text-white shadow-2xl border border-zinc-700/80 backdrop-blur-md whitespace-nowrap">
            <span ref={tooltipCountRef} className="font-semibold text-emerald-400">
              No submissions
            </span>
            <span ref={tooltipDateRef} className="text-zinc-400">
              on Oct 18, 2026
            </span>
          </div>
          <div
            ref={tooltipCaretRef}
            className="w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-zinc-700/80 -mt-[1px] transition-transform duration-75"
          />
        </div>
      </div>

      {/* Header bar: Title & Summary Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>365-Day Submission Heatmap</span>
              <span className="rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono font-bold">
                {totalSubmissions} Solves
              </span>
            </h2>
            <p className="text-[11px] text-zinc-400">
              Aggregated daily code submissions, POTD challenges, and contest rounds
            </p>
          </div>
        </div>

        {/* Quick Highlights Chips */}
        <div className="flex items-center gap-2.5 flex-wrap font-mono text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1f1f] border border-zinc-800 text-zinc-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              <strong className="text-white">{activeDays}</strong> Active Days
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1f1f] border border-zinc-800 text-zinc-300">
            <Flame className="h-3.5 w-3.5 text-amber-500 fill-amber-500/20" />
            <span>
              <strong className="text-amber-400">{currentStreak}</strong> Day Streak
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f1f1f] border border-zinc-800 text-zinc-300">
            <Trophy className="h-3.5 w-3.5 text-purple-400" />
            <span>
              <strong className="text-purple-300">{longestStreak}</strong> Max Streak
            </span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid by Month Blocks */}
      <div
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onScroll={handlePointerLeave}
        className="relative overflow-x-auto pb-2 pt-2 scrollbar-none"
      >
        {/* 12 Month Blocks */}
        <div className="inline-flex items-start justify-between gap-3 sm:gap-4 min-w-[780px] select-none py-1">
          {months.map((m) => (
            <div key={m.key} className="flex flex-col">
              {/* Month Header Label */}
              <span className="text-[10px] font-mono font-semibold uppercase text-zinc-400 mb-2 pl-0.5 tracking-wider">
                {m.name}
              </span>

              {/* Month Columns */}
              <div className="flex gap-[3px]">
                {m.weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {week.map((day, dIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${dIdx}`}
                            className="h-[11px] w-[11px] opacity-0 pointer-events-none"
                          />
                        );
                      }

                      // Future days: unclickable, muted, never show tooltip or active color
                      if (day.isFuture) {
                        return (
                          <div
                            key={day.dateStr}
                            className="h-[11px] w-[11px] rounded-[2.5px] bg-[#1c1c1c] opacity-35 cursor-default pointer-events-none"
                          />
                        );
                      }

                      // Past / Today days: fully interactive
                      return (
                        <div
                          key={day.dateStr}
                          data-heatmap-day="true"
                          data-date={day.formattedDate}
                          data-count={day.count}
                          className={`h-[11px] w-[11px] rounded-[2.5px] cursor-pointer transition-all duration-75 hover:scale-125 hover:z-20 ${getDayColor(
                            day.level
                          )} ${
                            day.isToday
                              ? 'ring-1 ring-zinc-200 ring-offset-1 ring-offset-[#141414]'
                              : ''
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: Color Scale Legend matching reference */}
      <div className="flex items-center justify-end text-xs text-zinc-400 font-sans pt-1">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 select-none">
          <span className="text-zinc-500 mr-0.5">Less</span>
          <div className="h-[11px] w-[11px] rounded-[2.5px] bg-[#242424]" title="0 submissions" />
          <div className="h-[11px] w-[11px] rounded-[2.5px] bg-[#0e4429]" title="1-2 submissions" />
          <div className="h-[11px] w-[11px] rounded-[2.5px] bg-[#006d32]" title="3-5 submissions" />
          <div className="h-[11px] w-[11px] rounded-[2.5px] bg-[#26a641]" title="6-9 submissions" />
          <div className="h-[11px] w-[11px] rounded-[2.5px] bg-[#39d353]" title="10+ submissions" />
          <span className="text-zinc-500 ml-0.5">More</span>
        </div>
      </div>
    </div>
  );
}
