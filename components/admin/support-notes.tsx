"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { addSupportNoteAction, updateSupportNoteAction } from "@/app/(admin)/admin/actions";
import { FormField } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useFormErrors } from "@/lib/forms/use-form-errors";
import { supportNoteSchema } from "@/lib/validations/admin-platform";

export type NoteView = {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  edited: boolean;
  canEdit: boolean;
};

const when = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function AddNote({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();

  const submit = () => {
    if (!validate(supportNoteSchema, { body })) return;
    send(async () => {
      const res = await addSupportNoteAction(tenantId, { body });
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Note added");
      setBody("");
      router.refresh();
    });
  };

  return (
    <form noValidate className="space-y-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
      <FormField id="sn-body" label="New note" error={errors.body} hint="Only platform admins can see this. Up to 2000 characters. Do not paste passwords.">
        <Textarea
          id="sn-body"
          rows={3}
          value={body}
          onChange={(e) => { setBody(e.target.value); clear("body"); }}
          disabled={pending}
          aria-invalid={Boolean(errors.body)}
          aria-describedby="sn-body-msg"
        />
      </FormField>
      <Button type="submit" disabled={pending || !body.trim()}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} {pending ? "Saving…" : "Add note"}
      </Button>
    </form>
  );
}

function NoteItem({ note }: { note: NoteView }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const { errors, formError, pending, validate, clear, fail, submit: send } = useFormErrors();

  const save = () => {
    if (!validate(supportNoteSchema, { body })) return;
    send(async () => {
      const res = await updateSupportNoteAction(note.id, { body });
      if (!res.ok) {
        fail(res);
        return;
      }
      toast.success("Note updated");
      setEditing(false);
      router.refresh();
    });
  };

  return (
    <li className="space-y-1.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {note.authorEmail} · {when.format(new Date(note.createdAt))}
          {note.edited ? " · edited" : ""}
        </span>
        {note.canEdit && !editing ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> Edit
          </Button>
        ) : null}
      </div>
      {editing ? (
        <form noValidate className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {formError ? <p role="alert" className="text-sm text-error">{formError}</p> : null}
          <FormField id={`sn-${note.id}`} label="Edit note" error={errors.body}>
            <Textarea
              id={`sn-${note.id}`}
              rows={3}
              value={body}
              onChange={(e) => { setBody(e.target.value); clear("body"); }}
              disabled={pending}
              aria-invalid={Boolean(errors.body)}
              aria-describedby={`sn-${note.id}-msg`}
              autoFocus
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null} Save
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setEditing(false); setBody(note.body); }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm whitespace-pre-wrap">{note.body}</p>
      )}
    </li>
  );
}

/**
 * Internal support notes for one organization. They are never shown to the organization. Everyone with admin access can add a
 * note and read them all; each admin can edit only their own. The server and database enforce that, not this component.
 */
export function SupportNotes({ tenantId, notes, total }: { tenantId: string; notes: NoteView[]; total: number }) {
  return (
    <div className="space-y-4">
      <AddNote tenantId={tenantId} />
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <>
          <ul className="divide-y rounded-lg border px-4">
            {notes.map((n) => (
              <NoteItem key={`${n.id}|${n.body}`} note={n} />
            ))}
          </ul>
          {total > notes.length ? <p className="text-xs text-muted-foreground">Showing the latest {notes.length} of {total}. Older notes are on the Support page.</p> : null}
        </>
      )}
    </div>
  );
}
