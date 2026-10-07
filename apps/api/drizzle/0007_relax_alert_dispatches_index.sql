DROP INDEX IF EXISTS "alert_dispatches_one_open_per_alert";
CREATE UNIQUE INDEX "alert_dispatches_one_open_per_alert" ON "alert_dispatches" USING btree ("alert_id") WHERE status IN ('ACCEPTED', 'ARRIVED');
