'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { parseSessionAccessToken } from '@/lib/auth/token';
import { io, type Socket } from 'socket.io-client';

type MessageRow = {
  id: string;
  senderUserId: string;
  body: string;
  status: 'SENT' | 'DELETED_BY_MOD' | 'DELETED_BY_USER';
  createdAt: string;
};

export function ConversationPanel({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moderationUserId, setModerationUserId] = useState('');
  const [moderationMutedUntil, setModerationMutedUntil] = useState('');
  const [deleteMessageId, setDeleteMessageId] = useState('');
  const [reportReason, setReportReason] = useState('Abusive message');

  const tokenPayload = parseSessionAccessToken(getAccessToken());
  const canModerate =
    tokenPayload?.role === 'ADMIN' ||
    tokenPayload?.role === 'VENDOR_OWNER' ||
    tokenPayload?.role === 'VENDOR_STAFF';

  const refresh = useCallback(async () => {
    const res = await apiRequest<{ messages: MessageRow[] }>(
      `/conversations/${conversationId}/messages`,
      { authenticated: true },
    );
    setMessages(res.messages);
  }, [conversationId]);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load messages'));
  }, [refresh]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const origin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? 'http://localhost:4000');
    const socket: Socket = io(origin.origin, {
      transports: ['websocket'],
      auth: {
        token,
      },
    });

    socket.on('connect', () => {
      socket.emit('chat.join_conversation', {
        conversationId,
      });
    });

    socket.on(
      'chat.message_created',
      (incoming: {
        id: string;
        conversationId: string;
        senderUserId: string;
        body: string;
        status: 'SENT' | 'DELETED_BY_MOD' | 'DELETED_BY_USER';
        createdAt: string;
      }) => {
        if (incoming.conversationId !== conversationId) {
          return;
        }
        setMessages((current) => {
          if (current.some((row) => row.id === incoming.id)) {
            return current;
          }
          return [...current, incoming].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
        });
      },
    );
    socket.on(
      'chat.message_updated',
      (incoming: {
        id: string;
        conversationId: string;
        senderUserId: string;
        body: string;
        status: 'SENT' | 'DELETED_BY_MOD' | 'DELETED_BY_USER';
        createdAt: string;
      }) => {
        if (incoming.conversationId !== conversationId) {
          return;
        }
        setMessages((current) =>
          current.map((row) => (row.id === incoming.id ? { ...row, ...incoming } : row)),
        );
      },
    );

    return () => {
      socket.emit('chat.leave_conversation', {
        conversationId,
      });
      socket.disconnect();
    };
  }, [conversationId]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 10 }}>
      <h1 className="page-title">Chat {conversationId}</h1>
      <p className="page-subtitle">Challenge conversation chat.</p>

      {error ? <p>{error}</p> : null}
      <div style={{ display: 'grid', gap: 8 }}>
        {messages.map((row) => (
          <article key={row.id} style={bubbleStyle}>
            <strong>{row.senderUserId}</strong>
            <span>{row.status === 'SENT' ? row.body : '[Message removed]'}</span>
            <span>{new Date(row.createdAt).toLocaleTimeString()}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={smallButtonStyle}
                onClick={async () => {
                  try {
                    await apiRequest(`/messages/${row.id}/report`, {
                      method: 'POST',
                      authenticated: true,
                      idempotency: true,
                      body: JSON.stringify({
                        reason: reportReason,
                      }),
                    });
                    setMessage('Message reported.');
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Report failed');
                  }
                }}
              >
                Report
              </button>
            </div>
          </article>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        style={textAreaStyle}
        placeholder="Type a message"
      />
      <button
        style={buttonStyle}
        onClick={async () => {
          try {
            setMessage(null);
            await apiRequest(`/conversations/${conversationId}/messages`, {
              method: 'POST',
              authenticated: true,
              idempotency: true,
              body: JSON.stringify({
                body,
              }),
            });
            setBody('');
            setMessage('Sent.');
            await refresh();
          } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Failed to send');
          }
        }}
      >
        Send
      </button>
      <input
        value={reportReason}
        onChange={(event) => setReportReason(event.target.value)}
        style={inputStyle}
        placeholder="Report reason"
      />
      {canModerate ? (
        <div style={moderationSectionStyle}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Moderation</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={moderationUserId}
              onChange={(event) => setModerationUserId(event.target.value)}
              placeholder="Participant userId"
              style={inputStyle}
            />
            <input
              type="datetime-local"
              value={moderationMutedUntil}
              onChange={(event) => setModerationMutedUntil(event.target.value)}
              style={inputStyle}
            />
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/vendor/conversations/${conversationId}/mute`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      userId: moderationUserId,
                      mutedUntilTs: moderationMutedUntil
                        ? new Date(moderationMutedUntil).toISOString()
                        : undefined,
                    }),
                  });
                  setMessage('Participant muted.');
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Mute failed');
                }
              }}
            >
              Mute Participant
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={deleteMessageId}
              onChange={(event) => setDeleteMessageId(event.target.value)}
              placeholder="Message ID"
              style={inputStyle}
            />
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/vendor/messages/${deleteMessageId}/delete`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({}),
                  });
                  setMessage('Message deleted by moderator.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Delete failed');
                }
              }}
            >
              Delete Message
            </button>
          </div>
        </div>
      ) : null}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const textAreaStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: 10,
  minHeight: 90,
};

const buttonStyle: React.CSSProperties = {
  height: 42,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};

const bubbleStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};

const moderationSectionStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  border: '1px solid rgba(92,224,255,0.25)',
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

const smallButtonStyle: React.CSSProperties = {
  height: 30,
  borderRadius: 8,
  border: '1px solid rgba(92,224,255,0.35)',
  background: 'rgba(5,22,26,0.75)',
  color: 'var(--text)',
  padding: '0 10px',
};
