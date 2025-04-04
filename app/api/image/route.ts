import { NextRequest, NextResponse } from 'next/server'
import { fal } from '@fal-ai/client'

fal.config({
  credentials: process.env.FAL_KEY!,
})

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()

  const result = await fal.subscribe('fal-ai/recraft-20b', {
    input: { prompt },
    logs: true,
    onQueueUpdate(update) {
      if (update.status === 'IN_PROGRESS') {
        update.logs?.forEach((log) => console.log('🧪 Log:', log.message))
      }
    },
  })

  const image = result?.data?.images?.[0]?.url || '[не удалось сгенерировать]'
  return NextResponse.json({ image, requestId: result.requestId })
}
