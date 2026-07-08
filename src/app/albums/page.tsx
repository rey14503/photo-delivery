import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { albumScopeFor } from '@/lib/album-scope'

export default async function AlbumsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/api/auth/signin')
  }

  const albums = await prisma.album.findMany({
    where: albumScopeFor(session.user),
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main>
      <h1>Albums</h1>
      <Link href="/albums/new">Create album</Link>
      <ul>
        {albums.map((album) => (
          <li key={album.id}>
            <Link href={`/albums/${album.id}`}>
              {album.name} — {album.clientName}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
