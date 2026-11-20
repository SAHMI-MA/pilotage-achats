CREATE TABLE `project_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`source_hash` text NOT NULL,
	`applied_at` text NOT NULL,
	`summary` text NOT NULL,
	`backup_payload` text NOT NULL,
	`snapshot_verified` integer NOT NULL,
	CONSTRAINT "project_import_snapshot_verified" CHECK("project_imports"."snapshot_verified" = 1)
);
