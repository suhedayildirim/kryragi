-- Onaylı firmaların admin tarafından takibi
ALTER TABLE `members` ADD COLUMN `follow_status` text NOT NULL DEFAULT 'bekliyor';
ALTER TABLE `members` ADD COLUMN `follow_updated_at` text;
ALTER TABLE `members` ADD COLUMN `next_follow_up` text NOT NULL DEFAULT '';
ALTER TABLE `members` ADD COLUMN `approved_at` text;

-- Mevcut onaylı firmalar için onay tarihi: onaylanan ilk talebin tarihi, yoksa kayıt tarihi
UPDATE `members` SET `approved_at` = COALESCE(
	(SELECT MIN(`decided_at`) FROM `access_requests` r WHERE r.`member_id` = `members`.`id` AND r.`status` = 'approved'),
	NULLIF(`created_at`, '')
) WHERE `status` = 'approved';

-- Firma geçmişi: admin iletişim kayıtları (contact) ve sistem olayları (system)
CREATE TABLE `firm_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL DEFAULT '',
	`channel` text NOT NULL DEFAULT '',
	`note` text NOT NULL DEFAULT '',
	`contacted_at` text NOT NULL DEFAULT '',
	`next_follow_up` text NOT NULL DEFAULT '',
	`created_by` text NOT NULL DEFAULT '',
	`created_at` text NOT NULL
);
CREATE INDEX `firm_activities_member` ON `firm_activities` (`member_id`, `created_at`);
