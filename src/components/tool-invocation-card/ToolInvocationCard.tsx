import { useState } from "react";
import type { ToolUIPart } from "ai";
import { Robot, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/button/Button";
import { Card } from "@/components/card/Card";
import { APPROVAL } from "@/shared";

interface ToolResultWithContent {
  content: Array<{ type: string; text: string }>;
}

function isToolResultWithContent(
  result: unknown
): result is ToolResultWithContent {
  return (
    typeof result === "object" &&
    result !== null &&
    "content" in result &&
    Array.isArray((result as ToolResultWithContent).content)
  );
}

interface ToolInvocationCardProps {
  toolUIPart: ToolUIPart;
  toolCallId: string;
  needsConfirmation: boolean;
  onSubmit: ({
    toolCallId,
    result
  }: {
    toolCallId: string;
    result: string;
  }) => void;
  addToolResult: (toolCallId: string, result: string) => void;
}

export function ToolInvocationCard({
  toolUIPart,
  toolCallId,
  needsConfirmation,
  onSubmit
  // addToolResult
}: ToolInvocationCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine status and styling based on state
  const getStatusInfo = () => {
    if (toolUIPart.state === "output-available") {
      return {
        status: "✓ Completed",
        statusColor: "text-green-500 dark:text-green-400",
        bgColor: needsConfirmation ? "bg-[#F48120]/10 border-[#F48120]/30" : "bg-green-500/10 border-green-500/30",
        iconBg: needsConfirmation ? "bg-[#F48120]/10" : "bg-green-500/10"
      };
    }
    if (toolUIPart.state === "input-available") {
      return {
        status: needsConfirmation ? "⏳ Awaiting Approval" : "⚙️ Running...",
        statusColor: needsConfirmation ? "text-yellow-500 dark:text-yellow-400" : "text-[#F48120]",
        bgColor: needsConfirmation ? "bg-yellow-500/10 border-yellow-500/30" : "bg-[#F48120]/10 border-[#F48120]/30",
        iconBg: needsConfirmation ? "bg-yellow-500/10" : "bg-[#F48120]/10"
      };
    }
    return {
      status: "⏳ Processing...",
      statusColor: "text-[#F48120]",
      bgColor: "bg-[#F48120]/10 border-[#F48120]/30",
      iconBg: "bg-[#F48120]/10"
    };
  };

  const statusInfo = getStatusInfo();
  const toolName = toolUIPart.type.replace("tool-", "");

  return (
    <Card className={`p-4 my-3 w-full max-w-[500px] rounded-md overflow-hidden border-2 ${statusInfo.bgColor}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 cursor-pointer"
      >
        <div className={`${statusInfo.iconBg} p-1.5 rounded-full flex-shrink-0 ${toolUIPart.state !== "output-available" ? "animate-pulse" : ""}`}>
          <Robot size={16} className="text-[#F48120]" />
        </div>
        <h4 className="font-semibold flex items-center gap-2 flex-1 text-left text-sm">
          <span className="font-mono text-[#F48120]">Tool:</span>
          <span className="capitalize">{toolName.replace(/([A-Z])/g, " $1").trim()}</span>
          <span className={`text-xs ${statusInfo.statusColor} font-normal`}>
            {statusInfo.status}
          </span>
        </h4>
        <CaretDown
          size={16}
          className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`transition-all duration-200 ${isExpanded ? "max-h-[400px] opacity-100 mt-3" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div
          className="overflow-y-auto"
          style={{ maxHeight: isExpanded ? "380px" : "0px" }}
        >
          <div className="mb-3 p-2 bg-neutral-200/50 dark:bg-neutral-800/50 rounded-md">
            <h5 className="text-xs font-semibold mb-2 text-[#F48120] uppercase tracking-wide">
              🔧 Tool Arguments
            </h5>
            <pre className="bg-background/80 p-3 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px] border border-neutral-300 dark:border-neutral-700">
              {JSON.stringify(toolUIPart.input, null, 2)}
            </pre>
          </div>

          {needsConfirmation && toolUIPart.state === "input-available" && (
            <div className="flex gap-2 justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => onSubmit({ toolCallId, result: APPROVAL.NO })}
              >
                Reject
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => onSubmit({ toolCallId, result: APPROVAL.YES })}
              >
                Approve
              </Button>
            </div>
          )}

          {toolUIPart.state === "output-available" && toolUIPart.output !== undefined && (
            <div className="mt-3 border-t-2 border-[#F48120]/20 pt-3">
              <h5 className="text-xs font-semibold mb-2 text-green-500 dark:text-green-400 uppercase tracking-wide">
                ✅ Tool Result
              </h5>
              <pre className="bg-background/80 p-3 rounded-md text-xs overflow-auto whitespace-pre-wrap break-words max-w-[450px] border border-green-500/30">
                {(() => {
                  const result = toolUIPart.output;
                  if (isToolResultWithContent(result)) {
                    return result.content
                      .map((item: { type: string; text: string }) => {
                        if (
                          item.type === "text" &&
                          item.text.startsWith("\n~ Page URL:")
                        ) {
                          const lines = item.text.split("\n").filter(Boolean);
                          return lines
                            .map(
                              (line: string) => `- ${line.replace("\n~ ", "")}`
                            )
                            .join("\n");
                        }
                        return item.text;
                      })
                      .join("\n");
                  }
                  if (typeof result === "string") {
                    return result;
                  }
                  return JSON.stringify(result, null, 2);
                })()}
              </pre>
            </div>
          )}
          
          {toolUIPart.state === "input-available" && needsConfirmation && (
            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md">
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                ⚠️ This tool requires your approval before execution
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
