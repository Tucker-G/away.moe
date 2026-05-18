import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import FileDisplay from "./components/FileDisplay";
import LandingPage from "./components/LandingPage";
import Nav from "./components/Nav";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/:uniqueId" element={<FileDisplay />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
      <Nav />
    </Router>
  );
}

export default App;
