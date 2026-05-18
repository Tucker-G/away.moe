import { Hono, TypedResponse } from "hono";
import { cors } from "hono/cors";
import {
	addTextEntry,
	addFileToQueue,
	createQueue,
	deleteEntry,
	deleteExpiredEntries,
	entryPresent,
	fetchInfoRow,
	getExpiredBucketKeys,
	isExpired, getUploadQueue, fetchFile, fetchFiles, deleteFile, markFileUploaded, cancelUpload,
} from "./db";
import { AwsClient } from "aws4fetch";
import type { Env } from "./types";
import { FetchInfoResponse, TTL_SECONDS, UploadRequest, UploadRequestSchema, UploadResponse } from "@away-moe/shared";

export type { Env };


function getExpiry(ttl: string): { expiry: number; instantExpire: boolean } | null {
	if (ttl === "-1") {
		return { expiry: Math.floor(Date.now() / 1000) + TTL_SECONDS["1w"], instantExpire: true };
	}
	const seconds = TTL_SECONDS[ttl];
	if (!seconds) return null;
	return { expiry: Math.floor(Date.now() / 1000) + seconds, instantExpire: false };
}

const app = new Hono<{ Bindings: Env }>();

app.use(
	"/api/*",
	cors({
		origin: (origin) => origin,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
		exposeHeaders: ["Content-Length", "Content-Disposition", "Content-Type"],
		maxAge: 600,
	})
);

