"use client";

import { useState } from "react";
import { N8nWorkflow } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface WorkflowPreviewProps {
  workflow: N8nWorkflow;
}

export default function WorkflowPreview({ workflow }: WorkflowPreviewProps) {
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState<{ id: string; active: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  async function deploy() {
    setDeploying(true);
    setError(null);
    try {
      const res = await fetch("/api/n8n/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeployed({ id: data.workflow.id, active: data.workflow.active });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deploy failed");
    } finally {
      setDeploying(false);
    }
  }

  async function activate() {
    if (!deployed) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/n8n/workflows/${deployed.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "activate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeployed({ id: deployed.id, active: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  return (
    <div className="mt-3 border border-orange-200 rounded-xl overflow-hidden bg-orange-50/50">
      <div className="flex items-center justify-between px-4 py-2 bg-orange-100/80 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <span className="text-orange-600 text-sm font-semibold">⚡ Workflow</span>
          <span className="text-orange-800 text-sm font-medium truncate max-w-[200px]">
            {workflow.name}
          </span>
          <Badge variant="secondary" className="text-xs">
            {workflow.nodes.length} nodes
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {deployed ? (
            <>
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                ✓ Deployed {deployed.id.slice(0, 6)}
              </Badge>
              {!deployed.active && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
                  onClick={activate}
                  disabled={activating}
                >
                  {activating ? "Activating..." : "Activate"}
                </Button>
              )}
              {deployed.active && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                  ● Active
                </Badge>
              )}
            </>
          ) : (
            <Button
              size="sm"
              className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
              onClick={deploy}
              disabled={deploying}
            >
              {deploying ? "Deploying..." : "Deploy to n8n"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-600 text-xs">
          {error}
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {workflow.nodes.map((node) => {
            const isFirst = workflow.nodes[0].name === node.name;
            return (
              <div
                key={node.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                  isFirst
                    ? "bg-orange-100 border-orange-300 text-orange-800"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                <span>{getNodeIcon(node.type)}</span>
                <span>{node.name}</span>
              </div>
            );
          })}
        </div>

        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 select-none">
            View JSON
          </summary>
          <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-auto max-h-64">
            {JSON.stringify(workflow, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

function getNodeIcon(type: string): string {
  if (type.includes("webhook")) return "🪝";
  if (type.includes("schedule") || type.includes("cron")) return "⏰";
  if (type.includes("email") || type.includes("gmail") || type.includes("smtp")) return "📧";
  if (type.includes("slack")) return "💬";
  if (type.includes("discord")) return "🎮";
  if (type.includes("telegram")) return "✈️";
  if (type.includes("http")) return "🌐";
  if (type.includes("if") || type.includes("switch")) return "🔀";
  if (type.includes("set")) return "✏️";
  if (type.includes("code") || type.includes("function")) return "💻";
  if (type.includes("merge")) return "🔗";
  if (type.includes("split") || type.includes("batch")) return "📋";
  if (type.includes("postgres") || type.includes("mysql") || type.includes("mongo")) return "🗄️";
  if (type.includes("notion")) return "📝";
  if (type.includes("github") || type.includes("gitlab")) return "🐙";
  if (type.includes("google")) return "🔍";
  if (type.includes("airtable")) return "📊";
  if (type.includes("stripe")) return "💳";
  if (type.includes("openai") || type.includes("anthropic")) return "🤖";
  if (type.includes("wait")) return "⏳";
  if (type.includes("respond")) return "↩️";
  return "⚙️";
}
