import express from "express";
import { createServer } from "http";
import socketio from "socket.io";
import path from "path";
import { ClientRoomState, JoinEvent, ErrorResponse } from "./sharedTypes";

const Express = express();
const server = createServer(Express);
const io = socketio(server);

// Serve static files from the React app
Express.use(express.static(path.join(__dirname, "client/build")));

function error(message: string): ErrorResponse {
  return { type: "ERROR", message };
}

const noNameError = error("You don't have a name. This is probably a bug.");
const noCodeError = error(
  "You don't have a room code. This is probably a bug."
);
const noRoomError = error("You don't have a room. This is probably a bug.");
const notInRoomError = error("You aren't in the room. This is probably a bug.");

// the state of every single room in the app
interface State {
  [roomCode: string]: ServerRoomState;
}

// all the different states a room can be in
type ServerRoomState =
  | ServerWaitingState
  | ServerWritingState
  | ServerGuessingState;

interface ServerWaitingState {
  type: "WAITING";
  // the keys are the member names
  members: Map<string, { id: string; isHost: boolean }>;
}

interface ServerWritingState {
  type: "WRITING";
  members: Map<
    string,
    { id: string; isHost: boolean; submission: string | null }
  >;
}

interface ServerGuessingState {
  type: "GUESSING";
  activePlayer: string;
  upcomingPlayers: string[];
  members: Map<string, { id: string; isHost: boolean; prompt: string | null }>;
}

const appState: State = {};

// use this for GC
const emitTimes: { [roomCode: string]: number } = {};

function getClientRoomState(
  roomState: ServerRoomState,
  memberName: string,
  roomCode: string
): ClientRoomState {
  switch (roomState.type) {
    case "WAITING": {
      const memberNames: string[] = [];
      roomState.members.forEach((_, name) => memberNames.push(name));
      const isHost = !!roomState.members.get(memberName)?.isHost;
      return {
        type: "WAITING",
        memberNames,
        ownName: memberName,
        roomCode,
        isHost,
      };
    }
    case "WRITING": {
      const members: Array<{ name: string; isWriting: boolean }> = [];
      roomState.members.forEach(({ submission }, name) => {
        members.push({ isWriting: !submission, name });
      });
      const isHost = !!roomState.members.get(memberName)?.isHost;
      const myPrompt = roomState.members.get(memberName)?.submission || null;
      return {
        type: "WRITING",
        members,
        ownName: memberName,
        roomCode,
        isHost,
        myPrompt,
      };
    }
    case "GUESSING": {
      const member = roomState.members.get(memberName);
      const isHost = !!member?.isHost;
      const isLastPlayer = !roomState.upcomingPlayers.length;
      if (roomState.activePlayer === memberName) {
        return {
          type: "GUESSING",
          isHost,
          roomCode,
          isLastPlayer,
          ownName: memberName,
        };
      } else {
        return {
          type: "HINTING",
          currentPlayer: roomState.activePlayer,
          prompt:
            roomState.members.get(roomState.activePlayer)?.prompt ||
            "No prompt???",
          isHost,
          roomCode,
          isLastPlayer,
        };
      }
    }
  }
}

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
function createRoom(name: string, id: string) {
  let roomCode: string;
  do {
    roomCode = "";
    for (let i = 0; i < 3; i++) {
      roomCode += letters[Math.floor(Math.random() * letters.length)];
    }
  } while (appState[roomCode]);

  appState[roomCode] = {
    type: "WAITING",
    members: new Map([[name, { id, isHost: true }]]),
  };
  return roomCode;
}

function joinRoom(roomCode: string, name: string, id: string) {
  const roomState = appState[roomCode];
  if (!roomState) return error("No room exists with that code!");
  const wasHost = !!roomState.members.get(name)?.isHost;
  if (roomState.type === "WAITING") {
    roomState.members.set(name, { id, isHost: wasHost });
  } else if (roomState.type === "WRITING") {
    const submission = roomState.members.get(name)?.submission || null;
    roomState.members.set(name, { id, isHost: wasHost, submission });
  } else if (roomState.type === "GUESSING") {
    const prompt = roomState.members.get(name)?.prompt || null;
    roomState.members.set(name, { id, isHost: wasHost, prompt });
  }
}

