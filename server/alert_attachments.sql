-- Alert attachments: metadata table. File bytes live on local disk
-- (ATTACHMENT_STORAGE_DIR); this table keeps the reference.
-- Apply with:  psql "$DATABASE_URL" -f server/alert_attachments.sql

CREATE TABLE IF NOT EXISTS alert_attachments (
    attachment_id  VARCHAR(36) PRIMARY KEY,
    alert_id       VARCHAR(255) NOT NULL,
    file_name      VARCHAR(255) NOT NULL,
    file_size      INTEGER      NOT NULL,
    content_type   VARCHAR(255),
    description    TEXT,
    storage_path   VARCHAR(1024) NOT NULL,          -- relative to ATTACHMENT_STORAGE_DIR
    uploaded_by    VARCHAR(100)  NOT NULL,
    uploaded_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alert_attachments_alert_id    ON alert_attachments (alert_id);
CREATE INDEX IF NOT EXISTS ix_alert_attachments_uploaded_by ON alert_attachments (uploaded_by);
