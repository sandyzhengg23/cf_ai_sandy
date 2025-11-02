/**
 * Google Calendar API integration
 * 
 * To set up:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project or select existing one
 * 3. Enable Google Calendar API
 * 4. Create credentials (OAuth 2.0 Client ID)
 * 5. Set up environment variables:
 *    - GOOGLE_CLIENT_ID
 *    - GOOGLE_CLIENT_SECRET
 *    - GOOGLE_REFRESH_TOKEN (obtained via OAuth flow)
 * 
 * For service account (simpler, for server-to-server):
 * 1. Create a service account
 * 2. Download JSON key
 * 3. Store credentials securely
 */

interface CalendarEventInput {
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  attendees?: string[];
}

interface GoogleCalendarEvent {
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: string;
  attendees?: Array<{ email: string }>;
}

/**
 * Parse natural language date/time to ISO 8601 format
 * This is a basic implementation - you may want to use a library like date-fns or chrono-node
 */
function parseDateTime(dateTimeStr: string, defaultHour: number = 14): string {
  const now = new Date();
  const lower = dateTimeStr.toLowerCase();
  
  // Handle "tomorrow", "today", etc.
  let date = new Date(now);
  if (lower.includes("tomorrow")) {
    date.setDate(date.getDate() + 1);
  }
  
  // Extract time (e.g., "2pm", "14:00", "2:00 PM")
  const timeMatch = dateTimeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    
    if (ampm === 'pm' && hour !== 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
    
    date.setHours(hour, minutes, 0, 0);
  } else {
    date.setHours(defaultHour, 0, 0, 0);
  }
  
  return date.toISOString();
}

/**
 * Get Google Calendar API access token
 * Uses service account or OAuth refresh token
 */
async function getAccessToken(env?: {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REFRESH_TOKEN?: string;
  GOOGLE_SERVICE_ACCOUNT_KEY?: string;
}): Promise<string> {
  // Support both Node.js process.env and Cloudflare Workers env
  const getEnv = (key: string): string | undefined => {
    if (env && key in env) return env[key as keyof typeof env];
    // Fallback for local development
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
    return undefined;
  };
  
  // Option 1: Using service account (stored in env)
  if (getEnv('GOOGLE_SERVICE_ACCOUNT_KEY')) {
    // Service account authentication
    // You would use google-auth-library here
    // For now, we'll use refresh token method
  }
  
  // Option 2: Using OAuth refresh token
  const clientId = getEnv('GOOGLE_CLIENT_ID');
  const clientSecret = getEnv('GOOGLE_CLIENT_SECRET');
  const refreshToken = getEnv('GOOGLE_REFRESH_TOKEN');
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Calendar credentials not configured. " +
      "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables."
    );
  }
  
  // Exchange refresh token for access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const data = await response.json<{ access_token: string }>();
  return data.access_token;
}

/**
 * Create a calendar event in Google Calendar
 */
export async function createCalendarEvent(
  input: CalendarEventInput,
  env?: {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REFRESH_TOKEN?: string;
    GOOGLE_SERVICE_ACCOUNT_KEY?: string;
  }
): Promise<string> {
  try {
    const accessToken = await getAccessToken(env);
    
    // Parse dates
    const startDateTime = parseDateTime(input.startTime);
    const endDateTime = input.endTime 
      ? parseDateTime(input.endTime)
      : new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString(); // Default 1 hour
    
    // Build Google Calendar event
    const calendarEvent: GoogleCalendarEvent = {
      summary: input.title,
      description: input.description || "",
      start: {
        dateTime: startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      ...(input.location && { location: input.location }),
      ...(input.attendees && {
        attendees: input.attendees.map(email => ({ email })),
      }),
    };
    
    // Create event via Google Calendar API
    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(calendarEvent),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create calendar event: ${error}`);
    }
    
    const event = await response.json<{ id: string; htmlLink: string }>();
    
    return `Calendar event "${input.title}" created successfully! View it here: ${event.htmlLink}`;
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

