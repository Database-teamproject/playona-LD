CREATE TABLE "platform_tracks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"track_id" bigint NOT NULL,
	"platform_id" integer NOT NULL,
	"external_id" varchar(255),
	"url" text NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platforms_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(100) NOT NULL,
	"slug" varchar(50) NOT NULL,
	"logo_url" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_links" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"link_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"short_code" varchar(16) NOT NULL,
	"track_id" bigint NOT NULL,
	"user_id" bigint,
	"click_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"track_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"isrc" varchar(20),
	"title" varchar(500) NOT NULL,
	"artist" varchar(500) NOT NULL,
	"album" varchar(500),
	"release_date" date,
	"duration_ms" integer,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_platform_preferences" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"platform_id" integer NOT NULL,
	"priority" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"nickname" varchar(100) NOT NULL,
	"profile_image_url" text,
	"provider" varchar(20) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_tracks" ADD CONSTRAINT "platform_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_tracks" ADD CONSTRAINT "platform_tracks_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_platform_preferences" ADD CONSTRAINT "user_platform_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_platform_preferences" ADD CONSTRAINT "user_platform_preferences_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_tracks_idx" ON "platform_tracks" USING btree ("track_id","platform_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_slug_idx" ON "platforms" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_token_idx" ON "refresh_tokens" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_links_short_code_idx" ON "shared_links" USING btree ("short_code");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_track_uuid_idx" ON "tracks" USING btree ("track_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_isrc_idx" ON "tracks" USING btree ("isrc");--> statement-breakpoint
CREATE UNIQUE INDEX "user_platform_pref_idx" ON "user_platform_preferences" USING btree ("user_id","platform_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_user_uuid_idx" ON "users" USING btree ("user_uuid");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_idx" ON "users" USING btree ("provider","provider_id");