'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type VenueDetails = {
  id: string;
  name: string;
  address: string;
  paymentInstructions: string | null;
  paymentMode: string;
  vendorPaymentLink: string | null;
  resources: Array<{
    id: string;
    name: string;
    sportId: string;
    capacity: number;
    status: string;
  }>;
};

type AvailabilityResponse = {
  resources: Array<{
    resourceId: string;
    slots: Array<{
      startTs: string;
      endTs: string;
      status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED';
    }>;
  }>;
};

export function VenueDetailsPanel({ venueId }: { venueId: string }) {
  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [holdResourceId, setHoldResourceId] = useState('');
  const [formatId, setFormatId] = useState('');
  const [holdStart, setHoldStart] = useState('');
  const [holdMessage, setHoldMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<VenueDetails>(`/venues/${venueId}`, { authenticated: true })
      .then((response) => {
        setVenue(response);
        setHoldResourceId((current) => current || response.resources[0]?.id || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch venue'));
  }, [venueId]);

  useEffect(() => {
    apiRequest<AvailabilityResponse>(`/venues/${venueId}/availability?date=${encodeURIComponent(date)}`, {
      authenticated: true,
    })
      .then(setAvailability)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch availability'));
  }, [venueId, date]);

  return (
    <section className="page-card" style={{ display: 'grid', gap: 10 }}>
      {!venue && !error ? <p className="page-subtitle">Loading venue details...</p> : null}
      {error ? <p>{error}</p> : null}
      {venue ? (
        <>
          <h1 className="page-title">{venue.name}</h1>
          <p>{venue.address}</p>
          <p>{venue.paymentInstructions || 'Payment required (handled by organizer)'}</p>
          <p>Mode: {venue.paymentMode}</p>
          {venue.vendorPaymentLink ? <p>Vendor link: {venue.vendorPaymentLink}</p> : null}
          <h2 style={{ margin: 0 }}>Resources</h2>
          {venue.resources.map((resource) => (
            <article key={resource.id} style={cardStyle}>
              <strong>{resource.name}</strong>
              <span>{resource.sportId}</span>
              <span>Capacity: {resource.capacity}</span>
            </article>
          ))}
          <h2 style={{ margin: 0 }}>Availability</h2>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} />
          {availability?.resources.map((row) => (
            <article key={row.resourceId} style={cardStyle}>
              <strong>Resource: {row.resourceId}</strong>
              {row.slots.slice(0, 8).map((slot) => (
                <span key={`${slot.startTs}-${slot.endTs}`}>
                  {slot.startTs.slice(11, 16)}-{slot.endTs.slice(11, 16)} {slot.status}
                </span>
              ))}
            </article>
          ))}
          <h2 style={{ margin: 0 }}>Create Challenge</h2>
          <select value={holdResourceId} onChange={(event) => setHoldResourceId(event.target.value)} style={inputStyle}>
            {venue.resources.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.name} ({resource.sportId})
              </option>
            ))}
          </select>
          <input
            value={formatId}
            onChange={(event) => setFormatId(event.target.value)}
            style={inputStyle}
            placeholder="Format ID (create from Vendor Formats)"
          />
          <input
            type="datetime-local"
            value={holdStart}
            onChange={(event) => setHoldStart(event.target.value)}
            style={inputStyle}
          />
          <button
            style={buttonStyle}
            onClick={async () => {
              try {
                setHoldMessage(null);
                if (!holdResourceId || !holdStart || !formatId) {
                  setHoldMessage('Select resource, format, and start time.');
                  return;
                }
                const startTs = new Date(holdStart).toISOString();
                const challenge = await apiRequest<{
                  challengeId: string;
                  bookingId: string;
                  joinDeadlineTs: string;
                  checkinOpenTs: string;
                }>(
                  '/challenges',
                  {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({
                      venueId,
                      resourceId: holdResourceId,
                      startTs,
                      sportId: venue.resources.find((resource) => resource.id === holdResourceId)?.sportId,
                      formatId,
                      teamMode: 'OWN_TEAM',
                    }),
                  },
                );
                setHoldMessage(`Challenge created: ${challenge.challengeId}`);
              } catch (err) {
                setHoldMessage(err instanceof Error ? err.message : 'Failed to create challenge');
              }
            }}
          >
            Create Challenge
          </button>
          <button
            style={buttonStyle}
            onClick={async () => {
              try {
                const res = await apiRequest<{ conversationId: string }>(
                  `/venues/${venueId}/support-conversation`,
                  {
                    method: 'POST',
                    authenticated: true,
                    idempotency: true,
                    body: JSON.stringify({}),
                  },
                );
                window.location.href = `/chat/${res.conversationId}`;
              } catch (err) {
                setHoldMessage(err instanceof Error ? err.message : 'Failed to open support chat');
              }
            }}
          >
            Message Venue Support
          </button>
          {holdMessage ? <p>{holdMessage}</p> : null}
        </>
      ) : null}
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
