import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://railwaybot-production-82aa.up.railway.app', // ← обязательно!
      'X-Title': 'Railway AI Bot',
    },
    body: JSON.stringify({
      model: 'openai/gpt-3.5-turbo', // можно заменить на любую доступную модель в openrouter
      messages: [
        {
          role: 'user',
          content: message,
        },
      ],
      max_tokens: 200,
    }),
  })

  const data = await response.json()
  console.log('🧾 OpenRouter Response:', JSON.stringify(data, null, 2))

  const reply = data?.choices?.[0]?.message?.content?.trim() || '[пустой ответ от OpenRouter]'
  return NextResponse.json({ reply })
}
