export const queryKeys = {
  lobbyChallenges: (city: string, sport: string, timeRange: string) =>
    ['lobby:challenges', city, sport, timeRange] as const,
  venue: (id: string) => ['venue', id] as const,
  venueAvailability: (venueId: string, date: string) => ['venueAvailability', venueId, date] as const,
  challenge: (id: string) => ['challenge', id] as const,
  tournament: (id: string) => ['tournament', id] as const,
  leaderboard: (sport: string, scope: string, window: string, geo: string) =>
    ['leaderboard', sport, scope, window, geo] as const,
  conversations: (userId: string) => ['conversations', userId] as const,
};
