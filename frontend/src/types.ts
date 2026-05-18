export type FetchInfoResponse =
  | {
      unique_id: string;
      success: true;
      id_present: true;
      text: string | null;
      has_files: boolean;
      files: Record<string, { filename: string; filesize: number }> | null;
      expiration: number;
      instantExpire: boolean;
    }
  | {
      unique_id: string;
      success: true;
      id_present: false;
      pending_uploads: boolean;
    }
  | {
      unique_id: string;
      success: false;
      error: string;
    };

export type UploadRequest = {
  text?: string;
  ttl: "10m" | "1h" | "1d" | "3d" | "1w" | "-1";
  files?: { fileName: string; fileType?: string; fileSize: number }[];
};

export type UploadResponse =
  | {
      success: true;
      uploadUrls: Record<string, { uploadUrl: string; fileName: string }> | null;
    }
  | {
      success: false;
      error: string;
    };
