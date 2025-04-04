import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY!,
})

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

// Память для защиты (в пределах одного запуска)
const rateLimit = new Map<string, number>()
const lastPrompts = new Map<string, string>()

export async function POST(req: NextRequest) {
  const body = await req.json()
  const chatId = body.message?.chat?.id
  const text = body.message?.text?.trim()

  if (!chatId || !text) return NextResponse.json({ ok: true })

  console.log(`📥 [${chatId}] Получено сообщение:`, text)

  // === /img — генерация изображения через FAL ===
  if (/^\/img\s+/.test(text.toLowerCase())) {
    const prompt = text.slice(5).trim()

    // антиспам
    if (lastPrompts.get(chatId) === prompt) {
      console.log(`⚠️ [${chatId}] Повторный prompt, пропускаем`)
      return NextResponse.json({ ok: true })
    }

    const lastTime = rateLimit.get(chatId)
    if (lastTime && Date.now() - lastTime < 30_000) {
      console.log(`🚫 [${chatId}] Слишком частый запрос`)
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⏱ Подожди немного перед новой генерацией.',
        }),
      })
      return NextResponse.json({ ok: true })
    }

    rateLimit.set(chatId, Date.now())
    lastPrompts.set(chatId, prompt)

    try {
      console.log(`🧠 [${chatId}] Генерация изображения: ${prompt}`)

      const result = await fal.subscribe('fal-ai/fast-sdxl', {
        input: {
          prompt,
          image_size: 'square_hd',
          guidance_scale: 7.5,
          num_inference_steps: 25,
        },
        logs: true,
        onQueueUpdate(update) {
          if (update.status === 'IN_PROGRESS') {
            update.logs?.forEach(log => console.log('📡', log.message))
          }
        },
      })

      const imageUrl = result?.data?.images?.[0]?.url

      if (imageUrl) {
        await fetch(`${TELEGRAM_API}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: imageUrl,
            caption: `🖼 ${prompt}`,
          }),
        })
      } else {
        throw new Error('Картинка не сгенерирована.')
      }
    } catch (err) {
      console.error('🔥 Ошибка генерации:', err)
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '⚠️ Ошибка генерации изображения.',
        }),
      })
    }

    return NextResponse.json({ ok: true })
  }

  // === Текстовый AI-ответ через OpenRouter (с поиском) ===
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://railwaybot-production-82aa.up.railway.app',
        'X-Title': 'Telegram AI Bot',
      },
      body: JSON.stringify({
        model: 'perplexity/pplx-70b-chat',
        messages: [{ role: 'user', content: text }],
      }),
    })

    const data = await res.json()
    const reply = data.choices?.[0]?.message?.content || '🤖 Нет ответа.'

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
      }),
    })
  } catch (err) {
    console.error('❌ Ошибка OpenRouter:', err)
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '⚠️ Ошибка AI-ответа.',
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
