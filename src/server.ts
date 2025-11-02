import { routeAgentRequest, type Schedule } from "agents";

import { getSchedulePrompt } from "agents/schedule";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  generateId,
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
//import { openai } from "@ai-sdk/openai";
import { createWorkersAI } from 'workers-ai-provider';
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Initialize Workers AI with the binding from this.env (Workers runtime)
    const workersai = createWorkersAI({ binding: this.env.AI });
    
    // Try Llama 3.1 which may have better tool calling support
    // Fallback to DeepSeek if Llama doesn't work
    const model = workersai("@cf/meta/llama-3.1-8b-instruct" as any);
    // Alternative: workersai("@cf/deepseek-ai/deepseek-r1-distill-qwen-32b" as any);

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions
        });

        console.log("🔧 Available tools:", Object.keys(allTools));
        console.log("📝 Current messages:", cleanedMessages.length);

        // Analyze user's last message to detect intent
        const lastUserMessage = cleanedMessages
          .filter(m => m.role === 'user')
          .slice(-1)[0];
        
        const userText = lastUserMessage?.parts
          ?.find(p => p.type === 'text')
          ?.text?.toLowerCase() || '';
        
        const wantsCalendar = userText.includes('calendar') || 
                              userText.includes('block') || 
                              userText.includes('meeting') || 
                              userText.includes('schedule') ||
                              userText.includes('add to') ||
                              userText.includes('put on');
        
        console.log("👤 User intent - wants calendar:", wantsCalendar, "Text:", userText.substring(0, 50));

        const result = streamText({
          system: `You are an AI assistant that MUST use tools to perform actions. DO NOT just describe what you would do - ACTUALLY CALL THE TOOLS.

${wantsCalendar ? `
🚨 USER WANTS TO CREATE A CALENDAR EVENT 🚨
You MUST call the createCalendarEvent tool NOW. Do not describe it, do not think about it - CALL IT IMMEDIATELY.
` : ''}

CRITICAL RULES:
1. When a user asks for ANY action (schedule, block time, calendar, meeting, etc.), you MUST call a tool
2. If you don't call a tool, you are FAILING your task
3. Tools are the ONLY way to perform actions - describing actions is not acceptable
4. Think of tools as functions you MUST call, not suggestions

${getSchedulePrompt({ date: new Date() })}

TOOL USAGE RULES:
1. **createCalendarEvent** - MANDATORY when user says:
   - "block time", "block my calendar", "add to calendar"
   - "schedule a meeting", "create calendar event", "schedule"
   - "put on my calendar", "add to my schedule"
   - ANY request mentioning "calendar", "meeting", "appointment"
   → YOU MUST CALL THIS TOOL - do not describe, CALL IT

2. **scheduleTask** - Only for internal task reminders (NOT calendar events)

TOOL DESCRIPTIONS:
- createCalendarEvent: Creates events in Google Calendar. Takes: title (string), startTime (string), optional endTime, description, location, attendees. REQUIRES USER APPROVAL.
- scheduleTask: Schedules internal tasks (not calendar events)
- getLocalTime: Gets time in a location
- getWeatherInformation: Gets weather (requires approval)
- getScheduledTasks: Lists scheduled tasks
- cancelScheduledTask: Cancels a task

EXAMPLE CONVERSATION:
User: "Block my calendar for a code review tomorrow at 2pm"
You: [IMMEDIATELY CALL createCalendarEvent with {"title": "Code Review", "startTime": "tomorrow at 2pm"}]
Do NOT say "I would create..." - CALL THE TOOL!

User: "Schedule a meeting for Monday at 9am"
You: [IMMEDIATELY CALL createCalendarEvent with {"title": "Meeting", "startTime": "Monday at 9am"}]

User: "Add doctor appointment to calendar Friday 3pm"
You: [IMMEDIATELY CALL createCalendarEvent with {"title": "Doctor Appointment", "startTime": "Friday at 3pm"}]

REMEMBER:
- Extract title from user request
- Parse time (accept natural language: "tomorrow at 2pm", "Monday 9am", etc.)
- Call createCalendarEvent immediately
- Wait for approval
- Then respond with confirmation

${wantsCalendar ? '⚠️ USER IS REQUESTING A CALENDAR EVENT - YOU MUST CALL createCalendarEvent TOOL NOW! ⚠️' : ''}
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: (async (result: Parameters<typeof onFinish>[0]) => {
            console.log("✅ Stream finished");
            if (result.toolCalls && result.toolCalls.length > 0) {
              console.log("🔧 Tool calls made:", result.toolCalls.map((tc: { toolName: string }) => tc.toolName));
            } else {
              console.warn("⚠️ No tool calls were made!");
              if (wantsCalendar) {
                console.error("❌ ERROR: User wanted calendar event but no tool was called!");
              }
            }
            return await onFinish(result);
          }) as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
  async executeTask(description: string, _task: Schedule<string>) {
    await this.saveMessages([
      ...this.messages,
      {
        id: generateId(),
        role: "user",
        parts: [
          {
            type: "text",
            text: `Running scheduled task: ${description}`
          }
        ],
        metadata: {
          createdAt: new Date()
        }
      }
    ]);
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
