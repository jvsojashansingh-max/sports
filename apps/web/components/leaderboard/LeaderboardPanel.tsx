'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type LeaderboardRow = {
  userId: string;
  wins: number;
  losses: number;
  matches: number;
  level: number;
  rating: number;
};

export function LeaderboardPanel() {
  const [sportId, setSportId] = useState('BADMINTON');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [source, setSource] = useState<'snapshot' | 'live'>('live');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ source: 'snapshot' | 'live'; rows: LeaderboardRow[] }>(
      `/leaderboards?sportId=${encodeURIComponent(sportId)}&scope=ALL&window=ALL_TIME`,
      { authenticated: true },
    )
      .then((res) => {
        setRows(res.rows);
        setSource(res.source);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load leaderboard'));
  }, [sportId]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Leaderboard</h1>
      <p className="page-subtitle">Top players by wins and level.</p>
      <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={inputStyle}>
        <option value="BADMINTON">BADMINTON</option>
        <option value="PICKLEBALL">PICKLEBALL</option>
        <option value="TENNIS">TENNIS</option>
        <option value="BASKETBALL">BASKETBALL</option>
        <option value="TABLE_TENNIS">TABLE_TENNIS</option>
      </select>
      <p className="page-subtitle">Source: {source}</p>
      {error ? <p>{error}</p> : null}
      {rows.map((row, index) => (
        <article key={row.userId} style={cardStyle}>
          <strong>#{index + 1}</strong>
          <span>{row.userId}</span>
          <span>Wins: {row.wins}</span>
          <span>Level: {row.level}</span>
        </article>
      ))}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: '0 10px',
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 12,
};
