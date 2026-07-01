import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const where: any = {}
  if (from || to) {
    where.dutyDate = {}
    if (from) where.dutyDate.gte = new Date(from + 'T00:00:00.000Z')
    if (to) where.dutyDate.lte = new Date(to + 'T23:59:59.999Z')
  }

  const duties = await prisma.duty.findMany({
    where,
    orderBy: { dutyDate: 'asc' },
    take: 1000
  })
  return NextResponse.json(duties)
}

export async function PATCH(req: NextRequest) {
  const { id, completed } = await req.json()
  const duty = await prisma.duty.update({
    where: { id },
    data: { completed: !!completed }
  })
  return NextResponse.json(duty)
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({error: 'id required'}, {status: 400})
  await prisma.duty.delete({ where: { id }})
  return NextResponse.json({ok: true})
}
