"use client";

import { useState, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export type ColumnDef<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  className?: string;
  headerClassName?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

const PAGE_SIZE_OPTIONS = [5, 10, 20] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

type DataTableProps<T> = {
  columns: ColumnDef<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  defaultPageSize?: PageSizeOption;
  /** className applied to the scroll container wrapping the table */
  scrollClassName?: string;
  className?: string;
};

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  isLoading = false,
  emptyTitle = "No data",
  emptyDescription,
  defaultPageSize = 10,
  scrollClassName,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<PageSizeOption>(defaultPageSize);

  const sorted = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return data;
    return [...data].sort((a, b) => {
      const va = col.sortValue!(a) ?? "";
      const vb = col.sortValue!(b) ?? "";
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [data, sort, columns]);

  const pageCount = Math.ceil(sorted.length / pageSize);
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    setPage(0);
  }

  function handlePageSizeChange(size: PageSizeOption) {
    setPageSize(size);
    setPage(0);
  }

  const skeletonCount = Math.min(pageSize, 6);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Scrollable table area */}
      <div className={cn("overflow-auto", scrollClassName)}>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortValue ? () => toggleSort(col.key) : undefined}
                  className={cn(
                    "bg-muted/60 px-4 py-2.5 text-left text-xs font-medium tracking-wide text-muted-foreground backdrop-blur-sm",
                    col.sortValue &&
                      "cursor-pointer select-none transition-colors hover:text-foreground",
                    col.headerClassName,
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortValue && (
                      <SortIcon state={sort?.key === col.key ? sort.dir : null} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: skeletonCount }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {columns.map((col, j) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton
                          className="h-3 rounded"
                          style={{ width: `${50 + ((i * 17 + j * 11) % 35)}%` }}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              : pageData.map((row) => {
                  const key = getRowKey(row);
                  return (
                    <tr
                      key={key}
                      className="border-b border-border transition-colors last:border-0"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn("px-4 py-3 align-middle", col.className)}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>

        {!isLoading && pageData.length === 0 && (
          <div className="flex flex-col items-start gap-1.5 px-4 py-10">
            <p className="text-sm font-medium">{emptyTitle}</p>
            {emptyDescription && (
              <p className="text-xs text-muted-foreground">{emptyDescription}</p>
            )}
          </div>
        )}
      </div>

      {/* Pagination bar — always outside scroll area */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        {/* Page size selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Show</span>
          <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => handlePageSizeChange(size)}
                className={cn(
                  "relative rounded-md px-2.5 py-1 font-mono text-xs transition-colors",
                  pageSize === size
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {pageSize === size && (
                  <motion.span
                    layoutId="page-size-indicator"
                    className="absolute inset-0 rounded-md bg-muted"
                    transition={{ duration: 0.15 }}
                  />
                )}
                <span className="relative">{size}</span>
              </button>
            ))}
          </div>
          {!isLoading && (
            <span className="font-mono text-xs text-muted-foreground">
              of {sorted.length}
            </span>
          )}
        </div>

        {/* Page navigation */}
        {!isLoading && pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-16 text-center font-mono text-xs text-muted-foreground">
              {page + 1} / {pageCount}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SortIcon({ state }: { state: "asc" | "desc" | null }) {
  if (state === "asc") return <ChevronUp className="size-3" />;
  if (state === "desc") return <ChevronDown className="size-3" />;
  return <ChevronsUpDown className="size-3 opacity-40" />;
}
