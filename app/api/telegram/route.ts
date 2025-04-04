import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY!,
})

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const chatId = body.message?.chat?.id
  const text = body.message?.text

  if (!chatId || !text) return NextResponse.json({ ok: true })

  console.log('📥 Получено сообщение:', text)

  if (text.toLowerCase().startsWith('/img ')) {
    const prompt = text.slice(5).trim()

    try {
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

  // AI-ответ от OpenRouter
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
        model: 'openai/gpt-3.5-turbo',
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
