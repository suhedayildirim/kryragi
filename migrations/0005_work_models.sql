-- CV taleplerinde tercih edilen çalışma modelleri (JSON dizi: uzaktan/hibrit/ofisten)
ALTER TABLE `access_requests` ADD COLUMN `work_models` text NOT NULL DEFAULT '[]';
