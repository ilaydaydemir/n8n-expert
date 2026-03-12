"use client";

import { useState, useRef, useEffect } from "react";
import { Message, N8nWorkflow, N8nWorkflowResponse } from "@/types";
import ChatMessage from "./Message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const SUGGESTIONS = [
  "Build a webhook that receives form data and sends a Slack notification",
  "Create a daily report workflow that fetches data from an API and emails it",
  "Make a workflow that monitors GitHub issues and notifies the team on Discord",
  "Build a lead nurture sequence: new signup → welcome email → follow-up after 3 days",
];

function extractWorkflow(content: string): N8nWorkflow | null {
  const match = content.match(/```workflow\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim());
  } catch {
    return null;
  }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey! I'm your **n8n Expert**. I can help you design and build any automation workflow — from simple webhooks to complex multi-step pipelines.\n\nTell me what you want to automate, and I'll design the workflow and deploy it directly to your n8n instance. To edit an existing workflow, open the sidebar and click **Edit** on it.\n\nWhat would you like to build?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflowResponse[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<N8nWorkflowResponse | null>(null);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    try {
      const res = await fetch("/api/n8n/workflows");
      const data = await res.json();
      if (data.workflows) setN8nWorkflows(data.workflows);
    } catch {
      // n8n not connected yet
    }
  }

  async function startEditing(wf: N8nWorkflowResponse) {
    setLoadingWorkflowId(wf.id);
    try {
      const res = await fetch(`/api/n8n/workflows/${wf.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const full: N8nWorkflowResponse = data.workflow;
      setEditingWorkflow(full);
      setShowSidebar(false);

      // Inject a system-style message into chat showing the workflow being edited
      const contextMsg: Message = {
        id: `edit-context-${wf.id}`,
        role: "assistant",
        content: `I've loaded **"${full.name}"** for editing. It has ${full.nodes.length} node${full.nodes.length !== 1 ? "s" : ""}:\n${full.nodes.map((n) => `- **${n.name}** (\`${n.type}\`)`).join("\n")}\n\nWhat would you like to change?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, contextMsg]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to load workflow");
    } finally {
      setLoadingWorkflowId(null);
    }
  }

  function stopEditing() {
    setEditingWorkflow(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `edit-done-${Date.now()}`,
        role: "assistant",
        content: "Done editing. What would you like to build next?",
        timestamp: new Date(),
      },
    ]);
  }

  async function sendMessage(text?: string) {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build history — inject current workflow JSON as system context when editing
    const history = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (editingWorkflow) {
      // Prepend a hidden system-level user message with the full workflow JSON
      history.unshift({
        role: "user",
        content: `[CONTEXT — do not repeat this to the user] I am editing an existing workflow. Here is its current full JSON. Preserve all node IDs, names, and connections that the user doesn't ask to change. Always include the workflow "id" field in your output so it gets updated rather than recreated.\n\n\`\`\`json\n${JSON.stringify(editingWorkflow, null, 2)}\n\`\`\``,
      });
      history.unshift({
        role: "assistant",
        content: "Understood. I have the workflow JSON loaded. I will make only the changes you request and preserve everything else.",
      });
    }

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  )
                );
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      const workflow = extractWorkflow(fullContent);
      if (workflow) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, workflow } : m))
        );
        // If the returned workflow has an id, update our editingWorkflow reference
        if (workflow.id && editingWorkflow && workflow.id === editingWorkflow.id) {
          setEditingWorkflow((prev) =>
            prev ? { ...prev, ...workflow, id: prev.id } : prev
          );
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? "w-72" : "w-0"
        } transition-all duration-300 overflow-hidden bg-white border-r border-gray-200 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm">n8n Workflows</h2>
          <p className="text-xs text-gray-500 mt-0.5">Click Edit to modify one</p>
        </div>
        <ScrollArea className="flex-1 p-3">
          {n8nWorkflows.length === 0 ? (
            <div className="text-xs text-gray-400 text-center mt-8 px-4">
              No workflows yet. Start chatting to create your first one!
            </div>
          ) : (
            <div className="space-y-2">
              {n8nWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    editingWorkflow?.id === wf.id
                      ? "border-orange-300 bg-orange-50"
                      : "border-gray-100 hover:border-orange-200 hover:bg-orange-50/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
                      {wf.name}
                    </span>
                    <Badge
                      className={`text-xs ml-1 shrink-0 ${
                        wf.active
                          ? "bg-green-100 text-green-700 border-green-200"
                          : "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                    >
                      {wf.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">
                    {wf.nodes?.length ?? 0} nodes · {new Date(wf.updatedAt).toLocaleDateString()}
                  </p>
                  {editingWorkflow?.id === wf.id ? (
                    <button
                      onClick={stopEditing}
                      className="w-full text-xs py-1 rounded-md bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors font-medium"
                    >
                      Stop Editing
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditing(wf)}
                      disabled={loadingWorkflowId === wf.id}
                      className="w-full text-xs py-1 rounded-md border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-700 hover:bg-orange-50 transition-colors disabled:opacity-50"
                    >
                      {loadingWorkflowId === wf.id ? "Loading..." : "Edit"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-3 border-t border-gray-100">
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={loadWorkflows}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((s) => !s)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Toggle workflow panel"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center text-white font-bold text-sm">
                n8
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 text-sm">n8n Expert</h1>
                <p className="text-xs text-gray-400">Powered by OpenRouter</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-500">Connected</span>
          </div>
        </div>

        {/* Edit mode banner */}
        {editingWorkflow && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-blue-600 text-xs">✏️</span>
              <span className="text-xs text-blue-700 font-medium">
                Editing: <strong>{editingWorkflow.name}</strong>
              </span>
              <span className="text-xs text-blue-500">
                — only your requested changes will be applied
              </span>
            </div>
            <button
              onClick={stopEditing}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              Exit edit mode
            </button>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {loading && (
              <div className="flex justify-start mb-4">
                <div className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-tl-sm shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <div className="max-w-3xl mx-auto">
              <p className="text-xs text-gray-400 mb-2">Try one of these:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-3 py-2 text-xs text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-gray-200 p-4">
          <div className="max-w-3xl mx-auto">
            <div
              className={`flex items-end gap-3 border rounded-2xl px-4 py-3 transition-all ${
                editingWorkflow
                  ? "bg-blue-50/50 border-blue-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-200"
                  : "bg-gray-50 border-gray-200 focus-within:border-orange-300 focus-within:ring-1 focus-within:ring-orange-200"
              }`}
            >
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  editingWorkflow
                    ? `What would you like to change in "${editingWorkflow.name}"?`
                    : "Describe the workflow you want to build..."
                }
                className="flex-1 border-0 bg-transparent resize-none text-sm focus-visible:ring-0 min-h-[20px] max-h-32 p-0"
                rows={1}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                size="sm"
                className={`rounded-xl px-4 shrink-0 text-white ${
                  editingWorkflow
                    ? "bg-blue-500 hover:bg-blue-600"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </Button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
