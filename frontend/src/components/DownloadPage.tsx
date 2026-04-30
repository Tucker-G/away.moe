import React, { CSSProperties, useState } from "react";
import Linkify from "linkify-react";
import { BASE_URL } from "../config";
import type { FetchInfoResponse } from "../types";

type IdPresent = Extract<FetchInfoResponse, { id_present: true }>;

type Props = {
  data: IdPresent;
};

const IMAGE_REGEX = /\.(jpe?g|gif|png|bmp|webp)$/i;

const DownloadPage = ({ data }: Props) => {
  const [progress, setProgress] = useState<Record<string, number>>({});

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

  const linkifyOptions = { defaultProtocol: "https" };
  const fileEntries = data.has_files && data.files ? Object.entries(data.files) : [];

  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>Entry Found</h1>
      {data.text !== null && (
        <div
          style={{
            textAlign: "left",
            maxWidth: "800px",
            margin: "0 auto",
            position: "relative",
          }}
        >
          <strong>Text:</strong>
          <div
            style={{
              whiteSpace: "pre-wrap",
              backgroundColor: "#f5f5f5",
              padding: "15px",
              borderRadius: "4px",
              marginTop: "10px",
            }}
          >
            <Linkify options={linkifyOptions}>{data.text}</Linkify>
            {data.text && (
              <button
                onClick={() => navigator.clipboard.writeText(data.text ?? "")}
                style={{
                  position: "absolute",
                  top: "40px",
                  right: "10px",
                  padding: "5px 10px",
                  fontSize: "12px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Copy
              </button>
            )}
          </div>
        </div>
      )}

      {fileEntries.length > 0 && (
        <div style={{ maxWidth: "800px", margin: "20px auto" }}>
          <h2>Files</h2>
          {fileEntries.map(([fileId, info]) => {
            const isImage = IMAGE_REGEX.test(info.filename);
            const fileProgress = progress[fileId] ?? 0;
            return (
              <div key={fileId} style={styles.fileCard}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Filename:</strong> {info.filename}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Filesize:</strong>{" "}
                  {(info.filesize / (1024 * 1024)).toFixed(2)} MB
                </p>
                {isImage ? (
                  <div>
                    <img
                      src={`${BASE_URL}/api/download/${data.unique_id}/${fileId}`}
                      alt={info.filename}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "500px",
                        marginTop: "10px",
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    {fileProgress > 0 && fileProgress < 100 && (
                      <div
                        style={{
                          marginTop: "10px",
                          width: "100%",
                          backgroundColor: "#ddd",
                          borderRadius: "8px",
                        }}
                      >
                        <div
                          style={{
                            height: "10px",
                            width: `${fileProgress}%`,
                            backgroundColor: "#4caf50",
                            borderRadius: "8px",
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
      )}
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  button: {
    padding: "10px 20px",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "#007BFF",
    color: "white",
    cursor: "pointer",
    marginTop: "10px",
  },
  fileCard: {
    border: "1px solid #eee",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "12px",
    backgroundColor: "#fafafa",
    textAlign: "left",
  },
};

export default DownloadPage;
