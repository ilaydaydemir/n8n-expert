import { createWorkflow, listWorkflows } from "@/lib/n8n-client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const workflows = await listWorkflows();
    return NextResponse.json({ workflows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list workflows" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { workflow } = await req.json();
    const created = await createWorkflow(workflow);
    return NextResponse.json({ workflow: created });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create workflow" },
      { status: 500 }
    );
  }
}