function startWriting(roomCode: string) {
  const roomState = appState[roomCode];
  if (!roomState) return noRoomError;
  const members: ServerWritingState["members"] = new Map();
  if (roomState.type === "WRITING") {
    return error(
      "You can't restart the round while users are writing. What would that even do?"
    );
  } else {
    roomState.members.forEach(({ id, isHost }, name) =>
      members.set(name, { id, isHost, submission: null })
    );
  }
  const newState: ServerWritingState = { type: "WRITING", members };
  appState[roomCode] = newState;
}

function submitPrompt(roomCode: string, name: string, submission: string) {
  const roomState = appState[roomCode];
  if (!roomState) return noRoomError;
  if (roomState.type !== "WRITING") {
    return error("The room isn't taking any submissions right now.");
  }
  const member = roomState.members.get(name);
  if (!member) return notInRoomError;
  if (member.submission) {
    return error("You already submitted a word!");
  }
  member.submission = submission;
}

function startGuessing(roomCode: string) {
  const roomState = appState[roomCode];
  if (!roomState) return noRoomError;
  if (roomState.type === "GUESSING") {
    return error("You can't re-start the round of guessing!");
  } else if (roomState.type === "WAITING") {
    return error("You can't go straight to guessing!");
  }
  const prevMembers = roomState.members;
  const members: ServerGuessingState["members"] = new Map();
  const namesAndPrompts: Array<{ name: string; prompt: string }> = [];
  prevMembers.forEach((member, name) => {
    if (member.submission) {
      namesAndPrompts.push({ name, prompt: member.submission });
    }
  });

  if (namesAndPrompts.length < 2) {
    return error("Need at least 2 submissions.");
  }

  // randomly swap prompts until nobody has the one they submitted
  let iterations = 0;
  while (
    namesAndPrompts.some(
      (member) => member.prompt === prevMembers.get(member.name)?.submission
    )
  ) {
    iterations++;
    if (iterations > 150) {
      return error(
        "Couldn't come up with a combination where nobody gets their own submission."
      );
    }
    const index1 = Math.floor(Math.random() * namesAndPrompts.length);
    const index2 = Math.floor(Math.random() * namesAndPrompts.length);
    [namesAndPrompts[index1].prompt, namesAndPrompts[index2].prompt] = [
      namesAndPrompts[index2].prompt,
      namesAndPrompts[index1].prompt,
    ];
  }
  shuffleArray(namesAndPrompts);
  const nameToPrompts: { [name: string]: string } = {};
  namesAndPrompts.forEach(({ name, prompt }) => {
    nameToPrompts[name] = prompt;
  });
  prevMembers.forEach((member, name) => {
    const prompt = nameToPrompts[name] || null;
    members.set(name, { id: member.id, isHost: member.isHost, prompt });
  });
  const upcomingPlayers = namesAndPrompts.map((n) => n.name);
  const activePlayer = upcomingPlayers.pop();
  if (!activePlayer) return error("Not enough players have submitted.");
  appState[roomCode] = {
    type: "GUESSING",
    members,
    upcomingPlayers,
    activePlayer,
  };
}

function shuffleArray(array: unknown[]) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function nextPlayer(roomCode: string) {
  const roomState = appState[roomCode];
  if (!roomState) return noRoomError;
  if (roomState.type === "WAITING") {
    return error("Room is still waiting to start.");
  } else if (roomState.type === "WRITING") {
    return error("Room is still writing submissions.");
  }
  const upcomingPlayers = roomState.upcomingPlayers;
  if (!upcomingPlayers.length) {
    const members: ServerWritingState["members"] = new Map();
    roomState.members.forEach(({ id, isHost }, name) => {
      members.set(name, { id, isHost, submission: null });
    });
    appState[roomCode] = { type: "WRITING", members };
  } else {
    const nextPlayer = upcomingPlayers[upcomingPlayers.length - 1];
    const member = roomState.members.get(nextPlayer);
    if (!member) return error("The next player to go isn't in this room.");
    if (!member.prompt) return error("The next player to go has no prompt.");
    roomState.activePlayer = roomState.upcomingPlayers.pop() as string;
  }
}

