"use client";

import { useState } from "react";

/**
 * A players-table row that toggles a detail row (the player's round-by-round history) below
 * it on click. Cells and the history are rendered on the server and passed in as children.
 * Clicks that start on an interactive element (the Withdraw/Remove buttons, their confirm
 * dialog) are ignored so row actions never also toggle the history.
 */
export function ExpandablePlayerRow({
  colSpan,
  history,
  children,
}: {
  colSpan: number;
  history: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  function handleClick(e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-row-toggle], [role=dialog], button, a, input, select, textarea, form")) return;
    setOpen((o) => !o);
  }

  return (
    <>
      <tr
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        tabIndex={0}
        aria-expanded={open}
        className={`cursor-pointer border-b border-neutral-100 outline-none transition-colors last:border-0 hover:bg-black/[0.02] focus-visible:bg-black/[0.03] ${
          open ? "bg-black/[0.02]" : ""
        }`}
      >
        <td className="w-8 py-3 pl-4 text-neutral-400">
          <span
            aria-hidden
            className={`inline-block text-xs transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
        </td>
        {children}
      </tr>
      {open && (
        <tr className="border-b border-neutral-100 bg-black/[0.02] last:border-0">
          <td colSpan={colSpan + 1} className="px-5 pb-4 pt-1">
            {history}
          </td>
        </tr>
      )}
    </>
  );
}
