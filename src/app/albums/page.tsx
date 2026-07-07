import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function AlbumsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const albums = await prisma.album.findMany({
    where: session.user.role === 'ADMIN' ? {} : { ownerId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main>
      <h1>Albums</h1>
      <Link href="/albums/new">Create album</Link>
      <ul>
        {albums.map((album) => (
          <li key={album.id}>
            {album.name} — {album.clientName}
          </li>
        ))}
      </ul>
    </main>
  )
}
