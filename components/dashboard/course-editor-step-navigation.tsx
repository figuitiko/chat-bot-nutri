"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ListTree } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCourseEditorStepItemClasses } from "@/lib/dashboard/course-editor-navigation";
import { cn } from "@/lib/utils";

interface StepNavItem {
  id: string;
  title: string;
  deliveryMode: string;
  href: string;
  isActive: boolean;
  index: number;
}

interface PagerLink {
  href: string;
  disabled: boolean;
}

export function CourseEditorStepNavigation({
  moduleTitle,
  stepCount,
  steps,
}: {
  moduleTitle: string;
  stepCount: number;
  steps: StepNavItem[];
}) {
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [steps]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListTree className="size-4 text-emerald-600" />
          <CardTitle>Pasos del módulo</CardTitle>
        </div>
        <CardDescription>
          {moduleTitle} · {stepCount} paso{stepCount === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid max-h-[70vh] gap-2 overflow-y-auto pr-1">
        {steps.map((step) => {
          const isActive = step.isActive;

          return (
            <Link
              key={step.id}
              ref={isActive ? activeRef : null}
              aria-current={isActive ? "step" : undefined}
              className={cn(getCourseEditorStepItemClasses(isActive), "px-4 py-3")}
              href={step.href}
              scroll={false}
            >
              <p
                className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  isActive ? "text-emerald-700" : "text-slate-500",
                )}
              >
                Paso {step.index}
              </p>
              <div className="mt-2 flex items-start justify-between gap-3">
                <p
                  className={cn(
                    "min-w-0 text-sm font-semibold leading-5",
                    isActive ? "text-emerald-950" : "text-slate-900",
                  )}
                >
                  {step.title}
                </p>
                <Badge
                  variant={
                    step.deliveryMode === "MEDIA_FIRST"
                      ? "warning"
                      : step.deliveryMode === "LINK_ONLY"
                        ? "default"
                        : "success"
                  }
                >
                  {step.deliveryMode}
                </Badge>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function CourseEditorStepPager({
  previous,
  next,
}: {
  previous: PagerLink;
  next: PagerLink;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm" variant="outline">
        <Link
          aria-disabled={previous.disabled}
          className={previous.disabled ? "pointer-events-none opacity-50" : undefined}
          href={previous.href}
          scroll={false}
        >
          <ChevronLeft className="mr-1 size-4" />
          Anterior
        </Link>
      </Button>
      <Button asChild size="sm" variant="outline">
        <Link
          aria-disabled={next.disabled}
          className={next.disabled ? "pointer-events-none opacity-50" : undefined}
          href={next.href}
          scroll={false}
        >
          Siguiente
          <ChevronRight className="ml-1 size-4" />
        </Link>
      </Button>
    </div>
  );
}
