import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BASE_URL } from "../config";
import UploadForm from "./UploadForm";
import DownloadPage from "./DownloadPage";
import type { FetchInfoResponse } from "../types";

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
  if (data === null) return <p style={{ textAlign: "center" }}>Loading...</p>;

  if (data.success === false) {
    return <p style={{ textAlign: "center", color: "red" }}>{data.error}</p>;
  }

  if (data.id_present === false) {
    return <UploadForm uniqueId={uniqueId} hasPending={data.pending_uploads} />;
  }

  return <DownloadPage data={data} />;
};

export default FileDisplay;
