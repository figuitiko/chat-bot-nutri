"use client";

import { useEffect, useState, useTransition } from "react";
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
import { GripVertical } from "lucide-react";

import { reorderModulesAction } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ModuleNavItem {
  id: string;
  slug: string;
  title: string;
  stepCount: number;
  isActive: boolean;
  href: string;
  index: number;
}

function SortableModuleItem({ module: mod, index }: { module: ModuleNavItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: mod.id,
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
        aria-current={mod.isActive ? "page" : undefined}
        className={cn(
          "flex-1 rounded-2xl border px-4 py-3 transition-colors",
          mod.isActive
            ? "border-emerald-300 bg-emerald-50 text-emerald-950"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        )}
        href={mod.href}
        scroll={false}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              Modulo {index} · {mod.title}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {mod.stepCount} paso{mod.stepCount === 1 ? "" : "s"}
            </p>
          </div>
          {mod.isActive ? <Badge variant="success">Activo</Badge> : null}
        </div>
      </Link>
    </div>
  );
}

export function CourseModuleList({
  courseId,
  modules,
}: {
  courseId: string;
  modules: ModuleNavItem[];
}) {
  const [, startTransition] = useTransition();
  const [localModules, setLocalModules] = useState(modules);

  useEffect(() => {
    setLocalModules(modules);
  }, [modules]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localModules.findIndex((m) => m.id === active.id);
    const newIndex = localModules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(localModules, oldIndex, newIndex);
    setLocalModules(reordered);

    const orderedIds = reordered.map((m) => m.id);
    startTransition(async () => {
      await reorderModulesAction(courseId, orderedIds);
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={localModules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
        <div className="grid gap-2">
          {localModules.map((mod, i) => (
            <SortableModuleItem key={mod.id} module={mod} index={i + 1} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
