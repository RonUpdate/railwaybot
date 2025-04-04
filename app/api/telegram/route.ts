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

  const parts = fullText.split('\n').map((p: string) => p.trim()).filter(Boolean)
  const first = parts[0].toLowerCase()
  const prompt = first.startsWith('/img ') ? parts[0].slice(5).trim() : null
  const otherMessages = parts.slice(prompt ? 1 : 0)

  if (prompt) {
    if (lastPrompts.get(chatId) === prompt) {
      console.log(`⚠️ [${chatId}] Повторный prompt, пропускаем`)
    } else {
      const lastTime = rateLimit.get(chatId)
      if (lastTime && Date.now() - lastTime < 30_000) {
        console.log(`🚫 [${chatId}] Слишком частый запрос`)
        await sendText(chatId, '⏱ Подожди немного перед новой генерацией.')
      } else {
        rateLimit.set(chatId, Date.now())
        lastPrompts.set(chatId, prompt)

        try {
          const stablePrompt = `(${prompt}), trending on artstation, 8k, ultra realistic, concept art, cinematic lighting, detailed`

          const result = await fal.subscribe('fal-ai/fast-sdxl', {
            input: {
              prompt: stablePrompt,
              negative_prompt: 'ugly, deformed, dark, creepy, blurry, bad anatomy',
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

          const images = result?.data?.images
          const imageUrl = images?.[0]?.url

          if (images && images.length > 0 && imageUrl && imageUrl.startsWith('https://')) {
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
            await sendText(chatId, '🕳 Модель не вернула изображение. Попробуй конкретнее.')
          }
        } catch (err) {
          console.error('🔥 Ошибка генерации:', err)
          await sendText(chatId, '⚠️ Ошибка генерации изображения.')
        }
      }
    }
  }

  for (const message of otherMessages) {
    try {
      console.log(`🔎 [${chatId}] AI-вопрос: ${message}`)

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://railwaybot-production-82aa.up.railway.app',
          'X-Title': 'Telegram AI Bot',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o:online',
          messages: [{ role: 'user', content: message }],
        }),
      })

      const data = await res.json()
      const reply = data.choices?.[0]?.message?.content || '🤖 Нет ответа.'

      await sendText(chatId, reply)
    } catch (err) {
      console.error('❌ Ошибка AI:', err)
      await sendText(chatId, '⚠️ Ошибка при получении ответа от ИИ.')
    }
  }

  return NextResponse.json({ ok: true })
}

async function sendText(chatId: number, text: string) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}
