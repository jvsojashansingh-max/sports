import type { UserRole } from '../policy/can';

export type RequestUser = {
  id: string;
  role: UserRole;
  vendorId: string | null;
  deviceId: string | null;
};

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
