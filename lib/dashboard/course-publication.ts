import { CourseStatus, type Prisma } from '@/generated/prisma/client';

export function buildCourseStatusUpdateData(
  status: CourseStatus,
  now = new Date(),
): Prisma.CourseUpdateInput {
  if (status === CourseStatus.ARCHIVED) {
    return {
      status,
      isActive: false,
      activatedAt: null,
      archivedAt: now,
    };
  }

  if (status === CourseStatus.DRAFT) {
    return {
      status,
      isActive: false,
      activatedAt: null,
      archivedAt: null,
    };
  }

  return {
    status,
    archivedAt: null,
  };
}

export function buildSetDefaultCourseUpdates(now = new Date()) {
  return {
    unsetOtherDefaults: {
      isActive: false,
      activatedAt: null,
    } satisfies Prisma.CourseUpdateManyMutationInput,
    setSelectedDefault: {
      isActive: true,
      activatedAt: now,
      archivedAt: null,
      status: CourseStatus.ACTIVE,
    } satisfies Prisma.CourseUpdateInput,
  };
}
