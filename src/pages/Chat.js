import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import API from "../utils/api";
import { useAuth } from "../context/AuthContext";
import ContactList from "../components/ContactList";
import { Dialog } from "@headlessui/react";
import { Navigate } from "react-router-dom";
import { HiMenu } from "react-icons/hi";

const socket = io("https://messagehub-backend.onrender.com");

export default function Chat() {
  const { user, loading } = useAuth();
  const [receiverId, setReceiverId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const chatEndRef = useRef(null);
  const [isCalling, setIsCalling] = useState(false);
  const [inCall, setInCall] = useState(false);
  const localStream = useRef(null);
  const peerConnection = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fetchedInitialMessages = useRef(false);
  const messageIds = useRef(new Set());

  const iceConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    if (user?._id) {
      socket.emit("join", user._id);
    }
  }, [user]);

  useEffect(() => {
    socket.on("online-users", (users) => setOnlineUsers(users));
    return () => socket.off("online-users");
  }, []);

  useEffect(() => {
    const handleReceiveMessage = (msg) => {
      if (!fetchedInitialMessages.current || messageIds.current.has(msg._id)) return;
      messageIds.current.add(msg._id);
      setMessages((prev) => [...prev, msg]);
    };

    const handleMessageUpdate = (updatedMsg) => {
      setMessages((prev) =>
        prev.map((msg) => (msg._id === updatedMsg._id ? updatedMsg : msg))
      );
    };

    socket.on("receive-message", handleReceiveMessage);
    socket.on("message-updated", handleMessageUpdate);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("message-updated", handleMessageUpdate);
    };
  }, [receiverId]);

  useEffect(() => {
    if (!receiverId) return;
    fetchedInitialMessages.current = false;
    messageIds.current.clear();

    API.get(`/messages/${receiverId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    }).then((res) => {
      setMessages(res.data);
      res.data.forEach((msg) => messageIds.current.add(msg._id));
      fetchedInitialMessages.current = true;
    });
  }, [receiverId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !receiverId) return;
    const res = await API.post(
      "/messages",
      { receiverId, content: text },
      { headers: { Authorization: `Bearer ${user.token}` } }
    );
    socket.emit("send-message", res.data);
    setText("");
  };

  const handleStartRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const audioChunks = [];

    recorder.ondataavailable = (e) => audioChunks.push(e.data);
    recorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("receiverId", receiverId);
      formData.append("audio", audioBlob);

      try {
        const res = await API.post("/messages/audio", formData, {
          headers: {
            Authorization: `Bearer ${user.token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        socket.emit("send-message", res.data);
      } catch (err) {
        console.error("Audio send failed", err);
      }
    };

    recorder.start();
    setRecording(true);
    setMediaRecorder(recorder);
  };

  const handleStopRecording = () => {
    mediaRecorder.stop();
    setRecording(false);
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !receiverId) return;

    const formData = new FormData();
    formData.append("receiverId", receiverId);
    formData.append("media", file);

    try {
      const res = await API.post("/messages/media", formData, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      socket.emit("send-message", res.data);
    } catch (err) {
      console.error("Media upload failed", err);
    }
  };

  const startCall = async () => {
    peerConnection.current = new RTCPeerConnection(iceConfig);
    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream.current);
    });

    peerConnection.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", {
          to: receiverId,
          candidate: e.candidate,
        });
      }
    };

    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("call-user", { to: receiverId, offer });
    setIsCalling(true);
  };

  const endCall = () => {
    peerConnection.current?.close();
    localStream.current?.getTracks().forEach((track) => track.stop());
    socket.emit("end-call", { to: receiverId });
    setIsCalling(false);
    setInCall(false);
  };

  useEffect(() => {
    socket.on("call-made", ({ from, offer }) => {
      setIncomingCall({ from, offer });
    });

    socket.on("answer-made", async ({ answer }) => {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      setInCall(true);
    });

    socket.on("ice-candidate", ({ candidate }) => {
      peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on("call-ended", () => {
      endCall();
    });

    return () => {
      socket.off("call-made");
      socket.off("answer-made");
      socket.off("ice-candidate");
      socket.off("call-ended");
    };
  }, [receiverId]);

  const acceptCall = async () => {
    const { from, offer } = incomingCall;
    setIncomingCall(null);
    peerConnection.current = new RTCPeerConnection(iceConfig);
    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream.current);
    });

    peerConnection.current.ontrack = (e) => {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.play();
    };

    peerConnection.current.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", {
          to: from,
          candidate: e.candidate,
        });
      }
    };

    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    socket.emit("make-answer", { to: from, answer });
    setReceiverId(from);
    setInCall(true);
  };

  const declineCall = () => setIncomingCall(null);

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/" replace />;

  return (
    <div className="flex flex-col md:flex-row max-w-7xl mx-auto  min-h-screen bg-black text-white  shadow-lg overflow-hidden">
      {/* Sidebar toggle button for small screens */}
      <button
        className="md:hidden mb-2 p-2 bg-red-600 rounded text-white flex items-center gap-1"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open contacts sidebar"
      >
        <HiMenu size={20} />
        Contacts
      </button>

      {/* Sidebar  */}
      <div
        className={`
    fixed md:static inset-y-0 left-0 bg-[#111] w-64 overflow-y-hidden z-50 transform transition-transform duration-300 ease-in-out
    ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
  `}
      >
        {/* Close button on mobile */}
        <button
          className="md:hidden mb-4 p-2 bg-red-700 rounded text-white w-full"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close contacts sidebar"
        >
          Close
        </button>

        {/* Contact List */}
        <ContactList
          receiverId={receiverId}
          setReceiverId={(id) => {
            setReceiverId(id);
            if (window.innerWidth < 768) setSidebarOpen(false);
          }}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-[#121212] rounded-lg shadow-inner overflow-hidden">
        {receiverId ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 p-3">
              {messages.map((msg, i) => (
                <div
            key={msg._id}
            className={`p-3 rounded-lg max-w-[75%] break-words ${
              msg.senderId === user._id
                ? "bg-red-600 text-white ml-auto"
                : "bg-gray-700 text-white"
            }`}
          >
                  {msg.content && <div>{msg.content}</div>}
                  {msg.audioUrl && (
                    <audio
                      controls
                      src={`https://messagehub-backend.onrender.com/${msg.audioUrl}`}
                      className="mt-2 w-full"
                    />
                  )}
                  {msg.mediaUrl && (
                    <img
                      src={`https://messagehub-backend.onrender.com/${msg.mediaUrl}`}
                      alt="media"
                      className="max-w-xs rounded mt-2"
                    />
                  )}
                  <div className="text-xs text-right mt-1 opacity-70">
                    {msg.senderId === user._id &&
                      (msg.seen ? "✓✓ Seen" : msg.delivered ? "✓✓" : "✓")}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 p-3 flex-wrap items-center border-t border-gray-700">
              <input
                type="text"
                className="flex-1 bg-[#222] border border-red-600 px-3 py-2 rounded-lg text-white placeholder-red-400 outline-none focus:ring-2 focus:ring-red-600"
                placeholder="Type a message..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                onClick={sendMessage}
              >
                Send
              </button>

              {recording ? (
                <button
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg"
                  onClick={handleStopRecording}
                >
                  Stop 🎙️
                </button>
              ) : (
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg"
                  onClick={handleStartRecording}
                >
                  Record 🎤
                </button>
              )}

              <input
                type="file"
                accept="image/*"
                onChange={handleMediaUpload}
                className="hidden"
                id="mediaInput"
              />
              <label
                htmlFor="mediaInput"
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg cursor-pointer"
              >
                📎
              </label>

              {!inCall && !isCalling && (
                <button
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-2 rounded-lg"
                  onClick={startCall}
                >
                  📞 Call
                </button>
              )}

              {isCalling && !inCall && (
                <div className="text-yellow-400 font-semibold">Calling...</div>
              )}

              {inCall && (
                <button
                  className="bg-red-700 hover:bg-red-800 text-white px-3 py-2 rounded-lg"
                  onClick={endCall}
                >
                  🔴 End Call
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a user to start chatting.
          </div>
        )}
      </div>

      {/* Call Modal */}
      <Dialog
        open={!!incomingCall}
        onClose={declineCall}
        className="fixed z-50 inset-0 overflow-y-auto"
      >
        <div className="flex items-center justify-center min-h-screen bg-black bg-opacity-50">
          <Dialog.Panel className="bg-[#111] p-6 rounded-lg shadow-xl space-y-4 text-white">
            <Dialog.Title className="text-lg font-semibold text-red-500">
              Incoming Call
            </Dialog.Title>
            <p>{incomingCall?.from} is calling you</p>
            <div className="flex gap-4">
              <button
                onClick={acceptCall}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Accept
              </button>
              <button
                onClick={declineCall}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Decline
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
