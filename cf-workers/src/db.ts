import type { Env } from "./types";
import { TTL_SECONDS } from "@away-moe/shared";
export type { Env };

export interface FetchInfoRow {
	ExpiryTime: number;
	InstantExpire: number;
	HasFiles: number;
	Content: string | null;
}

export interface FileRow {
	FileID: string;
	FileName: string;
	BucketKey: string;
	ExpiryTime: number;
}

export interface UploadQueueRow {
	QueueID: number;
	ID: string;
	Text: string | null;
	TTL: string;
	QueueExpiry: number;
	IP: string | null;
}

function now(): number {
	return Math.floor(Date.now() / 1000);
}

function computeExpiry(ttl: string): { expiryTime: number; instantExpire: boolean } | null {
	if (ttl === "-1") {
		return { expiryTime: now() + TTL_SECONDS["1w"], instantExpire: true };
	}
	const seconds = TTL_SECONDS[ttl];
	if (!seconds) return null;
	return { expiryTime: now() + seconds, instantExpire: false };
}

export function isExpired(expiryTime: number): boolean {
	return expiryTime < now();
}

export async function entryPresent(db: D1Database, uniqueId: string): Promise<boolean> {
	const result = await db.prepare("SELECT 1 FROM URLMetadata WHERE ID = ?").bind(uniqueId).first();
	return result !== null;
}

export async function addTextEntry(
	db: D1Database,
	uniqueId: string,
	text: string,
	expirationTime: number,
	instantExpire: boolean,
	ipAddress: string | null
): Promise<void> {
	await db.prepare(
		"INSERT INTO URLMetadata (ID, ExpiryTime, InstantExpire, IP) VALUES (?, ?, ?, ?)"
	).bind(uniqueId, expirationTime, instantExpire ? 1 : 0, ipAddress).run();

	await db.prepare(
		"INSERT INTO Text (ID, Content) VALUES (?, ?)"
	).bind(uniqueId, text).run();
}

export async function fetchInfoRow(db: D1Database, uniqueId: string): Promise<FetchInfoRow | null> {
	return db.prepare(`
		SELECT m.ExpiryTime, m.InstantExpire, m.HasFiles, t.Content
		FROM URLMetadata m
		LEFT JOIN Text t ON t.ID = m.ID
		WHERE m.ID = ?
	`).bind(uniqueId).first<FetchInfoRow>();
}

export async function fetchFiles(db: D1Database, uniqueId: string): Promise<FileRow[]> {
	const result = await db.prepare(
		"SELECT FileID, FileName, BucketKey, ExpiryTime FROM File WHERE MetaID = ?"
	).bind(uniqueId).all<FileRow>();
	return result.results;
}

export async function fetchFile(db: D1Database, fileId: string): Promise<FileRow | null> {
	return db.prepare(
		"SELECT FileID, FileName, BucketKey, ExpiryTime FROM File WHERE FileID = ?"
	).bind(fileId).first<FileRow>();
}

export async function deleteEntry(db: D1Database, uniqueId: string): Promise<void> {
	await db.prepare("DELETE FROM URLMetadata WHERE ID = ?").bind(uniqueId).run();
}

export async function createQueue(
	db: D1Database,
	id: string,
	text: string | null,
	ttl: string,
	ip: string | null
): Promise<number> {
	const queueExpiry = now() + 86400;
	const result = await db.prepare(
		"INSERT INTO UploadQueue (ID, Text, TTL, QueueExpiry, IP) VALUES (?, ?, ?, ?, ?)"
	).bind(id, text, ttl, queueExpiry, ip).run();
	return result.meta.last_row_id as number;
}

export async function addFileToQueue(
	db: D1Database,
	fileId: string,
	queueId: number,
	fileName: string,
	bucketKey: string
): Promise<void> {
	await db.prepare(
		"INSERT INTO File (FileID, QueueID, FileName, BucketKey) VALUES (?, ?, ?, ?)"
	).bind(fileId, queueId, fileName, bucketKey).run();
}

