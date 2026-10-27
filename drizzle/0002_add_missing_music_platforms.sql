INSERT INTO "platforms" ("name", "slug", "is_active")
VALUES ('FLO', 'flo', true), ('Genie Music', 'genie', true)
ON CONFLICT ("slug") DO NOTHING;
