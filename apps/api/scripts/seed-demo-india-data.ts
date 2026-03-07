import {
  ChatRole,
  ConversationStatus,
  ConversationType,
  PaymentMode,
  Prisma,
  PrismaClient,
  ResourceStatus,
  SportId,
  TournamentFormatType,
  TournamentStatus,
  UserRole,
  UserStatus,
  VendorStatus,
  VenueStatus,
} from '@prisma/client';
import { INDIA_DEMO_CITIES, type IndiaDemoCity } from '../../web/lib/indiaCities';

type ResourceBlueprint = {
  name: string;
  sportId: SportId;
  capacity: number;
  slotMinutes?: number;
};

type VenueBlueprint = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  resources: ResourceBlueprint[];
};

const prisma = new PrismaClient();

function demoUuid(seed: number): string {
  return `00000000-0000-4000-8000-${seed.toString(16).padStart(12, '0')}`;
}

function daysFromNow(daysAhead: number, hour: number): Date {
  const value = new Date();
  value.setDate(value.getDate() + daysAhead);
  value.setHours(hour, 0, 0, 0);
  return value;
}

const VENUES_BY_CITY: Record<IndiaDemoCity['code'], VenueBlueprint[]> = {
  CHD: [
    {
      name: 'Sector 35 Shuttle Arena',
      address: 'Sector 35-C, Chandigarh',
      lat: 30.7242,
      lng: 76.7724,
      resources: [
        { name: 'Court A', sportId: SportId.BADMINTON, capacity: 4 },
        { name: 'TT Bay 1', sportId: SportId.TABLE_TENNIS, capacity: 2 },
      ],
    },
    {
      name: 'Tricity Pickle Club',
      address: 'Industrial Area Phase 1, Chandigarh',
      lat: 30.7074,
      lng: 76.8012,
      resources: [
        { name: 'Pickle Court 1', sportId: SportId.PICKLEBALL, capacity: 4 },
        { name: 'Pickle Court 2', sportId: SportId.PICKLEBALL, capacity: 4 },
      ],
    },
    {
      name: 'Capitol Sports Deck',
      address: 'Sector 17, Chandigarh',
      lat: 30.7415,
      lng: 76.7802,
      resources: [
        { name: 'Practice Court', sportId: SportId.BADMINTON, capacity: 4 },
        { name: 'Spin Room', sportId: SportId.TABLE_TENNIS, capacity: 2 },
      ],
    },
  ],
  DEL: [
    {
      name: 'Siri Fort Racquet Hall',
      address: 'Siri Fort Road, New Delhi',
      lat: 28.5535,
      lng: 77.2231,
      resources: [
        { name: 'Shuttle Court 1', sportId: SportId.BADMINTON, capacity: 4 },
        { name: 'Tennis Court 4', sportId: SportId.TENNIS, capacity: 2, slotMinutes: 90 },
      ],
    },
    {
      name: 'Dwarka Court Club',
      address: 'Sector 11, Dwarka, New Delhi',
      lat: 28.5921,
      lng: 77.046,
      resources: [
        { name: 'Hoops Main Floor', sportId: SportId.BASKETBALL, capacity: 10, slotMinutes: 90 },
        { name: 'Tennis Court 1', sportId: SportId.TENNIS, capacity: 2, slotMinutes: 90 },
      ],
    },
    {
      name: 'Rohini Paddle Lab',
      address: 'Sector 9, Rohini, New Delhi',
      lat: 28.7202,
      lng: 77.1141,
      resources: [
        { name: 'Pickle Court 1', sportId: SportId.PICKLEBALL, capacity: 4 },
        { name: 'TT Bay 2', sportId: SportId.TABLE_TENNIS, capacity: 2 },
      ],
    },
  ],
  BOM: [
    {
      name: 'Bandra Shuttle Studio',
      address: 'Linking Road, Bandra West, Mumbai',
      lat: 19.0604,
      lng: 72.8369,
      resources: [
        { name: 'Shuttle Court 1', sportId: SportId.BADMINTON, capacity: 4 },
        { name: 'Shuttle Court 2', sportId: SportId.BADMINTON, capacity: 4 },
      ],
    },
    {
      name: 'Powai Paddle Social',
      address: 'Hiranandani Gardens, Powai, Mumbai',
      lat: 19.1177,
      lng: 72.9073,
      resources: [
        { name: 'Pickle Court 1', sportId: SportId.PICKLEBALL, capacity: 4 },
        { name: 'TT Bay 1', sportId: SportId.TABLE_TENNIS, capacity: 2 },
      ],
    },
    {
      name: 'Lower Parel Sports Box',
      address: 'Senapati Bapat Marg, Lower Parel, Mumbai',
      lat: 18.9959,
      lng: 72.8258,
      resources: [
        { name: 'Hoops Arena', sportId: SportId.BASKETBALL, capacity: 10, slotMinutes: 90 },
        { name: 'Tennis Court 2', sportId: SportId.TENNIS, capacity: 2, slotMinutes: 90 },
      ],
    },
  ],
  BLR: [
    {
      name: 'Indiranagar Rally Point',
      address: '100 Feet Road, Indiranagar, Bengaluru',
      lat: 12.9719,
      lng: 77.6412,
      resources: [
        { name: 'Shuttle Court 1', sportId: SportId.BADMINTON, capacity: 4 },
        { name: 'TT Bay 3', sportId: SportId.TABLE_TENNIS, capacity: 2 },
      ],
    },
    {
      name: 'HSR Paddle Works',
      address: '27th Main, HSR Layout, Bengaluru',
      lat: 12.9116,
      lng: 77.6474,
      resources: [
        { name: 'Pickle Court 1', sportId: SportId.PICKLEBALL, capacity: 4 },
        { name: 'Pickle Court 2', sportId: SportId.PICKLEBALL, capacity: 4 },
      ],
    },
    {
      name: 'Koramangala Court Club',
      address: '80 Feet Road, Koramangala, Bengaluru',
      lat: 12.9352,
      lng: 77.6245,
      resources: [
        { name: 'Tennis Court 1', sportId: SportId.TENNIS, capacity: 2, slotMinutes: 90 },
        { name: 'Shuttle Court 2', sportId: SportId.BADMINTON, capacity: 4 },
      ],
    },
  ],
  PUN: [
    {
      name: 'Aundh Smash House',
      address: 'ITI Road, Aundh, Pune',
      lat: 18.561,
      lng: 73.8075,
      resources: [
        { name: 'Shuttle Court 1', sportId: SportId.BADMINTON, capacity: 4 },
        { name: 'TT Bay 1', sportId: SportId.TABLE_TENNIS, capacity: 2 },
      ],
    },
    {
      name: 'Baner Pickle Yard',
      address: 'Baner Road, Pune',
      lat: 18.559,
      lng: 73.7868,
      resources: [
        { name: 'Pickle Court 1', sportId: SportId.PICKLEBALL, capacity: 4 },
        { name: 'Pickle Court 2', sportId: SportId.PICKLEBALL, capacity: 4 },
      ],
    },
    {
      name: 'Kharadi Court Club',
      address: 'World Trade Center Road, Kharadi, Pune',
      lat: 18.5534,
      lng: 73.9486,
      resources: [
        { name: 'Tennis Court 1', sportId: SportId.TENNIS, capacity: 2, slotMinutes: 90 },
        { name: 'Hoops Floor', sportId: SportId.BASKETBALL, capacity: 10, slotMinutes: 90 },
      ],
    },
  ],
};

