import { GoogleGenAI, Modality } from "@google/genai";
import readline from "readline";

const ai = new GoogleGenAI({});
const model = "gemini-live-2.5-flash-preview";

const config = {
  responseModalities: [Modality.TEXT],
  systemInstruction: "You are a helpful assistant. Keep responses concise.",
};

async function createInteractiveSession() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const responseQueue = [];
  let session = null;

  async function waitMessage() {
    let done = false;
    let message = undefined;
    while (!done) {
      message = responseQueue.shift();
      if (message) {
        done = true;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 50));
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
      }
    }
    return turns;
  }

  console.log("Connecting to Gemini Live API...");
  
  session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.log("Connected! Type your message (or 'quit' to exit):\n");
      },
      onmessage: function (message) {
        responseQueue.push(message);
      },
      onerror: function (e) {
        console.error("Error:", e.message);
      },
      onclose: function (e) {
        console.log("Disconnected:", e.reason);
      },
    },
    config: config,
  });

  const askQuestion = () => {
    rl.question("> ", async (input) => {
      if (input.toLowerCase() === "quit") {
        console.log("Goodbye!");
        session.close();
        rl.close();
        return;
      }

      // Send user input
      session.sendClientContent({ turns: input });

      // Wait for and display response
      const turns = await handleTurn();
      
      console.log("\nGemini:");
      for (const turn of turns) {
        if (turn.serverContent?.modelTurn?.parts) {
          for (const part of turn.serverContent.modelTurn.parts) {
            if (part.text) {
              process.stdout.write(part.text);
            }
          }
        }
      }
      console.log("\n");

      // Ask next question
      askQuestion();
    });
  };

  // Start the conversation
  askQuestion();
}

async function main() {
  try {
    await createInteractiveSession();
  } catch (e) {
    console.error("Error:", e);
  }
}

main();