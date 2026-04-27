-- Repair persisted module and step order for the seeded `nutri` course.
-- This preserves dashboard edits and only restores sortOrder using the original seed structure.

UPDATE "CourseModule" AS cm
SET "sortOrder" = module_order.sort_order
FROM "Course" AS c,
(
  VALUES
    ('bienvenida', 1),
    ('modulo-1', 2),
    ('modulo-2', 3),
    ('modulo-3', 4),
    ('modulo-4', 5)
) AS module_order(slug, sort_order)
WHERE c."id" = cm."courseId"
  AND c."slug" = 'nutri'
  AND cm."slug" = module_order.slug;

UPDATE "CourseStep" AS cs
SET "sortOrder" = step_order.sort_order
FROM "CourseModule" AS cm,
     "Course" AS c,
(
  VALUES
    ('bienvenida', 'training_welcome_intro', 1),
    ('bienvenida', 'training_materials_intro', 2),

    ('modulo-1', 'training_module_1_intro', 1),
    ('modulo-1', 'training_cafeteria_experience', 2),
    ('modulo-1', 'training_eta_audio', 3),
    ('modulo-1', 'training_eta_activity', 4),
    ('modulo-1', 'training_food_handling_audio', 5),
    ('modulo-1', 'training_regulation_intro', 6),
    ('modulo-1', 'training_hygiene_summary', 7),
    ('modulo-1', 'training_cleaning_audio', 8),
    ('modulo-1', 'training_drying_video', 9),
    ('modulo-1', 'training_drying_quiz', 10),
    ('modulo-1', 'training_drying_quiz_correct', 11),
    ('modulo-1', 'training_drying_quiz_incorrect', 12),
    ('modulo-1', 'training_cross_contamination_audio', 13),
    ('modulo-1', 'training_temperature_control', 14),
    ('modulo-1', 'training_evaluation_intro', 15),
    ('modulo-1', 'training_evaluation_q1', 16),
    ('modulo-1', 'training_evaluation_q2', 17),
    ('modulo-1', 'training_evaluation_q3', 18),
    ('modulo-1', 'training_evaluation_q4', 19),
    ('modulo-1', 'training_evaluation_q5', 20),
    ('modulo-1', 'training_evaluation_q6', 21),
    ('modulo-1', 'training_evaluation_result', 22),

    ('modulo-2', 'training_module_2_intro', 1),
    ('modulo-2', 'training_module_2_rules_video', 2),
    ('modulo-2', 'training_module_2_quiz_intro', 3),
    ('modulo-2', 'training_module_2_q1', 4),
    ('modulo-2', 'training_module_2_q2', 5),
    ('modulo-2', 'training_module_2_q3', 6),
    ('modulo-2', 'training_module_2_q4', 7),
    ('modulo-2', 'training_module_2_q5', 8),
    ('modulo-2', 'training_module_2_q6', 9),
    ('modulo-2', 'training_module_2_q7', 10),
    ('modulo-2', 'training_module_2_q8', 11),
    ('modulo-2', 'training_module_2_quiz_result', 12),
    ('modulo-2', 'training_module_2_handwashing_video', 13),
    ('modulo-2', 'training_module_2_handwashing_quiz', 14),
    ('modulo-2', 'training_module_2_waste_infographic', 15),
    ('modulo-2', 'training_module_2_peps_audio', 16),
    ('modulo-2', 'training_module_2_storage_video', 17),
    ('modulo-2', 'training_module_2_pests_infographic', 18),
    ('modulo-2', 'training_module_2_fruit_wash_infographic', 19),

    ('modulo-3', 'training_module_3_intro', 1),
    ('modulo-3', 'training_module_3_manual', 2),
    ('modulo-3', 'training_module_3_healthy_eating', 3),
    ('modulo-3', 'training_module_3_audio', 4),
    ('modulo-3', 'training_module_3_minutario', 5),
    ('modulo-3', 'training_module_3_menu_video', 6),

    ('modulo-4', 'training_module_4_intro', 1),
    ('modulo-4', 'training_module_4_survey_intro', 2),
    ('modulo-4', 'training_module_4_survey_q1', 3),
    ('modulo-4', 'training_module_4_survey_q2', 4),
    ('modulo-4', 'training_module_4_survey_q3', 5),
    ('modulo-4', 'training_module_4_survey_q4', 6),
    ('modulo-4', 'training_module_4_survey_q5', 7),
    ('modulo-4', 'training_module_4_survey_q6', 8),
    ('modulo-4', 'training_module_4_completion', 9)
) AS step_order(module_slug, step_slug, sort_order)
WHERE c."id" = cm."courseId"
  AND c."slug" = 'nutri'
  AND cm."id" = cs."moduleId"
  AND cm."slug" = step_order.module_slug
  AND cs."slug" = step_order.step_slug;
