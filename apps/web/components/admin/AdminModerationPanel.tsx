'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type MessageReportRow = {
  id: string;
  messageId: string;
  reportedByUserId: string;
  reason: string;
  status: 'OPEN' | 'ACTIONED' | 'DISMISSED';
};

export function AdminModerationPanel() {
  const [rows, setRows] = useState<MessageReportRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const reports = await apiRequest<MessageReportRow[]>('/admin/message-reports', { authenticated: true });
    setRows(reports);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load reports'));
  }, []);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Admin Moderation</h1>
      <p className="page-subtitle">Review player-reported messages.</p>
      {rows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <strong>{row.id}</strong>
          <span>Message: {row.messageId}</span>
          <span>By: {row.reportedByUserId}</span>
          <span>Reason: {row.reason}</span>
          <span>Status: {row.status}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/admin/message-reports/${row.id}/review`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      status: 'ACTIONED',
                    }),
                  });
                  setMessage('Report actioned.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Review failed');
                }
              }}
            >
              Action
            </button>
            <button
              style={buttonStyle}
              onClick={async () => {
                try {
                  await apiRequest(`/admin/message-reports/${row.id}/review`, {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      status: 'DISMISSED',
                    }),
                  });
                  setMessage('Report dismissed.');
                  await refresh();
                } catch (err) {
                  setMessage(err instanceof Error ? err.message : 'Review failed');
                }
              }}
            >
              Dismiss
            </button>
          </div>
        </article>
      ))}
      {message ? <p>{message}</p> : null}
    </section>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};

const buttonStyle: React.CSSProperties = {
  height: 36,
  borderRadius: 8,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
  padding: '0 12px',
};
