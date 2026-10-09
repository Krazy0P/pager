import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateUpload } from "@/lib/file-safety";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to share files." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const conversationId = String(form.get("conversationId") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file." }, { status: 400 });
  }
  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation." }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "You are not in this chat." }, { status: 403 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const check = validateUpload(file, buffer);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "file";
  const path = `${conversationId}/${user.id}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-media")
    .upload(path, buffer, {
      contentType: check.mime,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  return NextResponse.json({
    path,
    mime: check.mime,
    kind: check.kind,
    name: file.name,
    size: file.size,
  });
}
