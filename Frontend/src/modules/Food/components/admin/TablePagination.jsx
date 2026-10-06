import { useEffect, useMemo, useState } from "react"

/**
 * Client-side pagination for admin tables (bug #115).
 *   const { pageItems, controls, startIndex } = usePagination(rows, 25)
 * Render {controls} below the table and map over pageItems.
 */
export function usePagination(items, pageSize = 25) {
  const list = Array.isArray(items) ? items : []
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize))

  // Go back to page 1 when the data set changes (filters, search, reload).
  useEffect(() => {
    setPage(1)
  }, [list.length])

  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const pageItems = useMemo(
    () => list.slice(startIndex, startIndex + pageSize),
    [list, startIndex, pageSize],
  )

  const controls =
    list.length > 0 ? (
      <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Showing <span className="font-semibold">{startIndex + 1}</span> to{" "}
          <span className="font-semibold">{Math.min(startIndex + pageSize, list.length)}</span> of{" "}
          <span className="font-semibold">{list.length}</span> results
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    ) : null

  return { pageItems, controls, startIndex, page: safePage, totalPages }
}
