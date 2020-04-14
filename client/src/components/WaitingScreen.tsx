import React, { useState } from "react";
import { ClientWaitingState, ErrorResponse } from "../../../sharedTypes";
import { SocketRef } from "../App";
import { Flex, Text, Button, List, ListItem } from "@chakra-ui/core";

interface Props {
  state: ClientWaitingState;
  socketRef: SocketRef;
}

export default function WaitingScreen(props: Props) {
  const [error, setError] = useState<string | null>(null);

  const startGame = () => {
    if (!props.state.isHost) return;
    props.socketRef.current?.emit("write", (error: ErrorResponse) => {
      setError(error.message);
    });
  };

  return (
    <Flex
      flexDirection="column"
      paddingLeft={[2, "25%"]}
      paddingRight={[2, "25%"]}
    >
      <Flex flexDirection="column" alignSelf="center" alignItems="center">
        <Text fontSize="md">Room Code</Text>
        <Text fontSize="3xl" marginTop={0} as="h1">
          {props.state.roomCode}
        </Text>
      </Flex>
      {props.state.isHost && (
        <Button onClick={startGame} marginTop={2} marginBottom={2}>
          Start playing
        </Button>
      )}
      {!!error && <Text>Error: {error}</Text>}
      In the room:
      <List paddingLeft={2}>
        {props.state.memberNames.map((name) => (
          <ListItem key={name}>
            {name}
            {props.state.ownName === name && " (you)"}
          </ListItem>
        ))}
      </List>
    </Flex>
  );
}
