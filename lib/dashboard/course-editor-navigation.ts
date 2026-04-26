export interface CourseEditorStepBase {
  id: string;
  slug: string;
  title: string;
}

export interface CourseEditorModuleBase<Step extends CourseEditorStepBase = CourseEditorStepBase> {
  id: string;
  slug: string;
  title: string;
  steps: Step[];
}

type SearchParamValue = string | string[] | undefined;

type ModuleStep<Module extends CourseEditorModuleBase> = Module["steps"][number];

export interface CourseEditorStepLocation<Module extends CourseEditorModuleBase> {
  module: Module;
  moduleIndex: number;
  step: ModuleStep<Module>;
  stepIndex: number;
  absoluteIndex: number;
}

export interface CourseEditorNavigationState<Module extends CourseEditorModuleBase> {
  selectedModule: Module | null;
  selectedModuleIndex: number;
  selectedStep: ModuleStep<Module> | null;
  selectedStepIndex: number;
  previousStep: CourseEditorStepLocation<Module> | null;
  nextStep: CourseEditorStepLocation<Module> | null;
  totalSteps: number;
}

function normalizeSearchParam(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function matchesIdentifier(candidate: { id: string; slug: string }, value: string | undefined) {
  if (!value) {
    return false;
  }

  return candidate.id === value || candidate.slug === value;
}

export function getCourseEditorNavigation<Module extends CourseEditorModuleBase>(
  modules: Module[],
  searchParams: {
    module?: SearchParamValue;
    step?: SearchParamValue;
  },
): CourseEditorNavigationState<Module> {
  const requestedModule = normalizeSearchParam(searchParams.module);
  const requestedStep = normalizeSearchParam(searchParams.step);

  const selectedModule =
    modules.find((module) => matchesIdentifier(module, requestedModule)) ?? modules[0] ?? null;

  const selectedModuleIndex = selectedModule
    ? modules.findIndex((module) => module.id === selectedModule.id)
    : -1;

  const selectedStep = selectedModule
    ? selectedModule.steps.find((step) => matchesIdentifier(step, requestedStep)) ??
      selectedModule.steps[0] ??
      null
    : null;

  const selectedStepIndex = selectedStep
    ? selectedModule?.steps.findIndex((step) => step.id === selectedStep.id) ?? -1
    : -1;

  const flattenedSteps = modules.flatMap((module, moduleIndex) =>
    module.steps.map((step, stepIndex) => ({
      module,
      moduleIndex,
      step,
      stepIndex,
    })),
  );

  const selectedFlatIndex = selectedStep
    ? flattenedSteps.findIndex((entry) => entry.step.id === selectedStep.id)
    : -1;

  return {
    selectedModule,
    selectedModuleIndex,
    selectedStep,
    selectedStepIndex,
    previousStep:
      selectedFlatIndex > 0
        ? {
            ...flattenedSteps[selectedFlatIndex - 1],
            absoluteIndex: selectedFlatIndex - 1,
          }
        : null,
    nextStep:
      selectedFlatIndex >= 0 && selectedFlatIndex < flattenedSteps.length - 1
        ? {
            ...flattenedSteps[selectedFlatIndex + 1],
            absoluteIndex: selectedFlatIndex + 1,
          }
        : null,
    totalSteps: flattenedSteps.length,
  };
}
