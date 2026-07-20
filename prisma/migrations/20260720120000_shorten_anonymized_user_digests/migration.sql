UPDATE users
SET
  email = 'deleted-' || substring(email, 9, 10) || '@accounts.invalid',
  "referralCode" = 'deleted-' || substring("referralCode", 9, 10) || '.invalid',
  password = '!deleted:' || substring(password, 10, 10)
WHERE "anonymizedAt" IS NOT NULL
  AND status = 'Deleted'
  AND email ~ '^deleted-[a-f0-9]{64}@accounts\.invalid$';
