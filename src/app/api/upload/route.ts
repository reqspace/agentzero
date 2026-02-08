import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

export async function POST(request: Request) {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  await mkdir(uploadsDir, { recursive: true })

  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const paths: string[] = []

  for (const file of files) {
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filepath = path.join(uploadsDir, filename)
    await writeFile(filepath, buffer)
    paths.push(`/uploads/${filename}`)
  }

  return NextResponse.json({ paths })
}
