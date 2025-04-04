import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`
const FAL_KEY = process.env.FAL_KEY!

export async function POST(req: NextRequest) {
  const body = await req.json()
  const chatId = body.message?.chat?.id
  const text = body.message?.text

  if (!chatId || !text) return NextResponse.json({ ok: true })

  console.log('📥 Получено сообщение:', text)

  if (text.toLowerCase().startsWith('/img ')) {
    const prompt = text.slice(5).trim()

    try {
      const submission = await fetch('https://queue.fal.run/fal-ai/fast-sdxl', {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          image_size: 'square_hd',
        }),
      })

      const submissionData = await submission.json()
      const requestId = submissionData?.request_id
      if (!requestId) throw new Error('FAL не вернул request_id')

      let result = null
      let attempts = 0
      while (attempts < 20) {
        const res = await fetch(`https://queue.fal.run/fal-ai/fast-sdxl/requests/${requestId}`, {
          method: 'GET',
          headers: {
            Authorization: `Key ${FAL_KEY}`,
          },
        })

        const data = await res.json()
        if (data?.status === 'COMPLETED') {
          result = data
          break
        }

        await new Promise((r) => setTimeout(r, 3000))
        attempts++
      }

      const imageUrl = result?.images?.[0]?.url
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
        console.error('❌ Не удалось получить изображение:', result)
        await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: '😿 Картинку не удалось сгенерировать.',
          }),
        })
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

  // === Ответ от OpenRouter
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

  return NextResponse.json({ ok: true })
}
