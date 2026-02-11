import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Home } from "./pages/home";
import { CodeApp } from "./pages/code-app";
import { ManusAgent } from "./pages/manus-agent";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/code-app" element={<CodeApp />} />
        <Route path="/manus-agent" element={<ManusAgent />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
