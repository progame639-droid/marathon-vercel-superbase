import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getSupabaseAdmin } from "../../../lib/supabase";

async function getUserEmail(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.email) return session.user.email;
  return null;
}

export default async function handler(req, res) {
  try {
    const db = getSupabaseAdmin();

    if (req.method === "GET") {
      const search = req.query.search || "";
      let query = db.from("participants").select("*").order("created_at", { ascending: false });
      if (search) {
        query = query.or(`name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%`);
      }
      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    }

    const userEmail = await getUserEmail(req, res);
    if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const { data, error } = await db.from("participants").insert({
        owner_id: userEmail,
        email: body.email,
        name: body.name,
        surname: body.surname,
        gender: body.gender,
        role: body.role,
        country: body.country,
        dob: body.dob || null,
        photo: body.photo || null,
      }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ success: true, data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
