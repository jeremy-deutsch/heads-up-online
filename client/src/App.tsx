import React, { useRef, useEffect, useState } from "react";
import socketio from "socket.io-client";
import { ClientRoomState } from "../../sharedTypes";
import InitialScreen from "./components/InitialScreen";
import WaitingScreen from "./components/WaitingScreen";
import WritingScreen from "./components/WritingScreen";
import GuessingScreen from "./components/GuessingScreen";

export type SocketRef = React.RefObject<SocketIOClient.Socket | null>;

function App() {
  const [gameState, setGameState] = useState<ClientRoomState | null>(null);

  const socketRef = useRef<SocketIOClient.Socket | null>(null);
  useEffect(() => {
    socketRef.current = socketio("/");
    socketRef.current.on("state", setGameState);
    return () => {
      socketRef.current?.close();
    };
  }, []);

  switch (gameState?.type) {
    case undefined: {
      return <InitialScreen socketRef={socketRef} />;
    }
    case "WAITING": {
      return <WaitingScreen socketRef={socketRef} state={gameState} />;
    }
    case "WRITING": {
      return <WritingScreen socketRef={socketRef} state={gameState} />;
    }
    case "GUESSING":
    case "HINTING": {
      return <GuessingScreen socketRef={socketRef} state={gameState} />;
    }
  }
}

export default App;
