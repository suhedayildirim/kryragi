CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`member` text NOT NULL,
	`candidate` text NOT NULL,
	`company` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_email` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text
);

CREATE UNIQUE INDEX `contacts_member_candidate_unique` ON `contacts` (`member`,`candidate`);