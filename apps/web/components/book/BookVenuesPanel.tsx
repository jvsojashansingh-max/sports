'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { DEFAULT_CITY_ID, getCityLabel, INDIA_DEMO_CITIES } from '@/lib/indiaCities';

type VenueListRow = {
  id: string;
  name: string;
  cityId: string;
  stateId: string;
  address: string;
  status: string;
  resources: Array<{
    sportId: string;
  }>;
};

const sports = ['', 'BADMINTON', 'PICKLEBALL', 'TENNIS', 'BASKETBALL', 'TABLE_TENNIS'] as const;

export function BookVenuesPanel() {
  const [cityId, setCityId] = useState(DEFAULT_CITY_ID);
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
    setError(null);
    apiRequest<VenueListRow[]>(`/venues${query}`, { authenticated: true })
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load venues'));
  }, [query]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Book Slot</h1>
      <p className="page-subtitle">Browse approved live venues in your selected city.</p>
      <p className="page-subtitle">Demo cities available now: Chandigarh, Delhi, Mumbai, Bengaluru, and Pune.</p>

      <div style={{ display: 'grid', gap: 8 }}>
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={inputStyle}>
          {INDIA_DEMO_CITIES.map((city) => (
            <option key={city.id} value={city.id}>
              {city.code} - {city.name}
            </option>
          ))}
        </select>
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

      {rows.length === 0 ? (
        <p className="page-subtitle">No live venues found for {getCityLabel(cityId)}.</p>
      ) : null}
      {rows.map((venue) => {
        const sportsAvailable = Array.from(new Set(venue.resources.map((resource) => resource.sportId)));

        return (
          <a key={venue.id} href={`/venues/${venue.id}`} style={cardStyle}>
            <strong>{venue.name}</strong>
            <span>{getCityLabel(venue.cityId)}</span>
            <span>{venue.address}</span>
            <span>Sports: {sportsAvailable.join(', ')}</span>
            <span>Status: {venue.status}</span>
          </a>
        );
      })}
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
