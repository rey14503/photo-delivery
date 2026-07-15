import { CreateAlbumForm } from '@/components/CreateAlbumForm'
import { TopNav } from '@/components/TopNav'

export default function NewAlbumPage() {
  return (
    <>
      <TopNav />
      <main style={{ padding: '32px 28px', maxWidth: '720px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f4f4f5', marginBottom: '24px' }}>Create album</h1>
        <CreateAlbumForm />
      </main>
    </>
  )
}
