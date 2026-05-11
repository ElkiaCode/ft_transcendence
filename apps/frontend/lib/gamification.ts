export type GamificationBadge = {
  id: string;
  name: string;
  description: string;
  threshold: number;
  tone: 'positive' | 'negative';
  accentClass: string;
  mark: string;
};

export const GAMIFICATION_BADGES: GamificationBadge[] = [
  {
    id: 'rising-star',
    name: 'Rising Star',
    description: 'Reached 50 positive points.',
    threshold: 50,
    tone: 'positive',
    accentClass: 'border-emerald-400 bg-emerald-50 text-emerald-900',
    mark: 'RS',
  },
  {
    id: 'community-spark',
    name: 'Community Spark',
    description: 'Reached 100 positive points.',
    threshold: 100,
    tone: 'positive',
    accentClass: 'border-cyan-400 bg-cyan-50 text-cyan-900',
    mark: 'CS',
  },
  {
    id: 'helpful-hero',
    name: 'Helpful Hero',
    description: 'Reached 250 positive points.',
    threshold: 250,
    tone: 'positive',
    accentClass: 'border-sky-400 bg-sky-50 text-sky-900',
    mark: 'HH',
  },
  {
    id: 'trust-champion',
    name: 'Trust Champion',
    description: 'Reached 500 positive points.',
    threshold: 500,
    tone: 'positive',
    accentClass: 'border-violet-400 bg-violet-50 text-violet-900',
    mark: 'TC',
  },
  {
    id: 'fair-play-legend',
    name: 'Fair Play Legend',
    description: 'Reached 1000 positive points.',
    threshold: 1000,
    tone: 'positive',
    accentClass: 'border-amber-400 bg-amber-50 text-amber-950',
    mark: 'FL',
  },
  {
    id: 'caution-mark',
    name: 'Caution Mark',
    description: 'Dropped to -50 points.',
    threshold: -50,
    tone: 'negative',
    accentClass: 'border-yellow-500 bg-yellow-50 text-yellow-950',
    mark: 'CM',
  },
  {
    id: 'rule-bender',
    name: 'Rule Bender',
    description: 'Dropped to -100 points.',
    threshold: -100,
    tone: 'negative',
    accentClass: 'border-orange-500 bg-orange-50 text-orange-950',
    mark: 'RB',
  },
  {
    id: 'trouble-trail',
    name: 'Trouble Trail',
    description: 'Dropped to -250 points.',
    threshold: -250,
    tone: 'negative',
    accentClass: 'border-red-500 bg-red-50 text-red-950',
    mark: 'TT',
  },
  {
    id: 'critical-conduct',
    name: 'Critical Conduct',
    description: 'Dropped to -500 points.',
    threshold: -500,
    tone: 'negative',
    accentClass: 'border-rose-600 bg-rose-50 text-rose-950',
    mark: 'CC',
  },
  {
    id: 'redemption-needed',
    name: 'Redemption Needed',
    description: 'Dropped to -1000 points.',
    threshold: -1000,
    tone: 'negative',
    accentClass: 'border-zinc-500 bg-zinc-100 text-zinc-950',
    mark: 'RN',
  },
];

export function getEarnedBadges(points: number) {
  return GAMIFICATION_BADGES.filter((badge) =>
    badge.tone === 'positive'
      ? points >= badge.threshold
      : points <= badge.threshold,
  );
}
