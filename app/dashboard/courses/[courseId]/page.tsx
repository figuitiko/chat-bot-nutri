import { notFound } from "next/navigation";

import {
  activateCourseAction,
  createOrUpdateModuleAction,
  createOrUpdateStepAction,
  createTransitionAction,
  updateCourseAction,
  uploadAssetAction,
} from "@/app/dashboard/actions";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CourseEditorPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
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

  const allSteps = course.modules.flatMap((module) => module.steps);

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

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <CardHeader>
            <CardTitle>Modulos</CardTitle>
            <CardDescription>Crea y actualiza el mapa del curso.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {course.modules.length === 0 ? (
              <EmptyState
                eyebrow="Modulos"
                title="Este curso aun no tiene modulos"
                description="Empieza creando el primer modulo para luego agregar pasos, transiciones, assets y evaluaciones."
              />
            ) : null}
            {course.modules.map((module) => (
              <div key={module.id} className="rounded-2xl border border-slate-200 p-4">
                <form action={createOrUpdateModuleAction} className="grid gap-3">
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="moduleId" value={module.id} />
                  <Input name="title" defaultValue={module.title} />
                  <Input name="slug" defaultValue={module.slug} />
                  <Textarea name="summary" defaultValue={module.summary ?? ""} />
                  <Button type="submit" variant="outline">
                    Guardar modulo
                  </Button>
                </form>
                <form action={uploadAssetAction} className="mt-3 grid gap-2">
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="targetType" value="module" />
                  <input type="hidden" name="targetId" value={module.id} />
                  <input type="hidden" name="kind" value="IMAGE" />
                  <Input name="file" type="file" accept="image/*" />
                  <Button type="submit" variant="ghost">
                    Subir intro del modulo
                  </Button>
                </form>
              </div>
            ))}
            <Separator />
            <form action={createOrUpdateModuleAction} className="grid gap-3">
              <input type="hidden" name="courseId" value={course.id} />
              <Input name="title" placeholder="Nuevo modulo" />
              <Input name="slug" placeholder="nuevo-modulo" />
              <Textarea name="summary" placeholder="Resumen del modulo" />
              <Button type="submit">Agregar modulo</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {course.modules.map((module) => (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle>{module.title}</CardTitle>
                <CardDescription>{module.summary ?? "Sin resumen"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {module.steps.length === 0 ? (
                  <EmptyState
                    eyebrow="Pasos"
                    title="Este modulo aun no tiene pasos"
                    description="Agrega un paso inicial y luego conecta transiciones para construir la conversacion del modulo."
                  />
                ) : null}
                {module.steps.map((step) => (
                  <div key={step.id} className="rounded-2xl border border-slate-200 p-4">
                    <form action={createOrUpdateStepAction} className="grid gap-3" aria-describedby={`${step.id}-step-help`}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="moduleId" value={module.id} />
                      <input type="hidden" name="stepId" value={step.id} />
                      <p id={`${step.id}-step-help`} className="text-sm text-slate-500">
                        Ajusta el tipo de paso, su forma de entrega y como debe capturar respuestas o puntajes.
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input name="title" defaultValue={step.title} />
                        <Input name="slug" defaultValue={step.slug} />
                      </div>
                      <Textarea name="body" defaultValue={step.body} />
                      <div className="grid gap-3 md:grid-cols-3">
                        <Select name="stepType" defaultValue={step.stepType}>
                          <option value="CONTENT">CONTENT</option>
                          <option value="QUESTION">QUESTION</option>
                          <option value="RESULT">RESULT</option>
                          <option value="HANDOFF">HANDOFF</option>
                          <option value="SYSTEM">SYSTEM</option>
                        </Select>
                        <Select name="kind" defaultValue={step.kind}>
                          <option value="TEXT">TEXT</option>
                          <option value="TWILIO_CONTENT_TEMPLATE">TWILIO_CONTENT_TEMPLATE</option>
                        </Select>
                        <Select name="deliveryMode" defaultValue={step.deliveryMode}>
                          <option value="STANDARD">STANDARD</option>
                          <option value="MEDIA_FIRST">MEDIA_FIRST</option>
                        </Select>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Select name="renderMode" defaultValue={step.renderMode}>
                          <option value="TEXT">TEXT</option>
                          <option value="AUTO">AUTO</option>
                          <option value="QUICK_REPLY">QUICK_REPLY</option>
                          <option value="LIST_PICKER">LIST_PICKER</option>
                        </Select>
                        <Select name="inputType" defaultValue={step.inputType}>
                          <option value="CHOICE">CHOICE</option>
                          <option value="FREE_TEXT">FREE_TEXT</option>
                        </Select>
                        <Input name="mediaUrl" defaultValue={step.mediaUrl ?? ""} placeholder="https://... o /asset" />
                      </div>
                      <div className="grid gap-3 md:grid-cols-4">
                        <Input name="captureKey" defaultValue={step.captureKey ?? ""} placeholder="captureKey" />
                        <Input name="assessmentKey" defaultValue={step.assessmentKey ?? ""} placeholder="assessmentKey" />
                        <Input name="correctAnswer" defaultValue={step.correctAnswer ?? ""} placeholder="correctAnswer" />
                        <Input name="scoreWeight" defaultValue={step.scoreWeight ?? ""} placeholder="scoreWeight" />
                      </div>
                      <fieldset className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <legend className="sr-only">Configuraciones especiales del paso</legend>
                        <label className="flex items-center gap-2">
                          <input defaultChecked={step.isAssessmentResult} name="isAssessmentResult" type="checkbox" />
                          Resultado de evaluacion
                        </label>
                        <label className="flex items-center gap-2">
                          <input defaultChecked={step.isTerminal} name="isTerminal" type="checkbox" />
                          Paso terminal
                        </label>
                      </fieldset>
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" variant="outline">
                          Guardar paso
                        </Button>
                      </div>
                    </form>

                    <form action={uploadAssetAction} className="mt-3 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="targetType" value="step" />
                      <input type="hidden" name="targetId" value={step.id} />
                      <input type="hidden" name="kind" value="IMAGE" />
                      <Input className="max-w-sm" name="file" type="file" />
                      <Button type="submit" variant="ghost">
                        Subir asset del paso
                      </Button>
                    </form>

                    {step.transitions.length > 0 ? (
                      <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Transiciones actuales
                        </p>
                        {step.transitions.map((transition) => (
                          <div key={transition.id} className="text-sm text-slate-600">
                            <span className="font-medium text-slate-950">{transition.pattern}</span>{" "}
                            → {transition.nextStep?.title ?? "Sin destino"}{" "}
                            {transition.outputValue ? `· guarda "${transition.outputValue}"` : ""}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <form action={createTransitionAction} className="mt-4 grid gap-3 rounded-xl border border-dashed border-slate-200 p-3">
                      <input type="hidden" name="courseId" value={course.id} />
                      <input type="hidden" name="stepId" value={step.id} />
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
                  </div>
                ))}

                <Separator />

                <form action={createOrUpdateStepAction} className="grid gap-3 rounded-2xl bg-slate-50 p-4" aria-describedby={`${module.id}-new-step-help`}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <input type="hidden" name="moduleId" value={module.id} />
                  <p id={`${module.id}-new-step-help`} className="text-sm text-slate-500">
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
