'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type VenueRow = {
  id: string;
  name: string;
  status: string;
};

type TournamentRow = {
  id: string;
  venueId: string;
  sportId: string;
  status: string;
  startTs: string;
  registrationDeadline: string;
  bracketVersion: number;
};

export function VendorTournamentsPanel() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [venueId, setVenueId] = useState('');
  const [sportId, setSportId] = useState('BADMINTON');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [startTs, setStartTs] = useState('');
  const [slotMinutes, setSlotMinutes] = useState('60');
  const [resourceIdsCsv, setResourceIdsCsv] = useState('');
  const [generateResourceIdsCsv, setGenerateResourceIdsCsv] = useState('');

  const refresh = useCallback(async () => {
    const [vendorVenues, tournaments] = await Promise.all([
      apiRequest<VenueRow[]>('/vendor/venues', { authenticated: true }),
      apiRequest<TournamentRow[]>('/tournaments', { authenticated: true }),
    ]);
    setVenues(vendorVenues);
    setRows(tournaments);
    if (!venueId && vendorVenues.length > 0) {
      setVenueId(vendorVenues[0].id);
    }
  }, [venueId]);

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load tournaments'));
  }, [refresh]);

  const venueById = useMemo(() => {
    return new Map(venues.map((venue) => [venue.id, venue]));
  }, [venues]);

  const vendorTournamentRows = useMemo(() => {
    const venueIds = new Set(venues.map((venue) => venue.id));
    return rows.filter((row) => venueIds.has(row.venueId));
  }, [rows, venues]);

  async function createTournament(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const registrationIso = localDateTimeToIso(registrationDeadline);
    const startIso = localDateTimeToIso(startTs);

    if (!registrationIso || !startIso) {
      setMessage('Provide valid registration and start times.');
      return;
    }
    if (!venueId) {
      setMessage('Select a venue first.');
      return;
    }

    try {
      await apiRequest('/vendor/tournaments', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          venueId,
          sportId,
          registrationDeadline: registrationIso,
          startTs: startIso,
          slotMinutes: Number(slotMinutes),
          resourceIds: parseCsvIds(resourceIdsCsv),
        }),
      });
      setMessage('Tournament created.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Create tournament failed');
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Vendor Tournaments</h1>
      <p className="page-subtitle">Create single elimination tournaments and generate fixtures.</p>

      <form onSubmit={createTournament} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Create Tournament</h2>
        <select value={venueId} onChange={(event) => setVenueId(event.target.value)} style={inputStyle} required>
          <option value="">Select venue</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name} ({venue.status})
            </option>
          ))}
        </select>
        <select value={sportId} onChange={(event) => setSportId(event.target.value)} style={inputStyle}>
          <option value="BADMINTON">BADMINTON</option>
          <option value="PICKLEBALL">PICKLEBALL</option>
          <option value="TENNIS">TENNIS</option>
          <option value="BASKETBALL">BASKETBALL</option>
          <option value="TABLE_TENNIS">TABLE_TENNIS</option>
        </select>
        <input
          type="datetime-local"
          value={registrationDeadline}
          onChange={(event) => setRegistrationDeadline(event.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="datetime-local"
          value={startTs}
          onChange={(event) => setStartTs(event.target.value)}
          style={inputStyle}
          required
        />
        <input
          value={slotMinutes}
          onChange={(event) => setSlotMinutes(event.target.value)}
          style={inputStyle}
          placeholder="Slot minutes"
        />
        <input
          value={resourceIdsCsv}
          onChange={(event) => setResourceIdsCsv(event.target.value)}
          style={inputStyle}
          placeholder="Resource IDs CSV (optional)"
        />
        <button type="submit" style={buttonStyle}>
          Create Tournament
        </button>
      </form>

      <h2 style={{ margin: 0 }}>Your Tournaments</h2>
      {vendorTournamentRows.length === 0 ? <p className="page-subtitle">No tournaments yet.</p> : null}
      {vendorTournamentRows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <strong>{row.sportId}</strong>
          <span>Venue: {venueById.get(row.venueId)?.name ?? row.venueId}</span>
          <span>Status: {row.status}</span>
          <span>Start: {new Date(row.startTs).toLocaleString()}</span>
          <span>Registration deadline: {new Date(row.registrationDeadline).toLocaleString()}</span>
          <span>Bracket version: {row.bracketVersion}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={`/tournament/${row.id}`} style={linkStyle}>
              Open
            </a>
            <input
              value={generateResourceIdsCsv}
              onChange={(event) => setGenerateResourceIdsCsv(event.target.value)}
              style={inputStyle}
              placeholder="Generate resource IDs CSV (optional)"
            />
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/vendor/tournaments/${row.id}/generate-bracket`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      resourceIds: parseCsvIds(generateResourceIdsCsv),
                    }),
                  });
                  setMessage('Bracket generated.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Bracket generation failed');
                }
              }}
            >
              Generate Bracket
            </button>
          </div>
        </article>
      ))}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

function parseCsvIds(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function localDateTimeToIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

const inputStyle: React.CSSProperties = {
  height: 40,
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
  padding: 10,
};

const buttonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
};