export async function getOrCreateMetaURL(
	db: D1Database,
	id: string,
	ttl: string,
	ip: string | null,
	text: string | null
): Promise<{ expiryTime: number; instantExpire: boolean }> {
	const existing = await db.prepare(
		"SELECT ExpiryTime, InstantExpire FROM URLMetadata WHERE ID = ?"
	).bind(id).first<{ ExpiryTime: number; InstantExpire: number }>();

	if (existing) {
		return { expiryTime: existing.ExpiryTime, instantExpire: existing.InstantExpire === 1 };
	}

	const expiry = computeExpiry(ttl);
	if (!expiry) throw new Error(`Invalid TTL: ${ttl}`);

	await db.prepare(
		"INSERT INTO URLMetadata (ID, ExpiryTime, InstantExpire, HasFiles, IP) VALUES (?, ?, ?, 1, ?)"
	).bind(id, expiry.expiryTime, expiry.instantExpire ? 1 : 0, ip).run();

	if (text) {
		await db.prepare("INSERT INTO Text (ID, Content) VALUES (?, ?)").bind(id, text).run();
	}

	return expiry;
}

export async function markFileUploaded(db: D1Database, fileId: string): Promise<void> {
	const file = await db.prepare(`
		SELECT f.FileID, f.QueueID, q.ID, q.TTL, q.Text, q.IP
		FROM File f
		JOIN UploadQueue q ON q.QueueID = f.QueueID
		WHERE f.FileID = ?
	`).bind(fileId).first<{ FileID: string; QueueID: number; ID: string; TTL: string; Text: string | null; IP: string | null }>();

	if (!file) return;

	const { expiryTime } = await getOrCreateMetaURL(db, file.ID, file.TTL, file.IP, file.Text);

	await db.prepare(
		"UPDATE File SET MetaID = ?, QueueID = NULL, ExpiryTime = ? WHERE FileID = ?"
	).bind(file.ID, expiryTime, fileId).run();

	const remaining = await db.prepare(
		"SELECT COUNT(*) as count FROM File WHERE QueueID = ?"
	).bind(file.QueueID).first<{ count: number }>();

	if ((remaining?.count ?? 0) === 0) {
		await db.prepare("DELETE FROM UploadQueue WHERE QueueID = ?").bind(file.QueueID).run();
		console.log({ id: fileId, event: 'all files uploaded'})
	}
}

export async function getUploadQueue(db: D1Database, id: string): Promise<UploadQueueRow | null> {
	return db.prepare(
		"SELECT * FROM UploadQueue WHERE ID = ?"
	).bind(id).first<UploadQueueRow>();
}

export async function getRemainingUploads(db: D1Database, queueId: number): Promise<number> {
	const result = await db.prepare(
		"SELECT COUNT(*) as count FROM File WHERE QueueID = ?"
	).bind(queueId).first<{ count: number }>();
	return result?.count ?? 0;
}

export async function cancelUpload(db: D1Database, queueId: number): Promise<void> {
	await db.prepare("DELETE FROM File WHERE QueueID = ?").bind(queueId).run();
	await db.prepare("DELETE FROM UploadQueue WHERE QueueID = ?").bind(queueId).run();
}

export async function deleteFile(db: D1Database, fileId: string, metaId: string): Promise<void> {
	await db.prepare("DELETE FROM File WHERE FileID = ?").bind(fileId).run();

	const remaining = await db.prepare(
		"SELECT COUNT(*) as count FROM File WHERE MetaID = ?"
	).bind(metaId).first<{ count: number }>();

	if ((remaining?.count ?? 0) === 0) {
		await db.prepare("DELETE FROM URLMetadata WHERE ID = ?").bind(metaId).run();
	}
}

export async function getExpiredBucketKeys(db: D1Database): Promise<string[]> {
	const result = await db.prepare(
		"SELECT BucketKey FROM File WHERE ExpiryTime < ? AND BucketKey IS NOT NULL AND MetaID IS NOT NULL"
	).bind(now()).all<{ BucketKey: string }>();
	return result.results.map(row => row.BucketKey);
}

export async function deleteExpiredEntries(db: D1Database): Promise<void> {
	await db.prepare("DELETE FROM File WHERE MetaID IN (SELECT ID FROM URLMetadata WHERE ExpiryTime < ?)").bind(now()).run();
	await db.prepare("DELETE FROM Text WHERE ID IN (SELECT ID FROM URLMetadata WHERE ExpiryTime < ?)").bind(now()).run();
	await db.prepare("DELETE FROM URLMetadata WHERE ExpiryTime < ?").bind(now()).run();
	await db.prepare("DELETE FROM File WHERE QueueID IN (SELECT QueueID FROM UploadQueue WHERE QueueExpiry < ?)").bind(now()).run();
	await db.prepare("DELETE FROM UploadQueue WHERE QueueExpiry < ?").bind(now()).run();
}

export async function addMail(db: D1Database, message: string): Promise<void> {

}
