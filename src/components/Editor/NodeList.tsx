"use client";

import NoteNode from "@/components/Editor/NoteNode";
import type { MemoType } from "@/types/memoKind";
import type { NoteNode as NoteNodeType, NotePluginData, NoteGameData, CustomCardProperty } from "@/types/note";

type NodeListProps = {
  nodes: NoteNodeType[];
  memoType?: MemoType;
  themeColor: string;
  /** Multiplier 0–1 from sidebar row tint alpha; fades themed borders/fills, not body text hue. */
  themeChromeAlphaMult?: number;
  onActive: (id: string, editor: HTMLDivElement | null) => void;
  onUpdate: (id: string, content: string) => void;
  onToggleCollapsed: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onIndent: (id: string) => void;
  onUnindent: (id: string) => void;
  onToggleCompleted: (id: string) => void;
  onToggleHasCheckbox: (id: string) => void;
  onToggleNote: (id: string) => void;
  onSetNote: (id: string, text: string) => void;
  onSetBgColor: (id: string, color: string | null, opts?: { skipHistory?: boolean }) => void;
  onSetHeading: (id: string, heading: NoteNodeType["headingLevel"]) => void;
  onDelete: (id: string) => void;
  onDeleteEmpty: (id: string) => void;
  onFocusNode: (id: string) => void;
  selectedIds?: string[];
  /** Passed as false for roots; descendants inherit coverage from `NoteNode`. */
  ancestorCoversSelection?: boolean;
  isSelectionMode?: boolean;
  onSelectStart?: (id: string, e: React.MouseEvent) => void;
  onMobileSelectNode?: (id: string) => void;
  onPatchPluginData: (id: string, patch: Partial<NotePluginData>, historyMode?: "immediate" | "none") => void;
  onPatchGameData: (id: string, patch: Partial<NoteGameData>, historyMode?: "immediate" | "none") => void;
  onAddCard: (id: string) => void;
  onPatchCardTitle: (id: string, title: string) => void;
  onAddCardProperty: (id: string) => void;
  onRemoveCardProperty: (id: string, propId: string) => void;
  onPatchCardProperty: (id: string, propId: string, patch: Partial<Omit<CustomCardProperty, "id">>, historyMode?: "immediate" | "none") => void;
  onRemoveCard: (id: string) => void;
  onMemoColorSliderUndoGestureStart?: () => void;
  onMemoColorSliderUndoGestureEnd?: () => void;
  onPatchNodeContents: (patches: Record<string, string>) => void;
  onSetNodeImageUrl: (id: string, url: string | null) => void;
  /** Shared viewer: disable editing in all nodes. */
  editorReadOnly?: boolean;
  /** Mobile: hide ⋮ / long-press menu; use bottom editor bar instead. */
  suppressFloatingContextMenu?: boolean;
  /** Compact screens + selection mode: tap overlay toggles selection instead of editing. */
  mobileTapToggleOverlay?: boolean;
};

export default function NodeList({
  nodes,
  memoType = "standard",
  themeColor,
  themeChromeAlphaMult = 1,
  onActive,
  onUpdate,
  onToggleCollapsed,
  onAddChild,
  onAddSibling,
  onIndent,
  onUnindent,
  onToggleCompleted,
  onToggleHasCheckbox,
  onToggleNote,
  onSetNote,
  onSetBgColor,
  onSetHeading,
  onDelete,
  onDeleteEmpty,
  onFocusNode,
  selectedIds = [],
  ancestorCoversSelection = false,
  isSelectionMode = false,
  onSelectStart,
  onMobileSelectNode,
  onPatchPluginData,
  onPatchGameData,
  onAddCard,
  onPatchCardTitle,
  onAddCardProperty,
  onRemoveCardProperty,
  onPatchCardProperty,
  onRemoveCard,
  onMemoColorSliderUndoGestureStart,
  onMemoColorSliderUndoGestureEnd,
  onPatchNodeContents,
  onSetNodeImageUrl,
  editorReadOnly = false,
  suppressFloatingContextMenu = false,
  mobileTapToggleOverlay = false,
}: NodeListProps) {
  return (
    <div className="space-y-2">
      {nodes.map((node) => (
        <NoteNode
          key={node.id}
          node={node}
          depth={0}
          onActive={onActive}
          onUpdate={onUpdate}
          onToggleCollapsed={onToggleCollapsed}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onIndent={onIndent}
          onUnindent={onUnindent}
          onToggleCompleted={onToggleCompleted}
          onToggleHasCheckbox={onToggleHasCheckbox}
          onToggleNote={onToggleNote}
          onSetNote={onSetNote}
          onSetBgColor={onSetBgColor}
          onSetHeading={onSetHeading}
          onDelete={onDelete}
          onDeleteEmpty={onDeleteEmpty}
          onFocusNode={onFocusNode}
          selectedIds={selectedIds}
          ancestorCoversSelection={ancestorCoversSelection}
          isSelectionMode={isSelectionMode}
          onSelectStart={onSelectStart}
          onMobileSelectNode={onMobileSelectNode}
          memoType={memoType}
          onPatchPluginData={onPatchPluginData}
          onPatchGameData={onPatchGameData}
          onAddCard={onAddCard}
          onPatchCardTitle={onPatchCardTitle}
          onAddCardProperty={onAddCardProperty}
          onRemoveCardProperty={onRemoveCardProperty}
          onPatchCardProperty={onPatchCardProperty}
          onRemoveCard={onRemoveCard}
          themeColor={themeColor}
          themeChromeAlphaMult={themeChromeAlphaMult}
          onMemoColorSliderUndoGestureStart={onMemoColorSliderUndoGestureStart}
          onMemoColorSliderUndoGestureEnd={onMemoColorSliderUndoGestureEnd}
          onPatchNodeContents={onPatchNodeContents}
          onSetNodeImageUrl={onSetNodeImageUrl}
          editorReadOnly={editorReadOnly}
          suppressFloatingContextMenu={suppressFloatingContextMenu}
          mobileTapToggleOverlay={mobileTapToggleOverlay}
        />
      ))}
    </div>
  );
}
