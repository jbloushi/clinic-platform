import { describe, expect, it } from 'vitest';
import { applyTravelBuffer } from './travel-buffer';

const HOUR = 60 * 60_000;

describe('applyTravelBuffer', () => {
  it('returns ranges unchanged when the buffer is zero', () => {
    const ranges = [{ start: 0, end: HOUR }];
    expect(applyTravelBuffer(ranges, 0)).toEqual(ranges);
  });

  it('pads every range on both sides by the buffer', () => {
    const ranges = [{ start: 10 * HOUR, end: 11 * HOUR }];
    const padded = applyTravelBuffer(ranges, 30);
    expect(padded).toEqual([{ start: 10 * HOUR - 30 * 60_000, end: 11 * HOUR + 30 * 60_000 }]);
  });

  it('leaves a gap just outside the padded window bookable', () => {
    // Appointment at another branch: 10:00-11:00, 45-minute buffer either side
    // blocks 09:15-11:45. A slot starting at 11:45 is exactly at the edge and
    // must not be blocked — the range end is exclusive of anything at or after it.
    const [padded] = applyTravelBuffer([{ start: 10 * HOUR, end: 11 * HOUR }], 45);
    const slotAtEdgeStart = 11 * HOUR + 45 * 60_000;
    const overlaps = padded.start < slotAtEdgeStart + 30 * 60_000 && padded.end > slotAtEdgeStart;
    expect(overlaps).toBe(false);
  });

  it('blocks a slot inside the padded window', () => {
    const [padded] = applyTravelBuffer([{ start: 10 * HOUR, end: 11 * HOUR }], 45);
    // A slot at 11:20 (20 min after the appointment ends) is within the 45-min buffer.
    const slotStart = 11 * HOUR + 20 * 60_000;
    const overlaps = padded.start < slotStart + 30 * 60_000 && padded.end > slotStart;
    expect(overlaps).toBe(true);
  });

  it('pads multiple ranges independently', () => {
    const ranges = [
      { start: 0, end: HOUR },
      { start: 5 * HOUR, end: 6 * HOUR },
    ];
    const padded = applyTravelBuffer(ranges, 15);
    expect(padded).toHaveLength(2);
    expect(padded[0]).toEqual({ start: -15 * 60_000, end: HOUR + 15 * 60_000 });
    expect(padded[1]).toEqual({ start: 5 * HOUR - 15 * 60_000, end: 6 * HOUR + 15 * 60_000 });
  });
});
