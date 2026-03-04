'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type LobbyChallenge = {
  id: string;
  venueId: string;
  venueName: string;
  area: string;
  startTs: string;
  formatName: string;
  levelRangeHint: string | null;
  refereeAvailable: boolean;
};

export function LobbyPanel() {
  const [cityId, setCityId] = useState('');
  const [sportId, setSportId] = useState('BADMINTON');
  const [rows, setRows] = useState<LobbyChallenge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const from = new Date();
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const params = new URLSearchParams({
      cityId,
      sportId,
      fromTs: from.toISOString(),
      toTs: to.toISOString(),
    });
    return params.toString();
  }, [cityId, sportId]);

  useEffect(() => {
    if (!cityId) {
      setRows([]);
      return;
    }

    apiRequest<{ challenges: LobbyChallenge[] }>(`/lobby/challenges?${query}`, { authenticated: true })
      .then((res) => setRows(res.challenges))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load lobby'));
  }, [query, cityId]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Lobby</h1>
      <p className="page-subtitle">Open challenges in your city and sport.</p>

      <input placeholder="City ID" value={cityId} onChange={(e) => setCityId(e.target.value)} style={inputStyle} />
      <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={inputStyle}>
        <option value="BADMINTON">BADMINTON</option>
        <option value="PICKLEBALL">PICKLEBALL</option>
        <option value="TENNIS">TENNIS</option>
        <option value="BASKETBALL">BASKETBALL</option>
        <option value="TABLE_TENNIS">TABLE_TENNIS</option>
      </select>

      {error ? <p>{error}</p> : null}
      {rows.length === 0 ? <p className="page-subtitle">No live challenges. Create one from Book Slot.</p> : null}

      {rows.map((row) => (
        <a key={row.id} href={`/challenge/${row.id}`} style={cardStyle}>
          <strong>{row.venueName}</strong>
          <span>{new Date(row.startTs).toLocaleString()}</span>
          <span>{row.formatName}</span>
          <span>{row.area}</span>
          <span>Referee: {row.refereeAvailable ? 'Yes' : 'No'}</span>
        </a>
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
