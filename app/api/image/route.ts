import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY!,
})

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()

  const result = await fal.subscribe('fal-ai/recraft-20b', {
    input: {
      prompt,
    },
    logs: true,
    onQueueUpdate(update) {
      if (update.status === 'IN_PROGRESS') {
        update.logs?.forEach((log) => console.log('🧪 Log:', log.message))
      }
    },
  })

  // В результатах должен быть URL на изображение
  const image = result?.data?.image || '[изображение не сгенерировано]'
  return NextResponse.json({ image, requestId: result.requestId })
}
