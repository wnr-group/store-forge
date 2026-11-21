"use client";

import type { ThemeEditorAdapter } from "@/lib/editor/adapter";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ComponentNode, TemplateDocument } from "@/lib/templates/document";
import { cardKindOf } from "@/lib/templates/card-parts";
import { LIMITS } from "@/lib/templates/limits";
import { getRegistry } from "@/lib/templates/registry/index";
import { sectionTypesFor } from "@/lib/themes/editor/catalog";
import type { EditorState } from "@/lib/themes/editor/state";
import type { ThemeKind } from "@/lib/themes/types";
import { cn } from "@/lib/utils";
import { CardElements, type CardContext } from "./card-elements";

const registry = getRegistry();

export type SectionActions = {
  select: (docId: string, sectionId: string, blockId?: string) => void;
  toggle: (docId: string, sectionId: string) => void;
  duplicate: (docId: string, sectionId: string) => void;
  remove: (docId: string, sectionId: string) => void;
  move: (docId: string, sectionId: string, toIndex: number) => void;
  add: (docId: string, type: string, index?: number) => void;
  addBlock: (docId: string, sectionId: string, type: string) => void;
  removeBlock: (docId: string, sectionId: string, blockId: string) => void;
  moveBlock: (docId: string, sectionId: string, blockId: string, toIndex: number) => void;
  /** Sets (or, with undefined, clears) one setting of a section. */
  setSetting: (docId: string, sectionId: string, key: string, value: unknown) => void;
};

type Region = { label: string; docId: string | null; kind: ThemeKind; editable: boolean };

type Props = {
  state: EditorState;
  /** template ids of the shared groups, by kind (null when the store has none). */
  groupIds: { announcement: string | null; header: string | null; footer: string | null };
  pageKind: ThemeKind;
  actions: SectionActions;
  disabled: boolean;
  /** What the theme means for product cards (which elements exist, what the description does by default). */
  cardContext: CardContext;
  /** The look's editor adapter: it knows which accepted blocks the look never draws, so they are not offered. */
  adapter: ThemeEditorAdapter;
};

/** The page outline: announcement, header, the page's own (re-orderable) sections, and footer. */
export function SectionsPanel({ state, groupIds, pageKind, actions, disabled, cardContext, adapter }: Props) {
  const regions: Region[] = [
    { label: "Announcement bar", docId: groupIds.announcement, kind: "group_announcement", editable: false },
    { label: "Header", docId: groupIds.header, kind: "group_header", editable: false },
    { label: "Page", docId: state.pageId, kind: pageKind, editable: true },
    { label: "Footer", docId: groupIds.footer, kind: "group_footer", editable: false },
  ];
  return (
    <div className="space-y-5 p-3 sm:p-3.5">
      {regions.map((r) => (r.docId && state.docs[r.docId] ? <Region key={r.kind} region={r} state={state} actions={actions} disabled={disabled} cardContext={cardContext} adapter={adapter} /> : null))}
    </div>
  );
}

