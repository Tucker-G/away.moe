import React, { CSSProperties, useEffect, useRef } from "react";
import qr from "qr.js";
import { theme } from "../theme";

type Props = {
  uniqueId: string;
};

const UploadSuccess = ({ uniqueId }: Props) => {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!qrCanvasRef.current) return;
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
  }, [uniqueId]);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Upload complete</h1>
      <div style={styles.container}>
        <div style={styles.successBadge}>✓</div>
        <p style={styles.subtitle}>On any other device, visit:</p>
        <a
          href={`https://away.moe/${uniqueId}`}
          rel="noopener noreferrer"
          style={styles.link}
          className="mono"
        >
          away.moe/{uniqueId}
        </a>
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
  subtitle: {
    color: theme.color.muted,
    margin: 0,
    marginBottom: "24px",
    fontSize: "0.95em",
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
};

export default UploadSuccess;
