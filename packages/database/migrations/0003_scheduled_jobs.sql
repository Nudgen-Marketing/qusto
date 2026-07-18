CREATE UNIQUE INDEX jobs_singleton_active_type_idx
  ON jobs(type)
  WHERE type IN ('maintenance.partitions', 'maintenance.retention', 'rollups.refresh')
    AND status IN ('pending', 'running', 'failed');
