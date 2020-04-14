import React, { useState } from "react";
import {
  Flex,
  Input,
  FormLabel,
  FormControl,
  Button,
  Text,
} from "@chakra-ui/core";
import { SocketRef } from "../App";
import { JoinEvent, ErrorResponse } from "../../../sharedTypes";

interface Props {
  socketRef: SocketRef;
}

export default function InitialScreen(props: Props) {
  const [nameText, setNameText] = useState("");
  const [roomCodeText, setRoomCodeText] = useState("");

  const [error, setError] = useState<string | null>(null);

  const createRoom = () => {
    props.socketRef.current?.emit("create", nameText);
  };

  const joinRoom = () => {
    const joinEvent: JoinEvent = {
      roomCode: roomCodeText,
      name: nameText,
    };
    props.socketRef.current?.emit("join", joinEvent, (err: ErrorResponse) => {
      setError(err.message);
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (roomCodeText) {
          joinRoom();
        } else {
          createRoom();
        }
      }}
    >
      <FormControl>
        <Flex
          flexDirection="column"
          paddingRight={[2, "25%"]}
          paddingLeft={[2, "25%"]}
        >
          <Text fontSize="3xl" alignSelf="center" marginTop={2} as="h1">
            Heads Up!
          </Text>
          <Flex flexDirection="column">
            <FormLabel>Name:</FormLabel>
            <Input
              value={nameText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNameText(e.target.value)
              }
            />
          </Flex>
          <Flex flexDirection="column">
            <FormLabel>Room code:</FormLabel>
            <Input
              value={roomCodeText}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setRoomCodeText(e.target.value)
              }
            />
          </Flex>
          <Button isDisabled={!nameText} onClick={createRoom} marginTop={2}>
            Create new room
          </Button>
          <Button
            isDisabled={!nameText || !roomCodeText}
            onClick={joinRoom}
            marginTop={2}
          >
            Join existing room
          </Button>
          {!!error && <Text>Error: {error}</Text>}
        </Flex>
      </FormControl>
    </form>
  );
}
