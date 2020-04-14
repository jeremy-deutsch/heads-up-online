// all the different states a client can see the room as
export type ClientRoomState =
  | ClientWaitingState
  | ClientWritingState
  | ClientHintingState
  | ClientGuessingState;

export interface ClientWaitingState {
  type: "WAITING";
  memberNames: string[];
  ownName: string;
  roomCode: string;
  isHost: boolean;
}

export interface ClientWritingState {
  type: "WRITING";
  members: Array<{ name: string; isWriting: boolean }>;
  ownName: string;
  roomCode: string;
  isHost: boolean;
  myPrompt: string | null;
}

// hinting and guessing both correspond to the backend "GUESSING" state
export interface ClientHintingState {
  type: "HINTING";
  currentPlayer: string;
  prompt: string;
  isHost: boolean;
  roomCode: string;
  isLastPlayer: boolean;
}

export interface ClientGuessingState {
  type: "GUESSING";
  ownName: string;
  isHost: boolean;
  roomCode: string;
  isLastPlayer: boolean;
}

export interface JoinEvent {
  roomCode: string;
  name: string;
}

export interface ErrorResponse {
  type: "ERROR";
  message: string;
}
