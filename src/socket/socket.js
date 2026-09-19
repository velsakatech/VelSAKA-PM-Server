import { io } from "socket.io-client";

const socket = io(
  "http://localhost:5000",
  {
    autoConnect: true,
    withCredentials: true,
  }
);

socket.on("connect", () => {
  console.log(
    "SOCKET CONNECTED:",
    socket.id
  );
});

socket.on("disconnect", (reason) => {
  console.log(
    "SOCKET DISCONNECTED:",
    reason
  );
});

socket.on("connect_error", (error) => {
  console.error(
    "SOCKET CONNECTION ERROR:",
    error.message
  );
});

export default socket;