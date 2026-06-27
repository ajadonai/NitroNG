"use client";
import { useState, useCallback } from "react";
import PortalShell from "./shell";
import { StatusBadge, Skeleton, ErrorBanner, EmptyState } from "./kit";
import { useTheme } from "../shared-nav";
import { fN } from "@/lib/format";

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

const FILTERS = [
  { key: "all", label: "All" },
  { key: "held", label: "Held" },
  { key: "approved", label: "Approved" },
  { key: "voided", label: "Voided" },
];

function Inner({ member, initialData }) {
  const { dark, t } = useTheme();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isChief = member?.role === "chief";

  const load = useCallback((f, p) => {
    setLoading(true);
    setError(null);
    fetch(`/api/m/commissions?status=${f}&page=${p}`)
      .then((r) => r.json())
      .then((d) => d.error ? setError(d.error) : setData(d))
      .catch(() => setError("Failed to load commissions"))
      .finally(() => setLoading(false));
  }, []);

  const changeFilter = (f) => {
    setFilter(f);
    setPage(1);
    load(f, 1);
  };

  const changePage = (p) => {
    setPage(p);
    load(filter, p);
  };

  if (error) return <ErrorBanner message={error} onRetry={() => load(filter, page)} t={t} />;

  return (
    <div className="flex flex-col gap-5">
      {/* Filter tabs */}
      <div className="flex gap-[6px] overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => changeFilter(f.key)}
            className="px-3 py-[6px] rounded-lg text-[12.5px] font-semibold border-none cursor-pointer whitespace-nowrap transition-colors duration-150"
            style={{
              background: filter === f.key ? t.accentLight : "transparent",
              color: filter === f.key ? t.accent : t.muted,
              fontFamily: "inherit",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading && !data ? (
        <div className="rounded-2xl" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}` }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-4" style={{ borderTop: i > 1 ? `1px solid ${t.surfaceBrd}` : undefined }}>
              <div className="flex-1 flex flex-col gap-2"><Skeleton w={140} h={13} /><Skeleton w={90} h={10} /></div>
              <Skeleton w={70} h={13} />
            </div>
          ))}
        </div>
      ) : data?.commissions?.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No commissions yet" : `No ${filter} commissions`}
          subtitle={filter === "all" ? "When someone orders through your link, commissions appear here." : "Try a different filter."}
          icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
          t={t}
        />
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.surfaceBrd}`, opacity: loading ? 0.6 : 1, transition: "opacity 150ms" }}>
            {data.commissions.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-[14px] max-md:flex-wrap" style={{ borderTop: i > 0 ? `1px solid ${t.surfaceBrd}` : undefined }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="m text-[13px] font-medium" style={{ color: t.text }}>{c.orderId}</span>
                    {isChief && c.type === "team" && (
                      <span className="text-[10px] font-semibold py-[1px] px-[6px] rounded-md" style={{ color: t.accent, background: t.accentLight }}>TEAM</span>
                    )}
                  </div>
                  <div className="text-[11.5px] mt-[2px] flex items-center gap-[6px] flex-wrap" style={{ color: t.muted }}>
                    <span>{fmtDate(c.createdAt)}</span>
                    <span>·</span>
                    <span>via {c.slug}</span>
                    {isChief && c.type === "team" && c.memberName && (
                      <><span>·</span><span>{c.memberName}</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 max-md:w-full max-md:justify-between max-md:mt-1">
                  <div className="text-right">
                    <div className="m text-[13.5px] font-semibold" style={{ color: c.status === "voided" ? t.red : t.green }}>{fN(c.amount)}</div>
                    <div className="m text-[10.5px] mt-[1px]" style={{ color: t.muted }}>{c.rate}% of {fN(c.orderCharge)}</div>
                  </div>
                  <StatusBadge status={c.status} dark={dark} t={t} />
                </div>
              </div>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                disabled={page <= 1 || loading}
                onClick={() => changePage(page - 1)}
                className="px-3 py-[6px] rounded-lg text-[12.5px] font-medium border-none cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ background: t.surface, color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}
              >
                Prev
              </button>
              <span className="text-[12.5px]" style={{ color: t.muted }}>{page} of {data.pages}</span>
              <button
                disabled={page >= data.pages || loading}
                onClick={() => changePage(page + 1)}
                className="px-3 py-[6px] rounded-lg text-[12.5px] font-medium border-none cursor-pointer disabled:opacity-30 disabled:cursor-default"
                style={{ background: t.surface, color: t.text, border: `1px solid ${t.surfaceBrd}`, fontFamily: "inherit" }}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CommissionsPage({ member, initialData }) {
  return <PortalShell member={member}><Inner member={member} initialData={initialData} /></PortalShell>;
}
