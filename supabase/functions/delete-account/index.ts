import { withSupabase } from "npm:@supabase/server@^1";

export default {
  fetch: withSupabase({ auth: "user" }, async (request, context) => {
    if (request.method !== "POST") {
      return Response.json({ error: "method_not_allowed" }, { status: 405 });
    }

    const userId = context.userClaims?.id;
    if (!userId) {
      return Response.json({ error: "invalid_session" }, { status: 401 });
    }

    const { error } = await context.supabaseAdmin.auth.admin.deleteUser(userId, false);
    if (error) {
      return Response.json({ error: "delete_failed" }, { status: 500 });
    }

    return Response.json({ deleted: true });
  }),
};
