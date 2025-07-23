import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

//importing pages
import Login from "./pages/Login";
import Otp from "./pages/Otp";
import Chat from "./pages/Chat";

//importing authprovider
import { AuthProvider } from "./context/AuthContext";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/otp" element={<Otp />} />
          <Route path="/chat" element={<Chat />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
