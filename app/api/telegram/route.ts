import { NextRequest, NextResponse } from 'next/server'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`

export async function POST(req: NextRequest) {
  const body = await req.json()

  const chatId = body.message?.chat?.id
  const userMessage = body.message?.text

  if (!chatId || !userMessage) return NextResponse.json({ ok: true })

  // Запрос к OpenRouter
  const openaiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://railwaybot-production-82aa.up.railway.app',
      'X-Title': 'Telegram AI Bot',
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo',
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  const openaiData = await openaiRes.json()
  const aiReply = openaiData.choices?.[0]?.message?.content || 'Нет ответа 😢'

  // Отправляем ответ в Telegram
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: aiReply,
    }),
  })

  return NextResponse.json({ ok: true })
}
