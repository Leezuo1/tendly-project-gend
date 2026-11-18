-- Smart Sourcing thêm chế độ theo dõi thị trường & đối thủ (kind = 'market'). Dữ liệu cũ giữ nguyên.
ALTER TABLE sourcing_runs DROP CONSTRAINT IF EXISTS sourcing_runs_kind_check;
ALTER TABLE sourcing_runs ADD CONSTRAINT sourcing_runs_kind_check CHECK (kind IN ('tiktok', 'suppliers', 'market'));
