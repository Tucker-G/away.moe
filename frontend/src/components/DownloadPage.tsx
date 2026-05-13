import React, { CSSProperties, useState } from "react";
import Linkify from "linkify-react";
import { BASE_URL } from "../config";
import { theme } from "../theme";
import type { FetchInfoResponse } from "../types";

type IdPresent = Extract<FetchInfoResponse, { id_present: true }>;

type Props = {
  data: IdPresent;
};

const IMAGE_REGEX = /\.(jpe?g|gif|png|bmp|webp)$/i;

const DownloadPage = ({ data }: Props) => {
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const res = await fetch(
        `${BASE_URL}/api/download/${data.unique_id}/${fileId}`,
        { method: "GET" }
      );
      if (!res.ok) throw new Error("Failed to download the file");
      const totalHeader = res.headers.get("Content-Length");
      const total = totalHeader ? parseInt(totalHeader, 10) : 0;
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
          if (total > 0) {
            setProgress((prev) => ({
              ...prev,
              [fileId]: Math.round((loaded / total) * 100),
            }));
          }
        }
      }

      const blob = new Blob(chunks);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading the file:", err);
      alert("Failed to download the file.");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.text ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const linkifyOptions = { defaultProtocol: "https" };
  const fileEntries = data.has_files && data.files ? Object.entries(data.files) : [];

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Entry found</h1>
          <p style={styles.subtitle}>
            ID: <span className="mono" style={styles.idChip}>{data.unique_id}</span>
          </p>
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
                const fileProgress = progress[fileId] ?? 0;
                return (
                  <div key={fileId} style={styles.fileCard}>
                    <div style={styles.fileMeta}>
                      <span style={styles.fileName}>{info.filename}</span>
                      <span style={styles.fileSize}>
                        {(info.filesize / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    {isImage ? (
                      <img
                        src={`${BASE_URL}/api/download/${data.unique_id}/${fileId}`}
                        alt={info.filename}
                        style={styles.image}
                      />
                    ) : (
                      <div>
                        {fileProgress > 0 && fileProgress < 100 && (
                          <div style={styles.progressBar}>
                            <div
                              style={{
                                ...styles.progress,
                                width: `${fileProgress}%`,
                              }}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => handleDownload(fileId, info.filename)}
                          style={styles.button}
                        >
                          Download
                        </button>
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
  progressBar: {
    width: "100%",
    height: "6px",
    backgroundColor: theme.color.border,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    margin: "8px 0",
  },
  progress: {
    height: "100%",
    backgroundColor: theme.color.success,
    transition: "width 0.3s ease",
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
