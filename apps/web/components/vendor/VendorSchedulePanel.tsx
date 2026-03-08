'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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

type ResourceRow = {
  id: string;
  venueId: string;
  sportId: string;
  name: string;
  status: string;
};

type VenueRow = {
  id: string;
  name: string;
};

type ManagedChallengeRow = {
  id: string;
  booking: {
    startTs: string;
    resource: {
      name: string;
      venue: {
        name: string;
      };
    };
  };
  match: {
    id: string;
    status: string;
  } | null;
};

const DAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const SLOT_OPTIONS = [30, 45, 60, 90, 120];
const BUFFER_OPTIONS = [0, 5, 10, 15, 20];

export function VendorSchedulePanel({ initialMatchId = '' }: { initialMatchId?: string }) {
  const [templates, setTemplates] = useState<AvailabilityTemplate[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [managedChallenges, setManagedChallenges] = useState<ManagedChallengeRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const [templateResourceId, setTemplateResourceId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('3');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('22:00');
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

  const refresh = useCallback(async () => {
    const [templateRows, blockRows, resourceRows, venueRows, challengeRows] = await Promise.all([
      apiRequest<AvailabilityTemplate[]>('/vendor/availability-templates', { authenticated: true }),
      apiRequest<BlockRow[]>('/vendor/blocks', { authenticated: true }),
      apiRequest<ResourceRow[]>('/vendor/resources', { authenticated: true }),
      apiRequest<VenueRow[]>('/vendor/venues', { authenticated: true }),
      apiRequest<ManagedChallengeRow[]>('/vendor/challenges', { authenticated: true }),
    ]);
    setTemplates(templateRows);
    setBlocks(blockRows);
    setResources(resourceRows);
    setVenues(venueRows);
    setManagedChallenges(challengeRows);
    if (!templateResourceId && resourceRows.length > 0) {
      setTemplateResourceId(resourceRows[0].id);
    }
    if (!blockResourceId && resourceRows.length > 0) {
      setBlockResourceId(resourceRows[0].id);
    }
  }, [blockResourceId, templateResourceId]);

  useEffect(() => {
    refresh().catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load schedule data'));
  }, [refresh]);

  const venueNameById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue.name])), [venues]);

  const resourceLabelById = useMemo(() => {
    return new Map(
      resources.map((resource) => [
        resource.id,
        `${resource.name} · ${resource.sportId} · ${venueNameById.get(resource.venueId) ?? 'Venue'}`,
      ]),
    );
  }, [resources, venueNameById]);

  const matchOptions = useMemo(() => {
    return managedChallenges
      .filter((row): row is ManagedChallengeRow & { match: { id: string; status: string } } => Boolean(row.match))
      .map((row) => ({
        value: row.match.id,
        label: `${row.booking.resource.venue.name} · ${row.booking.resource.name} · ${new Date(row.booking.startTs).toLocaleString()} · ${row.match.status}`,
      }));
  }, [managedChallenges]);

  useEffect(() => {
    if (linkedMatchId) {
      setOpsMatchId(linkedMatchId);
      return;
    }
    if (!opsMatchId && matchOptions.length > 0) {
      setOpsMatchId(matchOptions[0].value);
    }
  }, [linkedMatchId, matchOptions, opsMatchId]);

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
          startMinute: timeToMinutes(startTime),
          endMinute: timeToMinutes(endTime),
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
      const startIso = localDateTimeToIso(blockStart);
      const endIso = localDateTimeToIso(blockEnd);
      if (!startIso || !endIso) {
        setMessage('Choose a valid block window.');
        return;
      }
      await apiRequest('/vendor/blocks', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          resourceId: blockResourceId,
          startTs: startIso,
          endTs: endIso,
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
      <p className="page-subtitle">Manage templates, block windows, and run match-day actions without raw IDs.</p>

      <form onSubmit={createTemplate} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Availability Template</h2>
        <select value={templateResourceId} onChange={(e) => setTemplateResourceId(e.target.value)} style={inputStyle} required>
          <option value="">Select resource</option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resourceLabelById.get(resource.id) ?? resource.name}
            </option>
          ))}
        </select>
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={inputStyle} required>
          {DAY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div style={gridRowStyle}>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} required />
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle} required />
        </div>
        <div style={gridRowStyle}>
          <select value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} style={inputStyle} required>
            {SLOT_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                Slot {minutes} minutes
              </option>
            ))}
          </select>
          <select value={bufferMinutes} onChange={(e) => setBufferMinutes(e.target.value)} style={inputStyle} required>
            {BUFFER_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                Buffer {minutes} minutes
              </option>
            ))}
          </select>
        </div>
        <button type="submit" style={buttonStyle} disabled={!templateResourceId}>
          Create Template
        </button>
      </form>

      <form onSubmit={createBlock} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Block Resource Window</h2>
        <select value={blockResourceId} onChange={(e) => setBlockResourceId(e.target.value)} style={inputStyle} required>
          <option value="">Select resource</option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resourceLabelById.get(resource.id) ?? resource.name}
            </option>
          ))}
        </select>
        <input type="datetime-local" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} style={inputStyle} required />
        <input type="datetime-local" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} style={inputStyle} required />
        <input placeholder="Reason" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} style={inputStyle} required />
        <button type="submit" style={buttonStyle} disabled={!blockResourceId}>
          Create Block
        </button>
      </form>

      <h2 style={{ margin: 0 }}>Templates</h2>
      {templates.length === 0 ? <p className="page-subtitle">No availability templates yet.</p> : null}
      {templates.map((template) => (
        <article key={template.id} style={cardStyle}>
          <strong>{resourceLabelById.get(template.resourceId) ?? 'Resource'}</strong>
          <span>
            {DAY_OPTIONS.find((option) => option.value === template.dayOfWeek)?.label ?? `Day ${template.dayOfWeek}`}
            {' · '}
            {minutesToTime(template.startMinute)}-{minutesToTime(template.endMinute)}
          </span>
          <span>
            Slot {template.slotMinutes}m + buffer {template.bufferMinutes}m
          </span>
        </article>
      ))}

      <h2 style={{ margin: 0 }}>Blocks</h2>
      {blocks.length === 0 ? <p className="page-subtitle">No blocked windows yet.</p> : null}
      {blocks.map((block) => (
        <article key={block.id} style={cardStyle}>
          <strong>{resourceLabelById.get(block.resourceId) ?? 'Resource'}</strong>
          <span>
            {new Date(block.startTs).toLocaleString()}
            {' -> '}
            {new Date(block.endTs).toLocaleString()}
          </span>
          <span>{block.reason}</span>
        </article>
      ))}

      <h2 style={{ margin: 0 }}>Match-Day Ops</h2>
      <div style={{ display: 'grid', gap: 8 }}>
        {linkedMatchId ? <p className="page-subtitle">Loaded from challenge board. Match is preselected below.</p> : null}
        <select value={opsMatchId} onChange={(e) => setOpsMatchId(e.target.value)} style={inputStyle}>
          <option value="">Select match</option>
          {matchOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {matchOptions.length === 0 ? <p className="page-subtitle">No confirmed matches yet. Confirm a challenge first.</p> : null}
        <div style={gridRowStyle}>
          <select value={opsSide} onChange={(e) => setOpsSide(e.target.value as 'A' | 'B')} style={inputStyle}>
            <option value="A">Side A</option>
            <option value="B">Side B</option>
          </select>
          <select value={opsPresent ? 'YES' : 'NO'} onChange={(e) => setOpsPresent(e.target.value === 'YES')} style={inputStyle}>
            <option value="YES">Present</option>
            <option value="NO">Absent</option>
          </select>
          <button
            type="button"
            style={buttonStyle}
            disabled={!opsMatchId}
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
        <div style={gridRowStyle}>
          <select value={opsWinnerSide} onChange={(e) => setOpsWinnerSide(e.target.value as 'A' | 'B')} style={inputStyle}>
            <option value="A">Winner A</option>
            <option value="B">Winner B</option>
          </select>
          <button
            type="button"
            style={buttonStyle}
            disabled={!opsMatchId}
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
            disabled={!opsMatchId}
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
        <div style={gridRowStyle}>
          <select
            value={opsPaymentStatus}
            onChange={(e) => setOpsPaymentStatus(e.target.value as 'UNKNOWN' | 'PAID' | 'UNPAID')}
            style={inputStyle}
          >
            <option value="UNKNOWN">Payment unknown</option>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
          </select>
          <button
            type="button"
            style={buttonStyle}
            disabled={!opsMatchId}
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
                setMessage('Payment status updated.');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Failed to update payment status');
              }
            }}
          >
            Update Payment
          </button>
        </div>
      </div>

      {message ? <p>{message}</p> : null}
    </section>
  );
}

function timeToMinutes(value: string): number {
  const [hour = '0', minute = '0'] = value.split(':');
  return Number(hour) * 60 + Number(minute);
}

function minutesToTime(value: number): string {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (value % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
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

const gridRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
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
