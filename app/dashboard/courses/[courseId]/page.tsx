import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers3, ListTree, Plus, Sparkles } from "lucide-react";

import {
  activateCourseAction,
  createOrUpdateModuleAction,
  createOrUpdateStepAction,
  createTransitionAction,
  updateCourseAction,
  uploadAssetAction,
} from "@/app/dashboard/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CourseEditorStepNavigation, CourseEditorStepPager } from "@/components/dashboard/course-editor-step-navigation";
import { StepSaveButton } from "@/components/dashboard/step-save-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  buildCourseEditorHref,
  getCourseEditorNavigation,
  getCourseEditorSelectionKey,
} from "@/lib/dashboard/course-editor-navigation";
import { estimateOutboundMessagesForStep } from "@/lib/services/course-delivery";
import { summarizeSurveySubmissions } from "@/lib/services/course-survey";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function CourseEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ module?: string | string[]; step?: string | string[]; saved?: string }>;
}) {
  const { courseId } = await params;
  const currentSearchParams = await searchParams;
  const isSaved = currentSearchParams.saved === "1";

  const course = await db.course.findUnique({
    where: { id: courseId },
    include: {
      coverAsset: true,
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          introAsset: true,
          steps: {
            orderBy: { sortOrder: "asc" },
            include: {
              mediaAsset: true,
              transitions: {
                where: { isActive: true },
                orderBy: { priority: "asc" },
                include: {
                  nextStep: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!course) {
    notFound();
  }

  const surveySubmissions = await db.courseSurveySubmission.findMany({
    where: { courseId: course.id },
    orderBy: { submittedAt: "desc" },
    include: {
      contact: {
        select: {
          id: true,
          phone: true,
          name: true,
          profileName: true,
        },
      },
    },
  });

  const allSteps = course.modules.flatMap((module) => module.steps);
  const stepsWithMedia = allSteps.filter((step) => step.mediaUrl || step.mediaAssetId).length;
  const stepsWithDoubleDeliveryRisk = allSteps.filter((step) =>
    estimateOutboundMessagesForStep({
      deliveryMode: step.deliveryMode,
      kind: step.kind,
      hasMedia: Boolean(step.mediaUrl || step.mediaAssetId),
    }) > 1,
  ).length;
  const surveySummary = summarizeSurveySubmissions(
    surveySubmissions.map((submission) => ({
      answers: submission.answers as {
        surveyQ1: number;
        surveyQ2: number;
        surveyQ3: number;
        surveyQ4: number;
        surveyQ5: number;
        surveyQ6: number;
      },
      averageScore: submission.averageScore,
      questionCount: submission.questionCount,
      totalScore: submission.totalScore,
    })),
  );
  const navigation = getCourseEditorNavigation(course.modules, currentSearchParams);
  const selectedModule = navigation.selectedModule;
  const selectedStep = navigation.selectedStep;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{course.name}</CardTitle>
            {course.isActive ? <Badge variant="success">Activo</Badge> : <Badge>{course.status}</Badge>}
          </div>
          <CardDescription>
            Edita la metadata del curso, activa la version publicada y administra assets.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4">
            <form action={updateCourseAction} className="grid gap-4" aria-describedby="course-editor-help">
              <input type="hidden" name="id" value={course.id} />
              <input type="hidden" name="moduleSlug" value={selectedModule?.slug ?? ""} />
              <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
              <p id="course-editor-help" className="text-sm text-slate-500">
                Edita esta version en borrador o activa el curso cuando todos los modulos, pasos y evaluaciones esten completos.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre</Label>
                  <Input id="name" name="name" defaultValue={course.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input id="slug" name="slug" defaultValue={course.slug} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descripcion</Label>
                <Textarea id="description" name="description" defaultValue={course.description ?? ""} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Estado</Label>
                  <Select id="status" name="status" defaultValue={course.status}>
                    <option value="DRAFT">DRAFT</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit">Guardar curso</Button>
                </div>
              </div>
            </form>

            {!course.isActive ? (
              <form action={activateCourseAction} className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="moduleSlug" value={selectedModule?.slug ?? ""} />
                <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">Publicacion controlada</p>
                    <p className="text-sm text-slate-600">
                      Solo un curso puede quedar activo para nuevas conversaciones. Los learners ya iniciados permanecen en su curso actual.
                    </p>
                  </div>
                  <Button type="submit" variant="secondary">
                    Activar para nuevas conversaciones
                  </Button>
                </div>
              </form>
            ) : null}
          </div>

          <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">Portada del curso</p>
            <p className="text-xs text-slate-500">
              Los learners actuales siguen en su curso actual aunque actives otra version.
            </p>
            {course.coverAsset ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={course.name} className="h-48 w-full object-cover" src={course.coverAsset.url} />
              </div>
            ) : null}
            <form action={uploadAssetAction} className="space-y-3">
              <input type="hidden" name="courseId" value={course.id} />
              <input type="hidden" name="moduleSlug" value={selectedModule?.slug ?? ""} />
              <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
              <input type="hidden" name="targetType" value="course" />
              <input type="hidden" name="targetId" value={course.id} />
              <input type="hidden" name="kind" value="IMAGE" />
              <Input name="file" type="file" accept="image/*" required />
              <Button className="w-full" type="submit" variant="outline">
                Subir portada
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="grid gap-6 xl:sticky xl:top-6 xl:self-start">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layers3 className="size-4 text-emerald-600" />
                <CardTitle>Mapa del curso</CardTitle>
              </div>
              <CardDescription>
                Navega modulo por modulo sin perderte entre todos los mensajes del curso.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3 text-center text-sm">
                <div>
                  <p className="font-semibold text-slate-950">{course.modules.length}</p>
                  <p className="text-slate-500">Modulos</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{navigation.totalSteps}</p>
                  <p className="text-slate-500">Pasos</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-amber-50 p-3 text-center text-sm">
                <div>
                  <p className="font-semibold text-slate-950">{stepsWithMedia}</p>
                  <p className="text-slate-500">Con media</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-950">{stepsWithDoubleDeliveryRisk}</p>
                  <p className="text-slate-500">Riesgo doble</p>
                </div>
              </div>
              {course.modules.length === 0 ? (
                <EmptyState
                  eyebrow="Modulos"
                  title="Este curso aun no tiene modulos"
                  description="Empieza creando el primer modulo para luego agregar pasos, transiciones, assets y evaluaciones."
                />
              ) : (
                <div className="grid gap-2">
                  {course.modules.map((module, moduleIndex) => {
                    const isActive = module.id === selectedModule?.id;
                    const firstStep = module.steps[0];

                    return (
                      <Link
                        key={module.id}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "rounded-2xl border px-4 py-3 transition-colors",
                          isActive
                            ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                        )}
                        href={buildCourseEditorHref(course.id, { moduleSlug: module.slug, stepSlug: firstStep?.slug })}
                        scroll={false}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">
                              Modulo {moduleIndex + 1} · {module.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {module.steps.length} paso{module.steps.length === 1 ? "" : "s"}
                            </p>
                          </div>
                          {isActive ? <Badge variant="success">Activo</Badge> : null}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedModule ? (
            selectedModule.steps.length === 0 ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <ListTree className="size-4 text-emerald-600" />
                    <CardTitle>Pasos del módulo</CardTitle>
                  </div>
                  <CardDescription>
                    {selectedModule.title} · {selectedModule.steps.length} pasos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                    Este módulo no tiene pasos todavía. Crea uno nuevo abajo y arrancamos.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <CourseEditorStepNavigation
                moduleTitle={selectedModule.title}
                stepCount={selectedModule.steps.length}
                steps={selectedModule.steps.map((step, stepIndex) => ({
                  id: step.id,
                  title: step.title,
                  deliveryMode: step.deliveryMode,
                  href: buildCourseEditorHref(course.id, {
                    moduleSlug: selectedModule.slug,
                    stepSlug: step.slug,
                  }),
                  isActive: step.id === selectedStep?.id,
                  index: stepIndex + 1,
                }))}
              />
            )
          ) : null}

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-emerald-600" />
                <CardTitle>Agregar modulo</CardTitle>
              </div>
              <CardDescription>Los modulos nuevos aparecen al final del curso.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createOrUpdateModuleAction} className="grid gap-3">
                <input type="hidden" name="courseId" value={course.id} />
                <input type="hidden" name="moduleSlug" value={selectedModule?.slug ?? ""} />
                <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
                <Input name="title" placeholder="Nuevo modulo" />
                <Input name="slug" placeholder="nuevo-modulo" />
                <Textarea name="summary" placeholder="Resumen del modulo" />
                <Button type="submit">Agregar modulo</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          {selectedModule ? (
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{selectedModule.title}</CardTitle>
                    <CardDescription>{selectedModule.summary ?? "Sin resumen"}</CardDescription>
                  </div>
                  <Badge>
                    Modulo {navigation.selectedModuleIndex + 1} de {course.modules.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1fr_280px]">
                <form action={createOrUpdateModuleAction} className="grid gap-3">
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="moduleId" value={selectedModule.id} />
                  <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                  <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
                  <Input name="title" defaultValue={selectedModule.title} />
                  <Input name="slug" defaultValue={selectedModule.slug} />
                  <Textarea name="summary" defaultValue={selectedModule.summary ?? ""} />
                  <Button type="submit" variant="outline">
                    Guardar modulo
                  </Button>
                </form>

                <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">Intro del modulo</p>
                  {selectedModule.introAsset ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={selectedModule.title}
                        className="h-40 w-full object-cover"
                        src={selectedModule.introAsset.url}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Todavia no subiste una imagen para este modulo.</p>
                  )}
                  <form action={uploadAssetAction} className="grid gap-2">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                    <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
                    <input type="hidden" name="targetType" value="module" />
                    <input type="hidden" name="targetId" value={selectedModule.id} />
                    <input type="hidden" name="kind" value="IMAGE" />
                    <Input name="file" type="file" accept="image/*" />
                    <Button type="submit" variant="ghost">
                      Subir intro del modulo
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card id="step-editor">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-600" />
                    <CardTitle>{selectedStep?.title ?? "Selecciona un paso"}</CardTitle>
                  </div>
                  <CardDescription>
                    {selectedStep
                      ? `Paso ${navigation.selectedStepIndex + 1} de ${selectedModule?.steps.length ?? 0} dentro de ${selectedModule?.title}.`
                      : "Elegi un paso del modulo para editar su copy, assets, captura y transiciones."}
                  </CardDescription>
                </div>
                {selectedStep ? (
                  <div className="flex flex-wrap gap-2">
                    <Badge>
                      Paso {navigation.selectedStepIndex + 1} de {selectedModule?.steps.length ?? 0}
                    </Badge>
                    <Badge variant={selectedStep.deliveryMode === "MEDIA_FIRST" ? "warning" : selectedStep.deliveryMode === "LINK_ONLY" ? "default" : "success"}>
                      {selectedStep.deliveryMode}
                    </Badge>
                  </div>
                ) : null}
              </div>
              <CourseEditorStepPager
                previous={{
                  disabled: !navigation.previousStep,
                  href: navigation.previousStep
                    ? buildCourseEditorHref(course.id, {
                        moduleSlug: navigation.previousStep.module.slug,
                        stepSlug: navigation.previousStep.step.slug,
                      })
                    : buildCourseEditorHref(course.id, { moduleSlug: selectedModule?.slug }),
                }}
                next={{
                  disabled: !navigation.nextStep,
                  href: navigation.nextStep
                    ? buildCourseEditorHref(course.id, {
                        moduleSlug: navigation.nextStep.module.slug,
                        stepSlug: navigation.nextStep.step.slug,
                      })
                    : buildCourseEditorHref(course.id, {
                        moduleSlug: selectedModule?.slug,
                        stepSlug: selectedStep?.slug,
                      }),
                }}
              />
            </CardHeader>
            <CardContent className="grid gap-4">
              {!selectedModule ? (
                <EmptyState
                  eyebrow="Editor"
                  title="Crea el primer modulo"
                  description="Cuando exista un modulo, vas a poder navegar entre pasos y editar cada mensaje sin perder contexto."
                />
              ) : !selectedStep ? (
                <>
                  <EmptyState
                    eyebrow="Pasos"
                    title="Este modulo aun no tiene pasos"
                    description="Agrega un paso inicial y luego enlazalo con transiciones para construir la conversacion del modulo."
                  />
                  <Separator />
                  <form
                    action={createOrUpdateStepAction}
                    className="grid gap-3 rounded-2xl bg-slate-50 p-4"
                    aria-describedby={`${selectedModule.id}-new-step-help`}
                  >
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleId" value={selectedModule.id} />
                    <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                    <input type="hidden" name="stepSlug" value="" />
                    <p id={`${selectedModule.id}-new-step-help`} className="text-sm text-slate-500">
                      Los pasos nuevos se agregan al final del modulo y luego puedes enlazarlos con transiciones.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="title" placeholder="Nuevo paso" />
                      <Input name="slug" placeholder="nuevo-paso" />
                    </div>
                    <Textarea name="body" placeholder="Contenido del paso" />
                    <div className="grid gap-3 md:grid-cols-4">
                      <Select name="stepType" defaultValue="CONTENT">
                        <option value="CONTENT">CONTENT</option>
                        <option value="QUESTION">QUESTION</option>
                        <option value="RESULT">RESULT</option>
                        <option value="HANDOFF">HANDOFF</option>
                        <option value="SYSTEM">SYSTEM</option>
                      </Select>
                      <Select name="kind" defaultValue="TEXT">
                        <option value="TEXT">TEXT</option>
                        <option value="TWILIO_CONTENT_TEMPLATE">TWILIO_CONTENT_TEMPLATE</option>
                      </Select>
                      <Select name="deliveryMode" defaultValue="STANDARD">
                        <option value="STANDARD">STANDARD</option>
                        <option value="MEDIA_FIRST">MEDIA_FIRST</option>
                        <option value="LINK_ONLY">LINK_ONLY</option>
                      </Select>
                      <Select name="renderMode" defaultValue="TEXT">
                        <option value="TEXT">TEXT</option>
                        <option value="AUTO">AUTO</option>
                        <option value="QUICK_REPLY">QUICK_REPLY</option>
                        <option value="LIST_PICKER">LIST_PICKER</option>
                      </Select>
                    </div>
                    <Select name="inputType" defaultValue="CHOICE">
                      <option value="CHOICE">CHOICE</option>
                      <option value="FREE_TEXT">FREE_TEXT</option>
                    </Select>
                    <Button type="submit">Agregar paso</Button>
                  </form>
                </>
              ) : (
                <div
                  key={getCourseEditorSelectionKey(selectedModule?.id, selectedStep.id)}
                  className="grid gap-4"
                >
                  <form action={createOrUpdateStepAction} className="grid gap-3" aria-describedby={`${selectedStep.id}-step-help`}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleId" value={selectedModule.id} />
                    <input type="hidden" name="stepId" value={selectedStep.id} />
                    <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                    <input type="hidden" name="stepSlug" value={selectedStep.slug} />
                    <p id={`${selectedStep.id}-step-help`} className="text-sm text-slate-500">
                      Ajusta el tipo de paso, su forma de entrega y como debe capturar respuestas o puntajes.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="title" defaultValue={selectedStep.title} />
                      <Input name="slug" defaultValue={selectedStep.slug} />
                    </div>
                    <Textarea name="body" defaultValue={selectedStep.body} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select name="stepType" defaultValue={selectedStep.stepType}>
                        <option value="CONTENT">CONTENT</option>
                        <option value="QUESTION">QUESTION</option>
                        <option value="RESULT">RESULT</option>
                        <option value="HANDOFF">HANDOFF</option>
                        <option value="SYSTEM">SYSTEM</option>
                      </Select>
                      <Select name="kind" defaultValue={selectedStep.kind}>
                        <option value="TEXT">TEXT</option>
                        <option value="TWILIO_CONTENT_TEMPLATE">TWILIO_CONTENT_TEMPLATE</option>
                      </Select>
                      <Select name="deliveryMode" defaultValue={selectedStep.deliveryMode}>
                        <option value="STANDARD">STANDARD</option>
                        <option value="MEDIA_FIRST">MEDIA_FIRST</option>
                        <option value="LINK_ONLY">LINK_ONLY</option>
                      </Select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Select name="renderMode" defaultValue={selectedStep.renderMode}>
                        <option value="TEXT">TEXT</option>
                        <option value="AUTO">AUTO</option>
                        <option value="QUICK_REPLY">QUICK_REPLY</option>
                        <option value="LIST_PICKER">LIST_PICKER</option>
                      </Select>
                      <Select name="inputType" defaultValue={selectedStep.inputType}>
                        <option value="CHOICE">CHOICE</option>
                        <option value="FREE_TEXT">FREE_TEXT</option>
                      </Select>
                      <Input name="mediaUrl" defaultValue={selectedStep.mediaUrl ?? ""} placeholder="https://... o /asset" />
                    </div>
                    {selectedStep.deliveryMode === "MEDIA_FIRST" ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Este paso puede disparar dos mensajes seguidos. Reservalo para bienvenida visual o actividades donde la imagen tenga que aparecer antes del copy.
                      </p>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input name="captureKey" defaultValue={selectedStep.captureKey ?? ""} placeholder="captureKey" />
                      <Input name="assessmentKey" defaultValue={selectedStep.assessmentKey ?? ""} placeholder="assessmentKey" />
                      <Input name="correctAnswer" defaultValue={selectedStep.correctAnswer ?? ""} placeholder="correctAnswer" />
                      <Input name="scoreWeight" defaultValue={selectedStep.scoreWeight ?? ""} placeholder="scoreWeight" />
                    </div>
                    <fieldset className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <legend className="sr-only">Configuraciones especiales del paso</legend>
                      <label className="flex items-center gap-2">
                        <input defaultChecked={selectedStep.isAssessmentResult} name="isAssessmentResult" type="checkbox" />
                        Resultado de evaluacion
                      </label>
                      <label className="flex items-center gap-2">
                        <input defaultChecked={selectedStep.isTerminal} name="isTerminal" type="checkbox" />
                        Paso terminal
                      </label>
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      <StepSaveButton
                        isSaved={isSaved}
                        href={buildCourseEditorHref(course.id, {
                          moduleSlug: selectedModule.slug,
                          stepSlug: selectedStep.slug,
                        })}
                      />
                    </div>
                  </form>

                  <form action={uploadAssetAction} className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-4">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                    <input type="hidden" name="stepSlug" value={selectedStep.slug} />
                    <input type="hidden" name="targetType" value="step" />
                    <input type="hidden" name="targetId" value={selectedStep.id} />
                    <input type="hidden" name="kind" value="IMAGE" />
                    <Input className="max-w-sm" name="file" type="file" />
                    <Button type="submit" variant="ghost">
                      Subir asset del paso
                    </Button>
                  </form>

                  {selectedStep.transitions.length > 0 ? (
                    <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Transiciones actuales
                      </p>
                      {selectedStep.transitions.map((transition) => (
                        <div key={transition.id} className="text-sm text-slate-600">
                          <span className="font-medium text-slate-950">{transition.pattern}</span> →{" "}
                          {transition.nextStep?.title ?? "Sin destino"}{" "}
                          {transition.outputValue ? `· guarda "${transition.outputValue}"` : ""}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <form action={createTransitionAction} className="grid gap-3 rounded-xl border border-dashed border-slate-200 p-3">
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="stepId" value={selectedStep.id} />
                    <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                    <input type="hidden" name="stepSlug" value={selectedStep.slug} />
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="pattern" placeholder="Patron de entrada" />
                      <Select name="matchType" defaultValue="EXACT">
                        <option value="EXACT">EXACT</option>
                        <option value="KEYWORD">KEYWORD</option>
                        <option value="CONTAINS">CONTAINS</option>
                        <option value="FALLBACK">FALLBACK</option>
                      </Select>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Input name="displayLabel" placeholder="Etiqueta visible" />
                      <Input name="displayHint" placeholder="Ayuda visible" />
                      <Input name="outputValue" placeholder="Valor guardado" />
                    </div>
                    <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                      <Select name="nextStepId" defaultValue="">
                        <option value="" disabled>
                          Selecciona el siguiente paso
                        </option>
                        {allSteps.map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {candidate.title}
                          </option>
                        ))}
                      </Select>
                      <Input name="priority" placeholder="100" />
                    </div>
                    <Button type="submit" variant="ghost">
                      Agregar transicion
                    </Button>
                  </form>

                  <Separator />

                  <form
                    action={createOrUpdateStepAction}
                    className="grid gap-3 rounded-2xl bg-slate-50 p-4"
                    aria-describedby={`${selectedModule.id}-new-step-help`}
                  >
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="moduleId" value={selectedModule.id} />
                    <input type="hidden" name="moduleSlug" value={selectedModule.slug} />
                    <input type="hidden" name="stepSlug" value={selectedStep?.slug ?? ""} />
                    <p id={`${selectedModule.id}-new-step-help`} className="text-sm text-slate-500">
                      Los pasos nuevos se agregan al final del modulo y luego puedes enlazarlos con transiciones.
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input name="title" placeholder="Nuevo paso" />
                      <Input name="slug" placeholder="nuevo-paso" />
                    </div>
                    <Textarea name="body" placeholder="Contenido del paso" />
                    <div className="grid gap-3 md:grid-cols-4">
                      <Select name="stepType" defaultValue="CONTENT">
                        <option value="CONTENT">CONTENT</option>
                        <option value="QUESTION">QUESTION</option>
                        <option value="RESULT">RESULT</option>
                        <option value="HANDOFF">HANDOFF</option>
                        <option value="SYSTEM">SYSTEM</option>
                      </Select>
                      <Select name="kind" defaultValue="TEXT">
                        <option value="TEXT">TEXT</option>
                        <option value="TWILIO_CONTENT_TEMPLATE">TWILIO_CONTENT_TEMPLATE</option>
                      </Select>
                      <Select name="deliveryMode" defaultValue="STANDARD">
                        <option value="STANDARD">STANDARD</option>
                        <option value="MEDIA_FIRST">MEDIA_FIRST</option>
                        <option value="LINK_ONLY">LINK_ONLY</option>
                      </Select>
                      <Select name="renderMode" defaultValue="TEXT">
                        <option value="TEXT">TEXT</option>
                        <option value="AUTO">AUTO</option>
                        <option value="QUICK_REPLY">QUICK_REPLY</option>
                        <option value="LIST_PICKER">LIST_PICKER</option>
                      </Select>
                    </div>
                    <Select name="inputType" defaultValue="CHOICE">
                      <option value="CHOICE">CHOICE</option>
                      <option value="FREE_TEXT">FREE_TEXT</option>
                    </Select>
                    <Button type="submit">Agregar paso</Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-emerald-600" />
                <CardTitle>Survey results</CardTitle>
              </div>
              <CardDescription>
                Persistencia de valoraciones finales del curso con resumen y detalle por intento.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Encuestas respondidas</p>
                  <p className="text-2xl font-semibold text-slate-950">{surveySummary.totalSubmissions}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Promedio general</p>
                  <p className="text-2xl font-semibold text-slate-950">{surveySummary.overallAverageScore.toFixed(2)} / 5</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Puntaje total acumulado</p>
                  <p className="text-2xl font-semibold text-slate-950">{surveySummary.overallTotalScore}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {Object.entries(surveySummary.questionAverages).map(([questionKey, value]) => (
                  <div key={questionKey} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{questionKey}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">{value.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">Promedio</p>
                  </div>
                ))}
              </div>

              {surveySubmissions.length === 0 ? (
                <EmptyState
                  eyebrow="Survey"
                  title="Todavia no hay valoraciones guardadas"
                  description="Cuando los learners completen la encuesta final, aqui vas a ver el resumen y el detalle por intento."
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-medium">Fecha</th>
                          <th className="px-4 py-3 font-medium">Contacto</th>
                          <th className="px-4 py-3 font-medium">Promedio</th>
                          <th className="px-4 py-3 font-medium">Q1</th>
                          <th className="px-4 py-3 font-medium">Q2</th>
                          <th className="px-4 py-3 font-medium">Q3</th>
                          <th className="px-4 py-3 font-medium">Q4</th>
                          <th className="px-4 py-3 font-medium">Q5</th>
                          <th className="px-4 py-3 font-medium">Q6</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                        {surveySubmissions.map((submission) => {
                          const answers = submission.answers as Record<string, number>;

                          return (
                            <tr key={submission.id}>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {submission.submittedAt.toLocaleString("es-MX")}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-950">
                                  {submission.contact.name ?? submission.contact.profileName ?? "Sin nombre"}
                                </div>
                                <div className="text-xs text-slate-500">{submission.contact.phone}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">{submission.averageScore.toFixed(2)} / 5</td>
                              <td className="px-4 py-3 whitespace-nowrap">{answers.surveyQ1}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{answers.surveyQ2}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{answers.surveyQ3}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{answers.surveyQ4}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{answers.surveyQ5}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{answers.surveyQ6}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
