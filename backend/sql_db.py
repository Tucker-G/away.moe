import os
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path
import threading

import psycopg2
from psycopg2 import sql
from werkzeug.datastructures import FileStorage

from database import Database, FileEntry


class SQLiteDatabase(Database):
    def __init__(self, db_file: str = "database.sqlite"):
        super().__init__()
        self.conn = psycopg2.connect(
            dbname=os.getenv("PG_DB", "mydb"),
            user=os.getenv("PG_USER", "user"),
            password=os.getenv("PG_PASSWORD", "password"),
            host=os.getenv("PG_HOST", "localhost"),
            port=os.getenv("PG_PORT", "5432")
        )
        self.conn.autocommit = True
        self._create_table()
        self._start_cleanup_scheduler()

    def _create_table(self):
        """Create the database tables if they do not exist."""
        with self.conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS urlmetadata (
                    id TEXT PRIMARY KEY,
                    uploadtime TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    expirytime TIMESTAMPTZ,
                    instantexpire BOOLEAN DEFAULT FALSE,
                    ip TEXT
                );

                CREATE TABLE IF NOT EXISTS text_content (
                    textid SERIAL PRIMARY KEY,
                    content VARCHAR(500),
                    id TEXT REFERENCES urlmetadata(id)
                        ON UPDATE CASCADE
                        ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS files (
                    fileid SERIAL PRIMARY KEY,
                    filename VARCHAR(100),
                    path VARCHAR(255),
                    expirytime TIMESTAMPTZ,
                    id TEXT REFERENCES urlmetadata(id)
                        ON DELETE SET NULL
                );
                """
            )

    def entry_present(self, unique_id: str) -> bool:
        """Check if an entry exists in the URLMetadata table."""
        with self.conn.cursor() as cursor:
            cursor.execute("SELECT 1 FROM URLMetadata WHERE ID = ?",
                           (unique_id,))
            return cursor.fetchone() is not None

    def retrieve_entry(self, unique_id: str) -> FileEntry | None:
        """Retrieve an entry from the database and return it as a FileEntry object."""
        # Retrieve metadata from URLMetadata table
        with self.conn.cursor() as cursor:
            cursor.execute(
                "SELECT expirytime, instantexpire, ip FROM urlmetadata WHERE id = %s",
                (unique_id,)
            )
            row = cursor.fetchone()
            if not row:
                return None

            # Parse metadata
            expiry_ts, instant_expire, ip_address = row
            expiry_time = int(expiry_ts.timestamp()) if expiry_ts else None

            # Retrieve text content
            cursor.execute(
                "SELECT content FROM text_content WHERE id = %s",
                (unique_id,)
            )
            text_result = cursor.fetchone()
            text_content = text_result[0] if text_result else None

            # Retrieve file information
            cursor.execute(
                "SELECT filename FROM files WHERE id = %s",
                (unique_id,)
            )
            file_result = cursor.fetchone()
            file_name = file_result[0] if file_result else None
            has_file = file_result is not None

        # Return a FileEntry object
        return FileEntry(
            file_name=file_name,
            text=text_content,
            expiration_time=expiry_time,
            has_file=has_file,
            instant_expire=instant_expire,
            ip_address=ip_address
        )

    # def file_present(self, unique_id: str) -> bool:
    #     """Check if a file exists for a given entry in the File table."""
    #     cursor = self.conn.cursor()
    #     cursor.execute("SELECT 1 FROM File WHERE ID = ?", (unique_id,))
    #     return cursor.fetchone() is not None

    def add_to_database(self, unique_id, entry: FileEntry, file: FileStorage | None):
        print(f"unique_id: {unique_id}, expiration_time: {entry.expiration_time}, instant_expire: {entry.instant_expire}")
        """Add data to the database."""
        with self.conn.cursor() as cursor:
            expiry_dt = datetime.fromtimestamp(entry.expiration_time) if entry.expiration_time else None
            cursor.execute(
                "INSERT INTO urlmetadata (id, expirytime, instantexpire, ip) VALUES (%s, %s, %s, %s)",
                (unique_id, expiry_dt, entry.instant_expire, entry.ip_address)
            )

            # Text and files optional
            if entry.text:
                cursor.execute(
                    "INSERT INTO text_content (content, id) VALUES (%s, %s)",
                    (entry.text, unique_id)
                )

            if file:
                file_path = f"./files/{uuid.uuid1()}"
                Path("./files").mkdir(exist_ok=True)  # Ensure the directory exists
                file.save(file_path)
                cursor.execute(
                    "INSERT INTO files (filename, path, expirytime, id) VALUES (%s, %s, %s, %s)",
                    (
                        entry.file_name,
                        file_path,
                        expiry_dt,
                        unique_id
                    )
                )



    def delete_from_database(self, unique_id: str):
        """Delete an entry and its associated data."""
        with self.conn.cursor() as cursor:
            cursor.execute(
                "SELECT instantexpire FROM urlmetadata WHERE id = %s",
                (unique_id,)
            )
            result = cursor.fetchone()
            if result and result[0]:  # If InstantExpire is True
                print("updated time to +1 hour")
                cursor.execute(
                    "UPDATE files SET expirytime = NOW() + INTERVAL '1 hour' WHERE id = %s",
                    (unique_id,)
                )

            # Set ID field to blank in File table
            cursor.execute(
                "UPDATE files SET id = NULL WHERE id = %s",
                (unique_id,)
            )

            cursor.execute(
                "DELETE FROM urlmetadata WHERE id = %s",
                (unique_id,)
            )
            print(f"deleted {unique_id}")

    def retrieve_file_path(self, unique_id: str) -> Path:
        """Retrieve the file path for a given entry."""
        with self.conn.cursor() as cursor:
            cursor.execute(
                "SELECT path FROM files WHERE id = %s",
                (unique_id,)
            )
            result = cursor.fetchone()
            return Path(result[0]) if result else None



    def _start_cleanup_scheduler(self):
        """Start a background task to run cleanup_db every hour."""
        def schedule_task():
            while True:
                self._cleanup_db()
                threading.Event().wait(timeout=3600)  # Wait for 1 hour

        self._cleanup_db()
        cleanup_thread = threading.Thread(target=schedule_task, daemon=True)
        cleanup_thread.start()

    def _cleanup_db(self):
        """Delete all expired entries from URLMetadata and File tables."""
        with self.conn.cursor() as cursor:

            # Delete from URLMetadata where ExpiryTime is in the past
            cursor.execute(
                "DELETE FROM urlmetadata WHERE expirytime IS NOT NULL AND expirytime < NOW()"
            )

            # Fetch the paths of files that need to be unlinked
            cursor.execute(
                "SELECT path FROM files WHERE expirytime IS NOT NULL AND expirytime < NOW()"
            )
            files_to_delete = cursor.fetchall()

            # Unlink the files
            for file in files_to_delete:
                file_path = file[0]
                if os.path.exists(file_path):
                    os.unlink(file_path)  # Deletes the file from the file system
                print(f"Unlinked {file_path}")

            # Delete the corresponding table entries
            cursor.execute(
                "DELETE FROM files WHERE expirytime IS NOT NULL AND expirytime < NOW()"
            )