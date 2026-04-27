# away.moe

**away.moe** is a simple web application that lets you upload files and text and share them using unique IDs. Files are accessible for a limited time based on expiration settings, ensuring secure and temporary sharing.

## Features

- **Upload Files or Text**: Upload any file or text to a unique ID.
- **Share via Unique ID**: Share the unique ID to allow others to access the uploaded content.
- **Temporary Access**: Content expires based on user-defined settings (e.g., 1 minute, 1 day, or after viewing).
- **Drag-and-Drop Upload**: Drag and drop your files directly into the upload box.

---

## How to Use

### 1. Upload Content
- Enter the unique ID of your choice or let the system generate one for you.
- Add text, select a file to upload, and specify an expiration time (e.g., delete after 1 minute or upon first viewing).
- Drag and drop files directly into the upload area or click to open the file picker.

### 2. Share the Unique ID
- Share the unique ID with others or save it for yourself for later access.

### 3. Access Uploaded Content
- Enter the unique ID on the website to check for uploaded content.
- If the ID contains an image, it will display as a preview. Otherwise, the file can be downloaded.
- Once the expiration time is reached or the file is viewed/downloaded, it is deleted automatically.

---

## Technical Details

### Frontend
- **React**: Built with React for an interactive user experience.
- **Drag-and-Drop File Upload**: Smooth and user-friendly interface for file uploads.
- **Dynamic Progress Bars**: Displays upload and download progress in real-time.

### Backend
- **Flask**: Backend server for handling uploads, downloads, and API requests.
- **SQLite3**: Database storing file and text data

---

## Development

The backend (Flask, API-only) and frontend (React) run as separate processes. In dev, Create React App's `proxy` field forwards `/api/*` requests from `:3000` to the backend on `:5000`.

### Backend (terminal 1)
```bash
cd backend
pip install -r ../requirements.txt
python app.py              # listens on 0.0.0.0:5000
```

### Frontend (terminal 2)
```bash
cd frontend
npm install
npm start                  # opens http://localhost:3000
```

### Production

Build the frontend with `npm run build` and serve the static assets from `frontend/build/` via any static host (nginx, Caddy, etc.). Route `/api/*` to the Flask backend via the same reverse proxy so the frontend's relative URLs resolve correctly. To point at a separate API host instead, build with `REACT_APP_BASE_URL=https://api.example.com npm run build`.