function Region({ region, state, actions, disabled, cardContext, adapter }: { region: Region; state: EditorState; actions: SectionActions; disabled: boolean; cardContext: CardContext; adapter: ThemeEditorAdapter }) {
  const docId = region.docId!;
  const doc = state.docs[docId].document as unknown as TemplateDocument;
  const order = doc.order ?? [];
  const [adding, setAdding] = useState(false);
  // dnd-kit numbers its aria ids from a global counter, which differs between the server and the browser and breaks hydration.
  const dndId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const to = order.indexOf(String(over.id));
    if (to >= 0) actions.move(docId, String(active.id), to);
  };

  const atLimit = order.length >= LIMITS.maxSectionsPerTemplate;

  return (
    <section aria-label={region.label}>
      <h3 className="mb-1.5 px-1.5 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{region.label}</h3>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy} disabled={!region.editable || disabled}>
          <ul className="space-y-0.5">
            {order.map((id) => (
              <SectionRow key={id} id={id} node={doc.sections[id]} docId={docId} state={state} actions={actions} sortable={region.editable} canRemove={region.editable} disabled={disabled} cardContext={cardContext} adapter={adapter} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {order.length === 0 ? <p className="px-1 py-2 text-xs text-muted-foreground">Nothing here yet.</p> : null}
      {region.editable ? (
        <>
          <Button variant="outline" size="lg" className="mt-2 w-full border-dashed bg-transparent text-muted-foreground shadow-none hover:border-primary/50 hover:bg-primary/5 hover:text-primary" disabled={disabled || atLimit} onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Add section
          </Button>
          {atLimit ? <p className="mt-1 px-1 text-xs text-muted-foreground">A page can have up to {LIMITS.maxSectionsPerTemplate} sections.</p> : null}
          <AddSectionDialog open={adding} kind={region.kind} onClose={() => setAdding(false)} onPick={(type) => { actions.add(docId, type); setAdding(false); }} />
        </>
      ) : null}
    </section>
  );
}

function SectionRow({ id, node, docId, state, actions, sortable, canRemove, disabled, cardContext, adapter }: { id: string; node: ComponentNode | undefined; docId: string; state: EditorState; actions: SectionActions; sortable: boolean; canRemove: boolean; disabled: boolean; cardContext: CardContext; adapter: ThemeEditorAdapter }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !sortable || disabled });
  const sel = state.selection;
  const selected = sel !== null && "sectionId" in sel && sel.docId === docId && sel.sectionId === id;
  const [open, setOpen] = useState(false);
  const def = node ? registry.sections[node.type] : undefined;
  const name = def?.name ?? node?.type ?? id;
  const blocks = node?.block_order ?? [];
  const cardKind = cardKindOf(node?.type);
  const hasCards = cardKind !== null;
  const expanded = selected || open;
  const hidden = Boolean(node?.disabled);
  const acceptable = useMemo(() => (def?.accepts ?? []).filter((t) => registry.blocks[t] && (adapter.drawsBlock?.(t, node?.type ?? "") ?? true)), [def, adapter, node?.type]);
  const [addBlockOpen, setAddBlockOpen] = useState(false);

  if (!node) return null;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("group/row rounded-lg transition-colors", selected ? "bg-primary/10" : "hover:bg-muted/70", isDragging && "z-10 bg-card opacity-90 shadow-lg ring-1 ring-border")}>
      <div className="relative flex items-center gap-0.5 p-1">
        {sortable ? (
          <button type="button" className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed" aria-label={`Drag ${name} to reorder`} disabled={disabled} {...attributes} {...listeners}>
            <GripVertical className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="w-1.5" />
        )}
        <button type="button" onClick={() => actions.select(docId, id)} className={cn("min-w-0 flex-1 rounded px-1.5 py-1.5 text-left text-sm leading-snug break-words outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "font-medium text-primary" : "text-foreground/90", hidden && "text-muted-foreground line-through")} aria-current={selected || undefined}>
          {name}
        </button>
        {!sortable ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Global</span> : blocks.length > 0 ? <span className={cn("shrink-0 px-1 text-[10px] text-muted-foreground", expanded && "hidden")}>{blocks.length}</span> : null}
        {blocks.length > 0 || hasCards ? (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={expanded} aria-label={expanded ? `Hide ${name} blocks` : `Show ${name} blocks`} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted">
            {expanded ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
          </button>
        ) : null}
        {/* On large screens the buttons float over the end of the row on hover, so they never take room from the name. */}
        <div className="flex shrink-0 items-center transition-opacity lg:pointer-events-none lg:absolute lg:top-1/2 lg:right-1 lg:-translate-y-1/2 lg:rounded-md lg:bg-card lg:opacity-0 lg:shadow-sm lg:ring-1 lg:ring-border lg:group-focus-within/row:pointer-events-auto lg:group-focus-within/row:opacity-100 lg:group-hover/row:pointer-events-auto lg:group-hover/row:opacity-100">
        <Button size="icon-xs" variant="ghost" aria-label={hidden ? `Show ${name}` : `Hide ${name}`} aria-pressed={hidden} disabled={disabled} onClick={() => actions.toggle(docId, id)}>
          {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        {canRemove ? (
          <Button size="icon-xs" variant="ghost" aria-label={`Remove ${name}`} disabled={disabled} onClick={() => actions.remove(docId, id)} className="hover:text-destructive"><Trash2 aria-hidden /></Button>
        ) : null}
        </div>
      </div>
      {expanded && (blocks.length > 0 || acceptable.length > 0 || hasCards) ? (
        <div className="mb-1 ml-5 border-l pr-1 pb-1 pl-1.5">
          {cardKind ? <CardElements kind={cardKind} className="mb-1.5" settings={node.settings} context={cardContext} disabled={disabled} onChange={(key, value) => actions.setSetting(docId, id, key, value)} /> : null}
          <ul className="space-y-0.5">
            {blocks.map((blockId, index) => {
              const block = node.blocks[blockId];
              const blockSelected = sel !== null && "blockId" in sel && sel.blockId === blockId;
              return (
                <li key={blockId} className={cn("flex items-center gap-0.5 rounded-md px-1.5", blockSelected ? "bg-primary/15 text-primary" : "hover:bg-muted")}>
                  <button type="button" onClick={() => actions.select(docId, id, blockId)} className="min-w-0 flex-1 py-1.5 text-left text-[13px] leading-snug break-words outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-current={blockSelected || undefined}>
                    {registry.blocks[block?.type ?? ""]?.name ?? block?.type}
                  </button>
                  <Button size="icon-xs" variant="ghost" aria-label="Move block up" disabled={disabled || index === 0} onClick={() => actions.moveBlock(docId, id, blockId, index - 1)}><ChevronDown className="rotate-180" aria-hidden /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Move block down" disabled={disabled || index === blocks.length - 1} onClick={() => actions.moveBlock(docId, id, blockId, index + 1)}><ChevronDown aria-hidden /></Button>
                  <Button size="icon-xs" variant="ghost" aria-label="Remove block" disabled={disabled} onClick={() => actions.removeBlock(docId, id, blockId)} className="hover:text-destructive"><Trash2 aria-hidden /></Button>
                </li>
              );
            })}
          </ul>
          {acceptable.length > 0 ? (
            <div className="mt-1">
              <Button size="xs" variant="ghost" className="w-full justify-start" disabled={disabled} onClick={() => setAddBlockOpen(!addBlockOpen)} aria-expanded={addBlockOpen}>
                <Plus aria-hidden /> Add block
              </Button>
              {addBlockOpen ? (
                <ul className="mt-1 grid grid-cols-2 gap-1">
                  {acceptable.map((type) => (
                    <li key={type}>
                      <Button size="xs" variant="outline" className="w-full" onClick={() => { actions.addBlock(docId, id, type); setAddBlockOpen(false); }}>
                        {registry.blocks[type].name}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AddSectionDialog({ open, kind, onClose, onPick }: { open: boolean; kind: ThemeKind; onClose: () => void; onPick: (type: string) => void }) {
  const groups = useMemo(() => {
    const byCategory = new Map<string, { type: string; name: string; description?: string }[]>();
    for (const type of sectionTypesFor(kind)) {
      const def = registry.sections[type];
      if (!def) continue;
      const category = def.category ?? "Other";
      byCategory.set(category, [...(byCategory.get(category) ?? []), { type, name: def.name, description: def.description }]);
    }
    return [...byCategory.entries()];
  }, [kind]);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a section</DialogTitle>
          <DialogDescription>Sections are the building blocks of your page. You can change everything about them afterwards.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60dvh] space-y-4 overflow-y-auto pr-1">
          {groups.map(([category, items]) => (
            <div key={category}>
              <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">{category}</h4>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {items.map((s) => (
                  <li key={s.type}>
                    <button type="button" onClick={() => onPick(s.type)} className="w-full rounded-md border bg-card p-2.5 text-left transition-colors outline-none hover:border-primary focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="block text-sm font-medium">{s.name}</span>
                      {s.description ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{s.description}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
