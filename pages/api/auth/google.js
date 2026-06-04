// pages/api/auth/google.js
//
// ❗ ПРОБЛЕМА: В вашем репо этот файл называется "api_auth_google.js"
//    Из-за этого мобильное приложение получает 404 при обращении к /api/auth/google
//    ПЕРЕИМЕНУЙТЕ файл: api_auth_google.js → google.js
//
// Мобильное приложение делает POST /api/auth/google с { email, google_sub }
// Сервер проверяет email в таблице auth_users и выдаёт JWT

import jwt from "jsonwebtoken";
import { getSupabaseAdmin } from "../../../lib/supabase";

export default async function handler(req, res) {
  // CORS — обязательно для мобильного приложения
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  // ❗ Принимаем оба варианта — мобильное приложение шлёт google_sub (snake_case)
  const { email, google_sub, googleSub } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email обязателен" });
  }

  try {
    const db = getSupabaseAdmin();

    // Ищем пользователя в auth_users (туда пишет NextAuth при входе через сайт)
    const { data: user, error } = await db
      .from("auth_users")
      .select("email, name, image, google_id")
      .eq("email", email.toLowerCase())
      .single();

    if (error || !user) {
      console.log(`Google mobile auth: user not found for email=${email}`);
      return res.status(401).json({
        success: false,
        message: "Аккаунт не найден. Сначала войдите через сайт марафона.",
      });
    }

    // ❗ Используем NEXTAUTH_SECRET — тот же секрет что в [...nextauth].js
    //    Это позволяет participants/index.js проверять оба типа токенов одинаково
    if (!process.env.NEXTAUTH_SECRET) {
      console.error("NEXTAUTH_SECRET не установлен в переменных окружения!");
      return res.status(500).json({ success: false, message: "Ошибка конфигурации сервера" });
    }

    const token = jwt.sign(
      {
        email: user.email,
        name: user.name,
      },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token,
      message: "Успешный вход через Google",
      user: {
        id: 1,
        username: user.name || user.email,
        role: "Administrator",
      },
    });
  } catch (err) {
    console.error("Google mobile auth error:", err);
    return res.status(500).json({ success: false, message: "Внутренняя ошибка сервера" });
  }
}
