import { NextRequest, NextResponse } from 'next/server'

const FAL_KEY = process.env.FAL_KEY!

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()

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
    if (!imageUrl) throw new Error('Картинка не получена')

    return NextResponse.json({ image: imageUrl })
  } catch (err) {
    console.error('🔥 Ошибка генерации:', err)
    return NextResponse.json({ error: 'Ошибка генерации изображения' }, { status: 500 })
  }
}
