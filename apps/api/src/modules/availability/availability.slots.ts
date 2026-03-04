export type TimeRange = {
  startTs: Date;
  endTs: Date;
};

export type SlotTemplate = {
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  bufferMinutes: number;
};

export type ComputedSlot = {
  startTs: string;
  endTs: string;
  status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED';
};

export function buildSlotsForDay(params: {
  dayStartUtc: Date;
  templates: SlotTemplate[];
  blockedRanges?: TimeRange[];
  bookedRanges?: TimeRange[];
}): ComputedSlot[] {
  const blockedRanges = params.blockedRanges ?? [];
  const bookedRanges = params.bookedRanges ?? [];

  const slots: ComputedSlot[] = [];
  for (const template of params.templates) {
    let currentMinute = template.startMinute;

    while (currentMinute + template.slotMinutes <= template.endMinute) {
      const slotStart = addMinutes(params.dayStartUtc, currentMinute);
      const slotEnd = addMinutes(slotStart, template.slotMinutes);

      let status: ComputedSlot['status'] = 'AVAILABLE';
      if (overlapsAny(slotStart, slotEnd, bookedRanges)) {
        status = 'BOOKED';
      } else if (overlapsAny(slotStart, slotEnd, blockedRanges)) {
        status = 'BLOCKED';
      }

      slots.push({
        startTs: slotStart.toISOString(),
        endTs: slotEnd.toISOString(),
        status,
      });

      currentMinute += template.slotMinutes + template.bufferMinutes;
    }
  }

  return slots.sort((a, b) => (a.startTs < b.startTs ? -1 : 1));
}

function addMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60_000);
}

function overlapsAny(slotStart: Date, slotEnd: Date, ranges: TimeRange[]): boolean {
  return ranges.some((range) => slotStart < range.endTs && slotEnd > range.startTs);
}
