"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { TableData } from "@/types/note";
import { useTranslation } from "@/i18n/useTranslation";

type Props = {
  data: TableData;
  accentColor: string;
  readOnly?: boolean;
  onAddColumn: () => void;
  onRenameColumn: (colId: string, label: string) => void;
  onRemoveColumn: (colId: string) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onPatchCell: (rowId: string, colId: string, value: string, historyMode?: "immediate" | "none") => void;
  onRemoveTable: () => void;
};

export function TableNodeCard({
  data,
  accentColor,
  readOnly = false,
  onAddColumn,
  onRenameColumn,
  onRemoveColumn,
  onAddRow,
  onRemoveRow,
  onPatchCell,
  onRemoveTable,
}: Props) {
  const { t } = useTranslation();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasColumns = data.columns.length > 0;

  return (
    <div className="mt-1.5 overflow-hidden rounded border border-zinc-700/50 bg-neutral-900 font-mono text-[11px]">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-zinc-700/50 bg-zinc-900/70 px-2.5 py-1">
        <span
          className="shrink-0 rounded-sm px-1 py-px text-[8px] font-semibold tracking-[0.18em]"
          style={{ backgroundColor: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44` }}
        >
          {t("table.badge")}
        </span>
        <div className="flex-1" />
        {!readOnly && (
          confirmRemove ? (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">{t("table.removeTableConfirm")}</span>
              <button
                type="button"
                onClick={() => { setConfirmRemove(false); onRemoveTable(); }}
                className="px-1 py-px text-red-400 hover:text-red-300 transition-colors"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(false)}
                className="px-1 py-px text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
            >
              {t("table.removeTable")}
            </button>
          )
        )}
      </div>

      {/* ── Table grid ── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {hasColumns && (
            <thead>
              <tr>
                {data.columns.map((col) => (
                  <th
                    key={col.id}
                    className="border-b border-r border-zinc-700/40 bg-zinc-900/40 px-2 py-1 text-left font-semibold text-zinc-400 last:border-r-0"
                    style={{ minWidth: 80 }}
                  >
                    {readOnly ? (
                      <span>{col.label || "—"}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={col.label}
                          placeholder={t("table.colPh")}
                          onChange={(e) => onRenameColumn(col.id, e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-zinc-300 placeholder-zinc-700 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveColumn(col.id)}
                          className="shrink-0 text-zinc-700 hover:text-red-400 transition-colors leading-none"
                          aria-label="列を削除"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </th>
                ))}
                {!readOnly && (
                  <th className="border-b border-zinc-700/40 bg-zinc-900/40 px-2 py-1 text-left">
                    <button
                      type="button"
                      onClick={onAddColumn}
                      className="text-zinc-500 hover:text-cyan-400 transition-colors whitespace-nowrap"
                    >
                      {t("table.addColumn")}
                    </button>
                  </th>
                )}
              </tr>
            </thead>
          )}
          <tbody>
            {data.rows.map((row) => (
              <tr
                key={row.id}
                className="group border-b border-zinc-700/30 last:border-b-0 hover:bg-zinc-800/20 transition-colors"
              >
                {data.columns.map((col) => (
                  <td
                    key={col.id}
                    className="border-r border-zinc-700/30 px-2 py-1 last:border-r-0"
                  >
                    {readOnly ? (
                      <span className="text-zinc-300">{row.cells[col.id] ?? ""}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.cells[col.id] ?? ""}
                        onChange={(e) => onPatchCell(row.id, col.id, e.target.value)}
                        onBlur={(e) => onPatchCell(row.id, col.id, e.target.value, "immediate")}
                        className={cn(
                          "w-full bg-transparent text-zinc-300 outline-none",
                          "placeholder-zinc-700",
                        )}
                        style={{ minWidth: 60 }}
                      />
                    )}
                  </td>
                ))}
                {!readOnly && (
                  <td className="border-r border-zinc-700/30 px-1 py-1 last:border-r-0">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.id)}
                      aria-label="行を削除"
                      className="text-zinc-700 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Footer actions ── */}
      {!readOnly && (
        <div className="flex items-center gap-3 border-t border-zinc-700/40 px-2.5 py-1">
          <button
            type="button"
            onClick={onAddRow}
            className="text-zinc-500 hover:text-cyan-400 transition-colors"
          >
            {t("table.addRow")}
          </button>
          {!hasColumns && (
            <button
              type="button"
              onClick={onAddColumn}
              className="text-zinc-500 hover:text-cyan-400 transition-colors"
            >
              {t("table.addColumn")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
