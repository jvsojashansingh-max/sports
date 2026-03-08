'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type ChallengeDetails = {
  id: string;
  status: string;
  joinDeadlineTs: string;
  checkinOpenTs: string;
  inviteCandidates: Array<{
    userId: string;
    label: string;
  }>;
  booking: {
    id: string;
    startTs: string;
    resource: {
      id: string;
      name: string;
      venue: {
        id: string;
        name: string;
        address: string;
      };
    };
  };
  format: {
    id: string;
    name: string;
    teamSize: number;
  };
  teams: Array<{
    id: string;
    side: 'A' | 'B';
    captainUserId: string;
    captainLabel: string;
    isOpenFill: boolean;
    members: Array<{
      userId: string;
      label: string;
      status: string;
    }>;
  }>;
  conversation: {
    id: string;
    status: string;
  } | null;
};

export function ChallengePanel({ challengeId }: { challengeId: string }) {
  const [challenge, setChallenge] = useState<ChallengeDetails | null>(null);
  const [inviteSelectionByTeamId, setInviteSelectionByTeamId] = useState<Record<string, string>>({});
  const [removeSelectionByTeamId, setRemoveSelectionByTeamId] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await apiRequest<ChallengeDetails>(`/challenges/${challengeId}`, {
      authenticated: true,
    });
    setChallenge(response);
  }, [challengeId]);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load challenge'));
  }, [refresh]);

  const inviteCandidates = useMemo(() => challenge?.inviteCandidates ?? [], [challenge]);

  if (!challenge && !error) {
    return <section className="page-card">Loading challenge...</section>;
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 10 }}>
      {error ? <p>{error}</p> : null}
      {challenge ? (
        <>
          <h1 className="page-title">Challenge</h1>
          <p className="page-subtitle">{challenge.booking.resource.venue.name}</p>
          <p>{challenge.booking.resource.venue.address}</p>
          <p>Resource: {challenge.booking.resource.name}</p>
          <p>Format: {challenge.format.name}</p>
          <p>Start: {new Date(challenge.booking.startTs).toLocaleString()}</p>
          <p>Status: {challenge.status}</p>
          <p>Join deadline: {new Date(challenge.joinDeadlineTs).toLocaleString()}</p>
          <p>Check-in opens: {new Date(challenge.checkinOpenTs).toLocaleString()}</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  setMessage(null);
                  await apiRequest(`/challenges/${challenge.id}/accept`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({}),
                  });
                  setMessage('Opponent accepted.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Accept failed');
                }
              }}
            >
              Accept Challenge
            </button>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  setMessage(null);
                  const res = await apiRequest<{ conversationId: string; matchId: string }>(
                    `/challenges/${challenge.id}/confirm-opponent`,
                    {
                      method: 'POST',
                      authenticated: true,
                      idempotency: true,
                      body: JSON.stringify({}),
                    },
                  );
                  setMessage('Opponent confirmed. Match is ready.');
                  if (res.conversationId) {
                    await refresh();
                  }
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Confirm failed');
                }
              }}
            >
              Captain Confirm
            </button>
          </div>

          {challenge.teams.map((team) => {
            const removableMembers = team.members.filter((member) => member.userId !== team.captainUserId);
            const selectedInviteUserId = inviteSelectionByTeamId[team.id] ?? '';
            const selectedRemoveUserId = removeSelectionByTeamId[team.id] ?? '';

            return (
              <article key={team.id} style={cardStyle}>
                <strong>Team {team.side}</strong>
                <span>Captain: {team.captainLabel}</span>
                <span>Open fill: {team.isOpenFill ? 'Yes' : 'No'}</span>
                <span>
                  Members:{' '}
                  {team.members.length > 0
                    ? team.members.map((member) => `${member.label} (${member.status})`).join(', ')
                    : 'None'}
                </span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={selectedInviteUserId}
                    onChange={(event) =>
                      setInviteSelectionByTeamId((current) => ({
                        ...current,
                        [team.id]: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Invite a player</option>
                    {inviteCandidates.map((candidate) => (
                      <option key={candidate.userId} value={candidate.userId}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                  <button
                    style={buttonStyle}
                    disabled={!selectedInviteUserId}
                    onClick={async () => {
                      try {
                        await apiRequest(`/teams/${team.id}/invite`, {
                          method: 'POST',
                          authenticated: true,
                          idempotency: true,
                          body: JSON.stringify({
                            userId: selectedInviteUserId,
                          }),
                        });
                        setMessage('Invite sent.');
                        setInviteSelectionByTeamId((current) => ({
                          ...current,
                          [team.id]: '',
                        }));
                        await refresh();
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : 'Invite failed');
                      }
                    }}
                  >
                    Invite
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    value={selectedRemoveUserId}
                    onChange={(event) =>
                      setRemoveSelectionByTeamId((current) => ({
                        ...current,
                        [team.id]: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="">Remove a member</option>
                    {removableMembers.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.label} ({member.status})
                      </option>
                    ))}
                  </select>
                  <button
                    style={buttonStyle}
                    disabled={!selectedRemoveUserId}
                    onClick={async () => {
                      try {
                        await apiRequest(`/teams/${team.id}/remove`, {
                          method: 'POST',
                          authenticated: true,
                          idempotency: true,
                          body: JSON.stringify({
                            userId: selectedRemoveUserId,
                          }),
                        });
                        setMessage('Member removed.');
                        setRemoveSelectionByTeamId((current) => ({
                          ...current,
                          [team.id]: '',
                        }));
                        await refresh();
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : 'Remove failed');
                      }
                    }}
                  >
                    Remove
                  </button>
                  <button
                    style={buttonStyle}
                    onClick={async () => {
                      try {
                        await apiRequest(`/teams/${team.id}/join`, {
                          method: 'POST',
                          authenticated: true,
                          idempotency: true,
                          body: JSON.stringify({}),
                        });
                        setMessage('Joined team.');
                        await refresh();
                      } catch (err) {
                        setMessage(err instanceof Error ? err.message : 'Join failed');
                      }
                    }}
                  >
                    Join Open Team
                  </button>
                </div>
              </article>
            );
          })}

          {challenge.conversation ? (
            <a href={`/chat/${challenge.conversation.id}`} style={cardStyle}>
              Open Challenge Chat
            </a>
          ) : (
            <p className="page-subtitle">Chat becomes available after captain confirmation.</p>
          )}
        </>
      ) : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const buttonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};

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
  gap: 6,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};
