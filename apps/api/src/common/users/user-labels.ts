import { IdentityProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type UserLabelSeed = {
  id: string;
  displayName: string | null;
  role: string;
};

export async function buildUserLabelMap(
  prisma: PrismaService,
  userIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter((value) => value.trim().length > 0)));
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const [users, identities] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: {
          in: uniqueIds,
        },
      },
      select: {
        id: true,
        displayName: true,
        role: true,
      },
    }),
    prisma.userIdentity.findMany({
      where: {
        userId: {
          in: uniqueIds,
        },
        provider: IdentityProvider.PHONE_OTP,
        deletedAt: null,
      },
      select: {
        userId: true,
        providerSubject: true,
        isPrimary: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    }),
  ]);

  const phoneByUserId = new Map<string, string>();
  for (const identity of identities) {
    if (!phoneByUserId.has(identity.userId)) {
      phoneByUserId.set(identity.userId, identity.providerSubject);
    }
  }

  const labelMap = new Map<string, string>();
  for (const user of users) {
    labelMap.set(
      user.id,
      resolveUserLabel({
        id: user.id,
        displayName: user.displayName,
        role: user.role,
        phone: phoneByUserId.get(user.id) ?? null,
      }),
    );
  }

  return labelMap;
}

export function resolveUserLabel(params: UserLabelSeed & { phone?: string | null }): string {
  if (params.displayName?.trim()) {
    return params.displayName.trim();
  }
  if (params.phone?.trim()) {
    return params.phone.trim();
  }
  if (params.role === 'VENDOR_OWNER') {
    return 'Vendor owner';
  }
  if (params.role === 'VENDOR_STAFF') {
    return 'Vendor staff';
  }
  if (params.role === 'ADMIN') {
    return 'Admin';
  }
  return 'Player';
}
