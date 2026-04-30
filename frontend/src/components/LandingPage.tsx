import React, { CSSProperties, FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div style={styles.container}>
      <h1 style={styles.header}>away.moe</h1>
      <p style={styles.description}>
        away.moe allows you to upload files and share them with others using a unique ID. Files can be accessed for a limited time based on their expiration settings. You can also check the status of previously uploaded files using their unique ID.
      </p>

      <div style={styles.infoBox}>
        <h2>How to Use:</h2>
        <ol style={styles.list}>
          <li>Upload a file or text to a Unique ID.</li>
          <li>Share the ID with others (or yourself on another computer) to allow them to access the content.</li>
          <li>The content will be deleted after the specified time, making it unavailable to others.</li>
        </ol>
      </div>

      <p style={styles.explanation}>
        Enter a unique ID below
      </p>

      <form onSubmit={handleCheck} style={styles.form}>
        <input
          type="text"
          value={uniqueId}
          onChange={(e) => setUniqueId(e.target.value)}
          placeholder="Enter unique ID"
          required
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Check</button>
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
    maxWidth: "600px",
    margin: "auto",
    padding: "20px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
  },
  header: {
    fontSize: "2.5em",
    color: "#007BFF",
    marginBottom: "15px",
  },
  description: {
    fontSize: "1.2em",
    marginBottom: "20px",
    color: "#333",
  },
  infoBox: {
    textAlign: "left",
    marginBottom: "20px",
    padding: "10px",
    backgroundColor: "#e0f7fa",
    borderRadius: "8px",
    width: "100%",
  },
  list: {
    margin: "10px 0",
    paddingLeft: "20px",
    fontSize: "1.1em",
  },
  explanation: {
    fontSize: "1.1em",
    margin: "20px 0",
    color: "#555",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
  },
  input: {
    padding: "10px",
    width: "80%",
    maxWidth: "400px",
    borderRadius: "5px",
    border: "1px solid #ddd",
    marginBottom: "10px",
    fontSize: "1em",
  },
  button: {
    padding: "10px 20px",
    fontSize: "1.1em",
    backgroundColor: "#007BFF",
    color: "white",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s",
  },
};

export default LandingPage;
