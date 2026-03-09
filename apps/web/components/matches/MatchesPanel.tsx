'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { getCityLabel } from '@/lib/indiaCities';

type ActivityResponse = {
  bookings: Array<{
    id: string;
    status: string;
    type: string;
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
    challenge: {
      id: string;
      status: string;
      formatName: string;
      match: {
        id: string;
        status: string;
      } | null;
      conversationId: string | null;
    } | null;
  }>;
  challengeParticipations: Array<{
    id: string;
    status: string;
    joinDeadlineTs: string;
    teamSide: 'A' | 'B' | null;
    participationRole: 'CAPTAIN' | 'PLAYER';
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
    format: {
      id: string;
      name: string;
    };
    match: {
      id: string;
      status: string;
    } | null;
    conversationId: string | null;
  }>;
  tournamentEntries: Array<{
    entryId: string;
    status: string;
    tournament: {
      id: string;
      sportId: string;
      status: string;
      startTs: string;
      registrationDeadline: string;
      venue: {
        id: string;
        name: string;
        cityId: string;
        address: string;
      };
    };
    fixtures: Array<{
      id: string;
      round: number;
      matchIndex: number;
      startTs: string | null;
      status: string;
      resourceId: string | null;
      isAwaitingOpponent: boolean;
    }>;
  }>;
};

export function MatchesPanel() {
  const [activity, setActivity] = useState<ActivityResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      setActivity(null);
      setMessage(SIGN_IN_MESSAGE);
      return;
    }

    apiRequest<ActivityResponse>('/me/activity', { authenticated: true })
      .then((response) => {
        setActivity(response);
        setMessage(null);
      })
      .catch((error) => {
        setActivity(null);
        setMessage(error instanceof Error ? error.message : 'Failed to load player activity');
      });
  }, []);

  if (!activity && !message) {
    return <section className="page-card">Loading your matches...</section>;
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h1 className="page-title">My Matches</h1>
        <p className="page-subtitle">Everything you booked, joined, or registered for as a player.</p>
      </div>

      {message ? <p>{message}</p> : null}

      {activity ? (
        <>
          <section style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>My Bookings</h2>
            {activity.bookings.length === 0 ? <p className="page-subtitle">No bookings created yet.</p> : null}
            {activity.bookings.map((booking) => (
              <article key={booking.id} style={cardStyle}>
                <strong>{booking.resource.venue.name}</strong>
                <span>{booking.resource.name} · {booking.resource.sportId}</span>
                <span>{getCityLabel(booking.resource.venue.cityId)} · {booking.resource.venue.address}</span>
                <span>{formatWindow(booking.startTs, booking.endTs)}</span>
                <span>Booking status: {booking.status}</span>
                {booking.challenge ? <span>Challenge: {booking.challenge.status} · {booking.challenge.formatName}</span> : null}
                <div style={linkRowStyle}>
                  <a href={`/venues/${booking.resource.venue.id}`} style={linkStyle}>Open venue</a>
                  {booking.challenge ? <a href={`/challenge/${booking.challenge.id}`} style={linkStyle}>Open challenge</a> : null}
                  {booking.challenge?.conversationId ? <a href={`/chat/${booking.challenge.conversationId}`} style={linkStyle}>Open chat</a> : null}
                </div>
              </article>
            ))}
          </section>

          <section style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Joined Challenges</h2>
            {activity.challengeParticipations.length === 0 ? (
              <p className="page-subtitle">No accepted or joined challenges yet.</p>
            ) : null}
            {activity.challengeParticipations.map((challenge) => (
              <article key={challenge.id} style={cardStyle}>
                <strong>{challenge.booking.resource.venue.name}</strong>
                <span>{challenge.booking.resource.name} · {challenge.booking.resource.sportId}</span>
                <span>{getCityLabel(challenge.booking.resource.venue.cityId)} · {challenge.booking.resource.venue.address}</span>
                <span>{formatWindow(challenge.booking.startTs, challenge.booking.endTs)}</span>
                <span>Challenge status: {challenge.status}</span>
                <span>Your side: {challenge.teamSide ?? 'Pending'} · Role: {challenge.participationRole}</span>
                <span>Format: {challenge.format.name}</span>
                <div style={linkRowStyle}>
                  <a href={`/challenge/${challenge.id}`} style={linkStyle}>Open challenge</a>
                  {challenge.conversationId ? <a href={`/chat/${challenge.conversationId}`} style={linkStyle}>Open chat</a> : null}
                </div>
              </article>
            ))}
          </section>

          <section style={{ display: 'grid', gap: 10 }}>
            <h2 style={{ margin: 0 }}>Tournament Fixtures</h2>
            {activity.tournamentEntries.length === 0 ? (
              <p className="page-subtitle">No tournament entries yet.</p>
            ) : null}
            {activity.tournamentEntries.map((entry) => (
              <article key={entry.entryId} style={cardStyle}>
                <strong>{entry.tournament.sportId} at {entry.tournament.venue.name}</strong>
                <span>{getCityLabel(entry.tournament.venue.cityId)} · {entry.tournament.venue.address}</span>
                <span>Tournament status: {entry.tournament.status}</span>
                <span>Entry status: {entry.status}</span>
                <span>Starts: {new Date(entry.tournament.startTs).toLocaleString()}</span>
                {entry.fixtures.length === 0 ? (
                  <span>Fixtures not generated yet.</span>
                ) : (
                  entry.fixtures.map((fixture) => (
                    <span key={fixture.id}>
                      Round {fixture.round} · Match {fixture.matchIndex} ·{' '}
                      {fixture.startTs ? new Date(fixture.startTs).toLocaleString() : 'Unscheduled'} · {fixture.status}
                      {fixture.isAwaitingOpponent ? ' · Awaiting opponent' : ''}
                    </span>
                  ))
                )}
                <div style={linkRowStyle}>
                  <a href={`/tournament/${entry.tournament.id}`} style={linkStyle}>Open tournament</a>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}

const SIGN_IN_MESSAGE = 'Sign in from the Auth page to view your matches and bookings.';

function formatWindow(startTs: string, endTs: string): string {
  return `${new Date(startTs).toLocaleString()} - ${new Date(endTs).toLocaleTimeString()}`;
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 12,
};

const linkRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
};
