import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BASE_URL } from "../config";
import { theme } from "../theme";
import UploadForm from "./UploadForm";
import DownloadPage from "./DownloadPage";
import type { FetchInfoResponse } from "../types";

const centerStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

const FileDisplay = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const [data, setData] = useState<FetchInfoResponse | null>(null);

  useEffect(() => {
    if (!uniqueId) return;
    fetch(`${BASE_URL}/api/fetch_info/${uniqueId}`)
      .then(async (res) => {
        const body = await res.json();
        return body as FetchInfoResponse;
      })
      .then((body) => setData(body))
      .catch((err) => alert(err.message));
  }, [uniqueId]);

  if (!uniqueId) return null;
  if (data === null) {
    return (
      <div style={centerStyle}>
        <p style={{ color: theme.color.muted }}>Loading…</p>
      </div>
    );
  }

  if (data.success === false) {
    return (
      <div style={centerStyle}>
        <p style={{ color: theme.color.danger }}>{data.error}</p>
      </div>
    );
  }

  if (data.id_present === false) {
    return <UploadForm uniqueId={uniqueId} hasPending={data.pending_uploads} />;
  }

  return <DownloadPage data={data} />;
};

export default FileDisplay;
