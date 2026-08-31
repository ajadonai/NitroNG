"use client";
import { useState, useCallback } from "react";
import { Card, Chip, Empty, Fact, Facts, dateOf, initialsOf, pitVars } from "./kit";
import { SkelBar, SkelFacts, SkelList } from "../skeleton";
import { useTheme } from "../shared-nav";
import { fN } from "@/lib/format";

// The four states a commission can be in, in the words the crew uses.
const STATUS = {
  approved: { label: "Cleared", kind: "ok" },
  held: { label: "Holding", kind: "warn" },
  voided: { label: "Reversed", kind: "bad" },
  pending: { label: "Pending", kind: "dim" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "held", label: "Holding" },
  { key: "approved", label: "Cleared" },
  { key: "voided", label: "Reversed" },
];

// How many days are left on a held commission before it clears.
function daysLeft(iso) {
  if (!iso) return null;
  const d = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return d > 0 ? d : 0;
}

export default function CommissionsPage({ member, initialData }) {
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
    fetch(`/api/pit/commissions?status=${f}&page=${p}`)
      .then((r) => r.json())
      .then((d) => d.error ? setError(d.error) : setData(d))
      .catch(() => setError("Failed to load commissions"))
      .finally(() => setLoading(false));
  }, []);

  const changeFilter = (f) => { setFilter(f); setPage(1); load(f, 1); };
  const changePage = (p) => { setPage(p); load(filter, p); };

  const rows = data?.commissions || [];

  return (
    <div className="cms" style={pitVars(dark, t)}>
      <style>{CMS_CSS}</style>

      {loading && !data ? <><SkelFacts dark={dark} /><SkelBar dark={dark} search={false} pills={4} /><SkelList dark={dark} rows={6} title rowH={58} /></> : <>
        <Facts>
          <Fact value={fN(member?.totalEarned || 0)} label="Earned" sub="all time" />
          <Fact value={fN(member?.totalPaid || 0)} label="Paid out" sub="already in your bank" kind="ok" />
          <Fact value={(data?.total || 0).toLocaleString()} label="Commissions" sub={filter === "all" ? "every one of them" : `${FILTERS.find(f => f.key === filter)?.label.toLowerCase()} only`} />
          <Fact value={`${member?.commissionRate || 0}%`} label="Your rate" sub="of the pot on every order" />
        </Facts>

        <div className="pt-bar">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className={"pt-tg" + (filter === f.key ? " on" : "")} onClick={() => changeFilter(f.key)}>
              {f.label}{filter === f.key && data ? <span className="m">{data.total}</span> : null}
            </button>
          ))}
          <span className="pt-cnt">{(data?.total || 0).toLocaleString()} {data?.total === 1 ? "commission" : "commissions"}</span>
        </div>

        {error ? (
          <Card title="Commissions" cnt="something got in the way">
            <Empty>
              {error}
              <div style={{ marginTop: 12 }}><button type="button" className="pt-b sm" onClick={() => load(filter, page)}>Try again</button></div>
            </Empty>
          </Card>
        ) : (
          <Card title="Commissions" cnt="newest first · a commission clears seven days after the order">
            {rows.length === 0 ? (
              <Empty>{filter === "all" ? "Nothing yet. When someone orders through your link, it lands here." : "Nothing under that filter."}</Empty>
            ) : <>
              <div className="pt-list" style={{ opacity: loading ? 0.6 : 1, transition: "opacity 150ms" }}>
                {rows.map((c) => {
                  const s = STATUS[c.status] || STATUS.pending;
                  const left = c.status === "held" ? daysLeft(c.releasesAt) : null;
                  const who = c.type === "team" && c.memberName ? c.memberName : c.orderId;
                  return (
                    <div key={c.id} className="pt-r cm">
                      <span className="pt-av sm">{c.type === "team" && c.memberName ? initialsOf(c.memberName) : c.slug.slice(0, 2).toUpperCase()}</span>
                      <span className="pt-tt">
                        <b>{who}</b>
                        <i>{c.slug} · order {fN(c.orderCharge)} · {c.rate}%{isChief && c.type === "team" ? " · crew" : ""}</i>
                      </span>
                      <Chip kind={s.kind}>{left != null ? `Holding, ${left} ${left === 1 ? "day" : "days"} left` : s.label}</Chip>
                      <span className={"pt-num m" + (c.status === "voided" ? " bad" : "")}>{c.status === "voided" ? `−${fN(c.amount)}` : fN(c.amount)}</span>
                      <span className="pt-c">{dateOf(c.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
              {data.pages > 1 && (
                <div className="pt-pg">
                  <span className="pt-cnt m">{(page - 1) * 20 + 1}–{(page - 1) * 20 + rows.length} of {data.total.toLocaleString()}</span>
                  <span className="pt-pgn">
                    <button type="button" className="pt-ib" disabled={page <= 1 || loading} onClick={() => changePage(page - 1)} aria-label="Previous page">‹</button>
                    <span className="pt-cnt m">{page} / {data.pages}</span>
                    <button type="button" className="pt-ib" disabled={page >= data.pages || loading} onClick={() => changePage(page + 1)} aria-label="Next page">›</button>
                  </span>
                </div>
              )}
            </>}
          </Card>
        )}
      </>}
    </div>
  );
}

const CMS_CSS = `
.cms{display:flex;flex-direction:column;gap:14px}
.cms .pt-tg .m{font-size:11.5px;color:var(--dim)}
.cms .pt-tg.on .m{color:var(--card);opacity:.75}
@media (min-width:900.99px){
  .cms .pt-r.cm{grid-template-columns:30px 1fr 180px 100px 80px}
}
`;
