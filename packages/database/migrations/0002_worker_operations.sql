CREATE TABLE worker_heartbeats (
  worker_id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE hourly_rollups (
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  bucket timestamptz NOT NULL,
  payments bigint NOT NULL DEFAULT 0,
  denies bigint NOT NULL DEFAULT 0,
  failures bigint NOT NULL DEFAULT 0,
  spend_atomic numeric(78, 0) NOT NULL DEFAULT 0,
  PRIMARY KEY (environment_id, bucket)
);

DO $$
DECLARE
  partition_day date;
  partition_name text;
BEGIN
  FOR offset_day IN 0..7 LOOP
    partition_day := current_date + offset_day;
    partition_name := 'trace_events_' || to_char(partition_day, 'YYYYMMDD');
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF trace_events FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      partition_day,
      partition_day + 1
    );
  END LOOP;
END $$;
