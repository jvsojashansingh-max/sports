'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getCityLabel } from '@/lib/indiaCities';

type TournamentRow = {
  id: string;
  sportId: string;
  status: string;
  startTs: string;
  registrationDeadline: string;
  venue: {
    id: string;
    name: string;
    cityId: string;
  };
};

export function TournamentsPanel() {
  const [rows, setRows] = useState<TournamentRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setMessage(null);

    if (!getAccessToken()) {
      setRows([]);
      setMessage(SIGN_IN_MESSAGE);
      setLoading(false);
      return;
    }

    try {
      const tournaments = await apiRequest<TournamentRow[]>('/tournaments', { authenticated: true });
      setRows(tournaments);
    } catch (error) {
      setRows([]);
      setMessage(resolveTournamentMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(resolveTournamentMessage(err)));
  }, []);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Tournaments</h1>
      <p className="page-subtitle">Single elimination tournaments.</p>

      {loading ? <p className="page-subtitle">Loading tournaments...</p> : null}
      {!loading && rows.length === 0 && !message ? <p className="page-subtitle">No tournaments available.</p> : null}
      {rows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <strong>{row.sportId}</strong>
          <span>{row.venue.name}</span>
          <span>{getCityLabel(row.venue.cityId)}</span>
          <span>Status: {row.status}</span>
          <span>Start: {new Date(row.startTs).toLocaleString()}</span>
          <span>Register by: {new Date(row.registrationDeadline).toLocaleString()}</span>
          <a href={`/tournament/${row.id}`} style={linkStyle}>
            Open
          </a>
          <button
            style={buttonStyle}
            onClick={async () => {
              try {
                await apiRequest(`/tournaments/${row.id}/register`, {
                  method: 'POST',
                  authenticated: true,
                  idempotency: true,
                  body: JSON.stringify({ teamMode: 'SOLO' }),
                });
                setMessage('Registered successfully.');
                await refresh();
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Registration failed');
              }
            }}
          >
            Register
          </button>
        </article>
      ))}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const SIGN_IN_MESSAGE = 'Sign in from the Auth page to view tournaments and register.';

function resolveTournamentMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Failed to load tournaments';
  if (message.includes('UNAUTHENTICATED') || message.includes('Unauthorized')) {
    return SIGN_IN_MESSAGE;
  }
  return message;
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 12,
};

const buttonStyle: React.CSSProperties = {
  height: 38,
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
