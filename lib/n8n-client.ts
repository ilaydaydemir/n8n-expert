import { N8nWorkflow, N8nWorkflowResponse } from "@/types";

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

const headers = {
  "Content-Type": "application/json",
  "X-N8N-API-KEY": N8N_API_KEY,
};

export async function createWorkflow(
  workflow: N8nWorkflow
): Promise<N8nWorkflowResponse> {
  const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows`, {
    method: "POST",
    headers,
    body: JSON.stringify(workflow),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create workflow: ${error}`);
  }

  return response.json();
}

export async function activateWorkflow(id: string): Promise<N8nWorkflowResponse> {
  const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${id}/activate`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to activate workflow: ${error}`);
  }

  return response.json();
}

export async function listWorkflows(): Promise<N8nWorkflowResponse[]> {
  const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list workflows: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${N8N_BASE_URL}/api/v1/workflows/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to delete workflow: ${error}`);
  }
}
