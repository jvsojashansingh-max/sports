'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type AvailabilityTemplate = {
  id: string;
  resourceId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  bufferMinutes: number;
};

type BlockRow = {
  id: string;
  resourceId: string;
  startTs: string;
  endTs: string;
  reason: string;
};

export function VendorSchedulePanel({ initialMatchId = '' }: { initialMatchId?: string }) {
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [templateResourceId, setTemplateResourceId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('3');
  const [startMinute, setStartMinute] = useState('360');
  const [endMinute, setEndMinute] = useState('1320');
  const [slotMinutes, setSlotMinutes] = useState('60');
  const [bufferMinutes, setBufferMinutes] = useState('0');

  const [blockResourceId, setBlockResourceId] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('Maintenance');

  const [opsMatchId, setOpsMatchId] = useState('');
  const [opsSide, setOpsSide] = useState<'A' | 'B'>('A');
  const [opsPresent, setOpsPresent] = useState(true);
  const [opsWinnerSide, setOpsWinnerSide] = useState<'A' | 'B'>('A');
  const [opsPaymentStatus, setOpsPaymentStatus] = useState<'UNKNOWN' | 'PAID' | 'UNPAID'>('UNKNOWN');
  const linkedMatchId = initialMatchId.trim();

  async function refresh() {
    const [templateRows, blockRows] = await Promise.all([
      apiRequest<AvailabilityTemplate[]>('/vendor/availability-templates', { authenticated: true }),
      apiRequest<BlockRow[]>('/vendor/blocks', { authenticated: true }),
    ]);
    setTemplates(templateRows);
    setBlocks(blockRows);
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load schedule data'));
  }, []);

  useEffect(() => {
    if (linkedMatchId) {
      setOpsMatchId(linkedMatchId);
    }
  }, [linkedMatchId]);

  async function createTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest('/vendor/availability-templates', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          resourceId: templateResourceId,
          dayOfWeek: Number(dayOfWeek),
          startMinute: Number(startMinute),
          endMinute: Number(endMinute),
          slotMinutes: Number(slotMinutes),
          bufferMinutes: Number(bufferMinutes),
        }),
      });
      setMessage('Template created.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create template');
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest('/vendor/blocks', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          resourceId: blockResourceId,
          startTs: blockStart,
          endTs: blockEnd,
          reason: blockReason,
        }),
      });
      setMessage('Block created.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create block');
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 14 }}>
      <h1 className="page-title">Vendor Schedule</h1>
      <p className="page-subtitle">Manage templates and blocked windows.</p>

      <form onSubmit={createTemplate} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Availability Template</h2>
        <input placeholder="Resource ID" value={templateResourceId} onChange={(e) => setTemplateResourceId(e.target.value)} style={inputStyle} required />
        <input placeholder="Day (0-6)" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={inputStyle} required />
        <input placeholder="Start minute (0-1439)" value={startMinute} onChange={(e) => setStartMinute(e.target.value)} style={inputStyle} required />
        <input placeholder="End minute (1-1440)" value={endMinute} onChange={(e) => setEndMinute(e.target.value)} style={inputStyle} required />
        <input placeholder="Slot minutes" value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} style={inputStyle} required />
        <input placeholder="Buffer minutes" value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} style={inputStyle} required />
        <button type="submit" style={buttonStyle}>Create Template</button>
      </form>

      <form onSubmit={createBlock} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Block Resource Window</h2>
        <input placeholder="Resource ID" value={blockResourceId} onChange={(e) => setBlockResourceId(e.target.value)} style={inputStyle} required />
        <input placeholder="Start ISO ts" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} style={inputStyle} required />
        <input placeholder="End ISO ts" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} style={inputStyle} required />
        <input placeholder="Reason" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} style={inputStyle} required />
        <button type="submit" style={buttonStyle}>Create Block</button>
      </form>

      <h2 style={{ margin: 0 }}>Templates</h2>
      {templates.map((template) => (
        <article key={template.id} style={cardStyle}>
          <strong>{template.resourceId}</strong>
          <span>
            D{template.dayOfWeek} {template.startMinute}-{template.endMinute} / {template.slotMinutes}m + {template.bufferMinutes}m
          </span>
        </article>
      ))}

      <h2 style={{ margin: 0 }}>Blocks</h2>
      {blocks.map((block) => (
        <article key={block.id} style={cardStyle}>
          <strong>{block.resourceId}</strong>
          <span>
            {block.startTs}
            {' -> '}
            {block.endTs}
          </span>
          <span>{block.reason}</span>
        </article>
      ))}

      <h2 style={{ margin: 0 }}>Match-Day Ops</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {linkedMatchId ? <p className="page-subtitle">Loaded from challenge board for match {linkedMatchId}.</p> : null}
        <input
          placeholder="Match ID"
          value={opsMatchId}
          onChange={(e) => setOpsMatchId(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={opsSide} onChange={(e) => setOpsSide(e.target.value as 'A' | 'B')} style={inputStyle}>
            <option value="A">Side A</option>
            <option value="B">Side B</option>
          </select>
          <select
            value={opsPresent ? 'YES' : 'NO'}
            onChange={(e) => setOpsPresent(e.target.value === 'YES')}
            style={inputStyle}
          >
            <option value="YES">Present</option>
            <option value="NO">Absent</option>
          </select>
          <button
            type="button"
            style={buttonStyle}
            onClick={async () => {
              try {
                await apiRequest(`/vendor/matches/${opsMatchId}/checkin`, {
                  method: 'POST',
                  authenticated: true,
                  idempotency: true,
                  body: JSON.stringify({
                    side: opsSide,
                    present: opsPresent,
                  }),
                });
                setMessage('Check-in updated.');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Failed to update check-in');
              }
            }}
          >
            Update Check-in
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={opsWinnerSide} onChange={(e) => setOpsWinnerSide(e.target.value as 'A' | 'B')} style={inputStyle}>
            <option value="A">Winner A</option>
            <option value="B">Winner B</option>
          </select>
          <button
            type="button"
            style={buttonStyle}
            onClick={async () => {
              try {
                await apiRequest(`/vendor/matches/${opsMatchId}/forfeit`, {
                  method: 'POST',
                  authenticated: true,
                  idempotency: true,
                  body: JSON.stringify({
                    winnerSide: opsWinnerSide,
                  }),
                });
                setMessage('Forfeit recorded.');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Failed to record forfeit');
              }
            }}
          >
            Mark Forfeit
          </button>
          <button
            type="button"
            style={buttonStyle}
            onClick={async () => {
              try {
                await apiRequest(`/vendor/matches/${opsMatchId}/resolve-dispute`, {
                  method: 'POST',
                  authenticated: true,
                  idempotency: true,
                  body: JSON.stringify({
                    winnerSide: opsWinnerSide,
                  }),
                });
                setMessage('Dispute resolved.');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Failed to resolve dispute');
              }
            }}
          >
            Resolve Dispute
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={opsPaymentStatus}
            onChange={(e) => setOpsPaymentStatus(e.target.value as 'UNKNOWN' | 'PAID' | 'UNPAID')}
            style={inputStyle}
          >
            <option value="UNKNOWN">UNKNOWN</option>
            <option value="PAID">PAID</option>
            <option value="UNPAID">UNPAID</option>
          </select>
          <button
            type="button"
            style={buttonStyle}
            onClick={async () => {
              try {
                await apiRequest(`/vendor/matches/${opsMatchId}/mark-payment-status`, {
                  method: 'POST',
                  authenticated: true,
                  idempotency: true,
                  body: JSON.stringify({
                    paymentStatus: opsPaymentStatus,
                  }),
                });
                setMessage('Payment status marked.');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Failed to mark payment status');
              }
            }}
          >
            Mark Payment Status
          </button>
        </div>
      </div>

      {message ? <p>{message}</p> : null}
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

const buttonStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 10,
  border: '1px solid rgba(92,224,255,0.5)',
  background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
  color: '#02161a',
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  border: '1px solid rgba(92,224,255,0.3)',
  borderRadius: 12,
  padding: 10,
};
