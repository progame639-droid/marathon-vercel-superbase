// pages/api/participants/index.js
//
// GET  — публичный, без авторизации (мобильное приложение читает список)
// POST — требует авторизацию: либо NextAuth сессия (сайт), либо JWT (мобильное приложение)

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { getSupabaseAdmin } from "../../../lib/supabase";
import jwt from "jsonwebtoken";

// Вспомогательная функция — достаём userId из любого источника авторизации
async function getUserEmail(req, res) {
  // 1. Пробуем NextAuth сессию (браузер/сайт)
  const session = await getServerSession(req, res, authOptions);
  if (session?.user?.email) {
    return session.user.email;
  }

  // 2. Пробуем JWT из заголовка Authorization: Bearer <token> (мобильное приложение)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET);
      if (payload?.email) return payload.email;
    } catch {
      // невалидный токен — игнорируем
    }
  }

  return null;
}

export default async function handler(req, res) {
  try {
    const db = getSupabaseAdmin();

    // ══════════════════════════════════════════════
    // GET — ПУБЛИЧНЫЙ (без авторизации)
    // Мобильное приложение и все посетители сайта
    // видят список участников без входа
    // ══════════════════════════════════════════════
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
        console.error("GET ERROR:", error);
        return res.status(500).json({ error: error.message });
      }

      // Маппинг полей под формат мобильного приложения
      const mapped = (data || []).map((p, i) => ({
        id: p.id,
        firstName: p.name || "",
        lastName: p.surname || "",
        email: p.email || "",
        phone: p.phone || "",
        country: p.country || "",
        city: p.city || "",
        age: p.age || 0,
        gender: p.gender || "",
        distance: p.role || "",        // в вашей схеме role = дистанция
        tShirtSize: p.tshirt_size || null,
        photoUrl: p.photo || null,
        registrationDate: p.created_at || new Date().toISOString(),
        bibNumber: String(p.bib_number || i + 1).padStart(3, "0"),
      }));

      return res.status(200).json(mapped);
    }

    // ══════════════════════════════════════════════
    // POST / PUT / DELETE — ТОЛЬКО АВТОРИЗОВАННЫМ
    // ══════════════════════════════════════════════
    const userEmail = await getUserEmail(req, res);

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // CREATE PARTICIPANT
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
          tshirt_size: body.tShirtSize || null,
          bib_number: body.bibNumber || null,
        })
        .select()
        .single();

      if (error) {
        console.error("POST ERROR:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json({ success: true, data });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
