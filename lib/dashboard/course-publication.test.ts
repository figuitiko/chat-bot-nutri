import { describe, expect, it } from 'vitest';

import { CourseStatus } from '@/generated/prisma/client';
import {
  buildCourseStatusUpdateData,
  buildSetDefaultCourseUpdates,
} from '@/lib/dashboard/course-publication';

describe('course-publication', () => {
  it('publishes courses without making them the default course', () => {
    const update = buildCourseStatusUpdateData(CourseStatus.ACTIVE, new Date('2026-01-01T00:00:00Z'));

    expect(update).toEqual({
      status: CourseStatus.ACTIVE,
      archivedAt: null,
    });
    expect(update).not.toHaveProperty('isActive');
  });

  it('clears default flags when a course leaves the published state', () => {
    expect(buildCourseStatusUpdateData(CourseStatus.DRAFT)).toMatchObject({
      status: CourseStatus.DRAFT,
      isActive: false,
      activatedAt: null,
      archivedAt: null,
    });

    const archivedAt = new Date('2026-01-01T00:00:00Z');
    expect(buildCourseStatusUpdateData(CourseStatus.ARCHIVED, archivedAt)).toMatchObject({
      status: CourseStatus.ARCHIVED,
      isActive: false,
      activatedAt: null,
      archivedAt,
    });
  });

  it('sets one default course without unpublishing the previous default', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const updates = buildSetDefaultCourseUpdates(now);

    expect(updates.unsetOtherDefaults).toEqual({
      isActive: false,
      activatedAt: null,
    });
    expect(updates.unsetOtherDefaults).not.toHaveProperty('status');
    expect(updates.setSelectedDefault).toEqual({
      isActive: true,
      activatedAt: now,
      archivedAt: null,
      status: CourseStatus.ACTIVE,
    });
  });
});
