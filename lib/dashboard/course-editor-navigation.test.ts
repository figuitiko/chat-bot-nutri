import { describe, expect, it } from "vitest";

import {
  buildCourseEditorEditorHref,
  buildCourseEditorHref,
  getCourseEditorNavigation,
  getCourseEditorSelectionKey,
  getCourseEditorStepItemClasses,
  type CourseEditorModuleBase,
} from "@/lib/dashboard/course-editor-navigation";

const modules: CourseEditorModuleBase[] = [
  {
    id: "m1",
    slug: "modulo-1",
    title: "Modulo 1",
    steps: [
      { id: "s1", slug: "bienvenida", title: "Bienvenida" },
      { id: "s2", slug: "intro", title: "Intro" },
    ],
  },
  {
    id: "m2",
    slug: "modulo-2",
    title: "Modulo 2",
    steps: [{ id: "s3", slug: "tema-1", title: "Tema 1" }],
  },
  {
    id: "m3",
    slug: "modulo-3",
    title: "Modulo 3",
    steps: [],
  },
];

describe("getCourseEditorNavigation", () => {
  it("selects the first module and step by default", () => {
    const navigation = getCourseEditorNavigation(modules, {});

    expect(navigation.selectedModule?.id).toBe("m1");
    expect(navigation.selectedStep?.id).toBe("s1");
    expect(navigation.selectedModuleIndex).toBe(0);
    expect(navigation.selectedStepIndex).toBe(0);
    expect(navigation.totalSteps).toBe(3);
  });

  it("honors module and step query params when they exist", () => {
    const navigation = getCourseEditorNavigation(modules, {
      module: "modulo-2",
      step: "tema-1",
    });

    expect(navigation.selectedModule?.id).toBe("m2");
    expect(navigation.selectedStep?.id).toBe("s3");
    expect(navigation.previousStep?.step.id).toBe("s2");
    expect(navigation.nextStep).toBeNull();
  });

  it("falls back to the first step of the selected module when the requested step does not exist", () => {
    const navigation = getCourseEditorNavigation(modules, {
      module: "modulo-1",
      step: "paso-inexistente",
    });

    expect(navigation.selectedModule?.id).toBe("m1");
    expect(navigation.selectedStep?.id).toBe("s1");
  });

  it("returns no selected step when the chosen module has no steps", () => {
    const navigation = getCourseEditorNavigation(modules, {
      module: "modulo-3",
    });

    expect(navigation.selectedModule?.id).toBe("m3");
    expect(navigation.selectedStep).toBeNull();
    expect(navigation.previousStep).toBeNull();
    expect(navigation.nextStep).toBeNull();
  });
});

describe("getCourseEditorStepItemClasses", () => {
  it("uses a readable highlighted surface for the selected step", () => {
    const classes = getCourseEditorStepItemClasses(true);

    expect(classes).toContain("bg-emerald-50");
    expect(classes).toContain("text-emerald-950");
    expect(classes).not.toContain("bg-slate-950");
  });

  it("keeps the neutral card treatment for unselected steps", () => {
    const classes = getCourseEditorStepItemClasses(false);

    expect(classes).toContain("bg-white");
    expect(classes).toContain("text-slate-700");
  });
});

describe("getCourseEditorSelectionKey", () => {
  it("changes when the selected step changes so uncontrolled editor fields remount", () => {
    expect(getCourseEditorSelectionKey("m1", "s1")).not.toBe(
      getCourseEditorSelectionKey("m1", "s2"),
    );
  });

  it("falls back safely when there is no selected step", () => {
    expect(getCourseEditorSelectionKey("m1", null)).toBe("m1:no-step");
    expect(getCourseEditorSelectionKey(null, null)).toBe("no-module:no-step");
  });
});

describe("buildCourseEditorHref", () => {
  it("preserves module and step in the generated editor url", () => {
    expect(
      buildCourseEditorHref("course-1", {
        moduleSlug: "modulo-1",
        stepSlug: "paso-6",
      }),
    ).toBe("/dashboard/courses/course-1?module=modulo-1&step=paso-6");
  });

  it("omits missing params without leaving broken query strings", () => {
    expect(buildCourseEditorHref("course-1", { moduleSlug: "modulo-1" })).toBe(
      "/dashboard/courses/course-1?module=modulo-1",
    );
    expect(buildCourseEditorHref("course-1", {})).toBe(
      "/dashboard/courses/course-1",
    );
  });
});

describe("buildCourseEditorEditorHref", () => {
  it("adds the editor anchor so redirects land back on the form", () => {
    expect(
      buildCourseEditorEditorHref("course-1", {
        moduleSlug: "modulo-1",
        stepSlug: "paso-6",
      }),
    ).toBe(
      "/dashboard/courses/course-1?module=modulo-1&step=paso-6#step-editor",
    );
  });

  it("still works when there is no selected step yet", () => {
    expect(
      buildCourseEditorEditorHref("course-1", { moduleSlug: "modulo-1" }),
    ).toBe("/dashboard/courses/course-1?module=modulo-1#step-editor");
  });
});
