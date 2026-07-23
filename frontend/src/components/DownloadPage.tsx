import React, { CSSProperties, useEffect, useRef, useState } from "react";
import Linkify from "linkify-react";
import { BASE_URL } from "../config";
import { theme } from "../theme";
import type { FetchInfoResponse } from "../types";

type IdPresent = Extract<FetchInfoResponse, { id_present: true }>;

type Props = {
  data: IdPresent;
};

const IMAGE_REGEX = /\.(jpe?g|gif|png|bmp|webp)$/i;
const VIDEO_REGEX = /\.(mp4|webm|ogv|mov|m4v)$/i;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatExpiration = (expirationSeconds: number): string => {
  const diffSec = expirationSeconds - Math.floor(Date.now() / 1000);
  if (diffSec <= 0) return "now";
  const minutes = Math.round(diffSec / 60);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(diffSec / 3600);
  if (hours < 24) return `in ${hours} hr`;
  const days = Math.round(diffSec / 86400);
  return `in ${days} day${days === 1 ? "" : "s"}`;
};

const DownloadPage = ({ data }: Props) => {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const videoUrlsRef = useRef(videoUrls);
  videoUrlsRef.current = videoUrls;

  useEffect(() => {
    return () => {
      Object.values(videoUrlsRef.current).forEach((url) =>
        window.URL.revokeObjectURL(url)
      );
    };
  }, []);

  const fetchBlob = async (fileId: string): Promise<Blob> => {
    setDownloading((prev) => ({ ...prev, [fileId]: true }));
    setProgress((prev) => ({ ...prev, [fileId]: 0 }));
    try {
      const res = await fetch(
        `${BASE_URL}/api/download/${data.unique_id}/${fileId}`,
        { method: "GET" }
      );
      if (!res.ok) throw new Error("Failed to download the file");
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      let loaded = 0;
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          setProgress((prev) => ({ ...prev, [fileId]: loaded }));
        }
      }

      const type = res.headers.get("content-type") ?? "";
      return new Blob(chunks as BlobPart[], type ? { type } : undefined);
    } finally {
      setDownloading((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  const saveUrl = (url: string, filename: string) => {
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const blob = await fetchBlob(fileId);
      const url = window.URL.createObjectURL(blob);
      saveUrl(url, filename);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading the file:", err);
      alert("Failed to download the file.");
    }
  };

  const handlePlay = async (fileId: string) => {
    try {
      const blob = await fetchBlob(fileId);
      const url = window.URL.createObjectURL(blob);
      setVideoUrls((prev) => ({ ...prev, [fileId]: url }));
    } catch (err) {
      console.error("Error loading the video:", err);
      alert("Failed to load the video.");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.text ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const linkifyOptions = { defaultProtocol: "https" };
  const fileEntries = data.has_files && data.files ? Object.entries(data.files) : [];
  const hasFiles = fileEntries.length > 0;
  const perFileExpireNotice = data.instantExpire && hasFiles;

  let topNotice: { text: string; kind: "warn" | "info" } | null = null;
  if (data.instantExpire && !hasFiles) {
    topNotice = {
      text: "This page is expired",
      kind: "warn",
    };
  } else if (!data.instantExpire) {
    topNotice = { text: `Expires ${formatExpiration(data.expiration)}`, kind: "info" };
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Entry found</h1>
          <p style={styles.subtitle}>
            ID: <span className="mono" style={styles.idChip}>{data.unique_id}</span>
          </p>
          {topNotice && (
            <div
              style={{
                ...styles.notice,
                ...(topNotice.kind === "warn" ? styles.noticeWarn : styles.noticeInfo),
              }}
            >
              {topNotice.text}
            </div>
          )}
        </div>

        {data.text !== null && (
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionLabel}>Text</span>
              <button onClick={handleCopy} style={styles.copyButton}>
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div style={styles.textBlock}>
              <Linkify options={linkifyOptions}>{data.text}</Linkify>
            </div>
          </div>
        )}

        {fileEntries.length > 0 && (
          <div style={styles.section}>
            <span style={styles.sectionLabel}>
              {fileEntries.length === 1 ? "File" : `${fileEntries.length} Files`}
            </span>
            <div style={styles.fileList}>
              {fileEntries.map(([fileId, info]) => {
                const isImage = IMAGE_REGEX.test(info.filename);
                const isVideo = VIDEO_REGEX.test(info.filename);
                const fileProgress = progress[fileId] ?? 0;
                const videoUrl = videoUrls[fileId];
                return (
                  <div key={fileId} style={styles.fileCard}>
                    <div style={styles.fileMeta}>
                      <span style={styles.fileName}>{info.filename}</span>
                      <span style={styles.fileSize}>
                        {(info.filesize / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    {perFileExpireNotice && (
                      <div style={styles.fileExpireNote}>
                        {isImage ? "Expired" : "Expires after download"}
                      </div>
                    )}
                    {isImage ? (
                      <img
                        src={`${BASE_URL}/api/download/${data.unique_id}/${fileId}`}
                        alt={info.filename}
                        style={styles.image}
                      />
                    ) : isVideo && videoUrl ? (
                      <div>
                        <video src={videoUrl} controls autoPlay style={styles.image} />
                        <div style={styles.buttonRow}>
                          <button
                            onClick={() => saveUrl(videoUrl, info.filename)}
                            style={styles.button}
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {downloading[fileId] && (
                          <div style={styles.progressWrap}>
                            <div style={styles.progressText}>
                              {formatBytes(fileProgress)} / {formatBytes(info.filesize)}
                            </div>
                            <div style={styles.progressBar}>
                              <div
                                style={{
                                  ...styles.progress,
                                  width: `${Math.min(100, (fileProgress / info.filesize) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                        <div style={styles.buttonRow}>
                          {isVideo && (
                            <button
                              onClick={() => handlePlay(fileId)}
                              style={styles.button}
                              disabled={downloading[fileId]}
                            >
                              {downloading[fileId] ? "Loading…" : "▶ Play"}
                            </button>
                          )}
                          <button
                            onClick={() => handleDownload(fileId, info.filename)}
                            style={styles.button}
                            disabled={downloading[fileId]}
                          >
                            {downloading[fileId] ? "Downloading…" : "Download"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "40px 16px",
  },
  container: {
    width: "100%",
    maxWidth: "720px",
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  header: {
    textAlign: "center",
  },
  title: {
    fontSize: "1.8em",
    fontWeight: 700,
    margin: 0,
    marginBottom: "6px",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: 0,
    color: theme.color.muted,
    fontSize: "0.95em",
  },
  notice: {
    display: "inline-block",
    marginTop: "12px",
    padding: "6px 12px",
    borderRadius: theme.radius.pill,
    fontSize: "0.85em",
    fontWeight: 500,
    border: "1px solid transparent",
  },
  noticeInfo: {
    backgroundColor: theme.color.surfaceAlt,
    borderColor: theme.color.border,
    color: theme.color.muted,
  },
  noticeWarn: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.25)",
    color: theme.color.danger,
  },
  fileExpireNote: {
    marginBottom: "8px",
    fontSize: "0.8em",
    color: theme.color.danger,
    fontWeight: 500,
  },
  idChip: {
    backgroundColor: theme.color.surfaceAlt,
    border: `1px solid ${theme.color.border}`,
    padding: "2px 8px",
    borderRadius: theme.radius.sm,
    color: theme.color.text,
    fontSize: "0.9em",
  },
  section: {
    backgroundColor: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.lg,
    padding: "20px",
    boxShadow: theme.shadow.soft,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  sectionLabel: {
    display: "block",
    fontSize: "0.8em",
    color: theme.color.muted,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "10px",
  },
  textBlock: {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    backgroundColor: theme.color.surfaceAlt,
    border: `1px solid ${theme.color.border}`,
    padding: "14px",
    borderRadius: theme.radius.md,
    fontSize: "0.95em",
    lineHeight: 1.6,
  },
  copyButton: {
    padding: "6px 12px",
    fontSize: "0.85em",
    fontWeight: 500,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.sm,
    cursor: "pointer",
  },
  fileList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  fileCard: {
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    padding: "14px",
    backgroundColor: theme.color.surfaceAlt,
  },
  fileMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "8px",
  },
  fileName: {
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileSize: {
    color: theme.color.muted,
    fontSize: "0.85em",
    flexShrink: 0,
  },
  image: {
    width: "100%",
    maxHeight: "500px",
    objectFit: "contain",
    marginTop: "8px",
    borderRadius: theme.radius.sm,
    backgroundColor: theme.color.surface,
  },
  progressWrap: {
    margin: "8px 0",
  },
  progressText: {
    fontSize: "0.85em",
    color: theme.color.muted,
    marginBottom: "4px",
    fontVariantNumeric: "tabular-nums",
  },
  progressBar: {
    width: "100%",
    height: "6px",
    backgroundColor: theme.color.border,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
  },
  progress: {
    height: "100%",
    backgroundColor: theme.color.success,
    transition: "width 0.2s ease",
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
  },
  button: {
    padding: "9px 18px",
    border: "none",
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: theme.shadow.button,
    marginTop: "4px",
  },
};

export default DownloadPage;
