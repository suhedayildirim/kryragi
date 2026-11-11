-- Yerel giriş sistemi
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`member_id` text,
	`created_at` text NOT NULL
);
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window_start` integer NOT NULL
);

-- Firma iletişim bilgileri
ALTER TABLE `members` ADD COLUMN `title` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `phone` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `website` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `city` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `created_at` text NOT NULL DEFAULT '';

-- Program menüsü: Program > Alan
CREATE TABLE `programs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL UNIQUE,
	`sort` integer NOT NULL DEFAULT 0,
	`active` integer NOT NULL DEFAULT 1
);
CREATE TABLE `program_areas` (
	`id` text PRIMARY KEY NOT NULL,
	`program_id` text NOT NULL,
	`name` text NOT NULL,
	`sort` integer NOT NULL DEFAULT 0,
	`active` integer NOT NULL DEFAULT 1,
	UNIQUE (`program_id`, `name`)
);

-- Firma talepleri (QR formu ve panelden ek program talebi)
CREATE TABLE `access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`type` text NOT NULL,
	`items` text NOT NULL,
	`note` text NOT NULL DEFAULT '',
	`status` text NOT NULL DEFAULT 'pending',
	`created_at` text NOT NULL,
	`decided_at` text,
	`decision_note` text NOT NULL DEFAULT ''
);

-- Firmaya açılan program/alan yetkileri (kontenjan bilgisiyle)
CREATE TABLE `member_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`program_id` text NOT NULL,
	`area_id` text NOT NULL DEFAULT '',
	`quota` integer NOT NULL DEFAULT 0,
	`request_id` text,
	`granted_at` text NOT NULL,
	UNIQUE (`member_id`, `program_id`, `area_id`)
);

-- Firmaya tek tek açılan mezun CV'leri
CREATE TABLE `member_profiles` (
	`member_id` text NOT NULL,
	`profile_id` text NOT NULL,
	`grant_id` text,
	`granted_at` text NOT NULL,
	`granted_by` text NOT NULL,
	PRIMARY KEY (`member_id`, `profile_id`)
);

-- Yönetim paneli bildirimleri
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`member_id` text,
	`ref_id` text,
	`candidate_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL DEFAULT '',
	`actor_email` text NOT NULL DEFAULT '',
	`created_at` text NOT NULL,
	`read_at` text
);
CREATE INDEX `notifications_created` ON `notifications` (`created_at`);

-- Aynı firma aynı adayı yalnızca bir kez işe alım sürecine ekleyebilir
CREATE UNIQUE INDEX `placements_member_candidate` ON `placements` (`member`, `candidate`);

-- Varsayılan program menüsü (yönetim panelinden değiştirilebilir)
INSERT INTO `programs` (`id`, `name`, `sort`) VALUES
	('p-gygy', 'Gençlere Yatırım Geleceğe Yazılım', 1),
	('p-gyk', 'Geleceği Yazan Kadınlar', 2),
	('p-siber', 'Siber Güvenliğin Süper Kadınları', 3);
INSERT INTO `program_areas` (`id`, `program_id`, `name`, `sort`) VALUES
	('a-gygy-java', 'p-gygy', 'Java', 1),
	('a-gygy-fe', 'p-gygy', 'Front-End', 2),
	('a-gygy-net', 'p-gygy', '.NET', 3),
	('a-gygy-kotlin', 'p-gygy', 'Kotlin', 4),
	('a-gygy-swift', 'p-gygy', 'Swift', 5),
	('a-gygy-ai', 'p-gygy', 'Yapay Zekâ', 6),
	('a-gygy-data', 'p-gygy', 'Veri Analitiği', 7),
	('a-gygy-ux', 'p-gygy', 'UX/UI', 8),
	('a-gygy-cloud', 'p-gygy', 'Bulut', 9),
	('a-gyk-java', 'p-gyk', 'Java', 1),
	('a-gyk-fe', 'p-gyk', 'Front-End', 2),
	('a-gyk-data', 'p-gyk', 'Veri Analitiği', 3),
	('a-gyk-ai', 'p-gyk', 'Yapay Zekâ', 4),
	('a-siber-sg', 'p-siber', 'Siber Güvenlik', 1);
