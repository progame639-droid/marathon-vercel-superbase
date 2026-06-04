import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getSupabaseAdmin } from "../../../lib/supabase";

async function getUserEmail(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.email) return session.user.email;
  return null;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const db = getSupabaseAdmin();

  if (req.method === "GET") {
    const { data, error } = await db.from("participants").select("*").eq("id", id).single();
    if (error || !data) return res.status(404).json({ error: "Not found" });
    return res.status(200).json(data);
  }

  const userEmail = await getUserEmail(req, res);
  if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "PUT") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { data, error } = await db.from("participants").update({
      email: body.email,
      name: body.name,
      surname: body.surname,
      gender: body.gender,
      role: body.role,
      country: body.country,
      dob: body.dob || null,
      bmi: body.bmi || null,
      photo: body.photo || null,
    }).eq("id", id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, data });
  }

  if (req.method === "DELETE") {
    const { error } = await db.from("participants").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
