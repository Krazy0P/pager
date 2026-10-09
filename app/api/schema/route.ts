import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "supabase", "schema.sql");
    const content = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Could not read schema file" },
      { status: 500 }
    );
  }
}
