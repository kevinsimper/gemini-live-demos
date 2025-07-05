import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({});
const model = "gemini-live-2.5-flash-preview";

// Simple function definitions
const turn_on_the_lights = { name: "turn_on_the_lights" }; // , description: '...', parameters: { ... }
const turn_off_the_lights = { name: "turn_off_the_lights" };

const tools = [
  { functionDeclarations: [turn_on_the_lights, turn_off_the_lights] },
];

const config = {
  responseModalities: [Modality.TEXT],
  tools: tools,
};

async function live() {
  const responseQueue = [];

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return message;
  }

  async function handleTurn() {
    const turns = [];
    let done = false;
    while (!done) {
      const message = await waitMessage();
      turns.push(message);
      if (message.serverContent && message.serverContent.turnComplete) {
        done = true;
      } else if (message.toolCall) {
        done = true;
      }
    }
    return turns;
  }

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.debug("Opened");
      },
      onmessage: function (message) {
        console.log("Message:", JSON.stringify(message), "\n");
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.debug("Error:", e.message);
      },
      onclose: function (e) {
        console.debug("Close:", e.reason);
      },
    },
    config: config,
  });

  const inputTurns = "Turn on the lights please";
  session.sendClientContent({ turns: inputTurns });

  let turns = await handleTurn();

  for (const turn of turns) {
    if (
      turn.serverContent &&
      turn.serverContent.modelTurn &&
      turn.serverContent.modelTurn.parts
    ) {
      for (const part of turn.serverContent.modelTurn.parts) {
        if (part.text) {
          console.debug("Received text: %s\n", part.text);
        }
      }
    } else if (turn.toolCall) {
      const functionResponses = [];
      for (const fc of turn.toolCall.functionCalls) {
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: "ok" }, // simple, hard-coded function response
        });
      }

      console.debug("Sending tool response...\n");
      session.sendToolResponse({ functionResponses: functionResponses });
    }
  }

  // Check again for new messages
  turns = await handleTurn();

  for (const turn of turns) {
    if (
      turn.serverContent &&
      turn.serverContent.modelTurn &&
      turn.serverContent.modelTurn.parts
    ) {
      for (const part of turn.serverContent.modelTurn.parts) {
        if (part.text) {
          console.debug("Received text: %s\n", part.text);
        }
      }
    }
  }

  session.close();
}

async function main() {
  await live().catch((e) => console.error("got error", e));
}

main();