app.post("/api/upload/:id", async (c): Promise<TypedResponse<UploadResponse>> => {
	const uniqueId = c.req.param("id");
	const env = c.env;

	const body = UploadRequestSchema.safeParse(await c.req.json());
	if (!body.success) {
		return c.json({ success: false, error: "Invalid JSON body" }, 400);
	}
	const { text, ttl, files } = body.data;
	const hasFiles = !!files && files.length > 0;

	if (!hasFiles && !text) {
		return c.json({ success: false, error: "No file or text uploaded" }, 400);
	}

	if (!ttl) {
		return c.json({ success: false, error: "Invalid expiration time given" }, 400);
	}

	const timestamp = getExpiry(ttl);
	if (!timestamp) {
		return c.json({ success: false, error: "Invalid expiration time given" }, 400);
	}

	const alreadyExists = await entryPresent(env.DB, uniqueId)
	if (alreadyExists) {
		return c.json({ success: false, error: "Entry already exists" }, 400);
	}

	if (hasFiles && files.length > 50) {
		return c.json({ success: false, error: "Too many files to upload" }, 400);
	}

	const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;
	if (hasFiles && files!.some(f => f.fileSize > MAX_FILE_SIZE)) {
		return c.json({ success: false, error: "File exceeds maximum size of 5 GB" }, 400);
	}
	const ip = c.req.header("CF-Connecting-IP") ?? null;

	// Users are allowed to overwrite existing uploads
	const existingQueue = await getUploadQueue(env.DB, uniqueId)
	if (existingQueue) {
		await cancelUpload(env.DB, existingQueue.QueueID)
	}

	if (!hasFiles && text) {
		await addTextEntry(env.DB, uniqueId, text, timestamp.expiry, timestamp.instantExpire, ip);
		return c.json({ success: true, uploadUrls: null });
	}

	const aws = new AwsClient({
		accessKeyId: env.R2_ACCESS_KEY_ID,
		secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		region: "auto",
		service: "s3",
	});

	// const uploadHost = env.R2_PUBLIC_HOST
	// 	? `https://${env.R2_PUBLIC_HOST}`
	// 	: `https://away-moe-files.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
	const uploadHost = `https://away-moe-files.${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

	const queueId = await createQueue(env.DB, uniqueId, text ?? null, ttl, ip);

	const entries = await Promise.all(files!.map(async (file) => {
		const fileId = [...crypto.getRandomValues(new Uint8Array(3))]
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
		const r2Key = crypto.randomUUID();

		const reqUrl = new URL(`${uploadHost}/${r2Key}`);
		reqUrl.searchParams.set("X-Amz-Expires", "86400");

		const [signedReq] = await Promise.all([
			aws.sign(new Request(reqUrl, {
				method: "PUT",
				headers: {
					"content-type": file.fileType ?? "application/octet-stream",
					"content-length": String(file.fileSize),
				},
			}), { aws: { signQuery: true } }),
			addFileToQueue(env.DB, fileId, queueId, file.fileName, r2Key),
		]);

		const uploadUrl = signedReq.url;

		return [fileId, { uploadUrl, filename: file.fileName }];
	}));

	return c.json({ success: true, uploadUrls: Object.fromEntries(entries) });
});

app.post("/api/confirm/:file_id", async (c) => {
	const fileId = c.req.param("file_id");
	const env = c.env;

	const fileRow = await fetchFile(env.DB, fileId);
	if (!fileRow) {
		return c.json({ success: false, error: "File not found" }, 404);
	}
	const object = await env.FILES.head(fileRow.BucketKey);
	console.log(fileRow, object)
	if (!object) {
		return c.json({ success: false, error: "File not yet uploaded" }, 400);
	}

	await markFileUploaded(env.DB, fileId);
	return c.json({ success: true });
});

app.get("/api/fetch_info/:id", async (c): Promise<TypedResponse<FetchInfoResponse>> => {
	const uniqueId = c.req.param("id");
	const env = c.env;

	const row = await fetchInfoRow(env.DB, uniqueId);

	const pendingUploads = await getUploadQueue(env.DB, uniqueId)
	if (!row) {
		return c.json({ unique_id: uniqueId, success: true, id_present: false, pending_uploads: !!pendingUploads });
	}

	if (isExpired(row.ExpiryTime)) {

		if (row.HasFiles) {
			const files = await fetchFiles(env.DB, uniqueId);
			await Promise.all(files.map(file => env.FILES.delete(file.BucketKey)));
		}
		// Files delete on cascade, so deleting entry deletes files too
		await deleteEntry(env.DB, uniqueId);
		const noInfo: FetchInfoResponse = {
			unique_id: uniqueId,
    		success: true,
    		id_present: false,
    		pending_uploads: false
		}
		return c.json(noInfo);
	}

	const response: FetchInfoResponse = {
		unique_id: uniqueId,
		success: true,
		id_present: true,
		text: row.Content ?? null,
		has_files: false,
		files: null,
		expiration: row.ExpiryTime,
		instantExpire: !!row.InstantExpire
	};

	if (row.HasFiles) {
		const responseFiles: Record<string, {filename: string; filesize: number;}> = {}
		const files = await fetchFiles(env.DB, uniqueId)
		await Promise.all(files.map(async (file) => {
			const object = await env.FILES.head(file.BucketKey);
			if (object) {
				responseFiles[file.FileID] = {filename: file.FileName, filesize: object.size}
			}
		}))
		response.files = responseFiles;
		response.has_files = true;
	} else if (row.InstantExpire) {
		await deleteEntry(env.DB, uniqueId);
	}
	return c.json(response);
});

app.get("/api/download/:id/:file_id", async (c) => {
	const uniqueId = c.req.param("id");
	const fileId = c.req.param("file_id");
	const env = c.env;

	const [row, fileRow] = await Promise.all([
		fetchInfoRow(env.DB, uniqueId),
		fetchFile(env.DB, fileId),
	]);

	if (!row || !row.HasFiles || !fileRow || isExpired(row.ExpiryTime)) {
		return c.json({ message: "File does not exist" }, 400);
	}
	const object = await env.FILES.get(fileRow.BucketKey);
	if (!object) {
		return c.json({ message: "File does not exist" }, 400);
	}

	if (row.InstantExpire) {
		await env.FILES.delete(fileRow.BucketKey);
		await deleteFile(env.DB, fileRow.FileID, uniqueId);
	}

	return new Response(object.body, {
		headers: {
			"Content-Disposition": `attachment; filename="${fileRow.FileName}"`,
			"Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
			"Content-Length": String(object.size),
		},
	});
});

export default {
	fetch: app.fetch,

	async scheduled(_event: ScheduledController, env: Env): Promise<void> {
		const bucketKeys = await getExpiredBucketKeys(env.DB);
		await Promise.all(bucketKeys.map(key => env.FILES.delete(key)));
		await deleteExpiredEntries(env.DB);
	},
} satisfies ExportedHandler<Env>;
