import React, { useState } from "react";
import { ClientWritingState, ErrorResponse } from "../../../sharedTypes";
import { SocketRef } from "../App";
import { Flex, Text, Input, Button } from "@chakra-ui/core";

interface Props {
  socketRef: SocketRef;
  state: ClientWritingState;
}

export default function WritingScreen(props: Props) {
  const [submission, setSubmission] = useState("");

  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    props.socketRef.current?.emit(
      "submit",
      submission,
      (error: ErrorResponse) => {
        setError(error.message);
      }
    );
  };

  const [areYouSureText, setAreYouSureText] = useState<string | null>(null);

  const startGuessing = () => {
    const memberStillWriting = props.state.members.find(
      (member) => member.isWriting
    );
    if (!areYouSureText && memberStillWriting) {
      setAreYouSureText(
        `Are you sure you want to start? ${memberStillWriting.name} is still writing.`
      );
    } else {
      props.socketRef.current?.emit("guess", (error: ErrorResponse) => {
        setError(error.message);
      });
    }
  };

  return (
    <Flex
      flexDirection="column"
      paddingRight={[2, "25%"]}
      paddingLeft={[2, "25%"]}
    >
      {!!error && <Text>Error: {error}</Text>}
      <Flex flexDirection="column" alignSelf="center" alignItems="center">
        <Text fontSize="md">Room Code</Text>
        <Text fontSize="3xl" marginTop={0} as="h1">
          {props.state.roomCode}
        </Text>
      </Flex>
      {props.state.myPrompt ? (
        <>
          <Text>You submitted:</Text>
          <Text fontSize="2xl">{props.state.myPrompt}</Text>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Flex flexDirection="column">
            <Input
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSubmission(e.target.value)
              }
              marginTop={2}
            />
            <Button type="submit" isDisabled={!submission} marginTop={2}>
              Submit
            </Button>
          </Flex>
        </form>
      )}
      {props.state.members.map(({ name, isWriting }) => (
        <Flex
          key={name}
          borderWidth={1}
          borderRadius={3}
          paddingRight={2}
          paddingLeft={3}
          paddingTop={1}
          paddingBottom={1}
          marginTop={2}
          flexDirection="column"
          backgroundColor={isWriting ? "#fefcbf" : "#f0fff4"}
        >
          <Text fontSize="xl">
            {name}
            {props.state.ownName === name && " (you)"}
          </Text>
          <Text fontSize="sm">{isWriting ? "Writing..." : "Done!"}</Text>
        </Flex>
      ))}
      {areYouSureText && <Text>{areYouSureText}</Text>}
      {props.state.isHost && (
        <Button onClick={startGuessing} marginTop={2}>
          Start guessing
        </Button>
      )}
    </Flex>
  );
}
