// шаг 1: отправка запроса
const submission = await fetch('https://queue.fal.run/fal-ai/recraft-20b', {
  method: 'POST',
  headers: {
    Authorization: `Key ${process.env.FAL_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt,
    image_size: 'square_hd',
    style: 'realistic_image',
  }),
})

const submissionData = await submission.json()
const requestId = submissionData?.request_id

if (!requestId) {
  throw new Error('Fal did not return request_id')
}

// шаг 2: ожидание результата (polling)
let result = null
let attempts = 0
while (attempts < 20) {
  const res = await fetch(`https://queue.fal.run/fal-ai/recraft-20b/requests/${requestId}`, {
    method: 'GET',
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
    },
  })

  const data = await res.json()
  if (data?.status === 'COMPLETED') {
    result = data
    break
  }

  await new Promise((r) => setTimeout(r, 3000)) // подождать 3 сек
  attempts++
}

const imageUrl = result?.images?.[0]?.url
