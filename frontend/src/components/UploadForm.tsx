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
import type { UploadRequest, UploadResponse } from "../types";

const MAX_FILE_SIZE_MB = 5120;
const MAX_FILES = 50;

type Props = {
  uniqueId: string;
  hasPending: boolean;
};

const UploadForm = ({ uniqueId, hasPending }: Props) => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [ttl, setTtl] = useState<UploadRequest["ttl"]>("-1");
  const [error, setError] = useState("");
  const [isUploaded, setIsUploaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [pendingPromptOpen, setPendingPromptOpen] = useState(hasPending);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const uploading = progress > 0 && !isUploaded;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        addFiles(e.clipboardData.files);
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

  const addFiles = (incoming: FileList) => {
    setFiles((prev) => {
      const next = [...prev];
      let localError = "";

      for (const file of Array.from(incoming)) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          localError = `File "${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB`;
          continue;
        }
        if (next.length >= MAX_FILES) {
          localError = `Cannot upload more than ${MAX_FILES} files`;
          break;
        }
        const dup = next.some(
          (f) => f.name === file.name && f.size === file.size
        );
        if (dup) continue;
        next.push(file);
      }

      setError(localError);
      return next;
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
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
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (files.length === 0 && text === "") {
      alert("Please select a file or enter text before uploading.");
      return;
    }

    setError("");

    const requestBody: UploadRequest = {
      text: text || undefined,
      ttl,
      files: files.map((f) => ({ fileName: f.name, fileType: f.type })),
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

      const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
      const bytesLoaded: Record<string, number> = {};
      const recomputeProgress = () => {
        const sum = Object.values(bytesLoaded).reduce((a, b) => a + b, 0);
        setProgress(Math.min(100, Math.round((sum / totalBytes) * 100)));
      };

      // Initialize so progress bar shows immediately
      setProgress(1);

      const entries = Object.entries(data.uploadUrls);
      await Promise.all(
        entries.map(([fileId, info], idx) => {
          const file = files[idx];
          bytesLoaded[fileId] = 0;
          return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", info.uploadUrl, true);
            xhr.setRequestHeader(
              "Content-Type",
              file.type || "application/octet-stream"
            );
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                bytesLoaded[fileId] = ev.loaded;
                recomputeProgress();
              }
            };
            xhr.onload = async () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                bytesLoaded[fileId] = file.size;
                recomputeProgress();
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
            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.send(file);
          });
        })
      );

      setProgress(100);
      setIsUploaded(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Error uploading:", err);
      setError(`Failed to upload. Reason: ${message}`);
      setProgress(0);
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
      <div style={styles.container}>
        <h1>Upload Successful!</h1>
        <p>
          Your upload was successful. On any other computer or smartphone, visit:
        </p>
        <h2>
          <a
            href={`https://away.moe/${uniqueId}`}
            rel="noopener noreferrer"
            style={styles.link}
          >
            away.moe/{uniqueId}
          </a>
        </h2>
        <p>Thank you for using away.moe!</p>
        {uniqueId && (
          <div className="qr-code-container">
            <h3>Scan QR Code to Share</h3>
            <canvas
              ref={qrCanvasRef}
              style={{
                width: "256px",
                height: "256px",
                margin: "10px",
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {pendingPromptOpen && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Upload in progress</h2>
            <p>
              Another upload is already in progress for this ID. If you continue,
              your upload will replace the pending one.
            </p>
            <div style={styles.modalButtons}>
              <button
                type="button"
                style={styles.button}
                onClick={() => setPendingPromptOpen(false)}
              >
                Continue anyway
              </button>
              <button
                type="button"
                style={{ ...styles.button, backgroundColor: "#666" }}
                onClick={() => navigate("/")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <h1>away.moe</h1>
      <p>
        Upload stuff for ID: <strong>{uniqueId}</strong>
      </p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label>Text:</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ ...styles.input, minHeight: "100px", resize: "vertical" }}
            placeholder="Enter your text here..."
          />
        </div>
        <div style={styles.formGroup}>
          <label>Expiration:</label>
          <select
            value={ttl}
            onChange={(e) => setTtl(e.target.value as UploadRequest["ttl"])}
            style={styles.input}
            required
          >
            <option value="-1">
              Delete Upon Viewing / Downloading (or 1 week)
            </option>
            <option value="1m">1 Minute</option>
            <option value="10m">10 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="1d">1 Day</option>
            <option value="3d">3 Days</option>
            <option value="1w">1 Week</option>
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
          <label htmlFor="fileInput" style={styles.label}>
            Drag &amp; Drop, paste or click to select files
            (Max 5 GB per file, up to {MAX_FILES} files)
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
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`} style={styles.fileRow}>
                <span style={styles.fileName}>{f.name}</span>
                <span style={styles.fileSize}>
                  {(f.size / (1024 * 1024)).toFixed(2)} MB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={styles.removeButton}
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        {progress > 0 && (
          <div style={styles.progressBar}>
            <div style={{ ...styles.progress, width: `${progress}%` }}>
              {progress}%
            </div>
          </div>
        )}

        <button type="submit" style={styles.button} disabled={uploading}>
          Upload
        </button>
      </form>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    maxWidth: "500px",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    backgroundColor: "#f9f9f9",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  formGroup: {
    marginBottom: "15px",
    width: "100%",
  },
  input: {
    width: "100%",
    padding: "8px",
    margin: "5px 0",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  dropZone: {
    width: "100%",
    padding: "20px",
    border: "2px dashed #ccc",
    borderRadius: "8px",
    textAlign: "center",
    backgroundColor: "#fefefe",
    cursor: "pointer",
    position: "relative",
    boxSizing: "border-box",
  },
  dropZoneActive: {
    backgroundColor: "#e0f7fa",
    borderColor: "#00796b",
  },
  label: {
    display: "block",
    cursor: "pointer",
    textAlign: "center",
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
    margin: "10px 0",
    width: "100%",
    textAlign: "left",
  },
  fileRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    backgroundColor: "#fff",
    border: "1px solid #eee",
    borderRadius: "4px",
    marginBottom: "4px",
    gap: "8px",
  },
  fileName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileSize: {
    color: "#666",
    fontSize: "0.9em",
  },
  removeButton: {
    background: "transparent",
    border: "none",
    color: "#c00",
    fontSize: "1.2em",
    cursor: "pointer",
    padding: "0 6px",
  },
  progressBar: {
    width: "100%",
    maxWidth: "400px",
    height: "20px",
    backgroundColor: "#e0e0e0",
    borderRadius: "10px",
    margin: "20px auto",
    overflow: "hidden",
    border: "1px solid #ccc",
  },
  progress: {
    height: "100%",
    backgroundColor: "#007BFF",
    color: "white",
    fontSize: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px 0 0 10px",
    transition: "width 0.3s ease",
  },
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "#007BFF",
    color: "white",
    cursor: "pointer",
  },
  error: {
    color: "red",
    marginTop: "10px",
    fontSize: "14px",
  },
  link: {
    color: "#007BFF",
    textDecoration: "none",
    fontWeight: "bold",
    transition: "color 0.3s",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  modal: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "8px",
    maxWidth: "400px",
    width: "90%",
    textAlign: "center",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  },
  modalButtons: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
    marginTop: "16px",
  },
};

export default UploadForm;
