'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';
import { DEFAULT_CITY_ID, INDIA_DEMO_CITIES, getCityLabel } from '@/lib/indiaCities';
import { VendorRegisterPanel } from './VendorRegisterPanel';

type Venue = {
  id: string;
  name: string;
  cityId: string;
  status: string;
};

type Resource = {
  id: string;
  venueId: string;
  name: string;
  sportId: string;
  capacity: number;
  status: string;
};

type MeResponse = {
  id: string;
  role: 'PLAYER' | 'VENDOR_OWNER' | 'VENDOR_STAFF' | 'ADMIN';
  vendorId: string | null;
  defaultCityId: string | null;
};

export function VendorSetupPanel() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [cityId, setCityId] = useState(DEFAULT_CITY_ID);
  const [address, setAddress] = useState('');

  const [resourceVenueId, setResourceVenueId] = useState('');
  const [resourceName, setResourceName] = useState('');
  const [sportId, setSportId] = useState('BADMINTON');
  const [capacity, setCapacity] = useState('2');

  const refresh = useCallback(async () => {
    const profile = await apiRequest<MeResponse>('/me', { authenticated: true });
    setMe(profile);

    const isVendor =
      profile.role === 'VENDOR_OWNER' ||
      profile.role === 'VENDOR_STAFF' ||
      Boolean(profile.vendorId);

    if (!isVendor) {
      setVenues([]);
      setResources([]);
      return;
    }

    const [venueList, resourceList] = await Promise.all([
      apiRequest<Venue[]>('/vendor/venues', { authenticated: true }),
      apiRequest<Resource[]>('/vendor/resources', { authenticated: true }),
    ]);
    setVenues(venueList);
    setResources(resourceList);
    setResourceVenueId((current) => {
      if (current || venueList.length === 0) {
        return current;
      }
      return venueList[0].id;
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh()
      .catch((err) => setMessage(err instanceof Error ? err.message : 'Failed to load vendor data'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const selectedCity = INDIA_DEMO_CITIES.find((city) => city.id === cityId) ?? INDIA_DEMO_CITIES[0];
  const stateId = selectedCity.stateId;
  const isVendor =
    me?.role === 'VENDOR_OWNER' ||
    me?.role === 'VENDOR_STAFF' ||
    Boolean(me?.vendorId);

  if (loading) {
    return <section className="page-card">Loading vendor setup...</section>;
  }

  if (!isVendor) {
    return <VendorRegisterPanel />;
  }

  async function submitVenue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const createdVenue = await apiRequest<Venue>('/vendor/venues', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({ name, cityId, stateId, address }),
      });
      setMessage(
        createdVenue.status === 'LIVE'
          ? 'Venue created and published live.'
          : `Venue created in ${createdVenue.status.toLowerCase()} status.`,
      );
      setName('');
      setAddress('');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create venue');
    }
  }

  async function submitResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiRequest('/vendor/resources', {
        method: 'POST',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({
          venueId: resourceVenueId,
          name: resourceName,
          sportId,
          capacity: Number(capacity),
        }),
      });
      setMessage('Resource created.');
      setResourceName('');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create resource');
    }
  }

  async function updateVenueStatus(venueId: string, status: 'DRAFT' | 'LIVE') {
    try {
      await apiRequest(`/vendor/venues/${venueId}`, {
        method: 'PATCH',
        authenticated: true,
        idempotency: true,
        body: JSON.stringify({ status }),
      });
      setMessage(status === 'LIVE' ? 'Venue published live.' : 'Venue moved back to draft.');
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to update venue status');
    }
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Vendor Setup</h1>
      <p className="page-subtitle">Create venues and resources for the 5 India demo cities. Stub mode auto-approves vendor signup.</p>

      <form onSubmit={submitVenue} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Create Venue</h2>
        <input placeholder="Venue name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} required />
        <select value={cityId} onChange={(e) => setCityId(e.target.value)} style={inputStyle} required>
          {INDIA_DEMO_CITIES.map((city) => (
            <option key={city.id} value={city.id}>
              {city.code} - {city.name}
            </option>
          ))}
        </select>
        <input value={selectedCity.stateName} style={inputStyle} readOnly />
        <input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} style={inputStyle} required />
        <button type="submit" style={buttonStyle}>Create Venue</button>
      </form>

      <form onSubmit={submitResource} style={{ display: 'grid', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Create Resource</h2>
        <select value={resourceVenueId} onChange={(e) => setResourceVenueId(e.target.value)} style={inputStyle} required>
          <option value="">Select venue</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>{venue.name}</option>
          ))}
        </select>
        <input placeholder="Resource name" value={resourceName} onChange={(e) => setResourceName(e.target.value)} style={inputStyle} required />
        <select value={sportId} onChange={(e) => setSportId(e.target.value)} style={inputStyle}>
          <option value="BADMINTON">BADMINTON</option>
          <option value="PICKLEBALL">PICKLEBALL</option>
          <option value="TENNIS">TENNIS</option>
          <option value="BASKETBALL">BASKETBALL</option>
          <option value="TABLE_TENNIS">TABLE_TENNIS</option>
        </select>
        <input placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} style={inputStyle} required />
        <button type="submit" style={buttonStyle}>Create Resource</button>
      </form>

      <h2 style={{ margin: 0 }}>Your Venues</h2>
      {venues.map((venue) => (
        <article key={venue.id} style={cardStyle}>
          <strong>{venue.name}</strong>
          <span>{getCityLabel(venue.cityId)}</span>
          <span>{venue.status}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {venue.status !== 'LIVE' ? (
              <button type="button" style={buttonStyle} onClick={() => updateVenueStatus(venue.id, 'LIVE')}>
                Publish Live
              </button>
            ) : (
              <button type="button" style={buttonStyle} onClick={() => updateVenueStatus(venue.id, 'DRAFT')}>
                Move To Draft
              </button>
            )}
          </div>
        </article>
      ))}

      <h2 style={{ margin: 0 }}>Your Resources</h2>
      {resources.map((resource) => (
        <article key={resource.id} style={cardStyle}>
          <strong>{resource.name}</strong>
          <span>{resource.sportId}</span>
          <span>Capacity: {resource.capacity}</span>
        </article>
      ))}

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
