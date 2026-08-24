'use client';
import { useState, useEffect, useCallback } from "react";
import { useToast } from "./toast";
import { useConfirm } from "./confirm-dialog";

function Spinner({ size = 14, color = "currentColor" }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeLinecap="round" opacity=".25" /><path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" strokeLinecap="round" /></svg>;
}

const naira = (n) => `₦${Number(n || 0).toLocaleString()}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function AdminResellersPage({ dark, t }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [noteDraft, setNoteDraft] = useState({});
  const [rateDraft, setRateDraft] = useState({});
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);

  const load = useCallback((q = "") => {
    const url = q ? `/api/admin/resellers?q=${encodeURIComponent(q)}` : "/api/admin/resellers";
    return fetch(url)
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLoading(false); })
      .catch(() => { toast.error("Failed to load resellers"); setLoading(false); });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim() || searching) return;
    setSearching(true);
    await load(query.trim());
    setSearching(false);
  };

  const act = async (userId, action, extra = {}, key = action) => {
    if (busy) return;
    setBusy(userId + key);
    try {
      const res = await fetch("/api/admin/resellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId, ...extra }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error("Action failed", d.error || "Something went wrong"); return; }
      toast.success("Done", "");
      load(data?.query || "");
    } catch {
      toast.error("Request failed", "Check your connection");
    } finally {
      setBusy(null);
    }
  };

  const grant = async (u) => {
    const ok = await confirm({
      title: `Make ${u.name || u.email} a reseller?`,
      message: "They will pay wholesale prices on every order from now on. "
        + `${u.orders} orders, ${naira(u.spend)} in the last ${data.windowDays} days.`,
      confirmLabel: "Grant access",
    });
    if (ok) act(u.userId, "approve", { catalog: "curated" });
  };

  const restore = async (r) => {
    const ok = await confirm({
      title: `Restore ${r.name || r.email}?`,
      message: "Wholesale pricing resumes on their next order. "
        + `${r.recentOrders} orders, ${naira(r.recentSpend)} in the last ${data.windowDays} days.`,
      confirmLabel: "Restore",
    });
    if (ok) act(r.userId, "approve");
  };

  const revoke = async (r) => {
    const ok = await confirm({
      title: `Revoke ${r.name || r.email}?`,
      message: "They go back to retail prices on their next order. Their record and API key are kept, so this can be undone.",
      confirmLabel: "Revoke",
      danger: true,
    });
    if (ok) act(r.userId, "revoke");
  };

  const cardS = { background: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}` };
  const headS = { background: dark ? "rgba(196,125,142,.1)" : "rgba(196,125,142,.06)", borderBottom: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}` };
  const rowBorder = (i) => ({ borderTop: i > 0 ? `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)"}` : "none" });
  const btn = (bg, fg) => ({ background: bg, color: fg });

  if (loading) return <div className="flex items-center justify-center py-16"><Spinner size={20} color={t.accent} /></div>;
  if (!data) return null;

  const active = data.resellers.filter(r => r.enabled);
  const revoked = data.resellers.filter(r => !r.enabled);

  return (
    <>
      <div className="adm-header">
        <div className="adm-title text-t-text">Resellers</div>
        <div className="adm-subtitle text-t-text-muted">Wholesale pricing — approve, track and revoke</div>
        <div className="page-divider bg-t-card-border" />
      </div>

      {/* Programme totals. Same window as the per-reseller figures below, so the
          two never disagree. */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          ["Active", data.summary.active, data.summary.revoked ? `${data.summary.revoked} revoked` : null],
          ["On full catalogue", data.summary.onFullCatalogue, `of ${data.summary.active}`],
          ["Orders", data.summary.orders.toLocaleString(), `last ${data.windowDays} days`],
          ["Revenue", naira(data.summary.revenue), `${data.summary.revenueShare}% of all sales`],
          ["Avg order", naira(data.summary.avgOrder), `everyone: ${naira(data.summary.avgOrderEveryone)}`],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-[14px] p-4" style={cardS}>
            <div className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: t.textMuted }}>{label}</div>
            <div className="text-[19px] font-semibold text-t-text" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
            {note && <div className="text-[11px] mt-0.5" style={{ color: t.textMuted }}>{note}</div>}
          </div>
        ))}
      </div>

      {/* Active + revoked */}
      <div className="rounded-[14px] overflow-hidden mb-6" style={cardS}>
        <div className="hidden md:grid grid-cols-[1.2fr_90px_80px_1fr_1fr_100px_110px] gap-3 py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-t-text-muted" style={headS}>
          <span>Reseller</span>
          <span>Catalogue</span>
          <span>Rate</span>
          <span>Last {data.windowDays} days</span>
          <span>Why</span>
          <span>Approved</span>
          <span>Actions</span>
        </div>
        {data.resellers.length === 0 ? (
          <div className="py-10 px-5 text-center text-sm" style={{ color: t.textMuted }}>
            No resellers yet. Search for an account below to grant access.
          </div>
        ) : [...active, ...revoked].map((r, i) => (
          <div key={r.id} className="grid grid-cols-1 md:grid-cols-[1.2fr_90px_80px_1fr_1fr_100px_110px] gap-1 md:gap-3 items-center py-3 px-4" style={{ ...rowBorder(i), opacity: r.enabled ? 1 : .5 }}>
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-t-text truncate">
                {r.name || "(no name)"}{!r.enabled && <span className="ml-2 text-[10px] uppercase" style={{ color: t.textMuted }}>revoked</span>}
              </div>
              <div className="text-[11px] text-t-text-muted truncate">{r.email}</div>
            </div>
            <select
              value={r.catalog}
              disabled={!r.enabled || !!busy}
              onChange={(e) => act(r.userId, "catalog", { catalog: e.target.value }, "catalog")}
              className="py-1 px-2 rounded-lg text-[11px] font-semibold border-none cursor-pointer disabled:opacity-40"
              style={{ background: dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)", color: t.textSoft }}
            >
              <option value="curated">Curated</option>
              <option value="full">Full</option>
            </select>
            {/* Blank means the global rate, shown as the placeholder so it is
                obvious what an empty field does. */}
            <input
              value={rateDraft[r.userId] ?? (r.discountPct ?? "")}
              placeholder={`${data.globalDiscount}%`}
              disabled={!r.enabled || !!busy}
              inputMode="numeric"
              onChange={(e) => setRateDraft(p => ({ ...p, [r.userId]: e.target.value.replace(/[^0-9]/g, "") }))}
              onBlur={() => {
                const v = rateDraft[r.userId];
                if (v === undefined || v === String(r.discountPct ?? "")) return;
                act(r.userId, "rate", { discountPct: v }, "rate");
              }}
              className="w-full py-1 px-2 rounded-lg text-[11px] text-center border-none outline-none disabled:opacity-40"
              style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textSoft }}
            />
            {/* Current behaviour, not the behaviour that earned the grant — an
                order count at zero is how someone who stopped reselling shows up. */}
            <div className="text-[12px] text-t-text-muted">
              {r.recentOrders} orders · {naira(r.recentSpend)}
            </div>
            {/* The only record of why this account gets wholesale pricing. Saved on
                blur so it cannot be half-typed and lost. */}
            <input
              value={noteDraft[r.userId] ?? r.notes ?? ""}
              placeholder="reason…"
              disabled={!!busy}
              onChange={(e) => setNoteDraft(p => ({ ...p, [r.userId]: e.target.value }))}
              onBlur={() => {
                const v = noteDraft[r.userId];
                if (v === undefined || v === (r.notes ?? "")) return;
                act(r.userId, "notes", { notes: v }, "notes");
              }}
              className="w-full py-1 px-2 rounded-lg text-[11px] border-none outline-none"
              style={{ background: dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.04)", color: t.textSoft }}
            />
            <div className="text-[11px] text-t-text-muted" title={r.approvedBy ? `by ${r.approvedBy}` : ""}>
              {fmtDate(r.approvedAt)}
              {r.approvedBy && <div className="truncate">by {r.approvedBy}</div>}
            </div>
            <div className="flex items-center gap-1.5">
              {r.enabled ? (
                <button disabled={!!busy} onClick={() => revoke(r)}
                  className="py-1 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-opacity disabled:opacity-40"
                  style={btn(dark ? "rgba(248,113,113,.12)" : "rgba(220,38,38,.08)", dark ? "#f87171" : "#dc2626")}>
                  {busy === r.userId + "revoke" ? <Spinner size={12} /> : "Revoke"}
                </button>
              ) : (
                <button disabled={!!busy} onClick={() => restore(r)}
                  className="py-1 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-opacity disabled:opacity-40"
                  style={btn(dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", dark ? "#6ee7b7" : "#059669")}>
                  {busy === r.userId + "approve" ? <Spinner size={12} /> : "Restore"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Grant access */}
      <div className="adm-header">
        <div className="adm-title text-t-text" style={{ fontSize: 18 }}>Grant access</div>
        <div className="adm-subtitle text-t-text-muted">
          Resellers ask through support. Find the account and grant it.
        </div>
      </div>

      <form onSubmit={search} className="flex items-center gap-2 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="flex-1 md:max-w-[360px] py-2 px-3 rounded-[10px] text-[13px] border-none outline-none"
          style={{ background: dark ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.85)", border: `1px solid ${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)"}`, color: t.textSoft }}
        />
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="py-2 px-4 rounded-[10px] text-[13px] font-semibold cursor-pointer border-none transition-opacity disabled:opacity-40"
          style={{ background: t.accent, color: "#fff" }}
        >
          {searching ? <Spinner size={13} color="#fff" /> : "Search"}
        </button>
      </form>

      {data.query && (
        <div className="rounded-[14px] overflow-hidden" style={cardS}>
          <div className="hidden md:grid grid-cols-[1.8fr_90px_110px_130px] gap-3 py-2.5 px-4 text-[11px] font-semibold uppercase tracking-wide text-t-text-muted" style={headS}>
            <span>Customer</span>
            <span>Orders</span>
            <span>Spend</span>
            <span>Actions</span>
          </div>
          {data.results.length === 0 ? (
            <div className="py-10 px-5 text-center text-sm" style={{ color: t.textMuted }}>
              No active account matches &ldquo;{data.query}&rdquo;.
            </div>
          ) : data.results.map((u, i) => (
            <div key={u.userId} className="grid grid-cols-1 md:grid-cols-[1.8fr_90px_110px_130px] gap-1 md:gap-3 items-center py-3 px-4" style={rowBorder(i)}>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-t-text truncate">{u.name || "(no name)"}</div>
                <div className="text-[11px] text-t-text-muted truncate">{u.email}</div>
              </div>
              <span className="text-[13px] text-t-text">{u.orders}</span>
              <span className="text-[13px] text-t-text">{naira(u.spend)}</span>
              {u.alreadyReseller ? (
                <span className="text-[11px]" style={{ color: t.textMuted }}>already a reseller</span>
              ) : (
                <button disabled={!!busy} onClick={() => grant(u)}
                  className="py-1 px-2.5 rounded-lg text-[11px] font-semibold cursor-pointer border-none transition-opacity disabled:opacity-40 justify-self-start"
                  style={btn(dark ? "rgba(110,231,183,.12)" : "rgba(5,150,105,.08)", dark ? "#6ee7b7" : "#059669")}>
                  {busy === u.userId + "approve" ? <Spinner size={12} /> : "Grant"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
