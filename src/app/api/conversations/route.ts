import { supabase } from "@/lib/supabase";

export async function GET() {
  // Get all conversations with their latest message
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Fetch last message and unread count for each conversation
  const withLastMessage = await Promise.all(
    (conversations || []).map(async (convo) => {
      const { data: messages } = await supabase
        .from("messages")
        .select("content, role, created_at")
        .eq("conversation_id", convo.id)
        .order("created_at", { ascending: false })
        .limit(1);

      // No last_read_at means the migration hasn't run yet - report nothing
      // unread rather than flagging every conversation.
      let unread_count = 0;
      if (convo.last_read_at) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("conversation_id", convo.id)
          .eq("role", "user")
          .gt("created_at", convo.last_read_at);
        unread_count = count ?? 0;
      }

      return {
        ...convo,
        last_message: messages?.[0]?.content || null,
        unread_count,
      };
    })
  );

  return Response.json(withLastMessage);
}
