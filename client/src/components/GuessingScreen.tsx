import React, { useState } from "react";
import {
  ClientGuessingState,
  ClientHintingState,
  ErrorResponse,
} from "../../../sharedTypes";
import { SocketRef } from "../App";
import { Flex, Text, Button } from "@chakra-ui/core";

interface Props {
  state: ClientGuessingState | ClientHintingState;
  socketRef: SocketRef;
}

export default function GuessingScreen(props: Props) {
  const [error, setError] = useState<string | null>(null);

  const nextPlayer = () => {
    props.socketRef.current?.emit("next", (error: ErrorResponse) => {
      setError(error.message);
    });
  };

  return (
    <Flex
      flexDirection="column"
      paddingRight={[2, "25%"]}
      paddingLeft={[2, "25%"]}
    >
      <Flex flexDirection="column" alignSelf="center" alignItems="center">
        <Text fontSize="md">Room Code</Text>
        <Text fontSize="3xl" marginTop={0} as="h1">
          {props.state.roomCode}
        </Text>
      </Flex>
      <Flex
        flexDirection="column"
        alignSelf="center"
        alignItems="center"
        paddingTop={2}
      >
        {props.state.type === "GUESSING" ? (
          <Text fontSize="lg">It's your turn, {props.state.ownName}!</Text>
        ) : (
          <>
            <Text fontSize="lg">{props.state.currentPlayer} is</Text>
            <Text fontSize="3xl">{props.state.prompt}</Text>
          </>
        )}
      </Flex>
      {props.state.isHost && (
        <Button marginTop={4} onClick={nextPlayer}>
          {props.state.isLastPlayer ? "Back to writing" : "Next"}
        </Button>
      )}
      {!!error && <Text>Error: {error}</Text>}
    </Flex>
  );
}
