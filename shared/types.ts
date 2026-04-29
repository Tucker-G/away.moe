export type FetchInfoResponse = {
    unique_id: string;
	success: true;
    id_present: true;
    text: string | null;
	has_files: boolean;
	files: Record<string, {filename: string, filesize: number}> | null;
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