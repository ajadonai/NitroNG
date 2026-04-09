'use client';
import { useState, useEffect } from "react";
import { useConfirm } from "./confirm-dialog";

export default function AdminPricingPage({ dark, t }) {
  const confirm = useConfirm();

  const [general, setGeneral] = useState({ markup_budget: "150", markup_standard: "200", markup_premium: "250", markup_default: "200" });
  const [nigerian, setNigerian] = useState({ markup_ng_budget: "200", markup_ng_standard: "250", markup_ng_premium: "300", markup_ng_default: "250" });
  const [shared, setShared] = useState({ markup_min_margin: "50", markup_usd_rate: "1600" });
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch("/api/admin/settings").then(r => r.json()).then(d => {
      if (d.settings) {
        const s = d.settings;
        setGeneral(prev => ({
          markup_budget: s.markup_budget || prev.markup_budget,
          markup_standard: s.markup_standard || prev.markup_standard,
          markup_premium: s.markup_premium || prev.markup_premium,
          markup_default: s.markup_default || prev.markup_default,
        }));
        setNigerian(prev => ({
          markup_ng_budget: s.markup_ng_budget || prev.markup_ng_budget,
          markup_ng_standard: s.markup_ng_standard || prev.markup_ng_standard,
          markup_ng_premium: s.markup_ng_premium || prev.markup_ng_premium,
          markup_ng_default: s.markup_ng_default || prev.markup_ng_default,
        }));
        setShared(prev => ({
          markup_min_margin: s.markup_min_margin || prev.markup_min_margin,
          markup_usd_rate: s.markup_usd_rate || prev.markup_usd_rate,
        }));
      }
    });
  }, []);

  const allSettings = () => ({ ...general, ...nigerian, ...shared });

  const saveMarkup = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: allSettings() }) });
      setMsg(res.ok ? { type: "success", text: "Markup settings saved" } : { type: "error", text: "Failed to save" });
    } catch { setMsg({ type: "error", text: "Request failed" }); }
    setSaving(false);
  };

  const recalculate = async () => {
    if (!await confirm({ title: "Recalculate All Prices", message: "This will overwrite ALL existing tier sell prices using the current markup percentages. Custom prices will be replaced. Continue?", confirmLabel: "Recalculate", danger: true })) return;
    setRecalculating(true); setMsg(null);
    try {
      await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: allSettings() }) });
      const res = await fetch("/api/admin/service-groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "recalculate-prices" }) });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: `Prices recalculated: ${data.updated} updated, ${data.skipped} skipped (no cost data)` });
      } else {
        setMsg({ type: "error", text: data.error || "Failed to recalculate" });
      }
    } catch { setMsg({ type: "error", text: "Request failed" }); }
    setRecalculating(false);
  };

  const inputStyle = { width: 70, padding: "6px 10px", borderRadius: 8, background: dark ? "#0d1020" : "#fff", border: `1px solid ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.1)"}`, color: t.text, fontSize: 13, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" };
  const cardStyle = { background: dark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.85)", border: `0.5px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`, padding: 18, borderRadius: 14, boxShadow: dark ? "0 4px 20px rgba(0,0,0,.25)" : "0 4px 20px rgba(0,0,0,.04)" };

  const TierRow = ({ label, keyName, color, state, setState }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: t.text, width: 130 }}>{label}</span>
      <input value={state[keyName] || ""} onChange={e => setState(p => ({ ...p, [keyName]: e.target.value.replace(/[^0-9]/g, "") }))} style={inputStyle} />
      <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
      <span style={{ fontSize: 11, color: t.textSoft, marginLeft: "auto" }}>₦100 → ₦{(100 * (1 + Number(state[keyName] || 0) / 100)).toLocaleString("en-NG")}</span>
    </div>
  );

  return (
    <div style={{ padding: "0 0 40px" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: t.text, margin: "0 0 6px" }}>Pricing & Markup</h2>
      <p style={{ fontSize: 13, color: t.textMuted, margin: "0 0 20px" }}>Control how sell prices are calculated from MTP costs. Prices = (USD cost × exchange rate) + markup %.</p>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 16, background: msg.type === "success" ? (dark ? "rgba(110,231,183,.08)" : "#f0fdf4") : (dark ? "rgba(220,38,38,.08)" : "#fef2f2"), color: msg.type === "success" ? (dark ? "#6ee7b7" : "#059669") : (dark ? "#fca5a5" : "#dc2626"), fontSize: 12 }}>{msg.text}</div>}

      {/* General Markup */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>General Services</div>
        <div style={cardStyle}>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, lineHeight: 1.5 }}>Markup for all standard (non-Nigerian) services.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TierRow label="Budget" keyName="markup_budget" color="#e0a458" state={general} setState={setGeneral} />
            <TierRow label="Standard" keyName="markup_standard" color="#60a5fa" state={general} setState={setGeneral} />
            <TierRow label="Premium" keyName="markup_premium" color="#a78bfa" state={general} setState={setGeneral} />
            <TierRow label="No tier (default)" keyName="markup_default" color="#888" state={general} setState={setGeneral} />
          </div>
        </div>
      </div>

      {/* Nigerian Markup */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: t.text }}>🇳🇬 Nigerian Services</span>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: dark ? "rgba(74,222,128,.1)" : "rgba(22,163,74,.06)", color: dark ? "#4ade80" : "#16a34a", fontWeight: 500 }}>Premium</span>
        </div>
        <div style={{ ...cardStyle, borderColor: dark ? "rgba(74,222,128,.12)" : "rgba(22,163,74,.1)" }}>
          <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, lineHeight: 1.5 }}>Higher markup for Nigerian-targeted services. These are premium — local audience engagement is worth more.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TierRow label="Budget" keyName="markup_ng_budget" color="#e0a458" state={nigerian} setState={setNigerian} />
            <TierRow label="Standard" keyName="markup_ng_standard" color="#60a5fa" state={nigerian} setState={setNigerian} />
            <TierRow label="Premium" keyName="markup_ng_premium" color="#a78bfa" state={nigerian} setState={setNigerian} />
            <TierRow label="No tier (default)" keyName="markup_ng_default" color="#888" state={nigerian} setState={setNigerian} />
          </div>
        </div>
      </div>

      {/* Shared settings */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>Global Settings</div>
        <div style={cardStyle}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: t.textMuted, width: 150 }}>Minimum margin floor</span>
              <input value={shared.markup_min_margin || ""} onChange={e => setShared(p => ({ ...p, markup_min_margin: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputStyle, width: 60 }} />
              <span style={{ fontSize: 12, color: t.textMuted }}>%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: t.textMuted, width: 150 }}>USD → NGN rate</span>
              <input value={shared.markup_usd_rate || ""} onChange={e => setShared(p => ({ ...p, markup_usd_rate: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputStyle, width: 80 }} />
              <span style={{ fontSize: 11, color: t.textSoft }}>MTP costs are in USD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button onClick={saveMarkup} disabled={saving} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#c47d8e,#a3586b)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", opacity: saving ? .5 : 1 }}>{saving ? "Saving..." : "Save Markup Settings"}</button>
        <button onClick={recalculate} disabled={recalculating} style={{ padding: "10px 24px", borderRadius: 10, border: `1px solid ${dark ? "rgba(252,165,165,.2)" : "rgba(220,38,38,.15)"}`, background: dark ? "rgba(252,165,165,.06)" : "rgba(220,38,38,.04)", color: dark ? "#fca5a5" : "#dc2626", fontSize: 13, fontWeight: 600, cursor: recalculating ? "wait" : "pointer", opacity: recalculating ? .5 : 1 }}>{recalculating ? "Recalculating..." : "Recalculate All Prices"}</button>
      </div>
      <p style={{ fontSize: 11, color: t.textMuted, marginTop: 8, lineHeight: 1.5 }}>Save updates the percentages. Recalculate overwrites all existing sell prices using these percentages — any custom prices will be replaced.</p>
    </div>
  );
}
