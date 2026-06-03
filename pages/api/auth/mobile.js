// pages/api/auth/mobile.js
//
// Мобильное приложение шлёт сюда Google email после OAuth.
// Сервер проверяет что email есть в auth_users (туда пишет NextAuth при входе через сайт),
// и возвращает JWT для дальнейших запросов из приложения.

import jwt from "jsonwebtoken";
import { getSupabaseAdmin } from "../../../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { email, googleSub } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email обязателен" });
  }

  try {
    const db = getSupabaseAdmin();

    // Ищем пользователя в auth_users — туда NextAuth пишет при входе через сайт
    const { data: user, error } = await db
      .from("auth_users")
      .select("email, name, image")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: "Аккаунт не найден. Сначала войдите через сайт.",
      });
    }

    // Выдаём JWT — такой же секрет как NEXTAUTH_SECRET
    const token = jwt.sign(
      { email: user.email, name: user.name },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token,
      message: "OK",
      user: {
        id: 1,
        username: user.name || user.email,
        role: "Administrator",
      },
    });
  } catch (err) {
    console.error("Mobile auth error:", err);
    return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
  }
}
