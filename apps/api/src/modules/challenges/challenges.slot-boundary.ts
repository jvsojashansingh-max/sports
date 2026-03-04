type SlotTemplate = {
  startMinute: number;
  endMinute: number;
  slotMinutes: number;
  bufferMinutes: number;
};

export function isSlotBoundaryValid(params: {
  startTs: Date;
  durationMinutes: number;
  templates: SlotTemplate[];
}): boolean {
  if (params.startTs.getUTCSeconds() !== 0 || params.startTs.getUTCMilliseconds() !== 0) {
    return false;
  }

  const startMinute = params.startTs.getUTCHours() * 60 + params.startTs.getUTCMinutes();

  return params.templates.some((template) => {
    const stepMinutes = template.slotMinutes + template.bufferMinutes;
    const endMinute = startMinute + params.durationMinutes;

    if (params.durationMinutes !== template.slotMinutes) {
      return false;
    }
    if (startMinute < template.startMinute || endMinute > template.endMinute) {
      return false;
    }
    if (stepMinutes <= 0) {
      return false;
    }

    return (startMinute - template.startMinute) % stepMinutes === 0;
  });
}
