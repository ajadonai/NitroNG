'use client';
import { useEffect, useRef, useState } from 'react';
import { validatePhone } from '../lib/phone-countries';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * "Is this email / WhatsApp number already on an account?", asked while the
 * visitor types, for both sign up forms: the modal and the desktop hero card.
 *
 * The modal had these two checks inline and the hero card had neither, so a
 * hero sign up learned the email was taken only after setting a password on
 * step 2. One copy, so the two forms cannot drift apart again.
 *
 * Debounced 600ms; a failed check reports "not taken" so it can never block a
 * sign up on its own. The server checks again on submit regardless.
 */
export function useSignupChecks({ active, email, phone, country }) {
  const [emailTaken, setEmailTaken] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const [phoneTaken, setPhoneTaken] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const emailTimer = useRef(null);
  const phoneTimer = useRef(null);

  useEffect(() => {
    if (!active || !email || !EMAIL_RE.test(email)) {
      setEmailTaken(false);
      setEmailChecking(false);
      return;
    }
    setEmailChecking(true);
    clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => {
      fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
        .then((r) => r.json())
        .then((d) => { setEmailTaken(!d.available); setEmailChecking(false); })
        .catch(() => setEmailChecking(false));
    }, 600);
    return () => clearTimeout(emailTimer.current);
  }, [active, email]);

  useEffect(() => {
    const checked = active && phone ? validatePhone(country, phone) : null;
    if (!checked?.ok) {
      setPhoneTaken(false);
      setPhoneChecking(false);
      return;
    }
    setPhoneChecking(true);
    clearTimeout(phoneTimer.current);
    phoneTimer.current = setTimeout(() => {
      fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: checked.local, country }),
      })
        .then((r) => r.json())
        .then((d) => { setPhoneTaken(!d.available); setPhoneChecking(false); })
        .catch(() => setPhoneChecking(false));
    }, 600);
    return () => clearTimeout(phoneTimer.current);
  }, [active, phone, country]);

  return { emailTaken, emailChecking, phoneTaken, phoneChecking };
}
