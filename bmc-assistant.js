import { GoogleGenAI, Modality } from "@google/genai";
import readline from "readline";

const ai = new GoogleGenAI({});
const model = "gemini-live-2.5-flash-preview";

// Business Model Canvas state
const bmc = {
  key_partners: [],
  key_activities: [],
  key_resources: [],
  value_propositions: [],
  customer_relationships: [],
  channels: [],
  customer_segments: [],
  cost_structure: [],
  revenue_streams: [],
};

// Function definitions
const add_customer_segment = {
  name: "add_customer_segment",
  description: "Add a customer segment to the business model canvas",
  parameters: {
    type: "object",
    properties: {
      segment: { type: "string", description: "The customer segment to add" },
    },
    required: ["segment"],
  },
};

const add_value_proposition = {
  name: "add_value_proposition",
  description: "Add a value proposition to the business model canvas",
  parameters: {
    type: "object",
    properties: {
      proposition: {
        type: "string",
        description: "The value proposition to add",
      },
    },
    required: ["proposition"],
  },
};

const add_key_partner = {
  name: "add_key_partner",
  description: "Add a key partner to the business model canvas",
  parameters: {
    type: "object",
    properties: {
      partner: { type: "string", description: "The key partner to add" },
    },
    required: ["partner"],
  },
};

const add_key_activity = {
  name: "add_key_activity",
  description: "Add a key activity to the business model canvas",
  parameters: {
    type: "object",
    properties: {
      activity: { type: "string", description: "The key activity to add" },
    },
    required: ["activity"],
  },
};

const tools = [
  {
    functionDeclarations: [
      add_customer_segment,
      add_value_proposition,
      add_key_partner,
      add_key_activity,
    ],
  },
];

const config = {
  responseModalities: [Modality.TEXT],
  systemInstruction: `You are helping fill out a Business Model Canvas through natural conversation.
  When users mention:
  - Customers/target market -> immediately call add_customer_segment
  - Value/benefits/solutions -> immediately call add_value_proposition
  - Partners/integrations -> immediately call add_key_partner
  - Core activities/tasks -> immediately call add_key_activity
  
  Be conversational and extract information naturally from what they say.`,
  tools: tools,
};

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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

  console.log("Connecting to BMC Assistant...\n");

  const session = await ai.live.connect({
    model: model,
    callbacks: {
      onopen: function () {
        console.log("Connected! Tell me about your business idea.\n");
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

  function showCanvas() {
    console.log("\n=== BUSINESS MODEL CANVAS ===\n");
    console.log(
      "Customer Segments:",
      bmc.customer_segments.join(", ") || "(empty)"
    );
    console.log(
      "Value Propositions:",
      bmc.value_propositions.join(", ") || "(empty)"
    );
    console.log("Key Partners:", bmc.key_partners.join(", ") || "(empty)");
    console.log("Key Activities:", bmc.key_activities.join(", ") || "(empty)");
    console.log("\n");
  }

  function handleFunctionCall(fc) {
    switch (fc.name) {
      case "add_customer_segment":
        if (!bmc.customer_segments.includes(fc.args.segment)) {
          bmc.customer_segments.push(fc.args.segment);
          return { result: `Added "${fc.args.segment}" to Customer Segments` };
        }
        return { result: `"${fc.args.segment}" already in Customer Segments` };

      case "add_value_proposition":
        if (!bmc.value_propositions.includes(fc.args.proposition)) {
          bmc.value_propositions.push(fc.args.proposition);
          return {
            result: `Added "${fc.args.proposition}" to Value Propositions`,
          };
        }
        return {
          result: `"${fc.args.proposition}" already in Value Propositions`,
        };

      case "add_key_partner":
        if (!bmc.key_partners.includes(fc.args.partner)) {
          bmc.key_partners.push(fc.args.partner);
          return { result: `Added "${fc.args.partner}" to Key Partners` };
        }
        return { result: `"${fc.args.partner}" already in Key Partners` };

      case "add_key_activity":
        if (!bmc.key_activities.includes(fc.args.activity)) {
          bmc.key_activities.push(fc.args.activity);
          return { result: `Added "${fc.args.activity}" to Key Activities` };
        }
        return { result: `"${fc.args.activity}" already in Key Activities` };

      default:
        return { result: "Unknown function" };
    }
  }

  const askQuestion = () => {
    rl.question("> ", async (input) => {
      if (input.toLowerCase() === "quit") {
        showCanvas();
        console.log("Goodbye!");
        session.close();
        rl.close();
        return;
      }

      if (input.toLowerCase() === "show") {
        showCanvas();
        askQuestion();
        return;
      }

      // Send user input
      session.sendClientContent({ turns: input });

      // Keep processing until we get a complete turn
      let allFunctionResponses = [];
      let textParts = [];
      let processingComplete = false;

      while (!processingComplete) {
        let turns = await handleTurn();
        
        for (const turn of turns) {
          if (
            turn.serverContent &&
            turn.serverContent.modelTurn &&
            turn.serverContent.modelTurn.parts
          ) {
            for (const part of turn.serverContent.modelTurn.parts) {
              if (part.text) {
                textParts.push(part.text);
              }
            }
          } else if (turn.toolCall) {
            // Debug: Log the tool call details
            console.log(
              `\n[DEBUG] Received toolCall with ${turn.toolCall.functionCalls.length} function(s):`
            );
            for (const fc of turn.toolCall.functionCalls) {
              console.log(`  - ${fc.name}(${JSON.stringify(fc.args)})`);
            }

            // Handle function calls
            const functionResponses = [];
            for (const fc of turn.toolCall.functionCalls) {
              const result = handleFunctionCall(fc);
              console.log(`[${fc.name}] ${result.result}`);

              functionResponses.push({
                id: fc.id,
                name: fc.name,
                response: result,
              });
              allFunctionResponses.push(fc.name);
            }

            // Send tool response
            session.sendToolResponse({ functionResponses: functionResponses });
            
            // Continue loop to check for more tool calls or text
            continue;
          }
          
          // Check if this is the final turn
          if (turn.serverContent?.turnComplete) {
            processingComplete = true;
          }
        }
        
        // If we got text or no more messages, we're done
        if (textParts.length > 0 || turns.length === 0) {
          processingComplete = true;
        }
      }

      // Display all collected text
      if (textParts.length > 0) {
        console.log("\nAssistant:", textParts.join(""));
      }

      console.log();
      askQuestion();
    });
  };

  askQuestion();
}

main().catch(console.error);
