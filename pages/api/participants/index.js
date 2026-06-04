// pages/api/participants/index.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getSupabaseAdmin } from "../../../lib/supabase";
import jwt from "jsonwebtoken";

async function getUserEmail(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.email) return session.user.email;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      if (payload?.email) return payload.email;
    } catch {}
  }
  return null;
}

// Маппинг из БД → формат фронтенда (используется везде одинаково)
function mapParticipant(p, index) {
  return {
    id: p.id,
    // Поля для сайта
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
    // Поля для мобильного приложения
    firstName: p.name || "",
    lastName: p.surname || "",
    phone: p.phone || "",
    city: p.city || "",
    age: p.age || 0,
    distance: p.role || "",
    tShirtSize: p.tshirt_size || null,
    photoUrl: p.photo || null,
    registrationDate: p.created_at || new Date().toISOString(),
    bibNumber: String(p.bib_number || (index !== undefined ? index + 1 : p.id)).padStart(3, "0"),
  };
}

export default async function handler(req, res) {
  // CORS для мобильного приложения
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const db = getSupabaseAdmin();

    // ── GET — публичный ──────────────────────────────────────────
    if (req.method === "GET") {
      const search = req.query.search || "";

      let query = db
        .from("participants")
        .select("*")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%,country.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("GET participants error:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json((data || []).map((p, i) => mapParticipant(p, i)));
    }

    // ── POST — требует авторизацию ───────────────────────────────
    const userEmail = await getUserEmail(req, res);
    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      const { data, error } = await db
        .from("participants")
        .insert({
          owner_id: userEmail,
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
          bib_number: body.bibNumber || null,
        })
        .select()
        .single();

      if (error) {
        console.error("POST participants error:", error);
        return res.status(500).json({ error: error.message });
      }

      // ❗ ИСПРАВЛЕНИЕ: возвращаем { success, data } где data — замапленный объект
      return res.status(201).json({ success: true, data: mapParticipant(data) });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
