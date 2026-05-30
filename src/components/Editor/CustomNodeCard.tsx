"use client";

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { themeChromeRgba, isThemeChromeInvisible } from "@/lib/memoThemeColor";
import type { CustomCardData, CustomCardProperty } from "@/types/note";
import { useTranslation } from "@/i18n/useTranslation";

type Props = {
  data: CustomCardData;
  accentColor: string;
  chromeAlphaMult?: number;
  onPatchTitle: (title: string) => void;
  onAddProperty: () => void;
  onInsertPropertyAt: (atIndex: number) => void;
  onReorderProperties: (fromIndex: number, toIndex: number) => void;
  onRemoveProperty: (propId: string) => void;
  onPatchProperty: (
    propId: string,
    patch: Partial<Omit<CustomCardProperty, "id">>,
    historyMode?: "immediate" | "none",
  ) => void;
  onRemoveCard: () => void;
  readOnly?: boolean;
};

// ── Sortable property row ─────────────────────────────────────────────────────

type RowProps = {
  prop: CustomCardProperty;
  index: number;
  total: number;
  readOnly: boolean;
  onInsertPropertyAt: (atIndex: number) => void;
  onPatchProperty: Props["onPatchProperty"];
  onRemoveProperty: (propId: string) => void;
};

function SortablePropertyRow({
  prop,
  index,
  total,
  readOnly,
  onInsertPropertyAt,
  onPatchProperty,
  onRemoveProperty,
}: RowProps) {
  const [hovered, setHovered] = useState(false);
  const { t } = useTranslation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: prop.id, disabled: readOnly });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Insert-before button — shown on hover above row 0 only */}
      {!readOnly && index === 0 && hovered && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onInsertPropertyAt(0)}
          className="absolute -top-2.5 left-6 z-10 flex h-4 items-center gap-0.5 rounded px-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-cyan-400"
          title="ここに挿入"
        >
          <Plus size={8} strokeWidth={3} aria-hidden />
        </button>
      )}

      <div className="flex items-start gap-1.5">
        {/* Drag handle */}
        {!readOnly && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-0.5 flex h-[22px] w-4 shrink-0 cursor-grab items-center justify-center text-zinc-700 transition-colors hover:text-zinc-400 active:cursor-grabbing"
            tabIndex={-1}
            aria-label="drag to reorder"
          >
            <GripVertical size={11} strokeWidth={1.5} aria-hidden />
          </button>
        )}

        {/* Label */}
        <input
          type="text"
          value={prop.label}
          readOnly={readOnly}
          onChange={(e) => onPatchProperty(prop.id, { label: e.target.value })}
          placeholder={t("card.propLabelPh")}
          className="w-[72px] shrink-0 border border-zinc-700/60 bg-zinc-950/40 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400 outline-none placeholder:text-zinc-700 focus:border-cyan-700/40 read-only:cursor-default read-only:opacity-90"
        />

        {/* Value */}
        <div className="min-w-0 flex-1">
          {prop.type === "textarea" ? (
            <textarea
              value={prop.value}
              readOnly={readOnly}
              onChange={(e) => onPatchProperty(prop.id, { value: e.target.value })}
              placeholder={t("card.propValuePh")}
              rows={2}
              className="w-full resize-y border border-zinc-700/60 bg-zinc-950/40 px-1.5 py-0.5 font-mono text-[11px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-cyan-700/40 read-only:cursor-default read-only:opacity-90"
            />
          ) : (
            <input
              type="text"
              value={prop.value}
              readOnly={readOnly}
              onChange={(e) => onPatchProperty(prop.id, { value: e.target.value })}
              placeholder={t("card.propValuePh")}
              className="w-full border border-zinc-700/60 bg-zinc-950/40 px-1.5 py-0.5 font-mono text-[11px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-cyan-700/40 read-only:cursor-default read-only:opacity-90"
            />
          )}
        </div>

        {/* Type toggle + remove */}
        {!readOnly && (
          <div className="flex shrink-0 flex-col gap-px">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() =>
                onPatchProperty(
                  prop.id,
                  { type: prop.type === "textarea" ? "text" : "textarea" },
                  "immediate",
                )
              }
              title={prop.type === "textarea" ? t("card.typeToggleSingle") : t("card.typeToggleMulti")}
              className="flex h-[14px] w-5 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-300"
            >
              <span className="font-mono text-[8px]">
                {prop.type === "textarea" ? "T" : "¶"}
              </span>
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => onRemoveProperty(prop.id)}
              title={t("card.removeProperty")}
              className="flex h-[14px] w-5 items-center justify-center text-zinc-600 transition-colors hover:text-red-400"
            >
              <X size={8} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        )}
      </div>

      {/* Insert-after button — shown on hover for each row */}
      {!readOnly && hovered && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onInsertPropertyAt(index + 1)}
          className="absolute -bottom-2.5 left-6 z-10 flex h-4 items-center gap-0.5 rounded px-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-cyan-400"
          title="ここに挿入"
        >
          <Plus size={8} strokeWidth={3} aria-hidden />
        </button>
      )}
    </div>
  );
}

