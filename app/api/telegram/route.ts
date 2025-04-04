import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY!,
})

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

const rateLimit = new Map<string, number>()
const lastPrompts = new Map<string, string>()

export async function POST(req: NextRequest) {
  const body = await req.json()
  const chatId = body.message?.chat?.id
  const fullText = body.message?.text?.trim()

  if (!chatId || !fullText) return NextResponse.json({ ok: true })

  console.log(`📥 [${chatId}] Получено сообщение:\n${fullText}`)

  const parts = fullText.split('\n').map(p => p.trim()).filter(Boolean)
  const first = parts[0].toLowerCase()
  const prompt = first.startsWith('/img ') ? parts[0].slice(5).trim() : null
  const otherMessages = parts.slice(prompt ? 1 : 0)

  // === Генерация изображения ===
  if (prompt) {
    if (lastPrompts.get(chatId) === prompt) {
      console.log(`⚠️ [${chatId}] Повторный prompt, пропускаем`)
    } else {
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
      } else {
        rateLimit.set(chatId, Date.now())
        lastPrompts.set(chatId, prompt)

        try {
          console.log(`🧠 [${chatId}] Генерация изображения: ${prompt}`)

          const result = await fal.subscribe('fal-ai/fast-sdxl', {
            input: {
              prompt,
              negative_prompt: 'ugly, scary, deformed, creepy, disfigured, extra limbs, bad anatomy',
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
      }
    }
  }

  // === Остальной текст → AI через OpenRouter ===
  for (const message of otherMessages) {
    try {
      console.log(`💬 [${chatId}] AI-вопрос: ${message}`)

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://railwaybot-production-82aa.up.railway.app',
          'X-Title': 'Telegram AI Bot',
        },
        body: JSON.stringify({
          model: 'mistralai/mistral-7b-instruct-v0.3',
          messages: [{ role: 'user', content: message }],
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
  }

  return NextResponse.json({ ok: true })
}
