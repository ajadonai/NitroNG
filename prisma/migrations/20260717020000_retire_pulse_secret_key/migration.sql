-- Pulse and Live now use revocable, short-lived access grants tied to admin sessions.
-- Remove the legacy long-lived bearer secret so it cannot be recovered or reused.
DELETE FROM "settings" WHERE "key" = 'pulse_secret_key';
