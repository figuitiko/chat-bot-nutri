import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsertMock, loggerWarnMock, loggerErrorMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    courseSurveySubmission: {
      upsert: upsertMock,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: loggerWarnMock,
    error: loggerErrorMock,
  },
}));

import {
  buildCourseSurveySubmissionData,
  persistCourseSurveySubmission,
  summarizeSurveySubmissions,
} from "@/lib/services/course-survey";

describe("buildCourseSurveySubmissionData", () => {
  it("returns metrics when all six survey answers are valid", () => {
    const result = buildCourseSurveySubmissionData({
      surveyQ1: "5",
      surveyQ2: "4",
      surveyQ3: "3",
      surveyQ4: "2",
      surveyQ5: "1",
      surveyQ6: "5",
    });

    expect(result).toEqual({
      answers: {
        surveyQ1: 5,
        surveyQ2: 4,
        surveyQ3: 3,
        surveyQ4: 2,
        surveyQ5: 1,
        surveyQ6: 5,
      },
      averageScore: 3.33,
      questionCount: 6,
      totalScore: 20,
    });
  });

  it("returns null when any survey answer is missing or invalid", () => {
    expect(
      buildCourseSurveySubmissionData({
        surveyQ1: "5",
        surveyQ2: "4",
        surveyQ3: "3",
        surveyQ4: "2",
        surveyQ5: "1",
      }),
    ).toBeNull();

    expect(
      buildCourseSurveySubmissionData({
        surveyQ1: "5",
        surveyQ2: "4",
        surveyQ3: "3",
        surveyQ4: "2",
        surveyQ5: "1",
        surveyQ6: "9",
      }),
    ).toBeNull();
  });
});

describe("persistCourseSurveySubmission", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    loggerWarnMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it("upserts a survey submission when the context contains a valid completed survey", async () => {
    await persistCourseSurveySubmission({
      contactId: "contact-1",
      conversationId: "conversation-1",
      courseId: "course-1",
      contextData: {
        surveyQ1: "5",
        surveyQ2: "4",
        surveyQ3: "3",
        surveyQ4: "2",
        surveyQ5: "1",
        surveyQ6: "5",
      },
    });

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: "conversation-1" },
        create: expect.objectContaining({
          contactId: "contact-1",
          conversationId: "conversation-1",
          courseId: "course-1",
          answers: {
            surveyQ1: 5,
            surveyQ2: 4,
            surveyQ3: 3,
            surveyQ4: 2,
            surveyQ5: 1,
            surveyQ6: 5,
          },
          questionCount: 6,
          totalScore: 20,
          averageScore: 3.33,
        }),
      }),
    );
  });

  it("does not persist and logs a warning when the survey is incomplete", async () => {
    await persistCourseSurveySubmission({
      contactId: "contact-1",
      conversationId: "conversation-1",
      courseId: "course-1",
      contextData: {
        surveyQ1: "5",
        surveyQ2: "4",
      },
    });

    expect(upsertMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).toHaveBeenCalled();
  });

  it("does nothing silently when the conversation has no survey answers", async () => {
    await persistCourseSurveySubmission({
      contactId: "contact-1",
      conversationId: "conversation-1",
      courseId: "course-1",
      contextData: {},
    });

    expect(upsertMock).not.toHaveBeenCalled();
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });
});

describe("summarizeSurveySubmissions", () => {
  it("computes overall and per-question averages", () => {
    const summary = summarizeSurveySubmissions([
      {
        answers: {
          surveyQ1: 5,
          surveyQ2: 4,
          surveyQ3: 3,
          surveyQ4: 2,
          surveyQ5: 1,
          surveyQ6: 5,
        },
        averageScore: 3.33,
        questionCount: 6,
        totalScore: 20,
      },
      {
        answers: {
          surveyQ1: 3,
          surveyQ2: 3,
          surveyQ3: 3,
          surveyQ4: 3,
          surveyQ5: 3,
          surveyQ6: 3,
        },
        averageScore: 3,
        questionCount: 6,
        totalScore: 18,
      },
    ]);

    expect(summary.totalSubmissions).toBe(2);
    expect(summary.overallAverageScore).toBe(3.17);
    expect(summary.questionAverages.surveyQ1).toBe(4);
    expect(summary.questionAverages.surveyQ6).toBe(4);
  });
});
