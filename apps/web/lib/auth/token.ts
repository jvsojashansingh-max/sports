export type SessionTokenPayload = {
  userId: string;
  role: 'PLAYER' | 'VENDOR_OWNER' | 'VENDOR_STAFF' | 'ADMIN';
  vendorId: string | null;
};

export function parseSessionAccessToken(token: string | null): SessionTokenPayload | null {
  if (!token) {
    return null;
  }

  try {
    const normalized = token.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = atob(padded);
    const [userId, role, vendorId] = decoded.split('|');
    if (!userId || !role) {
      return null;
    }
    if (role !== 'PLAYER' && role !== 'VENDOR_OWNER' && role !== 'VENDOR_STAFF' && role !== 'ADMIN') {
      return null;
    }
    return {
      userId,
      role,
      vendorId: vendorId || null,
    };
  } catch {
    return null;
  }
}
