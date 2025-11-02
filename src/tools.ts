/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { createCalendarEvent as createGoogleCalendarEvent } from "./lib/google-calendar";

/**
 * Weather information tool that requires human confirmation
 * When invoked, this will present a confirmation dialog to the user
 */
const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() })
  // Omitting execute function makes this tool require human confirmation
});

/**
 * Local time tool that executes automatically
 * Since it includes an execute function, it will run without user confirmation
 * This is suitable for low-risk operations that don't need oversight
 */
const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  }
});

// Extended schema to include optional dueDate field
const extendedScheduleSchema = scheduleSchema.extend({
  dueDate: z.string().optional().describe("Optional due date for the task (ISO 8601 format or natural language)")
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time. Can optionally include a due date for the task.",
  inputSchema: extendedScheduleSchema,
  execute: async ({ dueDate, when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    
    // Create enhanced description that includes due date if provided
    const taskDescription = dueDate 
      ? `${description} (Due: ${dueDate})`
      : description;
    
    try {
      agent!.schedule(input!, "executeTask", taskDescription);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    
    const response = `Task scheduled for type "${when.type}": ${input}`;
    return dueDate 
      ? `${response} with due date: ${dueDate}`
      : response;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Google Calendar tool that requires human confirmation
 * Creates a calendar event/block in the user's Google Calendar
 */
const createCalendarEvent = tool({
  description: "CALL THIS TOOL when the user wants to: block time, schedule a meeting, add to calendar, create calendar event, or put something on their schedule. This creates real events in their Google Calendar. REQUIRED when user mentions calendar, meeting, appointment, or scheduling.",
  inputSchema: z.object({
    title: z.string().describe("Event title (extract from user's request, e.g., 'Code Review', 'Team Meeting')"),
    description: z.string().optional().describe("Optional description or details for the event"),
    startTime: z.string().describe("Start time - use natural language like 'tomorrow at 2pm', 'Monday at 9am', 'Friday 3pm', or ISO format"),
    endTime: z.string().optional().describe("End time in natural language or ISO format. Defaults to 1 hour after start if not provided"),
    location: z.string().optional().describe("Optional location for the event"),
    attendees: z.array(z.string()).optional().describe("Optional list of email addresses to invite")
  })
  // Omitting execute function makes this tool require human confirmation
});




/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  getWeatherInformation,
  getLocalTime,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask,
  createCalendarEvent
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 */
export const executions = {
  getWeatherInformation: async ({ city }: { city: string }) => {
    console.log(`Getting weather information for ${city}`);
    return `The weather in ${city} is sunny`;
  },
  createCalendarEvent: async (input: {
    title: string;
    description?: string;
    startTime: string;
    endTime?: string;
    location?: string;
    attendees?: string[];
  }) => {
    try {
      console.log("Creating calendar event with input:", JSON.stringify(input, null, 2));
      
      // Get environment variables - try multiple methods
      let env: {
        GOOGLE_CLIENT_ID?: string;
        GOOGLE_CLIENT_SECRET?: string;
        GOOGLE_REFRESH_TOKEN?: string;
      } | undefined = undefined;
      
      // Method 1: Try to get from global env (Workers runtime)
      // In Cloudflare Workers, env vars from .dev.vars are available via globalThis or process.env
      if (typeof process !== 'undefined' && process.env) {
        env = {
          GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
          GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
        };
        console.log("Using process.env for credentials");
      }
      
      // Method 2: Check if credentials are actually loaded
      if (!env?.GOOGLE_CLIENT_ID || !env?.GOOGLE_CLIENT_SECRET || !env?.GOOGLE_REFRESH_TOKEN) {
        console.error("❌ Missing Google Calendar credentials!");
        console.log("CLIENT_ID:", env?.GOOGLE_CLIENT_ID ? "✓" : "✗");
        console.log("CLIENT_SECRET:", env?.GOOGLE_CLIENT_SECRET ? "✓" : "✗");
        console.log("REFRESH_TOKEN:", env?.GOOGLE_REFRESH_TOKEN ? "✓" : "✗");
        throw new Error(
          "Google Calendar credentials not found. " +
          "Make sure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN " +
          "are set in your .dev.vars file and restart the dev server."
        );
      }
      
      const result = await createGoogleCalendarEvent(input, env);
      
      console.log("✅ Calendar event created successfully:", result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Error in createCalendarEvent:", errorMessage);
      console.error("Full error:", error);
      
      // Return detailed error message so user can see what went wrong
      return `❌ Failed to create calendar event: ${errorMessage}\n\nPossible causes:\n- Credentials missing from .dev.vars\n- Need to restart dev server after adding credentials\n- Invalid or expired refresh token\n- Google Calendar API not enabled\n- Network error\n\nCheck the server console for more details.`;
    }
  }
};


