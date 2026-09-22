import Link from "next/link";

function ChevronIcon({ direction, bar }: { direction: "left" | "right"; bar?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
      {bar && (
        <line
          x1={direction === "left" ? 19 : 5}
          y1="5"
          x2={direction === "left" ? 19 : 5}
          y2="19"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      <path
        d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PageLink({
  href,
  active,
  "aria-label": ariaLabel,
  children,
}: {
  href?: string;
  active?: boolean;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs transition-colors";
  if (!href) {
    return (
      <span className={`${base} text-neutral-300`} aria-disabled="true">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={`${base} ${
        active ? "bg-neutral-900 font-medium text-white" : "text-neutral-600 hover:bg-black/5"
      }`}
    >
      {children}
    </Link>
  );
}

export function Pagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "ellipsis")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("ellipsis");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
  }

  return (
    <nav className="flex w-fit shrink-0 items-center gap-1" aria-label="Pagination">
      <PageLink href={page > 1 ? buildHref(1) : undefined} aria-label="Go to first page">
        <ChevronIcon direction="left" bar />
      </PageLink>
      <PageLink href={page > 1 ? buildHref(page - 1) : undefined} aria-label="Go to previous page">
        <ChevronIcon direction="left" />
      </PageLink>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`e-${i}`} className="flex size-8 items-center justify-center text-neutral-300">
            …
          </span>
        ) : (
          <PageLink key={p} href={buildHref(p)} active={p === page}>
            {p}
          </PageLink>
        )
      )}
      <PageLink href={page < totalPages ? buildHref(page + 1) : undefined} aria-label="Go to next page">
        <ChevronIcon direction="right" />
      </PageLink>
      <PageLink href={page < totalPages ? buildHref(totalPages) : undefined} aria-label="Go to last page">
        <ChevronIcon direction="right" bar />
      </PageLink>
    </nav>
  );
}
