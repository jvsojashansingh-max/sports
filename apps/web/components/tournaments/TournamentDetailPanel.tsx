'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';

type TournamentDetails = {
  id: string;
  sportId: string;
  status: string;
  registrationDeadline: string;
  startTs: string;
  bracketVersion: number;
  conversationId: string | null;
  venue: {
    id: string;
    name: string;
    cityId: string;
  };
  entries: Array<{
    id: string;
    captainUserId: string;
    captainLabel: string;
    status: string;
    createdAt: string;
  }>;
  matches: Array<{
    id: string;
    round: number;
    matchIndex: number;
    sideAEntryId: string | null;
    sideBEntryId: string | null;
    winnerEntryId: string | null;
    resourceId: string | null;
    resourceName: string | null;
    startTs: string | null;
    status: string;
    matchId: string | null;
    linkedMatchStatus: string | null;
    sideAEntryLabel: string | null;
    sideBEntryLabel: string | null;
    winnerEntryLabel: string | null;
  }>;
  brackets: Array<{
    id: string;
    version: number;
    bracketJson: unknown;
    createdAt: string;
  }>;
};

export function TournamentDetailPanel({ tournamentId }: { tournamentId: string }) {
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'bracket' | 'chat'>('overview');
  const [winnerByMatchId, setWinnerByMatchId] = useState<Record<string, 'A' | 'B'>>({});

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setTournament(null);
      throw new Error(SIGN_IN_MESSAGE);
    }

    const response = await apiRequest<TournamentDetails>(`/tournaments/${tournamentId}`, {
      authenticated: true,
    });
    setTournament(response);
  }, [tournamentId]);

  useEffect(() => {
    refresh().catch((err) => setMessage(resolveTournamentMessage(err)));
  }, [refresh]);

  if (!tournament && !message) {
    return <section className="page-card">Loading tournament...</section>;
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      {tournament ? (
        <>
          <h1 className="page-title">Tournament</h1>
          <p className="page-subtitle">
            {tournament.sportId} at {tournament.venue.name}
          </p>
          <p>Status: {tournament.status}</p>
          <p>Start: {formatTs(tournament.startTs)}</p>
          <p>Registration deadline: {formatTs(tournament.registrationDeadline)}</p>
          <p>Bracket version: {tournament.bracketVersion}</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={buttonStyle} onClick={() => setActiveTab('overview')}>
              Overview
            </button>
            <button style={buttonStyle} onClick={() => setActiveTab('matches')}>
              Matches
            </button>
            <button style={buttonStyle} onClick={() => setActiveTab('bracket')}>
              Bracket
            </button>
            <button style={buttonStyle} onClick={() => setActiveTab('chat')}>
              Chat
            </button>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/tournaments/${tournament.id}/register`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({ teamMode: 'SOLO' }),
                  });
                  setMessage('Registered successfully.');
                  await refresh();
                } catch (err) {
                  setMessage(resolveTournamentMessage(err));
                }
              }}
            >
              Register
            </button>
          </div>

          {activeTab === 'overview' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Entries</h2>
              {tournament.entries.length === 0 ? <p className="page-subtitle">No entries yet.</p> : null}
              {tournament.entries.map((entry) => (
                <article key={entry.id} style={cardStyle}>
                  <strong>{entry.captainLabel}</strong>
                  <span>Status: {entry.status}</span>
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'matches' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Matches</h2>
              {tournament.matches.length === 0 ? <p className="page-subtitle">No fixtures generated yet.</p> : null}
              {tournament.matches.map((match) => (
                <article key={match.id} style={cardStyle}>
                  <strong>
                    Round {match.round} • Match {match.matchIndex}
                  </strong>
                  <span>Status: {match.status}</span>
                  <span>
                    Sides: {match.sideAEntryLabel ?? 'BYE'} vs {match.sideBEntryLabel ?? 'BYE'}
                  </span>
                  <span>Winner: {match.winnerEntryLabel ?? 'Pending'}</span>
                  <span>Resource: {match.resourceName ?? 'Needs manual scheduling'}</span>
                  <span>Start: {match.startTs ? formatTs(match.startTs) : 'Unscheduled'}</span>
                  <span>Result flow: {match.matchId ? 'Linked' : 'Not linked yet'}</span>
                  <span>Linked match status: {match.linkedMatchStatus ?? 'N/A'}</span>
                  {match.matchId ? (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <select
                        value={winnerByMatchId[match.matchId!] ?? 'A'}
                        onChange={(event) => {
                          setWinnerByMatchId((current) => ({
                            ...current,
                            [match.matchId!]: event.target.value as 'A' | 'B',
                          }));
                        }}
                        style={inputStyle}
                      >
                        <option value="A">Winner A</option>
                        <option value="B">Winner B</option>
                      </select>
                      <button
                        style={buttonStyle}
                        onClick={async () => {
                          try {
                            await apiRequest(`/matches/${match.matchId}/submit-result`, {
                              method: 'POST',
                              authenticated: true,
                              idempotency: true,
                              body: JSON.stringify({
                                winnerSide: winnerByMatchId[match.matchId!] ?? 'A',
                              }),
                            });
                            setMessage('Result submitted.');
                            await refresh();
                          } catch (err) {
                            setMessage(resolveTournamentMessage(err));
                          }
                        }}
                      >
                        Submit Result
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'bracket' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Latest Bracket Snapshot</h2>
              {tournament.brackets.length === 0 ? (
                <p className="page-subtitle">No bracket generated yet.</p>
              ) : (
                <pre style={preStyle}>{JSON.stringify(tournament.brackets[0].bracketJson, null, 2)}</pre>
              )}
            </div>
          ) : null}

          {activeTab === 'chat' ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <h2 style={{ margin: 0 }}>Tournament Chat</h2>
              {tournament.conversationId ? (
                <a href={`/chat/${tournament.conversationId}`} style={linkStyle}>
                  Open tournament chat
                </a>
              ) : (
                <p className="page-subtitle">Conversation not available yet.</p>
              )}
            </div>
          ) : null}
        </>
      ) : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const SIGN_IN_MESSAGE = 'Sign in from the Auth page to view this tournament and register.';

function resolveTournamentMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Failed to load tournament';
  if (message.includes('UNAUTHENTICATED') || message.includes('Unauthorized')) {
    return SIGN_IN_MESSAGE;
  }
  return message;
}

function formatTs(value: string): string {
  return new Date(value).toLocaleString();
}

const buttonStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 8,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};

const inputStyle: React.CSSProperties = {
  height: 40,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: '0 10px',
};

const preStyle: React.CSSProperties = {
  margin: 0,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 12,
  background: 'rgba(5,22,26,0.75)',
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent)',
  textDecoration: 'underline',
};