// ── Main card component ───────────────────────────────────────────────────────

export function CustomNodeCard({
  data,
  accentColor,
  chromeAlphaMult = 1,
  onPatchTitle,
  onAddProperty,
  onInsertPropertyAt,
  onReorderProperties,
  onRemoveProperty,
  onPatchProperty,
  onRemoveCard,
  readOnly = false,
}: Props) {
  const { t } = useTranslation();
  const chrome = chromeAlphaMult;
  const hideChrome = isThemeChromeInvisible(chrome);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = data.properties.map((p) => p.id);
    const fromIndex = ids.indexOf(active.id as string);
    const toIndex = ids.indexOf(over.id as string);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorderProperties(fromIndex, toIndex);
    }
  }

  return (
    <div
      data-geo-editor="custom-card"
      className={cn(
        "min-h-[22px] flex-1 rounded-md border border-cyan-500/20 bg-zinc-900/40 px-2.5 py-2",
        "shadow-[inset_0_1px_0_rgba(6,182,212,0.06),0_0_24px_rgba(6,182,212,0.04)]",
        "transition-colors duration-150 ease-in-out hover:bg-zinc-800/50",
      )}
      style={
        hideChrome
          ? { boxShadow: "none" }
          : {
              borderColor: themeChromeRgba(accentColor, 0.38, chrome),
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 22px ${themeChromeRgba(accentColor, 0.08, chrome)}`,
            }
      }
    >
      {/* Header row: title + remove-card button */}
      <div className="mb-2 flex items-center gap-1.5">
        <input
          type="text"
          data-card-focus-target="name"
          value={data.title}
          readOnly={readOnly}
          onChange={(e) => onPatchTitle(e.target.value)}
          placeholder={t("card.titlePh")}
          className="min-w-0 flex-1 border border-zinc-700/60 bg-zinc-950/40 px-2 py-1 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-600/40 focus:ring-1 focus:ring-cyan-500/20 read-only:cursor-default read-only:opacity-90"
        />
        {!readOnly && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              if (window.confirm(t("card.removeCardConfirm"))) onRemoveCard();
            }}
            title={t("card.removeCard")}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-red-950/40 hover:text-red-400"
          >
            <X size={11} strokeWidth={2.5} aria-hidden />
          </button>
        )}
      </div>

      {/* Property rows with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={data.properties.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {data.properties.map((prop, index) => (
              <SortablePropertyRow
                key={prop.id}
                prop={prop}
                index={index}
                total={data.properties.length}
                readOnly={readOnly}
                onInsertPropertyAt={onInsertPropertyAt}
                onPatchProperty={onPatchProperty}
                onRemoveProperty={onRemoveProperty}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add property button (appends to end) */}
      {!readOnly && (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onAddProperty}
          className="mt-3 flex items-center gap-1 font-mono text-[9px] tracking-wider text-zinc-600 transition-colors hover:text-cyan-400"
        >
          <Plus size={9} strokeWidth={2.5} aria-hidden />
          <span>{t("card.addProperty")}</span>
        </button>
      )}
    </div>
  );
}
