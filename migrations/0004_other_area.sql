-- Talep formundaki "Diğer Teknoloji Alanları" serbest metin alanı
ALTER TABLE `access_requests` ADD COLUMN `other_label` text NOT NULL DEFAULT '';
ALTER TABLE `access_requests` ADD COLUMN `other_quota` integer NOT NULL DEFAULT 0;
