'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { getAccessToken } from '@/lib/auth/session';
import { io, type Socket } from 'socket.io-client';

type ConversationRow = {
  id: string;
  type: string;
  status: string;
  challengeId: string | null;
  title: string;
};

export function InboxPanel() {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await apiRequest<{ conversations: ConversationRow[] }>('/conversations', { authenticated: true });
    setRows(res.conversations);
  }, []);

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : 'Failed to load conversations'));
  }, [refresh]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      return;
    }

    const origin = new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000');
    const socket: Socket = io(origin.origin, {
      transports: ['websocket'],
      auth: {
        token,
      },
    });

    socket.on('chat.conversation_available', () => {
      refresh().catch(() => {
        // Keep UI stable if refresh fails.
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [refresh]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Inbox</h1>
      <p className="page-subtitle">Challenge and tournament chat threads.</p>

      {error ? <p>{error}</p> : null}
      {rows.length === 0 ? <p className="page-subtitle">No conversations yet.</p> : null}
      {rows.map((row) => (
        <a key={row.id} href={`/chat/${row.id}`} style={cardStyle}>
          <strong>{row.title}</strong>
          <span>{row.type}</span>
          <span>Status: {row.status}</span>
          {row.challengeId ? <span>Challenge: {row.challengeId}</span> : null}
        </a>
      ))}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 12,
};
