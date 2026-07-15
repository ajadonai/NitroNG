INSERT INTO "settings" ("key", "value", "updatedAt")
VALUES ('social_whatsapp_channel', 'https://whatsapp.com/channel/0029Vb8hC6rJ3jv7Ig2m3D3Q', NOW())
ON CONFLICT ("key") DO NOTHING;
