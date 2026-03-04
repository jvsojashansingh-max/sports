'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type VenueListRow = {
  id: string;
  name: string;
  cityId: string;
  stateId: string;
  address: string;
  status: string;
};

const sports = ['', 'BADMINTON', 'PICKLEBALL', 'TENNIS', 'BASKETBALL', 'TABLE_TENNIS'] as const;

export function BookVenuesPanel() {
  const [cityId, setCityId] = useState('');
  const [sportId, setSportId] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<VenueListRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (cityId.trim()) params.set('cityId', cityId.trim());
    if (sportId.trim()) params.set('sportId', sportId.trim());
    if (q.trim()) params.set('q', q.trim());
    const raw = params.toString();
    return raw ? `?${raw}` : '';
  }, [cityId, sportId, q]);

  useEffect(() => {
    apiRequest<VenueListRow[]>(`/venues${query}`, { authenticated: true })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load venues'));
  }, [query]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Book Slot</h1>
      <p className="page-subtitle">Browse approved live venues in your selected city.</p>

      <div style={{ display: 'grid', gap: 8 }}>
        <input
          placeholder="City ID"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          style={inputStyle}
        />
        <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={inputStyle}>
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport || 'All sports'}
            </option>
          ))}
        </select>
        <input
          placeholder="Search venue or area"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={inputStyle}
        />
      </div>

      {error ? <p>{error}</p> : null}

      {rows.length === 0 ? <p className="page-subtitle">No live challenges. Create one from Book Slot.</p> : null}
      {rows.map((venue) => (
        <a key={venue.id} href={`/venues/${venue.id}`} style={cardStyle}>
          <strong>{venue.name}</strong>
          <span>{venue.address}</span>
          <span>Status: {venue.status}</span>
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
