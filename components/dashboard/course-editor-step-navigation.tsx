"use client";

import { useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronLeft, ChevronRight } from "lucide-react";

import { reorderStepsAction } from "@/app/dashboard/actions";
import { getCourseEditorStepItemClasses } from "@/lib/dashboard/course-editor-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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

function SortableStepItem({ step }: { step: StepNavItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded p-1 text-slate-400 hover:text-slate-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
        type="button"
      >
        <GripVertical className="size-4" />
      </button>
      <Link
        className={`flex-1 px-3 py-2 text-sm ${getCourseEditorStepItemClasses(step.isActive)}`}
        href={step.href}
        scroll={false}
      >
        <span className="font-medium">{step.index}. {step.title}</span>
        <Badge className="ml-2 text-xs">{step.deliveryMode}</Badge>
      </Link>
    </div>
  );
}

export function CourseEditorStepNavigation({
  moduleTitle,
  stepCount,
  steps,
  moduleId,
}: {
  moduleTitle: string;
  stepCount: number;
  steps: StepNavItem[];
  moduleId: string;
}) {
  const activeRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [steps]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(steps, oldIndex, newIndex);
    const orderedIds = reordered.map((s) => s.id);

    startTransition(async () => {
      await reorderStepsAction(moduleId, orderedIds);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{moduleTitle}</CardTitle>
        <CardDescription>{stepCount} paso{stepCount === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div ref={activeRef} className="grid gap-1">
              {steps.map((step) => (
                <SortableStepItem key={step.id} step={step} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
    <div className="flex gap-2">
      <Button asChild={!previous.disabled} disabled={previous.disabled} size="sm" variant="outline">
        {previous.disabled ? (
          <span><ChevronLeft className="size-4" /> Anterior</span>
        ) : (
          <Link href={previous.href} scroll={false}><ChevronLeft className="size-4" /> Anterior</Link>
        )}
      </Button>
      <Button asChild={!next.disabled} disabled={next.disabled} size="sm" variant="outline">
        {next.disabled ? (
          <span>Siguiente <ChevronRight className="size-4" /></span>
        ) : (
          <Link href={next.href} scroll={false}>Siguiente <ChevronRight className="size-4" /></Link>
        )}
      </Button>
    </div>
  );
}
