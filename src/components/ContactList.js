import React, { useEffect, useState } from "react";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";

export default function ContactList({
  receiverId,
  setReceiverId,
  onlineUsers,
}) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.token) return;

    const fetchUsers = async () => {
      try {
        const res = await API.get("/auth/users", {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        setUsers(res.data);
      } catch (err) {
        setError("Failed to load users.");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  if (loading) {
    return (
      <div className="w-full md:w-1/4 border-r border-gray-700 p-4 text-white">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full md:w-1/4 border-r border-gray-700 p-4 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full md:h-auto w-full md:w-64 p-4 bg-black text-white overflow-y-hidden">
      <h2 className="text-lg font-bold mb-4 text-red-500">Contacts</h2>
      <ul className="space-y-2">
        {users
          .filter((u) => u._id !== user._id)
          .map((u) => {
            const isOnline = onlineUsers?.includes(u._id);
            const isSelected = receiverId === u._id;

            return (
              <li
                key={u._id}
                onClick={() => setReceiverId(u._id)}
                className={`p-3 rounded flex items-center justify-between cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "bg-red-700 text-white"
                    : "hover:bg-gray-800 text-gray-200"
                }`}
              >
                <span className="truncate">{u.email}</span>
                {isOnline && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-2"></span>
                )}
              </li>
            );
          })}
      </ul>
    </div>
  );
}
