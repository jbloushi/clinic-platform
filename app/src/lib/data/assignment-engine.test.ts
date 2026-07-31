import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ASSIGNMENT_RULES,
  rankAutoAssignmentCandidates,
  slotBuckets,
  type AssignmentCandidate,
} from './assignment-engine';

function candidate(over: Partial<AssignmentCandidate> & { specialistOpenemrUuid: string }): AssignmentCandidate {
  return {
    practitionerOfferingId: `offering-${over.specialistOpenemrUuid}`,
    assignmentPriority: 100,
    assignmentPriorityTier: 'NORMAL',
    activeLoad: 0,
    lastAutoAssignedAt: null,
    ...over,
  };
}

describe('rankAutoAssignmentCandidates', () => {
  it('returns nothing when there are no candidates', () => {
    expect(rankAutoAssignmentCandidates([])).toEqual([]);
  });

  it('prefers the previous doctor for a follow-up even when others rank higher', () => {
    const ranked = rankAutoAssignmentCandidates(
      [
        candidate({ specialistOpenemrUuid: 'a', assignmentPriority: 1, activeLoad: 0 }),
        candidate({ specialistOpenemrUuid: 'b', assignmentPriority: 900, activeLoad: 99 }),
      ],
      { previousPractitionerUuid: 'b', isFollowUp: true },
    );

    expect(ranked[0].specialistOpenemrUuid).toBe('b');
    expect(ranked[0].reason).toBe('previous_doctor');
  });

  it('ignores the previous doctor when the booking is not a follow-up', () => {
    const ranked = rankAutoAssignmentCandidates(
      [
        candidate({ specialistOpenemrUuid: 'a', assignmentPriority: 1 }),
        candidate({ specialistOpenemrUuid: 'b', assignmentPriority: 900 }),
      ],
      { previousPractitionerUuid: 'b', isFollowUp: false },
    );

    expect(ranked[0].specialistOpenemrUuid).toBe('a');
  });

  it('ignores the previous doctor when the rule is disabled', () => {
    const ranked = rankAutoAssignmentCandidates(
      [
        candidate({ specialistOpenemrUuid: 'a', assignmentPriority: 1 }),
        candidate({ specialistOpenemrUuid: 'b', assignmentPriority: 900 }),
      ],
      {
        previousPractitionerUuid: 'b',
        isFollowUp: true,
        rules: { ...DEFAULT_ASSIGNMENT_RULES, preferPreviousPractitioner: false },
      },
    );

    expect(ranked[0].specialistOpenemrUuid).toBe('a');
  });

  it('ranks preferred above normal regardless of the numeric priority', () => {
    const ranked = rankAutoAssignmentCandidates([
      candidate({ specialistOpenemrUuid: 'normal', assignmentPriorityTier: 'NORMAL', assignmentPriority: 1 }),
      candidate({ specialistOpenemrUuid: 'preferred', assignmentPriorityTier: 'PREFERRED', assignmentPriority: 900 }),
    ]);

    expect(ranked.map((r) => r.specialistOpenemrUuid)).toEqual(['preferred', 'normal']);
  });

  it('drops backup doctors entirely while a non-backup one exists', () => {
    const ranked = rankAutoAssignmentCandidates([
      candidate({ specialistOpenemrUuid: 'backup', assignmentPriorityTier: 'BACKUP', assignmentPriority: 1 }),
      candidate({ specialistOpenemrUuid: 'normal', assignmentPriorityTier: 'NORMAL', assignmentPriority: 900 }),
    ]);

    expect(ranked.map((r) => r.specialistOpenemrUuid)).toEqual(['normal']);
  });

  it('falls back to backup doctors when nobody else is eligible', () => {
    const ranked = rankAutoAssignmentCandidates([
      candidate({ specialistOpenemrUuid: 'backup', assignmentPriorityTier: 'BACKUP' }),
    ]);

    expect(ranked.map((r) => r.specialistOpenemrUuid)).toEqual(['backup']);
  });

  it('returns nothing when only backups remain and backups are disallowed', () => {
    const ranked = rankAutoAssignmentCandidates(
      [candidate({ specialistOpenemrUuid: 'backup', assignmentPriorityTier: 'BACKUP' })],
      { rules: { ...DEFAULT_ASSIGNMENT_RULES, allowBackupTier: false } },
    );

    expect(ranked).toEqual([]);
  });

  it('breaks equal priority by the lowest current load', () => {
    const ranked = rankAutoAssignmentCandidates([
      candidate({ specialistOpenemrUuid: 'busy', activeLoad: 12 }),
      candidate({ specialistOpenemrUuid: 'quiet', activeLoad: 3 }),
    ]);

    expect(ranked[0].specialistOpenemrUuid).toBe('quiet');
    expect(ranked[0].reason).toBe('lowest_active_load');
  });

  it('breaks equal load by least recently assigned, with never-assigned first', () => {
    const ranked = rankAutoAssignmentCandidates([
      candidate({ specialistOpenemrUuid: 'recent', lastAutoAssignedAt: new Date('2026-07-30T10:00:00Z') }),
      candidate({ specialistOpenemrUuid: 'older', lastAutoAssignedAt: new Date('2026-07-01T10:00:00Z') }),
      candidate({ specialistOpenemrUuid: 'never', lastAutoAssignedAt: null }),
    ]);

    expect(ranked.map((r) => r.specialistOpenemrUuid)).toEqual(['never', 'older', 'recent']);
    expect(ranked[0].reason).toBe('least_recently_assigned');
  });

  it('is deterministic and total when every ranked field is identical', () => {
    const pool = [
      candidate({ specialistOpenemrUuid: 'ccc' }),
      candidate({ specialistOpenemrUuid: 'aaa' }),
      candidate({ specialistOpenemrUuid: 'bbb' }),
    ];

    const first = rankAutoAssignmentCandidates(pool).map((r) => r.specialistOpenemrUuid);
    // Same inputs in a different row order must still produce the same result.
    const shuffled = rankAutoAssignmentCandidates([pool[2], pool[0], pool[1]]).map(
      (r) => r.specialistOpenemrUuid,
    );

    expect(first).toEqual(['aaa', 'bbb', 'ccc']);
    expect(shuffled).toEqual(first);
    expect(rankAutoAssignmentCandidates(pool)[0].reason).toBe('stable_tiebreaker');
  });

  it('does not mutate the input array', () => {
    const pool = [candidate({ specialistOpenemrUuid: 'b' }), candidate({ specialistOpenemrUuid: 'a' })];
    const order = pool.map((c) => c.specialistOpenemrUuid);
    rankAutoAssignmentCandidates(pool);
    expect(pool.map((c) => c.specialistOpenemrUuid)).toEqual(order);
  });
});

