'use client'
import { useState } from 'react'

export default function Home() {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    setLoading(true)
    setReply('')

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })

    const data = await res.json()
    setReply(data.reply)
    setLoading(false)
  }

  return (
    <main className="p-8 max-w-xl mx-auto font-sans">
      <h1 className="text-2xl font-bold mb-4">🤖 AI Chat</h1>
      <textarea
        rows={4}
        className="w-full border rounded p-2 mb-2"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Введите вопрос..."
      />
      <button
        onClick={sendMessage}
        className="bg-blue-600 text-white px-4 py-2 rounded"
        disabled={loading}
      >
        {loading ? 'Ждём ответ...' : 'Отправить'}
      </button>
      {reply && (
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <strong>Ответ:</strong>
          <p>{reply}</p>
        </div>
      )}
    </main>
  )
}
