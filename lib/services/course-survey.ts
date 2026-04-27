import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

const SURVEY_CAPTURE_KEYS = [
  "surveyQ1",
  "surveyQ2",
  "surveyQ3",
  "surveyQ4",
  "surveyQ5",
  "surveyQ6",
] as const;

type SurveyCaptureKey = (typeof SURVEY_CAPTURE_KEYS)[number];

type SurveyContext = Record<string, string>;

export type CourseSurveyAnswers = Record<SurveyCaptureKey, number>;

export type CourseSurveySubmissionData = {
  answers: CourseSurveyAnswers;
  questionCount: number;
  totalScore: number;
  averageScore: number;
};

type SurveySubmissionSummaryInput = Pick<
  CourseSurveySubmissionData,
  "answers" | "questionCount" | "totalScore" | "averageScore"
>;

export function buildCourseSurveySubmissionData(
  contextData: SurveyContext,
): CourseSurveySubmissionData | null {
  const hasAnySurveyAnswer = SURVEY_CAPTURE_KEYS.some((key) => key in contextData);

  if (!hasAnySurveyAnswer) {
    return null;
  }

  const answers = {} as CourseSurveyAnswers;

  for (const key of SURVEY_CAPTURE_KEYS) {
    const rawValue = contextData[key];
    const parsedValue = Number(rawValue);

    if (!rawValue || !Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 5) {
      return null;
    }

    answers[key] = parsedValue;
  }

  const questionCount = SURVEY_CAPTURE_KEYS.length;
  const totalScore = SURVEY_CAPTURE_KEYS.reduce((sum, key) => sum + answers[key], 0);
  const averageScore = Number((totalScore / questionCount).toFixed(2));

  return {
    answers,
    questionCount,
    totalScore,
    averageScore,
  };
}

export async function persistCourseSurveySubmission(input: {
  contactId: string;
  conversationId: string;
  courseId: string;
  contextData: SurveyContext;
}) {
  const hasAnySurveyAnswer = SURVEY_CAPTURE_KEYS.some((key) => key in input.contextData);
  const submission = buildCourseSurveySubmissionData(input.contextData);

  if (!submission) {
    if (hasAnySurveyAnswer) {
      logger.warn("course.survey_submission.invalid", {
        contactId: input.contactId,
        conversationId: input.conversationId,
        courseId: input.courseId,
      });
    }
    return null;
  }

  return db.courseSurveySubmission.upsert({
    where: {
      conversationId: input.conversationId,
    },
    create: {
      contactId: input.contactId,
      conversationId: input.conversationId,
      courseId: input.courseId,
      answers: submission.answers,
      questionCount: submission.questionCount,
      totalScore: submission.totalScore,
      averageScore: submission.averageScore,
    },
    update: {
      answers: submission.answers,
      questionCount: submission.questionCount,
      totalScore: submission.totalScore,
      averageScore: submission.averageScore,
    },
  });
}

export function summarizeSurveySubmissions(submissions: SurveySubmissionSummaryInput[]) {
  if (submissions.length === 0) {
    return {
      totalSubmissions: 0,
      overallAverageScore: 0,
      overallTotalScore: 0,
      questionAverages: Object.fromEntries(
        SURVEY_CAPTURE_KEYS.map((key) => [key, 0]),
      ) as Record<SurveyCaptureKey, number>,
    };
  }

  const overallTotalScore = submissions.reduce((sum, submission) => sum + submission.totalScore, 0);
  const totalQuestionCount = submissions.reduce(
    (sum, submission) => sum + submission.questionCount,
    0,
  );

  const questionAverages = Object.fromEntries(
    SURVEY_CAPTURE_KEYS.map((key) => {
      const sum = submissions.reduce((acc, submission) => acc + submission.answers[key], 0);
      return [key, Number((sum / submissions.length).toFixed(2))];
    }),
  ) as Record<SurveyCaptureKey, number>;

  return {
    totalSubmissions: submissions.length,
    overallAverageScore: Number((overallTotalScore / totalQuestionCount).toFixed(2)),
    overallTotalScore,
    questionAverages,
  };
}

export { SURVEY_CAPTURE_KEYS };
