'use client';

/**
 * The pieces both sign-in forms (the modal and the desktop hero card) use to
 * show a problem without making the card taller: the one-line slot under a
 * field, and the message that takes over the line under the button.
 *
 * Styles live in app/globals.css under "AUTH MODAL ERRORS".
 */

const ERR_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg>;
const OK_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
const NET_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 8.8a15 15 0 0 1 20 0M5 12.6a10 10 0 0 1 14 0M8.5 16.2a5 5 0 0 1 7 0"/><path d="M12 19.8v.01"/><path d="M3 3l18 18"/></svg>;

/** The one-line message slot under a field. Always rendered, so a message never adds height. */
export function Slot({ kind, children }) {
  return (
    <div className={`auth-slot${kind ? ` is-${kind}` : ''}`}>
      {kind === 'err' && ERR_ICON}{kind === 'ok' && OK_ICON}<span>{children}</span>
    </div>
  );
}

/**
 * A message for the line under the button, in place of what that line
 * normally says. line = { kind: 'error' | 'success', text, action?, net? }.
 */
export function LineMsg({ line }) {
  const body = <span>{line.text}{line.action && <>{' '}<button type="button" onClick={line.action.onClick}>{line.action.label}</button></>}</span>;
  return line.kind === 'success'
    ? <span role="status" aria-live="polite" className="auth-msg is-ok">{OK_ICON}{body}</span>
    : <span role="alert" aria-live="assertive" className="auth-msg is-err">{line.net ? NET_ICON : ERR_ICON}{body}</span>;
}

/**
 * What the line under the sign up email says, one thing at a time, and
 * whether the box itself should be red. `fe` is the field's error, if any.
 */
export function emailState({ tr, fe, email, valid, touched, taken, checking, suggestion, onUseSuggestion, onLogin }) {
  const bad = (!!fe && fe.code !== 'typo') || (valid && taken) || (!!email && !valid && touched);
  // A slip in the domain (gmial.com) is pointed out as it is typed, not after the password.
  const meant = fe?.code === 'typo' ? fe.suggestion : !fe && valid && !taken ? suggestion : null;
  let slot;
  if (meant) slot = <Slot kind="amber">{tr("Did you mean")} <b>{meant}</b>? <button type="button" onClick={() => onUseSuggestion(meant)}>{tr("Use it")}</button></Slot>;
  else if (fe?.code === 'taken' || (valid && taken)) slot = <Slot kind="err">{tr("This email has an account.")} <button type="button" onClick={onLogin}>{tr("Log in instead")}</button></Slot>;
  else if (fe?.code === 'required') slot = <Slot />;
  else if (fe || (email && !valid && touched)) slot = <Slot kind="err">{fe?.text ? tr(fe.text) : tr("Please enter a valid email")}</Slot>;
  else if (valid && checking) slot = <Slot>{tr("Checking...")}</Slot>;
  else if (valid) slot = <Slot kind="ok">{tr("Looks good")}</Slot>;
  else slot = <Slot />;
  return { bad, slot };
}

/** The same for the WhatsApp number, whose resting line says what the number is for. */
export function phoneState({ tr, fe, phone, check, touched, taken, checking, supportWhatsApp }) {
  const valid = check.ok;
  const bad = !!fe || (valid && taken) || (!!phone && !valid && touched);
  let slot;
  if (fe?.code === 'taken' || (valid && taken)) {
    slot = supportWhatsApp
      ? <Slot kind="err">{tr("Already on an account.")} <a href={`https://wa.me/${supportWhatsApp.replace(/\D/g, '')}?text=${encodeURIComponent("Hi Nitro, my WhatsApp number is already on another account")}`} target="_blank" rel="noopener noreferrer">{tr("Message us on WhatsApp")}</a></Slot>
      : <Slot kind="err">{tr("This number is already in use")}</Slot>;
  } else if (fe || (phone && !valid && touched)) slot = <Slot kind="err">{fe?.text || check.error}</Slot>;
  else if (valid && checking) slot = <Slot>{tr("Checking...")}</Slot>;
  else slot = <Slot>{tr("We'll reach you here for order updates")}</Slot>;
  return { bad, slot };
}

const CART_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 12.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7H6.1"/></svg>;

/**
 * "Order without an account": the whole bar is the button. Shown only while
 * guest_checkout_enabled is on. `className` places it: bled to the card's foot,
 * or "on-panel" inside the desktop modal's pink panel.
 */
export function GuestButton({ tr, onClick, className = '', isNew = false }) {
  return (
    <button type="button" onClick={onClick} className={`auth-guest ${className}`}>
      <span className="auth-guest-ic">{CART_ICON}</span>
      <span className="auth-guest-tx"><b>{tr("Order without an account")}</b><i>{tr("No sign up. Pay for one order.")}</i></span>
      <span className="auth-guest-go" aria-hidden="true"><span className="dir-flip">→</span></span>
      {isNew && <span className="auth-guest-new">{tr("New")}</span>}
    </button>
  );
}
