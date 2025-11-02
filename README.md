# Personal Productivity AI Assistant

An AI-powered chat assistant that helps you manage tasks, schedule events, and organize your day. Built on Cloudflare Workers with Google Calendar integration.

## How It Works

### The Main Parts

1. **AI Brain (LLM)**
   - Uses Cloudflare Workers AI (Llama 3.1 model)
   - Understands your requests and decides what to do
   - Located in `src/server.ts`

2. **Chat Interface**
   - React web app where you type messages
   - Shows AI responses and tool cards in real-time
   - Located in `src/app.tsx`

3. **Tools (What the AI Can Do)**
   - **Calendar Events**: Creates events in your Google Calendar
   - **Task Scheduling**: Schedules internal tasks with reminders
   - **Time Lookup**: Gets the time in different locations
   - Tools are defined in `src/tools.ts`

4. **Memory (State Storage)**
   - Uses Cloudflare Durable Objects
   - Remembers your conversation history
   - Persists even after you close the browser

5. **Agentic Behavior**
   - Shows tool cards when the AI uses tools
   - You can approve or reject actions
   - You see what the AI is doing step-by-step

### The Flow

```
You type a message → AI reads it → AI decides to use a tool → 
Tool card appears → You approve → Tool executes → 
AI responds with the result
```

**Example:**
1. You say: "Block my calendar for a code review tomorrow at 2pm"
2. AI shows: A tool card asking to create the calendar event
3. You click: "Approve"
4. AI creates: The event in your Google Calendar
5. AI responds: "I've added 'Code Review' to your calendar for tomorrow at 2pm"

## Features

- ✅ **Google Calendar Integration** - Creates real calendar events
- ✅ **Task Scheduling** - Schedule tasks with due dates
- ✅ **Persistent Memory** - Conversation history is saved
- ✅ **Tool Confirmations** - Approve actions before they happen
- ✅ **Real-time Streaming** - See responses as they're generated
- ✅ **Modern UI** - Clean chat interface with dark/light themes

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.dev.vars` file:

```env
OPENAI_API_KEY=your_openai_api_key

# Google Calendar (optional)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

### 3. Run Locally

```bash
npm start
```

### 4. Deploy

```bash
npm run deploy
```

## How to Use

1. Open the chat interface
2. Type your request, like:
   - "Block my calendar for a meeting tomorrow at 3pm"
   - "Schedule a code review for next Monday"
   - "What time is it in New York?"
3. The AI will use tools when needed
4. Approve tool actions when prompted
5. View your calendar - events will appear there!

## Project Structure

```
src/
├── app.tsx              # Chat UI (React)
├── server.ts            # AI agent logic
├── tools.ts             # Tool definitions (calendar, tasks, etc.)
├── lib/
│   └── google-calendar.ts  # Google Calendar API integration
└── components/          # UI components
```

## Key Technologies

- **Cloudflare Workers** - Server runtime
- **Workers AI** - AI model hosting (Llama 3.1)
- **Durable Objects** - State and memory storage
- **React** - Frontend UI
- **AI SDK** - Tool calling and streaming
- **Google Calendar API** - Calendar integration

## What Makes This Agentic?

The AI doesn't just talk - it **does things**:
- Shows you tool cards when it's about to perform actions
- Lets you approve or reject actions
- Actually creates calendar events, schedules tasks, etc.
- You can see its "thinking" process through tool invocations

This is different from a regular chatbot because you can **see what tools it's using** and **control what it does**.

## License

MIT
