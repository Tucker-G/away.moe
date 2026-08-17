import React, {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import qr from "qr.js";
import { BASE_URL } from "../config";
import { theme } from "../theme";
import type { UploadRequest, UploadResponse } from "@away-moe/shared";

const MAX_FILE_SIZE_MB = 5120;
const MAX_FILES = 50;

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

type Props = {
  uniqueId: string;
  hasPending: boolean;
};

type TrackedFile = { id: string; file: File };

const newId = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const UploadForm = ({ uniqueId, hasPending }: Props) => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState<UploadRequest["ttl"]>("-1");
  const [error, setError] = useState("");
  const [isUploaded, setIsUploaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileProgress, setFileProgress] = useState<Record<string, number>>({});
  const [dragging, setDragging] = useState(false);
  const [pendingPromptOpen, setPendingPromptOpen] = useState(hasPending);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xhrsRef = useRef<Record<string, XMLHttpRequest>>({});

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        addFiles(Array.from(e.clipboardData.files));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("paste", handlePaste);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading, files]);

  useEffect(() => {
    if (uniqueId && isUploaded && qrCanvasRef.current) {
      const qrData = qr(`https://away.moe/${uniqueId}`);
      const canvas = qrCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const size = 256;
      const cells: boolean[][] = qrData.modules;
      const cellSize = size / cells.length;

      canvas.width = size;
      canvas.height = size;

      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = "black";
      cells.forEach((row, rowIndex) => {
        row.forEach((cell, cellIndex) => {
          if (cell) {
            ctx.fillRect(
              cellIndex * cellSize,
              rowIndex * cellSize,
              cellSize,
              cellSize
            );
          }
        });
      });
    }
  }, [uniqueId, isUploaded]);

  const addFiles = (incoming: File[]) => {
    const next = [...files];
    let localError = "";

    for (const file of incoming) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        localError = `File "${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB`;
        continue;
      }
      if (next.length >= MAX_FILES) {
        localError = `Cannot upload more than ${MAX_FILES} files`;
        break;
      }
      const dup = next.some(
        (f) => f.file.name === file.name && f.file.size === file.size
      );
      if (dup) continue;
      next.push({ id: newId(), file });
    }

    setError(localError);
    setFiles(next);
  };

  const removeFile = (id: string) => {
    const xhr = xhrsRef.current[id];
    if (xhr) {
      xhr.abort();
      delete xhrsRef.current[id];
    }
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setFileProgress((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (files.length === 0 && text === "") {
      alert("Please select a file or enter text before uploading.");
      return;
    }

    setError("");

    const snapshot = files;
    const requestBody: UploadRequest = {
      text: text || undefined,
      ttl,
      files: snapshot.map(({ file: f }) => ({
        fileName: f.name,
        fileType: f.type,
        fileSize: f.size,
      })),
    };

    try {
      const res = await axios.post<UploadResponse>(
        `${BASE_URL}/api/upload/${uniqueId}`,
        requestBody
      );
      const data = res.data;
      if (!data.success) {
        setError(data.error);
        return;
      }

      if (!data.uploadUrls) {
        setIsUploaded(true);
        return;
      }

      setUploading(true);
      setFileProgress(Object.fromEntries(snapshot.map((f) => [f.id, 0])));

      const entries = Object.entries(data.uploadUrls);
      await Promise.all(
        entries.map(([fileId, info], idx) => {
          const { id: clientId, file } = snapshot[idx];
          return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrsRef.current[clientId] = xhr;
            xhr.open("PUT", info.uploadUrl, true);
            xhr.setRequestHeader(
              "Content-Type",
              file.type || "application/octet-stream"
            );
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                setFileProgress((prev) => ({ ...prev, [clientId]: ev.loaded }));
              }
            };
            xhr.onload = async () => {
              delete xhrsRef.current[clientId];
              if (xhr.status >= 200 && xhr.status < 300) {
                setFileProgress((prev) => ({ ...prev, [clientId]: file.size }));
                try {
                  await axios.post(`${BASE_URL}/api/confirm/${fileId}`);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              } else {
                reject(new Error(`Upload failed (${xhr.status})`));
              }
            };
            xhr.onerror = () => {
              delete xhrsRef.current[clientId];
              reject(new Error("Network error during upload"));
            };
            xhr.onabort = () => {
              delete xhrsRef.current[clientId];
              resolve();
            };
            xhr.send(file);
          });
        })
      );

      setIsUploaded(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error uploading:", err);
      setError(`Failed to upload. Reason: ${message}`);
      setFileProgress({});
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest("form");
      form?.requestSubmit();
    }
  };

  if (isUploaded) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Upload complete</h1>
        <div style={styles.container}>
          <div style={styles.successBadge}>✓</div>
          <p style={styles.subtitle}>
            On any other device, visit:
          </p>
          <a
            href={`https://away.moe/${uniqueId}`}
            rel="noopener noreferrer"
            style={styles.link}
            className="mono"
          >
            away.moe/{uniqueId}
          </a>
          {uniqueId && (
            <div style={styles.qrWrap}>
              <p style={styles.qrLabel}>Or scan the QR code</p>
              <canvas
                ref={qrCanvasRef}
                style={{
                  width: "200px",
                  height: "200px",
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.color.border}`,
                  padding: "8px",
                  background: "white",
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {pendingPromptOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={{ margin: 0, marginBottom: "8px" }}>Upload in progress</h2>
            <p style={{ color: theme.color.muted, margin: 0 }}>
              Another upload is already in progress for this ID. If you continue,
              your upload will replace the pending one.
            </p>
            <div style={styles.modalButtons}>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={() => navigate("/")}
              >
                Cancel
              </button>
              <button
                type="button"
                style={styles.button}
                onClick={() => setPendingPromptOpen(false)}
              >
                Continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 style={styles.title}>
        away<span style={styles.titleAccent}>.moe</span>
      </h1>
      <div style={styles.container}>
        <p style={styles.subtitle}>
          Uploading to ID:{" "}
          <span className="mono" style={styles.idChip}>{uniqueId}</span>
        </p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGroup}>
            <label style={styles.fieldLabel}>Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                ...styles.input,
                minHeight: "100px",
                resize: "vertical",
                backgroundColor: theme.color.surfaceAlt,
              }}
              placeholder="Optional Message"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.fieldLabel}>Expiration</label>
            <select
              value={ttl}
              onChange={(e) => setTtl(e.target.value as UploadRequest["ttl"])}
              style={{ ...styles.input, backgroundColor: theme.color.surfaceAlt }}
              required
            >
              <option value="-1">
                Delete on first view / download (or 1 week)
              </option>
              <option value="10m">10 minutes</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
              <option value="3d">3 days</option>
              <option value="1w">1 week</option>
            </select>
          </div>
          <div
            style={{
              ...styles.dropZone,
              ...(dragging ? styles.dropZoneActive : {}),
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            <label htmlFor="fileInput" style={styles.dropLabel}>
              <span style={styles.dropLabelMain}>
                Drag &amp; drop, paste, or click to select files
              </span>
              <span style={styles.dropLabelHint}>
                Max 5 GB per file, up to {MAX_FILES} files
              </span>
            </label>
            <input
              id="fileInput"
              type="file"
              multiple
              onChange={handleFileSelect}
              style={styles.fileInput}
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          {files.length > 0 && (
            <ul style={styles.fileList}>
              {files.map(({ id, file: f }) => {
                const loaded = fileProgress[id] ?? 0;
                const showProgress = uploading || (loaded > 0 && loaded < f.size);
                const pct = f.size > 0 ? Math.min(100, (loaded / f.size) * 100) : 0;
                return (
                  <li key={id} style={styles.fileRow}>
                    <div style={styles.fileRowTop}>
                      <span style={styles.fileName}>{f.name}</span>
                      <span style={styles.fileSize}>
                        {showProgress
                          ? `${formatBytes(loaded)} / ${formatBytes(f.size)}`
                          : formatBytes(f.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFile(id)}
                        style={styles.removeButton}
                        aria-label={`Remove ${f.name}`}
                      >
                        ×
                      </button>
                    </div>
                    {showProgress && (
                      <div style={styles.progressBar}>
                        <div style={{ ...styles.progress, width: `${pct}%` }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <button type="submit" style={styles.button} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "64px 16px 32px",
  },
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    width: "100%",
    maxWidth: "560px",
    padding: "32px",
    backgroundColor: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
  },
  title: {
    fontSize: "3.2em",
    fontWeight: 700,
    margin: 0,
    marginBottom: "24px",
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  titleAccent: {
    color: theme.color.primary,
  },
  subtitle: {
    color: theme.color.muted,
    margin: 0,
    marginBottom: "24px",
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
  form: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    width: "100%",
    gap: "16px",
  },
  formGroup: {
    width: "100%",
    textAlign: "left",
  },
  fieldLabel: {
    display: "block",
    fontSize: "0.85em",
    color: "#4b5563",
    fontWeight: 500,
    marginBottom: "6px",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    boxSizing: "border-box",
  },
  dropZone: {
    width: "100%",
    padding: "24px",
    border: `1.5px dashed ${theme.color.borderStrong}`,
    borderRadius: theme.radius.md,
    textAlign: "center",
    backgroundColor: theme.color.surfaceAlt,
    cursor: "pointer",
    position: "relative",
    boxSizing: "border-box",
    transition: "background-color 0.15s ease, border-color 0.15s ease",
  },
  dropZoneActive: {
    backgroundColor: "rgba(99, 102, 241, 0.06)",
    borderColor: theme.color.primary,
  },
  dropLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    cursor: "pointer",
    textAlign: "center",
  },
  dropLabelMain: {
    color: theme.color.text,
    fontWeight: 500,
  },
  dropLabelHint: {
    color: theme.color.muted,
    fontSize: "0.85em",
  },
  fileInput: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0,
    zIndex: 1,
    cursor: "pointer",
  },
  fileList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
    width: "100%",
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fileRow: {
    display: "flex",
    flexDirection: "column",
    padding: "8px 12px",
    backgroundColor: theme.color.surfaceAlt,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    gap: "6px",
  },
  fileRowTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  fileName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "0.9em",
  },
  fileSize: {
    color: theme.color.muted,
    fontSize: "0.85em",
    fontVariantNumeric: "tabular-nums",
  },
  removeButton: {
    background: "transparent",
    border: "none",
    color: theme.color.muted,
    fontSize: "1.3em",
    cursor: "pointer",
    padding: "0 6px",
    lineHeight: 1,
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
    backgroundColor: theme.color.primary,
    transition: "width 0.2s ease",
  },
  button: {
    padding: "11px 22px",
    border: "none",
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.primary,
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: theme.shadow.button,
  },
  buttonSecondary: {
    padding: "11px 22px",
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.color.surface,
    color: theme.color.text,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    color: theme.color.danger,
    margin: 0,
    fontSize: "0.9em",
    textAlign: "left",
  },
  link: {
    color: theme.color.primary,
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "1.1em",
    padding: "10px 16px",
    backgroundColor: theme.color.surfaceAlt,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    marginTop: "8px",
  },
  successBadge: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    color: theme.color.success,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: 700,
    marginBottom: "16px",
  },
  qrWrap: {
    marginTop: "24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  qrLabel: {
    margin: 0,
    color: theme.color.muted,
    fontSize: "0.9em",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 15, 20, 0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    padding: "16px",
  },
  modal: {
    backgroundColor: theme.color.surface,
    padding: "24px",
    borderRadius: theme.radius.lg,
    maxWidth: "400px",
    width: "100%",
    textAlign: "center",
    border: `1px solid ${theme.color.border}`,
    boxShadow: theme.shadow.card,
  },
  modalButtons: {
    display: "flex",
    justifyContent: "center",
    gap: "10px",
    marginTop: "20px",
  },
};

export default UploadForm;
