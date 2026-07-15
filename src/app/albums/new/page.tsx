import { CreateAlbumForm } from '@/components/CreateAlbumForm'
import { TopNav } from '@/components/TopNav'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export default async function NewAlbumPage() {
  const session = await getServerSession(authOptions)

  return (
    <>
      <TopNav
        userName={session?.user?.name}
        userEmail={session?.user?.email}
        avatarUrl={session?.user?.avatarUrl}
        studioName={session?.user?.studioName}
        role={session?.user?.role}
      />
      <main style={{ padding: '32px 28px', maxWidth: '720px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '24px' }}>Create album</h1>
        <CreateAlbumForm />
      </main>
    </>
  )
}
