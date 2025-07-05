# Gemini Live API Demos

This repository contains various demos for working with Google's Gemini Live API, including audio processing, function calling, and a Business Model Canvas assistant.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your Gemini API key:
```bash
export GOOGLE_GENAI_API_KEY="your-api-key-here"
```

## Demos

### 1. Audio Demo (`demo.js`)
Processes audio files with Gemini Live API and saves the response as audio.

```bash
# Download sample audio
curl -o sample.wav https://storage.googleapis.com/generativeai-downloads/data/16000.wav

# Run demo
node demo.js
```

### 2. Function Calling Demo (`function-demo.js`)
Simple example of function calling with the Live API.

```bash
node function-demo.js
```

### 3. Interactive Chat (`interactive-demo.js`)
Basic interactive chat interface with Gemini Live API.

```bash
node interactive-demo.js
```

### 4. Business Model Canvas Assistant (`bmc-assistant.js`)
An AI assistant that helps fill out a Business Model Canvas through natural conversation.

```bash
node bmc-assistant.js
```

Features:
- Natural conversation about your business
- Automatic extraction and categorization of business information
- Function calling to store data in appropriate BMC sections
- Commands: `show` (display canvas), `quit` (exit)

## Key Learnings

### Function Calling with Gemini Live API

The Gemini Live API has some unique behaviors when handling function calls:

1. **Sequential Tool Calls**: When the model needs to call multiple functions (e.g., "integrate with Hubspot and Microsoft Teams"), it sends them as separate sequential `toolCall` messages, not bundled together.

2. **Message Flow Pattern**:
   ```
   User Input → 
   toolCall 1 → Send tool response → 
   toolCall 2 → Send tool response → 
   ... (more tool calls if needed) →
   Text response with turnComplete
   ```

3. **Critical Implementation Detail**: You must keep processing messages until you receive a `turnComplete` signal. Don't assume one toolCall per turn.

   ```javascript
   // Wrong approach:
   let turns = await handleTurn();
   // Process ONE toolCall
   // Wait for text response

   // Correct approach:
   while (!processingComplete) {
     let turns = await handleTurn();
     // Keep processing ANY toolCalls that come
     // Continue until turnComplete or text arrives
   }
   ```

4. **Debugging Tips**:
   - Add logging to see all messages received
   - The API sends `executableCode` messages before `toolCall` - these can be ignored
   - Watch for the `turnComplete` signal to know when processing is done

## Troubleshooting

- If the assistant gets stuck after function calls, it's likely not handling multiple sequential toolCalls properly
- The Live API is optimized for real-time streaming and may behave differently than the standard Gemini API
- Function calling is more reliable with explicit, direct language ("add X to Y" vs conversational requests)

## Models Used

- `gemini-live-2.5-flash-preview` - Main model for most demos
- `gemini-2.5-flash-preview-native-audio-dialog` - For audio output demos