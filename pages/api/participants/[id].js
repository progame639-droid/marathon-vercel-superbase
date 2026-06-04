// pages/api/participants/[id].js

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

function mapParticipant(p) {
  return {
    id: p.id,
    name: p.name || "",
    surname: p.surname || "",
    email: p.email || "",
    gender: p.gender || "",
    role: p.role || "",
    country: p.country || "",
    dob: p.dob || null,
    bmi: p.bmi || null,
    photo: p.photo || null,
    created_at: p.created_at,
    // мобильное приложение
    firstName: p.name || "",
    lastName: p.surname || "",
    phone: p.phone || "",
    city: p.city || "",
    age: p.age || 0,
    distance: p.role || "",
    tShirtSize: p.tshirt_size || null,
    photoUrl: p.photo || null,
    registrationDate: p.created_at || new Date().toISOString(),
    bibNumber: String(p.bib_number || p.id).padStart(3, "0"),
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

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
    return res.status(200).json(mapParticipant(data));
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
        dob: body.dob || null,
        bmi: body.bmi || null,
        photo: body.photoUrl || body.photo || null,
        phone: body.phone || null,
        tshirt_size: body.tShirtSize || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    // ❗ ИСПРАВЛЕНИЕ: возвращаем { success, data }
    return res.status(200).json({ success: true, data: mapParticipant(data) });
  }

  if (req.method === "DELETE") {
    const { error } = await db.from("participants").delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
