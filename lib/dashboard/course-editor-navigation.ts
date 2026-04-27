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



export function buildCourseEditorHref(
  courseId: string,
  options: { moduleSlug?: string | null; stepSlug?: string | null } = {},
) {
  const params = new URLSearchParams();

  if (options.moduleSlug) {
    params.set("module", options.moduleSlug);
  }

  if (options.stepSlug) {
    params.set("step", options.stepSlug);
  }

  const query = params.toString();
  return query ? `/dashboard/courses/${courseId}?${query}` : `/dashboard/courses/${courseId}`;
}


export function buildCourseEditorEditorHref(
  courseId: string,
  options: { moduleSlug?: string | null; stepSlug?: string | null } = {},
) {
  return `${buildCourseEditorHref(courseId, options)}#step-editor`;
}
export function getCourseEditorSelectionKey(moduleId?: string | null, stepId?: string | null) {
  return `${moduleId ?? "no-module"}:${stepId ?? "no-step"}`;
}

export function getCourseEditorStepItemClasses(isActive: boolean) {
  return isActive
    ? "rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm ring-1 ring-emerald-100 transition-colors"
    : "rounded-2xl border border-slate-200 bg-white text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50";
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
