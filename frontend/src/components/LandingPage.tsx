import React, { CSSProperties, FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "../theme";

const LandingPage = () => {
  const [uniqueId, setUniqueId] = useState("");
  const navigate = useNavigate();

  const handleCheck = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (uniqueId.trim()) {
      navigate(`/${uniqueId}`);
    }
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.header}>
        away<span style={styles.headerAccent}>.moe</span>
      </h1>
      <div style={styles.container}>
        <p style={styles.tagline}>Share files and text with a unique ID.</p>

        <div style={styles.infoBox}>
          <ol style={styles.list}>
            <li>Upload a file or text to a unique ID.</li>
            <li>Share the ID with anyone — or yourself on another device.</li>
            <li>Content auto-deletes after the expiration you set.</li>
          </ol>
        </div>

        <form onSubmit={handleCheck} style={styles.form}>
          <label style={styles.label}>Enter a unique ID</label>
          <div style={styles.inputRow}>
            <input
              type="text"
              value={uniqueId}
              onChange={(e) => setUniqueId(e.target.value)}
              placeholder="e.g. cat-7f3a"
              required
              autoFocus
              style={styles.input}
              className="mono"
            />
            <button type="submit" style={styles.button}>
              Go
            </button>
          </div>
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
    maxWidth: "480px",
    padding: "40px 32px",
    backgroundColor: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
  },
  header: {
    fontSize: "3.2em",
    fontWeight: 700,
    color: theme.color.text,
    margin: 0,
    marginBottom: "24px",
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },
  headerAccent: {
    color: theme.color.primary,
  },
  tagline: {
    fontSize: "1em",
    color: theme.color.muted,
    margin: 0,
    marginBottom: "24px",
  },
  infoBox: {
    textAlign: "left",
    width: "100%",
    marginBottom: "28px",
    padding: "16px 20px",
    backgroundColor: theme.color.surfaceAlt,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
  },
  list: {
    margin: 0,
    paddingLeft: "20px",
    color: theme.color.text,
    fontSize: "0.95em",
    lineHeight: 1.7,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  label: {
    fontSize: "0.85em",
    color: theme.color.muted,
    marginBottom: "8px",
    textAlign: "left",
    fontWeight: 500,
  },
  inputRow: {
    display: "flex",
    gap: "8px",
    width: "100%",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.border}`,
    backgroundColor: theme.color.surface,
    fontSize: "1em",
  },
  button: {
    padding: "10px 22px",
    fontSize: "1em",
    fontWeight: 600,
    backgroundColor: theme.color.primary,
    color: "white",
    border: "none",
    borderRadius: theme.radius.md,
    cursor: "pointer",
    boxShadow: theme.shadow.button,
  },
};

export default LandingPage;
