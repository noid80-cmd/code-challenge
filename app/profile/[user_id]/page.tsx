'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { use } from 'react'

const supabase = createClient()

type Profile = { name: string; avatar_url: string | null }
type Submission = {
  id: string; video_url: string; thumbnail_url: string | null
  caption: string | null; likes_count: number; created_at: string
  challenges: { title: string; date: string }[] | null
}

function getPublicUrl(path: string) {
  if (path.startsWith('http')) return path
  return supabase.storage.from('videos').getPublicUrl(path).data.publicUrl
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function ProfilePage({ params }: { params: Promise<{ user_id: string }> }) {
  const { user_id } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: prof }, { data: subs }] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url').eq('id', user_id).single(),
        supabase.from('submissions')
          .select('id, video_url, thumbnail_url, caption, likes_count, created_at, challenges(title, date)')
          .eq('user_id', user_id)
          .order('created_at', { ascending: false }),
      ])
      setProfile(prof)
      setSubmissions(subs ?? [])
      setLoading(false)
    }
    load()
  }, [user_id])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <header style={{
        padding: '0 20px', height: 54,
        display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(240,236,224,0.08)',
        position: 'sticky', top: 0,
        background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(12px)', zIndex: 10,
      }}>
        <button onClick={() => router.back()} style={{
          background: 'none', border: 'none', color: '#a0988c',
          fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1,
        }}>←</button>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#f0ece0' }}>
          {profile?.name ?? ''}
        </span>
      </header>

      <main style={{ maxWidth: 560, margin: '0 auto', padding: '32px 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#303028', paddingTop: 60 }}>불러오는 중...</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 36 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 900, color: '#0a0a08',
                boxShadow: '0 4px 20px rgba(240,236,224,0.3)',
              }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : (profile?.name ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.02em' }}>
                  {profile?.name ?? '익명'}
                </div>
                <div style={{ fontSize: 13, color: '#504840', marginTop: 4 }}>
                  영상 {submissions.length}개
                </div>
              </div>
            </div>

            {submissions.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#303028', paddingTop: 40, fontSize: 14 }}>
                아직 올린 영상이 없어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {submissions.map(sub => (
                  <div key={sub.id} style={{
                    background: 'linear-gradient(145deg, #111110, #0d0d0c)',
                    border: '1px solid rgba(240,236,224,0.1)',
                    borderRadius: 20, overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  }}>
                    <video
                      src={getPublicUrl(sub.video_url)}
                      poster={sub.thumbnail_url ? getPublicUrl(sub.thumbnail_url) : undefined}
                      controls playsInline preload="metadata"
                      style={{ width: '100%', display: 'block', background: '#000', maxHeight: 460, objectFit: 'contain' }}
                    />
                    <div style={{ padding: '12px 16px 14px' }}>
                      {sub.challenges?.[0] && (
                        <div style={{ fontSize: 11, color: '#504840', fontWeight: 700, marginBottom: 4 }}>
                          {sub.challenges[0].date} · {sub.challenges[0].title}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#303028' }}>{timeAgo(sub.created_at)}</span>
                        <span style={{ fontSize: 13, color: '#504840', fontWeight: 700 }}>♥ {sub.likes_count}</span>
                      </div>
                      {sub.caption && (
                        <p style={{ fontSize: 13, color: '#7a6020', marginTop: 8, lineHeight: 1.6 }}>{sub.caption}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
