"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { getCollectionQuickEditAction, quickEditCollectionAction } from "@/app/(dashboard)/dashboard/collections/actions";
import { ImageUploader, type ImageItem } from "@/components/products/image-uploader";
import { useReportFormState, type FormState } from "@/components/shared/embedded-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROUTES } from "@/config/app";
import type { CollectionQuickEdit } from "@/services/collection.service";
import { useDiscardGuard } from "./discard-guard";

/** The collection a card shows: its id and name, which is all the card carries. */
export type CardCollectionRef = { id: string; name: string };

/** Which field the merchant came for, so it is focused when the form opens. */
export type CollectionEditField = "name" | "description" | "image";

/**
 * Edit the collection behind a card, from the card: name, description and picture. It saves the real collection (the record the
 * Collections page edits), so the change shows everywhere it is listed. Esc, a click outside and Cancel ask first when something
 * was changed.
 */
export function CollectionQuickEdit({ target, field, canEdit, onClose, onSaved }: { target: CardCollectionRef | null; field: CollectionEditField; canEdit: boolean; onClose: () => void; onSaved: (collection: CollectionQuickEdit) => void }) {
  const query = useQuery({
    queryKey: ["quick-edit-collection", target?.id],
    enabled: Boolean(target),
    // Always the collection as it is now: another tab or the Collections page may have changed it.
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const result = await getCollectionQuickEditAction(target!.id);
      if (!result.ok) throw new Error(result.error);
      return result.data!;
    },
  });
  const guard = useDiscardGuard(onClose);

  return (
    <>
      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open) guard.requestClose(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit collection</DialogTitle>
            <DialogDescription>Changes are saved to the collection itself and show everywhere it is listed.</DialogDescription>
          </DialogHeader>
          {query.isPending ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin" aria-label="Loading collection" /></div>
          ) : query.isError ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-2">
                {query.error.message}
                <Button size="xs" variant="outline" onClick={() => void query.refetch()}>Try again</Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Form key={query.data.id} collection={query.data} field={field} canEdit={canEdit} onCancel={guard.requestClose} onDone={guard.closeNow} onStateChange={guard.report} onSaved={onSaved} />
          )}
        </DialogContent>
      </Dialog>
      {guard.confirm}
    </>
  );
}

function Form({ collection, field, canEdit, onCancel, onDone, onStateChange, onSaved }: { collection: CollectionQuickEdit; field: CollectionEditField; canEdit: boolean; onCancel: () => void; onDone: () => void; onStateChange: (state: FormState) => void; onSaved: (collection: CollectionQuickEdit) => void }) {
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description);
  const [images, setImages] = useState<ImageItem[]>(
    collection.imagePath ? [{ key: "current", path: collection.imagePath, altText: collection.name, progress: 100, status: "done", saved: true }] : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploading = images.some((i) => i.status === "uploading");
  const failed = images.some((i) => i.status === "error");
  const newPath = images[0]?.status === "done" && images[0].path !== collection.imagePath ? images[0].path : null;
  const changed = name !== collection.name || description !== collection.description || newPath !== null;
  const disabled = !canEdit || saving;
  useReportFormState(onStateChange, changed || uploading, saving);

  async function save() {
    if (failed) return setError("Remove the picture that failed to upload, or upload it again.");
    if (!name.trim()) return setError("Enter a collection name.");
    setSaving(true);
    setError(null);
    try {
      const result = await quickEditCollectionAction({ id: collection.id, name, description, imagePath: newPath });
      if (!result.ok) {
        setError(Object.values(result.fieldErrors ?? {})[0] ?? result.error);
        return;
      }
      toast.success("Collection updated", { description: result.data!.name });
      onSaved(result.data!);
      onDone();
    } catch {
      setError("Could not save the collection. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <div className="space-y-1.5">
        <Label htmlFor="qe-col-name" className="text-xs font-medium">Collection name</Label>
        <Input id="qe-col-name" value={name} maxLength={80} disabled={disabled} autoFocus={field === "name"} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="qe-col-desc" className="text-xs font-medium">Description</Label>
        <Textarea id="qe-col-desc" value={description} rows={3} maxLength={1000} disabled={disabled} autoFocus={field === "description"} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Picture</Label>
        <ImageUploader value={images} onChange={setImages} scope="collection" ownerId={collection.id} max={1} single disabled={disabled} />
        <p className="text-xs text-muted-foreground">Upload a new picture to replace the current one.</p>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      {!canEdit ? <p className="text-xs text-muted-foreground">You can look but not change anything. Editing needs access to the catalogue.</p> : null}
      <DialogFooter className="items-center sm:justify-between">
        <Link href={`${ROUTES.collections}/${collection.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Full collection page <ExternalLink className="size-3" aria-hidden />
        </Link>
        <span className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={disabled || uploading || !changed}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null} Save
          </Button>
        </span>
      </DialogFooter>
    </form>
  );
}
