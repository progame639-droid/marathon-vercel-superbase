// pages/api/auth/me.js
//
// Мобильное приложение вызывает GET /api/auth/me при запуске
// чтобы проверить — валиден ли сохранённый JWT токен.
// Если токен истёк → возвращает 401 → приложение перенаправляет на логин.

import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Токен не предоставлен" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.NEXTAUTH_SECRET);
    return res.status(200).json({
      success: true,
      user: {
        email: payload.email,
        name: payload.name,
        role: "Administrator",
      },
    });
  } catch (err) {
    return res.status(401).json({ success: false, message: "Токен истёк или недействителен" });
  }
}
