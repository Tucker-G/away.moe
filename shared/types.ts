import { z } from "zod";

export type FetchInfoResponse = {
    unique_id: string;
	success: true;
    id_present: true;
    text: string | null;
	has_files: boolean;
	files: Record<string, {filename: string, filesize: number}> | null;
	expiration: number
	instantExpire: boolean
} | {
	unique_id: string;
	success: true;
    id_present: false;
	pending_uploads: boolean;
} | {
	unique_id: string;
	success: false;
	error: string;
}

export const UploadRequestSchema = z.object({
    text: z.string().optional(),
    ttl: z.union([z.enum(["10m", "1h", "1d", "3d", "1w"]), z.literal("-1")]),
    files: z.array(z.object({
        fileName: z.string(),
        fileType: z.string().optional(),
        fileSize: z.number().int().nonnegative(),
    })).optional(),
});
export type UploadRequest = z.infer<typeof UploadRequestSchema>;

export type UploadResponse = {
	success: true;
	uploadUrls: Record<string, {uploadUrl: string, fileName: string}> | null;
} | {
	success: false;
	error: string;
}

export const TTL_SECONDS: Record<string, number> = {
	"10m": 600,
	"1h": 3600,
	"1d": 86400,
	"3d": 259200,
	"1w": 604800,
};

export const MailRequestSchema = z.object({
	message: z.string(),
	sender: z.string().nullable(),
})
export type MailRequest = z.infer<typeof MailRequestSchema>;

export type GenericResponse = {
	success: boolean;
}