import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Unified single-page dashboard - all journeys accessible from home */}
      </Routes>
    </Router>
  );
}

export default App;
