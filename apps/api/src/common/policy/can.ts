export const userRoles = ['PLAYER', 'VENDOR_OWNER', 'VENDOR_STAFF', 'ADMIN'] as const;

export type UserRole = (typeof userRoles)[number];

export type Action =
  | 'vendor.register'
  | 'vendor.venue.manage'
  | 'vendor.resource.manage'
  | 'vendor.availability.manage'
  | 'vendor.blocks.manage'
  | 'booking.hold.create'
  | 'booking.hold.activate'
  | 'booking.list.mine'
  | 'challenge.create'
  | 'challenge.accept'
  | 'challenge.confirm'
  | 'challenge.view'
  | 'team.invite'
  | 'team.remove'
  | 'team.join'
  | 'conversation.list'
  | 'conversation.messages.read'
  | 'conversation.messages.send'
  | 'conversation.support.open'
  | 'conversation.moderate'
  | 'match.checkin.manage'
  | 'match.forfeit.manage'
  | 'match.result.submit'
  | 'dispute.admin.review'
  | 'message.report'
  | 'message.report.review'
  | 'review.create'
  | 'tournament.create'
  | 'tournament.register'
  | 'tournament.bracket.generate'
  | 'tournament.view'
  | 'vendor.format.create'
  | 'vendor.approval.review'
  | 'match.dispute.resolve'
  | 'payment.status.mark';

export type ResourceContext = {
  vendorId?: string;
  actorVendorId?: string;
};

export function isUserRole(value: string): value is UserRole {
  return userRoles.includes(value as UserRole);
}

export function can(role: UserRole, action: Action, resource?: ResourceContext): boolean {
  if (role === 'ADMIN') {
    return true;
  }

  switch (action) {
    case 'vendor.register':
      return role === 'PLAYER';
    case 'booking.hold.create':
    case 'booking.hold.activate':
    case 'booking.list.mine':
      return role === 'PLAYER';
    case 'vendor.venue.manage':
    case 'vendor.resource.manage':
    case 'vendor.availability.manage':
    case 'vendor.blocks.manage':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'challenge.create':
    case 'challenge.accept':
    case 'challenge.confirm':
    case 'challenge.view':
    case 'team.invite':
    case 'team.remove':
    case 'team.join':
    case 'conversation.list':
    case 'conversation.messages.read':
    case 'conversation.messages.send':
    case 'conversation.support.open':
      return role === 'PLAYER';
    case 'conversation.moderate':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'match.checkin.manage':
    case 'match.forfeit.manage':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'match.result.submit':
      return role === 'PLAYER';
    case 'message.report':
      return role === 'PLAYER' || role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'review.create':
      return role === 'PLAYER';
    case 'tournament.create':
    case 'tournament.bracket.generate':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'tournament.register':
      return role === 'PLAYER';
    case 'tournament.view':
      return role === 'PLAYER' || role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'dispute.admin.review':
    case 'message.report.review':
      return false;
    case 'vendor.format.create':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'vendor.approval.review':
      return false;
    case 'match.dispute.resolve':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    case 'payment.status.mark':
      return role === 'VENDOR_OWNER' || role === 'VENDOR_STAFF';
    default:
      return false;
  }
}
