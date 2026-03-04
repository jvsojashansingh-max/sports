import { isUserRole, type UserRole } from '../policy/can';

export type ParsedAccessToken = {
  id: string;
  role: UserRole;
  vendorId: string | null;
};

export function parseAccessToken(token: string): ParsedAccessToken | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [id, roleCandidate, vendorId] = decoded.split('|');
    if (!id || !roleCandidate || !isUserRole(roleCandidate)) {
      return null;
    }

    return {
      id,
      role: roleCandidate,
      vendorId: vendorId || null,
    };
  } catch {
    return null;
  }
}

export function isUuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
}
