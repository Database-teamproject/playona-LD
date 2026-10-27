ALTER TABLE "tracks" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "matched_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_source_url_idx" ON "tracks" USING btree ("source_url");