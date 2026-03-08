'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api/client';

type VendorRow = {
  id: string;
  ownerUserId: string;
  ownerLabel: string;
  status: string;
  businessName: string;
  approvedAt: string | null;
  createdAt: string;
};

export function AdminVendorsPanel() {
  const [rows, setRows] = useState<VendorRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('PENDING_APPROVAL');

  useEffect(() => {
    fetchRows(statusFilter).then(setRows).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    });
  }, [statusFilter]);

  async function updateStatus(vendorId: string, action: 'approve' | 'reject') {
    await apiRequest(`/admin/vendors/${vendorId}/${action}`, {
      method: 'POST',
      authenticated: true,
      idempotency: true,
      body: JSON.stringify({}),
    });
    const updated = await fetchRows(statusFilter);
    setRows(updated);
  }

  return (
    <section className="page-card" style={{ display: 'grid', gap: 12 }}>
      <h1 className="page-title">Admin Vendor Queue</h1>
      <p className="page-subtitle">Approve or reject vendor applications.</p>

      <select
        value={statusFilter}
        onChange={(event) => setStatusFilter(event.target.value)}
        style={{ ...inputStyle, height: 40 }}
      >
        <option value="PENDING_APPROVAL">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="SUSPENDED">Suspended</option>
      </select>

      {error ? <p>{error}</p> : null}

      {rows.map((row) => (
        <article key={row.id} style={cardStyle}>
          <strong>{row.businessName}</strong>
          <span>Status: {row.status}</span>
          <span>Owner: {row.ownerLabel}</span>
          {statusFilter === 'PENDING_APPROVAL' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={buttonStyle} onClick={() => updateStatus(row.id, 'approve')}>
                Approve
              </button>
              <button style={buttonStyle} onClick={() => updateStatus(row.id, 'reject')}>
                Reject
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}

async function fetchRows(status: string): Promise<VendorRow[]> {
  const response = await apiRequest<{ id: string; ownerUserId: string; ownerLabel: string; status: string; businessName: string; approvedAt: string | null; createdAt: string; }[]>(
    `/admin/vendors?status=${encodeURIComponent(status)}`,
    {
      method: 'GET',
      authenticated: true,
    },
  );
  return response;
}

const inputStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(92, 224, 255, 0.4)',
  background: 'rgba(5, 22, 26, 0.75)',
  color: 'var(--text)',
  padding: '0 12px',
};

const buttonStyle: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: '1px solid rgba(92, 224, 255, 0.5)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  display: 'grid',
  gap: 6,
  border: '1px solid rgba(92, 224, 255, 0.25)',
  borderRadius: 12,
  padding: 10,
};
