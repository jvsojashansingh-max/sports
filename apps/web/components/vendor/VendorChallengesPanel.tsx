'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { getCityLabel } from '@/lib/indiaCities';

type VendorChallengeRow = {
  id: string;
  status: 'WAITING_OPPONENT' | 'OPPONENT_REQUESTED' | 'CONFIRMED' | 'CANCELLED' | 'CLOSED';
  paymentStatus: 'UNKNOWN' | 'PAID' | 'UNPAID';
  joinDeadlineTs: string;
  checkinOpenTs: string;
  format: {
    id: string;
    name: string;
    sportId: string;
    teamSize: number;
    refereeAllowed: boolean;
  };
  booking: {
    id: string;
    status: string;
    startTs: string;
    endTs: string;
    resource: {
      id: string;
      name: string;
      sportId: string;
      venue: {
        id: string;
        name: string;
        cityId: string;
        address: string;
      };
    };
  };
  teams: Array<{
    id: string;
    side: 'A' | 'B';
    isOpenFill: boolean;
    memberCount: number;
  }>;
  match: {
    id: string;
    status: string;
  } | null;
  conversation: {
    id: string;
    status: string;
  } | null;
};

export function VendorChallengesPanel() {
  const [rows, setRows] = useState<VendorChallengeRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<VendorChallengeRow[]>('/vendor/challenges', { authenticated: true })
      .then(setRows)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load vendor challenges'));
  }, []);

  const pending = useMemo(() => rows.filter((row) => row.status === 'WAITING_OPPONENT' || row.status === 'OPPONENT_REQUESTED'), [rows]);
  const confirmed = useMemo(() => rows.filter((row) => row.status === 'CONFIRMED'), [rows]);
  const closed = useMemo(() => rows.filter((row) => row.status === 'CANCELLED' || row.status === 'CLOSED'), [rows]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 className="page-title">Vendor Challenge Board</h1>
        <p className="page-subtitle">
          This is the vendor-side request view. Use it to track player-created challenges on your venues and jump into
          match-day controls once a challenge is confirmed.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a href="/vendor/formats" style={linkStyle}>Create format</a>
        <a href="/vendor/settings" style={linkStyle}>Create venue/resource</a>
        <a href="/vendor/schedule" style={linkStyle}>Open schedule + match ops</a>
        <a href="/vendor/inbox" style={linkStyle}>Open vendor inbox</a>
      </div>

      {error ? <p>{error}</p> : null}

      <ChallengeSection
        title={`Pending Requests (${pending.length})`}
        subtitle="Waiting for an opponent or waiting for the captain to confirm the opponent."
        rows={pending}
      />
      <ChallengeSection
        title={`Confirmed / Live (${confirmed.length})`}
        subtitle="Confirmed challenges with upcoming or active match operations."
        rows={confirmed}
      />
      <ChallengeSection
        title={`Closed (${closed.length})`}
        subtitle="Cancelled or closed rows kept for reference."
        rows={closed}
      />
    </section>
  );
}

function ChallengeSection({ title, subtitle, rows }: { title: string; subtitle: string; rows: VendorChallengeRow[] }) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 4 }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {rows.length === 0 ? <p className="page-subtitle">No rows in this bucket.</p> : null}
      {rows.map((row) => {
        const sideA = row.teams.find((team) => team.side === 'A');
        const sideB = row.teams.find((team) => team.side === 'B');
        return (
          <article key={row.id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <strong>{row.format.sportId} at {row.booking.resource.venue.name}</strong>
              <span style={badgeStyle}>{row.status}</span>
            </div>
            <span>{getCityLabel(row.booking.resource.venue.cityId)} · {row.booking.resource.venue.address}</span>
            <span>Resource: {row.booking.resource.name}</span>
            <span>Format: {row.format.name} · team size {row.format.teamSize} · referee {row.format.refereeAllowed ? 'yes' : 'no'}</span>
            <span>Start: {new Date(row.booking.startTs).toLocaleString()}</span>
            <span>Join deadline: {new Date(row.joinDeadlineTs).toLocaleString()}</span>
            <span>Check-in opens: {new Date(row.checkinOpenTs).toLocaleString()}</span>
            <span>Booking: {row.booking.status} · Payment: {row.paymentStatus}</span>
            <span>
              Team A: {sideA?.memberCount ?? 0}
              {sideA?.isOpenFill ? ' (open fill)' : ''}
              {' · '}
              Team B: {sideB?.memberCount ?? 0}
              {sideB?.isOpenFill ? ' (open fill)' : ''}
            </span>
            {row.match ? <span>Match ready · {row.match.status}</span> : <span>Match: not created yet</span>}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`/challenge/${row.id}`} style={linkStyle}>Open challenge</a>
              {row.conversation ? <a href={`/chat/${row.conversation.id}`} style={linkStyle}>Open chat</a> : null}
              {row.match ? <a href={`/vendor/schedule?matchId=${row.match.id}`} style={linkStyle}>Open match ops</a> : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  borderRadius: 12,
  padding: 12,
  border: '1px solid rgba(92,224,255,0.3)',
  background: 'rgba(5,22,26,0.58)',
};

const badgeStyle: React.CSSProperties = {
  borderRadius: 999,
  padding: '4px 10px',
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(92,224,255,0.12)',
  fontSize: 12,
  fontWeight: 700,
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
  fontWeight: 700,
};
