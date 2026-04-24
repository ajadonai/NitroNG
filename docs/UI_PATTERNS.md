# UI Patterns — Nitro Design Reference

Single-order flow is the canonical reference. All new flows (bulk, batch history, etc.) must match these patterns.

## Submit Button Loading

**Pattern:** Text change + opacity. No dedicated spinner component on buttons.

| File | Button | Idle text | Loading text | Disabled |
|------|--------|-----------|-------------|----------|
| `new-order.jsx` | Place order | "Place order" | "Placing..." | `opacity: 0.5` |
| `addfunds-page.jsx` | Pay | "Pay ₦X Now" | "Processing..." | `opacity: 0.5` |
| `support-page.jsx` | Create ticket | "Create Ticket" | "Creating..." | `opacity: 0.5` |
| `settings-page.jsx` | Update password | "Update Password" | "Updating..." | `opacity: 0.5` |

Style: `bg-gradient-to-br from-[#c47d8e] to-[#8b5e6b]`, white text, `border-none`, `rounded-[10px]` to `rounded-xl`.

## Inline Spinner (non-button contexts)

```jsx
<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_0.6s_linear_infinite]" />
```
Used in auth-modal, landing-page, admin-login. 16px default, 20px for larger contexts.

## Error Colors

| Context | Dark | Light |
|---------|------|-------|
| Error text / border | `#fca5a5` | `#dc2626` |
| Error background | `rgba(239,68,68,.06)` | `rgba(239,68,68,.06)` |
| Warning text | `#fcd34d` | `#b45309` |
| Warning background | `rgba(250,204,21,.06)` | `rgba(250,204,21,.08)` |

## Toast (global feedback)

Hook: `useToast()` from `components/toast.jsx`.

```js
toast.error("Title", "Description", { position: "bottom", duration: 5000 })
toast.success("Title", "Description")
toast.warning("Title", "Description")
toast.info("Title", "Description")
```

Options: `position` ("top" | "bottom"), `duration` (ms), `cta` ({ label, onClick }).

## Inline Field Validation

- Red border on input: `borderColor: dark ? "#e47373" : "#dc2626"`
- Error text below: `text-[10.5px]`, color `dark ? "#e47373" : "#dc2626"`, with `mt-1.5`
- Space reservation: `visibility: error ? "visible" : "hidden"` where layout matters

## Success Patterns

**Single-order success (modal):**
- Green checkmark SVG in circle: `w-14 h-14 rounded-full`, bg `rgba(110,231,183,.1)` / `rgba(5,150,105,.08)`
- Stroke color: `dark ? "#6ee7b7" : "#059669"`
- Title: `text-lg font-semibold`
- Subtitle: `text-sm`, color `t.textMuted`
- Two buttons: secondary ("Place another") + primary ("View orders")

**Bulk success (already built, same pattern):**
- Same checkmark, same layout, adds batch summary card + order list

## Modal Structure

- Backdrop: `fixed inset-0 z-50 bg-black/40`
- Container: `rounded-2xl max-md:rounded-b-none`, `max-w-[420px]`, `p-6`
- Background: `dark ? "#0e1120" : "#ffffff"`
- Border: `1px solid ${t.cardBorder}`
- Shadow: `0 20px 60px rgba(0,0,0,.3)`

## Button Variants

**Primary:** gradient `from-[#c47d8e] to-[#8b5e6b]`, white text, `border-none`
**Secondary:** `bg-transparent`, border `1px solid ${t.cardBorder}`, color `t.text`
**Danger:** bg `transparent` or subtle red, border red, color `dark ? "#fca5a5" : "#dc2626"`
**Disabled:** `opacity: 0.4-0.5`, `cursor-not-allowed`

## Gaps (no existing pattern)

- **Partial failure banner** — single order never has partial failure. Bulk needs this. Use error banner colors with per-row amber/red dots.
- **Price drift warning** — no existing precedent. Use warning colors (amber).
- **Idempotency "still processing"** — no existing precedent. Use info toast + polling.
- **Service unavailable per-row** — no existing precedent. Grey out row at 60% opacity.
