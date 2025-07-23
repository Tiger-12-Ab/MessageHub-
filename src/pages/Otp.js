import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../utils/api";

export default function Otp() {
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();
  const email = localStorage.getItem("tempEmail");

  const handleVerify = async (e) => {
    e.preventDefault();
    try {
      const res = await API.post("/auth/verify-otp", { email, otp });
      if (res.data.success) {
        localStorage.setItem("token", res.data.token);
        navigate("/chat");
      }
    } catch {
      setMsg("Invalid or expired OTP");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-black px-4">
      <form
        onSubmit={handleVerify}
        className="bg-[#111] p-6 md:p-8 rounded-xl shadow-md w-full max-w-md space-y-5"
      >
        <h2 className="text-2xl font-bold text-red-500 text-center">
          Enter OTP
        </h2>
        <input
          type="text"
          placeholder="6-digit OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
          className="w-full border border-red-500 bg-black text-white p-3 rounded outline-none focus:ring-2 focus:ring-red-500"
        />
        <button
          type="submit"
          className="bg-red-600 hover:bg-red-700 text-white p-3 w-full rounded font-semibold transition"
        >
          Verify OTP
        </button>
        <p className="text-sm text-red-400 text-center">{msg}</p>
      </form>
    </div>
  );
}
