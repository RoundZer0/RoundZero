/**
 * RoundZero Contest Rating & Calendar System
 * Elo-style rating tiers, calculation algorithms, and calendar integrations.
 */

export type RatingTier = 'Novice' | 'Pupil' | 'Specialist' | 'Expert' | 'Knight' | 'Guardian';

export interface RatingBadgeInfo {
  tier: RatingTier;
  rating: number;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Returns tier metadata and UI badge styling for any rating score.
 */
export function getRatingTier(rating: number = 1500): RatingBadgeInfo {
  if (rating >= 2200) {
    return {
      tier: 'Guardian',
      rating,
      label: 'Guardian',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
    };
  }
  if (rating >= 2000) {
    return {
      tier: 'Knight',
      rating,
      label: 'Knight',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/30',
    };
  }
  if (rating >= 1800) {
    return {
      tier: 'Expert',
      rating,
      label: 'Expert',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    };
  }
  if (rating >= 1600) {
    return {
      tier: 'Specialist',
      rating,
      label: 'Specialist',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
    };
  }
  if (rating >= 1400) {
    return {
      tier: 'Pupil',
      rating,
      label: 'Pupil',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
    };
  }
  return {
    tier: 'Novice',
    rating,
    label: 'Novice',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/10',
    borderColor: 'border-zinc-500/30',
  };
}

/**
 * Calculates contest rating change based on participant pool and score performance.
 */
export function calculateContestRatingChange(
  oldRating: number = 1500,
  rank: number,
  totalParticipants: number,
  score: number,
  maxScore: number = 18
): { newRating: number; delta: number; performance: number } {
  const safeTotal = Math.max(1, totalParticipants);
  const percentile = (safeTotal - rank + 0.5) / safeTotal;
  const scoreRatio = maxScore > 0 ? score / maxScore : 0;

  // Expected percentile based on current rating relative to 1500
  const expectedPercentile = 1 / (1 + Math.pow(10, (1500 - oldRating) / 400));

  // Volatility constant
  const K = 40;
  const performanceMultiplier = scoreRatio * 0.4 + percentile * 0.6;
  const rawDelta = Math.round(K * (performanceMultiplier - expectedPercentile));

  // Minimum guarantee for perfect score
  let delta = rawDelta;
  if (score === maxScore && delta < 15) {
    delta = 15;
  }
  // Clamp extreme swings
  delta = Math.max(-60, Math.min(85, delta));

  const newRating = Math.max(800, oldRating + delta);
  const performance = Math.round(1500 + (percentile - 0.5) * 800 + scoreRatio * 400);

  return { newRating, delta, performance };
}

/**
 * Generates Google Calendar 1-click event link for Saturday 9:00 PM IST.
 */
export function generateGoogleCalendarUrl(
  title: string,
  startTime: Date,
  endTime: Date,
  contestUrl: string = 'https://roundzero.com/contest'
): string {
  const formatTime = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const text = encodeURIComponent(title);
  const dates = `${formatTime(startTime)}/${formatTime(endTime)}`;
  const details = encodeURIComponent(
    `RoundZero Weekly Contest (90 Mins, 4 Questions, 18 Pts).\nJoin live arena at: ${contestUrl}`
  );
  const location = encodeURIComponent(contestUrl);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${dates}&details=${details}&location=${location}`;
}

/**
 * Generates an .ics file content for Apple Calendar / Outlook / Thunderbird.
 */
export function generateIcsContent(
  title: string,
  startTime: Date,
  endTime: Date,
  contestUrl: string = 'https://roundzero.com/contest'
): string {
  const formatTime = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//RoundZero//Contest Reminder//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:roundzero-contest-${startTime.getTime()}@roundzero.com`,
    `DTSTAMP:${formatTime(new Date())}`,
    `DTSTART:${formatTime(startTime)}`,
    `DTEND:${formatTime(endTime)}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:Weekly synchronized 90-minute competitive coding contest. 4 algorithmic challenges (3, 4, 5, 6 pts). URL: ${contestUrl}`,
    `URL:${contestUrl}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:RoundZero Contest starts in 15 minutes!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Generates structured algorithmic editorial breakdown for contest problems.
 */
export function getProblemEditorial(problem: {
  title: string;
  difficulty: string;
  points: number;
  tags?: string[];
  id?: number;
}) {
  const isEasy = problem.difficulty === 'Easy';
  const isMed = problem.difficulty === 'Medium';

  if (isEasy) {
    return {
      intuition: `This problem tests fundamental data structures and linear scanning. A single pass or hash set provides the optimal solution.`,
      approach: `1. Initialize a hash map or two-pointer window depending on lookup requirements.
2. Traverse the input sequentially, validating constraints in O(1) per element.
3. Return the result directly without auxiliary sorting.`,
      timeComplexity: 'O(N) - Linear single-pass scan.',
      spaceComplexity: 'O(1) to O(N) auxiliary storage.',
      pythonSnippet: `def solve(nums):\n    seen = set()\n    for x in nums:\n        if x in seen:\n            return True\n        seen.add(x)\n    return False`,
      cppSnippet: `bool solve(const vector<int>& nums) {\n    unordered_set<int> seen;\n    for (int x : nums) {\n        if (seen.count(x)) return true;\n        seen.insert(x);\n    }\n    return false;\n}`,
    };
  }

  if (isMed) {
    return {
      intuition: `The challenge requires identifying overlapping subproblems, monotonic stack behavior, or two-pointer search to avoid the naive O(N²) quadratic ceiling.`,
      approach: `1. Formulate state representations or sort elements by criteria.
2. Maintain an invariant (e.g. prefix sums, priority queue, or binary search over candidate answers).
3. Update global optimum greedily or via DP transition.`,
      timeComplexity: 'O(N log N) with sorting / binary search, or O(N) with Hash/Stack.',
      spaceComplexity: 'O(N) memory for stack/DP table.',
      pythonSnippet: `def solve(arr, k):\n    import heapq\n    pq = []\n    for val in arr:\n        heapq.heappush(pq, val)\n        if len(pq) > k:\n            heapq.heappop(pq)\n    return pq[0]`,
      cppSnippet: `int solve(vector<int>& arr, int k) {\n    priority_queue<int, vector<int>, greater<int>> pq;\n    for (int x : arr) {\n        pq.push(x);\n        if (pq.size() > k) pq.pop();\n    }\n    return pq.top();\n}`,
    };
  }

  return {
    intuition: `This advanced problem requires multi-dimensional dynamic programming, bitmask representation, or tree/graph traversal with memoization.`,
    approach: `1. Define state DP[i][mask] representing the minimum cost after visiting state mask ending at node i.
2. Evaluate transitions across valid neighbors while pruning redundant branches.
3. Apply topological ordering or Dijkstra-like state relaxation for shortest paths.`,
    timeComplexity: 'O(2^N * N^2) or O((V + E) log V).',
    spaceComplexity: 'O(2^N * N) state table.',
    pythonSnippet: `def solve_hard(n, edges):\n    # Multi-state DP / Dijkstra with bitmask\n    dp = {}\n    def dfs(node, mask):\n        if mask == (1 << n) - 1: return 0\n        state = (node, mask)\n        if state in dp: return dp[state]\n        res = float('inf')\n        for nxt, weight in edges.get(node, []):\n            if not (mask & (1 << nxt)):\n                res = min(res, weight + dfs(nxt, mask | (1 << nxt)))\n        dp[state] = res\n        return res\n    return dfs(0, 1)`,
    cppSnippet: `int solveHard(int n, vector<vector<pair<int,int>>>& adj) {\n    vector<vector<int>> dp(1 << n, vector<int>(n, 1e9));\n    dp[1][0] = 0;\n    for (int mask = 1; mask < (1 << n); ++mask) {\n        for (int u = 0; u < n; ++u) {\n            if (!(mask & (1 << u)) || dp[mask][u] == 1e9) continue;\n            for (auto& [v, w] : adj[u]) {\n                if (!(mask & (1 << v))) {\n                    dp[mask | (1 << v)][v] = min(dp[mask | (1 << v)][v], dp[mask][u] + w);\n                }\n            }\n        }\n    }\n    return *min_element(dp[(1 << n) - 1].begin(), dp[(1 << n) - 1].end());\n}`,
  };
}
