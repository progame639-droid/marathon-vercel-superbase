// pages/api/participants/[id].js
//
// GET    — публичный (карточка участника)
// PUT    — авторизация обязательна
// DELETE — авторизация обязательна

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getSupabaseAdmin } from "../../../lib/supabase";
import jwt from "jsonwebtoken";

async function getUserEmail(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.email) return session.user.email;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.NEXTAUTH_SECRET);
      if (payload?.email) return payload.email;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  const { id } = req.query;
  const db = getSupabaseAdmin();

  // GET — публичный
  if (req.method === "GET") {
    const { data, error } = await db
      .from("participants")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return res.status(404).json({ error: "Not found" });

    return res.status(200).json({
      id: data.id,
      firstName: data.name || "",
      lastName: data.surname || "",
      email: data.email || "",
      phone: data.phone || "",
      country: data.country || "",
      city: data.city || "",
      age: data.age || 0,
      gender: data.gender || "",
      distance: data.role || "",
      tShirtSize: data.tshirt_size || null,
      photoUrl: data.photo || null,
      registrationDate: data.created_at || new Date().toISOString(),
      bibNumber: String(data.bib_number || data.id).padStart(3, "0"),
    });
  }

  // PUT / DELETE — только авторизованным
  const userEmail = await getUserEmail(req, res);
  if (!userEmail) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "PUT") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { data, error } = await db
      .from("participants")
      .update({
        email: body.email,
        name: body.firstName || body.name,
        surname: body.lastName || body.surname,
        gender: body.gender,
        role: body.distance || body.role,
        country: body.country,
        city: body.city || null,
        age: body.age || null,
        tshirt_size: body.tShirtSize || null,
      })
      .eq("id", id)
      .select()
      .single();

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