describe('slotBuckets', () => {
  it('covers every quantum the booking occupies', () => {
    const buckets = slotBuckets(
      new Date('2026-08-04T10:00:00Z'),
      new Date('2026-08-04T10:30:00Z'),
      5,
    );
    expect(buckets).toHaveLength(6);
    expect(buckets[0].toISOString()).toBe('2026-08-04T10:00:00.000Z');
    expect(buckets[5].toISOString()).toBe('2026-08-04T10:25:00.000Z');
  });

  it('treats the end as exclusive so back-to-back bookings do not collide', () => {
    const first = slotBuckets(new Date('2026-08-04T10:00:00Z'), new Date('2026-08-04T10:30:00Z'), 5);
    const second = slotBuckets(new Date('2026-08-04T10:30:00Z'), new Date('2026-08-04T11:00:00Z'), 5);

    const firstKeys = new Set(first.map((d) => d.toISOString()));
    expect(second.some((d) => firstKeys.has(d.toISOString()))).toBe(false);
  });

  it('shares a bucket with any overlapping booking, which is what blocks it', () => {
    // The case a start-instant-only key misses: 10:10 starts inside 10:00–10:30.
    const existing = slotBuckets(new Date('2026-08-04T10:00:00Z'), new Date('2026-08-04T10:30:00Z'), 5);
    const overlapping = slotBuckets(new Date('2026-08-04T10:10:00Z'), new Date('2026-08-04T10:40:00Z'), 5);

    const existingKeys = new Set(existing.map((d) => d.toISOString()));
    expect(overlapping.some((d) => existingKeys.has(d.toISOString()))).toBe(true);
  });

  it('floors a start that does not land on a quantum boundary', () => {
    const buckets = slotBuckets(
      new Date('2026-08-04T10:03:00Z'),
      new Date('2026-08-04T10:13:00Z'),
      5,
    );
    expect(buckets[0].toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });

  it('returns nothing for a non-positive duration', () => {
    const t = new Date('2026-08-04T10:00:00Z');
    expect(slotBuckets(t, t, 5)).toEqual([]);
  });

  it('rejects a non-positive quantum rather than looping forever', () => {
    expect(() =>
      slotBuckets(new Date('2026-08-04T10:00:00Z'), new Date('2026-08-04T10:30:00Z'), 0),
    ).toThrow();
  });
});
