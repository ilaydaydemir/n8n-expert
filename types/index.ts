export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  workflow?: N8nWorkflow;
  timestamp: Date;
}

export interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: N8nConnections;
  settings?: Record<string, unknown>;
  active?: boolean;
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  webhookId?: string;
}

export interface N8nConnections {
  [nodeName: string]: {
    main?: Array<Array<{ node: string; type: string; index: number }>>;
  };
}

export interface N8nWorkflowResponse {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: N8nNode[];
  connections: N8nConnections;
}

export interface ChatRequest {
  messages: { role: string; content: string }[];
}
