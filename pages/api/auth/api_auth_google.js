// ============================================================
// Файл: pages/api/auth/google.js  (или app/api/auth/google/route.js)
// Добавить в ваш Vercel проект рядом с pages/api/auth/login.js
// ============================================================
//
// Этот endpoint получает email от мобильного приложения,
// проверяет что он есть в таблице admin_users в Supabase,
// и возвращает JWT для дальнейших запросов.

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // service_role key — только на сервере!
);

const JWT_SECRET = process.env.JWT_SECRET; // добавьте в Vercel Environment Variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const { email, googleSub } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email обязателен' });
  }

  try {
    // Ищем пользователя в таблице admin_users по email
    // Создайте таблицу: CREATE TABLE admin_users (id serial, email text unique, username text, role text);
    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('id, username, role, email')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !adminUser) {
      return res.status(401).json({
        success: false,
        message: 'Этот Google-аккаунт не зарегистрирован как администратор'
      });
    }

    // Создаём JWT токен (точно такой же формат, как при логине по паролю)
    const token = jwt.sign(
      {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        email: adminUser.email,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      token,
      message: 'OK',
      user: {
        id: adminUser.id,
        username: adminUser.username || adminUser.email,
        role: adminUser.role,
      }
    });

  } catch (err) {
    console.error('Google auth error:', err);
    return res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
}
