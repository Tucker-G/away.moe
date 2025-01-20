import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { BASE_URL } from "../config";
import qr from 'qr.js';

const UploadForm = ({ uniqueId, setUploadProgress, uploadProgress }) => {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState("-1");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(""); // Track error messages
  const [isUploaded, setIsUploaded] = useState(false); // Track upload success
  const qrCanvasRef = useRef(null);

  const MAX_FILE_SIZE_MB = 50;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Show prompt if the form is not yet submitted
      if (isUploaded) {
        e.preventDefault();
        e.returnValue = ""; // Modern browsers require this for the confirmation dialog
      }
    };

    // Add the listener
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Add global paste event listener to capture pasted files
    const handlePaste = (e) => {
      const pastedFiles = e.clipboardData.files;
      if (pastedFiles && pastedFiles[0]) {
        const pastedFile = pastedFiles[0];
        if (pastedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          setError(`File size exceeds ${MAX_FILE_SIZE_MB} MB`);
          setFile(null); // Clear the file
        } else {
          setError(""); // Clear any previous error
          setFile(pastedFile);
        }
      }
    };

    document.addEventListener("paste", handlePaste);

    // Cleanup on unmount
    return () => {
      document.removeEventListener("paste", handlePaste);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isUploaded]);

  // Add this useEffect to render the QR code
  useEffect(() => {
    if (uniqueId && isUploaded && qrCanvasRef.current) {
      const qrData = qr(`https://away.moe/${uniqueId}`);
      const canvas = qrCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const size = 256;
      const cells = qrData.modules;
      const cellSize = size / cells.length;
      
      canvas.width = size;
      canvas.height = size;
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      
      ctx.fillStyle = 'black';
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

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB} MB`);
      setFile(null); // Clear the file
    } else {
      setError(""); // Clear any previous error
      setFile(selectedFile);
    }
  };

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File size exceeds ${MAX_FILE_SIZE_MB} MB`);
      setFile(null); // Clear the file
    } else {
      setError(""); // Clear any previous error
      setFile(droppedFile);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!file && !text) {
      alert("Please select a file or enter text before uploading.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("text", text);
    formData.append("ttl", date);

    axios
      .post(`${BASE_URL}/api/upload/${uniqueId}`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      })
      .then(() => {
        setUploadProgress(0); // Reset progress
        setIsUploaded(true); // Set to true after successful upload

      })
      .catch((error) => {
        console.error("Error uploading file:", error);
        alert("Failed to upload the file. Reason: " + error.message);
        setUploadProgress(0); // Reset progress
      });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
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
                width: '256px', 
                height: '256px',
                margin: '10px'
              }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={styles.container}>
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
            value={date}
            onChange={(e) => setDate(e.target.value)}
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
          tabIndex={0} // Ensure the drop zone is focusable for keyboard interactions
        >
          <label htmlFor="fileInput" style={styles.label}>
            Drag & Drop, paste or click to select a file
            (Max 50 MB)
          </label>
          <input
            id="fileInput"
            type="file"
            onChange={handleFileSelect}
            style={styles.fileInput}
          />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {file && !error && (
          <>
            <p style={{ marginBottom: "4px" }}>Selected File: {file.name}</p>
            <p style={{ marginTop: "0px" }}>
              File Size: {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </>
        )}

        {uploadProgress > 0 && (
          <div style={styles.progressBar}>
            <div style={{ ...styles.progress, width: `${uploadProgress}%` }}>
              {uploadProgress}%
            </div>
          </div>
        )}

        <button
          type="submit"
          style={styles.button}
          disabled={error} // Disable button if no valid file or error
        >
          Upload
        </button>
      </form>
    </div>
  );
};

const styles = {
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
  },
  dropZone: {
    width: "100%",
    padding: "20px",
    border: "2px dashed #ccc",
    borderRadius: "8px",
    textAlign: "center",
    backgroundColor: "#fefefe",
    cursor: "pointer",
    position: "relative", // Required for absolute positioning of the file input
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
    position: "absolute", // Ensure the file input covers the entire drop zone
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0, // Hide the file input visually but keep it functional
    zIndex: 1, // Ensure it sits above other content
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
    color: "#007BFF", // Set the color of the link
    textDecoration: "none", // Remove underline
    fontWeight: "bold", // Make the text bold (optional)
    transition: "color 0.3s", // Smooth color transition when hovering
  },
  '.qr-code-container': {
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  '.qr-code-container h3': {
    marginBottom: '15px',
    color: '#333',
  }
};

export default UploadForm;
