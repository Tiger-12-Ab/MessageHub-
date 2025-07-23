import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../utils/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg("");
    try {
      const res = await API.post("/auth/send-otp", { email });
      if (res.data.success) {
        setMsg("OTP sent to your email");
        localStorage.setItem("tempEmail", email);
        navigate("/otp");
      }
    } catch (err) {
      setMsg("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[#111] p-6 md:p-8 rounded-xl shadow-md w-full max-w-md space-y-5"
      >
        <h2 className="text-2xl font-bold text-red-500 text-center">
          Login / Register
        </h2>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          className="w-full border border-red-500 bg-black text-white p-3 rounded outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          type="submit"
          disabled={loading}
          className={`bg-red-600 hover:bg-red-700 text-white p-3 w-full rounded font-semibold transition ${
            loading ? "cursor-not-allowed opacity-70" : ""
          }`}
        >
          {loading ? "Sending…" : "Send OTP"}
        </button>
        <p className="text-sm text-red-400 text-center">{msg}</p>
      </form>
    </div>
  );
}
