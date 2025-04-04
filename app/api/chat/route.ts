import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message } = await req.json()

  const res = await fetch('https://api.openai.com/v1/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-davinci-003',
      prompt: message,
      max_tokens: 100,
    }),
  })

  const data = await res.json()

  console.log('🧾 RAW OpenAI Response:', JSON.stringify(data, null, 2))

  // Пытаемся вернуть текст, если есть
  const reply = data?.choices?.[0]?.text?.trim() || '[нет ответа от OpenAI]'
  return NextResponse.json({ reply })
}
