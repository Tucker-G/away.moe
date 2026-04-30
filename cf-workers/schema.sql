CREATE TABLE IF NOT EXISTS URLMetadata (
    ID TEXT PRIMARY KEY,
    ExpiryTime INTEGER NOT NULL,
    InstantExpire INTEGER DEFAULT 0,
    HasFiles INTEGER DEFAULT 0,
    IP TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_expiry ON URLMetadata (ExpiryTime);

-- No real reason for this to be a separate table, idk why it was done that way originally
CREATE TABLE IF NOT EXISTS Text (
    ID TEXT PRIMARY KEY,
    Content TEXT,
    FOREIGN KEY (ID) REFERENCES URLMetadata(ID) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS File (
    FileID TEXT PRIMARY KEY,
    MetaID TEXT,
	QueueID INTEGER,
    FileName TEXT,
    ExpiryTime INTEGER DEFAULT NULL,
    BucketKey TEXT,
    FOREIGN KEY (MetaID) REFERENCES URLMetadata(ID) ON DELETE CASCADE,
    FOREIGN KEY (QueueID) REFERENCES UploadQueue(QueueID) ON DELETE CASCADE,
	CHECK (MetaID IS NOT NULL OR QueueID IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_file_expiry ON File (ExpiryTime);
CREATE INDEX IF NOT EXISTS idx_file_id ON File (MetaID);

CREATE TABLE IF NOT EXISTS UploadQueue (
    QueueID INTEGER PRIMARY KEY,
    ID TEXT NOT NULL UNIQUE,
    Text TEXT,
    TTL TEXT NOT NULL,
    QueueExpiry INTEGER NOT NULL,
    IP TEXT DEFAULT NULL
);
CREATE INDEX IF NOT EXISTS idx_queue_expiry ON UploadQueue (QueueExpiry);
CREATE INDEX IF NOT EXISTS idx_queue_id ON UploadQueue (ID);