io.on("connection", (socket) => {
  let roomCode: string | null = null;
  let name: string | null = null;

  const emitNewState = () => {
    if (!roomCode || !appState[roomCode]) return;
    const roomState = appState[roomCode];
    roomState.members.forEach(({ id }, name) => {
      if (roomCode) {
        const clientState = getClientRoomState(roomState, name, roomCode);
        io.to(id).emit("state", clientState);
      }
    });
    emitTimes[roomCode] = Date.now();
  };

  socket.on("create", (newName: string) => {
    roomCode = createRoom(newName, socket.id);
    name = newName;
    emitNewState();
  });
  socket.on(
    "join",
    (joinEvent: JoinEvent, errCb: (err: ErrorResponse) => void) => {
      const maybeError = joinRoom(
        joinEvent.roomCode.toUpperCase(),
        joinEvent.name,
        socket.id
      );
      if (maybeError?.type === "ERROR") {
        errCb(maybeError);
      } else {
        // no state should change if joinRoom errors
        roomCode = joinEvent.roomCode.toUpperCase();
        name = joinEvent.name;
        emitNewState();
      }
    }
  );
  socket.on("write", (errCb: (error: ErrorResponse) => void) => {
    if (!name) return errCb(noNameError);
    if (!roomCode) return errCb(noCodeError);
    const roomState = appState[roomCode];
    if (!roomState) return errCb(noRoomError);
    const memberInfo = roomState.members.get(name);
    if (!memberInfo) return errCb(notInRoomError);
    if (!memberInfo.isHost) {
      return errCb(error("You aren't the host of this room."));
    }

    const maybeError = startWriting(roomCode);
    if (maybeError) return errCb(maybeError);
    emitNewState();
  });
  socket.on(
    "submit",
    (submission: string | null, errCb: (error: ErrorResponse) => void) => {
      if (!name) return errCb(noNameError);
      if (!roomCode) return errCb(noCodeError);
      if (!submission) return errCb(error("Sent an empty submission."));
      const maybeError = submitPrompt(roomCode, name, submission);
      if (maybeError) return errCb(maybeError);
      emitNewState();
    }
  );
  socket.on("guess", (errCb: (error: ErrorResponse) => void) => {
    if (!name) return errCb(noNameError);
    if (!roomCode) return errCb(noCodeError);
    const roomState = appState[roomCode];
    if (!roomState) return errCb(noRoomError);
    const memberInfo = roomState.members.get(name);
    if (!memberInfo) return errCb(notInRoomError);
    if (!memberInfo.isHost) {
      return errCb(error("You aren't the host of this room."));
    }

    const maybeError = startGuessing(roomCode);
    if (maybeError) return errCb(maybeError);
    emitNewState();
  });
  socket.on("next", (errCb: (error: ErrorResponse) => void) => {
    if (!name) return errCb(noNameError);
    if (!roomCode) return errCb(noCodeError);
    const roomState = appState[roomCode];
    if (!roomState) return errCb(noRoomError);
    const memberInfo = roomState.members.get(name);
    if (!memberInfo) return errCb(notInRoomError);
    if (!memberInfo.isHost) {
      return errCb(error("You aren't the host of this room."));
    }

    const maybeError = nextPlayer(roomCode);
    if (maybeError) return errCb(maybeError);
    emitNewState();
  });
});

// for any room, if its state hasn't been emitted for 3 hours,
// delete it so memory doesn't leak
const oneHour = 1000 /*ms*/ * 60 /*sec*/ * 60; /*min*/
setInterval(function collectGarbage() {
  const now = Date.now();
  for (const roomCode of Object.keys(emitTimes)) {
    if (now - emitTimes[roomCode] > oneHour * 3) {
      delete emitTimes[roomCode];
      delete appState[roomCode];
    }
  }
}, oneHour);

// The "catchall" handler: for any request that doesn't
// match another, send back React's index.html file.
Express.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/client/build/index.html"));
});

const port = process.env.PORT || 3200;

server.listen(port, () => {
  console.log("listening at port 3200!");
});
