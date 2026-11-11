CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`company` text,
	`action` text NOT NULL,
	`target` text,
	`at` text NOT NULL
);

CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`uid` text,
	`company` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires` text NOT NULL,
	`terms` text,
	`scopes` text DEFAULT '[]' NOT NULL
);

CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);
CREATE TABLE `placements` (
	`id` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`candidate` text NOT NULL,
	`payload` text NOT NULL,
	`updated` text NOT NULL
);

CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`evidence` text DEFAULT '' NOT NULL,
	`cvkey` text,
	`updated` text NOT NULL
);

CREATE UNIQUE INDEX `profiles_email_unique` ON `profiles` (`email`);
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
