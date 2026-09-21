"use client";

import { useState } from "react";
import { PROJECT_STATUSES, STATUS_LABELS, type Project, type TeamMember } from "@/lib/types";
import { projectInputSchema, fieldErrors, type ProjectInput } from "@/lib/validation";
import { todayIso } from "@/lib/format";
import { ApiError } from "@/lib/api-client";
import { Modal } from "./Modal";
import { Button, Field, controlClass } from "./ui";

interface ProjectFormModalProps {
  open: boolean;
  /** `null` means "create"; a project means "edit that project". */
  project: Project | null;
  team: TeamMember[];
  onClose: () => void;
  onSubmit: (values: ProjectInput) => Promise<void>;
}

/** The form's own state: every field is a string, as HTML inputs produce. */
interface FormState {
  name: string;
  client: string;
  description: string;
  status: string;
  deadline: string;
  budget: string;
  assigneeId: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  client: "",
  description: "",
  status: "active",
  deadline: "",
  budget: "",
  assigneeId: "",
};

function toFormState(project: Project | null): FormState {
  if (!project) return { ...EMPTY_FORM, deadline: todayIso() };
  return {
    name: project.name,
    client: project.client,
    description: project.description,
    status: project.status,
    deadline: project.deadline,
    budget: String(project.budget),
    assigneeId: project.assignee ? String(project.assignee.id) : "",
  };
}

/**
 * Add/edit dialog.
 *
 * The caller gives this component a new `key` every time the dialog opens, so
 * React remounts it and the form starts from `project` - no effect is needed
 * to reset state between a "create" and an "edit".
 */
export function ProjectFormModal({
  open,
  project,
  team,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(project));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
    // Clear the field's error as soon as the user edits it.
    setErrors((previous) => {
      if (!previous[key]) return previous;
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Validate with the exact schema the API uses, so the client and the
    // server can never disagree about what is acceptable.
    const parsed = projectInputSchema.safeParse({
      ...form,
      assigneeId: form.assigneeId === "" ? null : form.assigneeId,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.details);
        setFormError(Object.keys(error.details).length > 0 ? null : error.message);
      } else {
        setFormError("Could not save the project. Please try again.");
      }
      setSaving(false);
    }
  }

  const isEdit = project !== null;

  return (
    <Modal
      open={open}
      title={isEdit ? "Edit project" : "New project"}
      description={
        isEdit
          ? "Update the details of this project."
          : "Add a project to the dashboard. You can change everything later."
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" variant="primary" loading={saving}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {formError}
          </p>
        )}

        <Field label="Project name" htmlFor="name" error={errors.name} className="sm:col-span-2">
          <input
            id="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            placeholder="Customer portal redesign"
            className={controlClass(Boolean(errors.name))}
          />
        </Field>

        <Field label="Client" htmlFor="client" error={errors.client} hint="Optional">
          <input
            id="client"
            value={form.client}
            onChange={(event) => update("client", event.target.value)}
            aria-invalid={Boolean(errors.client)}
            placeholder="Northwind Trading"
            className={controlClass(Boolean(errors.client))}
          />
        </Field>

        <Field label="Status" htmlFor="status" error={errors.status}>
          <select
            id="status"
            value={form.status}
            onChange={(event) => update("status", event.target.value)}
            className={controlClass(Boolean(errors.status))}
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Deadline" htmlFor="deadline" error={errors.deadline}>
          <input
            id="deadline"
            type="date"
            value={form.deadline}
            onChange={(event) => update("deadline", event.target.value)}
            aria-invalid={Boolean(errors.deadline)}
            aria-describedby={errors.deadline ? "deadline-error" : undefined}
            className={controlClass(Boolean(errors.deadline))}
          />
        </Field>

        <Field label="Budget (USD)" htmlFor="budget" error={errors.budget}>
          <input
            id="budget"
            type="number"
            min="0"
            step="100"
            inputMode="decimal"
            value={form.budget}
            onChange={(event) => update("budget", event.target.value)}
            aria-invalid={Boolean(errors.budget)}
            aria-describedby={errors.budget ? "budget-error" : undefined}
            placeholder="25000"
            className={controlClass(Boolean(errors.budget))}
          />
        </Field>

        <Field
          label="Assigned to"
          htmlFor="assigneeId"
          error={errors.assigneeId}
          className="sm:col-span-2"
        >
          <select
            id="assigneeId"
            value={form.assigneeId}
            onChange={(event) => update("assigneeId", event.target.value)}
            className={controlClass(Boolean(errors.assigneeId))}
          >
            <option value="">Unassigned</option>
            {team.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name} - {member.role}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Description"
          htmlFor="description"
          error={errors.description}
          hint="Optional. Searchable from the dashboard."
          className="sm:col-span-2"
        >
          <textarea
            id="description"
            rows={3}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="What is this project about?"
            className={controlClass(Boolean(errors.description), "resize-y")}
          />
        </Field>
      </form>
    </Modal>
  );
}
