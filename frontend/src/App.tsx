import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import FileDisplay from "./components/FileDisplay";
import LandingPage from "./components/LandingPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:uniqueId" element={<FileDisplay />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