const TOURNAMENT_SPORT_BY_CITY: Record<IndiaDemoCity['code'], SportId> = {
  CHD: SportId.BADMINTON,
  DEL: SportId.TENNIS,
  BOM: SportId.PICKLEBALL,
  BLR: SportId.BADMINTON,
  PUN: SportId.PICKLEBALL,
};

async function upsertAvailabilityTemplate(
  resourceId: string,
  cityIndex: number,
  venueIndex: number,
  resourceIndex: number,
  dayOfWeek: number,
  slotMinutes: number,
) {
  const templateId = demoUuid(800000 + cityIndex * 1000 + venueIndex * 100 + resourceIndex * 10 + dayOfWeek);
  await prisma.availabilityTemplate.upsert({
    where: { id: templateId },
    update: {
      resourceId,
      dayOfWeek,
      startMinute: 360,
      endMinute: 1320,
      slotMinutes,
      bufferMinutes: 10,
      deletedAt: null,
    },
    create: {
      id: templateId,
      resourceId,
      dayOfWeek,
      startMinute: 360,
      endMinute: 1320,
      slotMinutes,
      bufferMinutes: 10,
    },
  });
}

async function main() {
  const summary = {
    users: 0,
    vendors: 0,
    venues: 0,
    resources: 0,
    availabilityTemplates: 0,
    tournaments: 0,
    conversations: 0,
  };

  for (const [cityIndex, city] of INDIA_DEMO_CITIES.entries()) {
    const ownerUserId = demoUuid(3000 + cityIndex + 1);
    const vendorId = demoUuid(4000 + cityIndex + 1);

    await prisma.user.upsert({
      where: { id: ownerUserId },
      update: {
        role: UserRole.VENDOR_OWNER,
        status: UserStatus.ACTIVE,
        defaultCityId: city.id,
        displayName: `${city.name} Demo Host`,
        avatarUrl: null,
        deletedAt: null,
      },
      create: {
        id: ownerUserId,
        role: UserRole.VENDOR_OWNER,
        status: UserStatus.ACTIVE,
        defaultCityId: city.id,
        displayName: `${city.name} Demo Host`,
      },
    });
    summary.users += 1;

    await prisma.vendor.upsert({
      where: { id: vendorId },
      update: {
        ownerUserId,
        status: VendorStatus.APPROVED,
        approvedAt: new Date(),
        businessName: `${city.name} Demo Sports`,
        deletedAt: null,
      },
      create: {
        id: vendorId,
        ownerUserId,
        status: VendorStatus.APPROVED,
        approvedAt: new Date(),
        businessName: `${city.name} Demo Sports`,
      },
    });
    summary.vendors += 1;

    let tournamentVenueId: string | null = null;
    const tournamentResourceIds: string[] = [];
    const tournamentSportId = TOURNAMENT_SPORT_BY_CITY[city.code];

    for (const [venueIndex, venue] of VENUES_BY_CITY[city.code].entries()) {
      const venueId = demoUuid(5000 + cityIndex * 100 + venueIndex + 1);

      await prisma.venue.upsert({
        where: { id: venueId },
        update: {
          vendorId,
          name: venue.name,
          cityId: city.id,
          stateId: city.stateId,
          address: venue.address,
          lat: venue.lat,
          lng: venue.lng,
          status: VenueStatus.LIVE,
          paymentInstructions: 'Pay at venue reception before your slot starts.',
          paymentMode: PaymentMode.PAY_ON_SPOT,
          vendorPaymentLink: null,
          photos: null,
          deletedAt: null,
        },
        create: {
          id: venueId,
          vendorId,
          name: venue.name,
          cityId: city.id,
          stateId: city.stateId,
          address: venue.address,
          lat: venue.lat,
          lng: venue.lng,
          status: VenueStatus.LIVE,
          paymentInstructions: 'Pay at venue reception before your slot starts.',
          paymentMode: PaymentMode.PAY_ON_SPOT,
        },
      });
      summary.venues += 1;

      for (const [resourceIndex, resource] of venue.resources.entries()) {
        const resourceId = demoUuid(6000 + cityIndex * 100 + venueIndex * 10 + resourceIndex + 1);
        const slotMinutes = resource.slotMinutes ?? 60;

        await prisma.resource.upsert({
          where: { id: resourceId },
          update: {
            venueId,
            sportId: resource.sportId,
            name: resource.name,
            capacity: resource.capacity,
            status: ResourceStatus.ACTIVE,
            deletedAt: null,
          },
          create: {
            id: resourceId,
            venueId,
            sportId: resource.sportId,
            name: resource.name,
            capacity: resource.capacity,
            status: ResourceStatus.ACTIVE,
          },
        });
        summary.resources += 1;

        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
          await upsertAvailabilityTemplate(resourceId, cityIndex, venueIndex, resourceIndex, dayOfWeek, slotMinutes);
          summary.availabilityTemplates += 1;
        }

        if (resource.sportId === tournamentSportId) {
          tournamentVenueId ??= venueId;
          if (tournamentVenueId === venueId) {
            tournamentResourceIds.push(resourceId);
          }
        }
      }
    }

    if (!tournamentVenueId || tournamentResourceIds.length === 0) {
      throw new Error(`Missing tournament venue/resource for ${city.code}`);
    }

    const startTs = daysFromNow(cityIndex + 3, 19);
    const registrationDeadline = new Date(startTs.getTime() - 36 * 60 * 60 * 1000);
    const tournamentId = demoUuid(7000 + cityIndex + 1);
    const conversationId = demoUuid(7500 + cityIndex + 1);

    await prisma.tournament.upsert({
      where: { id: tournamentId },
      update: {
        venueId: tournamentVenueId,
        sportId: tournamentSportId,
        formatType: TournamentFormatType.SINGLE_ELIM,
        status: TournamentStatus.REG_OPEN,
        registrationDeadline,
        startTs,
        rulesJson: {
          resourceIds: tournamentResourceIds,
          slotMinutes: 60,
          cityCode: city.code,
        } as Prisma.InputJsonValue,
        createdByUserId: ownerUserId,
        deletedAt: null,
      },
      create: {
        id: tournamentId,
        venueId: tournamentVenueId,
        sportId: tournamentSportId,
        formatType: TournamentFormatType.SINGLE_ELIM,
        status: TournamentStatus.REG_OPEN,
        registrationDeadline,
        startTs,
        rulesJson: {
          resourceIds: tournamentResourceIds,
          slotMinutes: 60,
          cityCode: city.code,
        } as Prisma.InputJsonValue,
        createdByUserId: ownerUserId,
      },
    });
    summary.tournaments += 1;

    await prisma.conversation.upsert({
      where: { id: conversationId },
      update: {
        tournamentId,
        type: ConversationType.TOURNAMENT,
        createdByUserId: ownerUserId,
        status: ConversationStatus.ACTIVE,
        deletedAt: null,
      },
      create: {
        id: conversationId,
        tournamentId,
        type: ConversationType.TOURNAMENT,
        createdByUserId: ownerUserId,
        status: ConversationStatus.ACTIVE,
      },
    });
    summary.conversations += 1;

    await prisma.conversationParticipant.createMany({
      data: [
        {
          conversationId,
          userId: ownerUserId,
          roleInChat: ChatRole.MODERATOR,
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
