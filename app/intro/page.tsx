import Link from 'next/link'

export default function IntroPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #080808 0%, #0a0a0a 60%, #090909 100%)',
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    }}>

      {/* Hero */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px 40px', textAlign: 'center',
      }}>

        {/* 로고 */}
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(240,236,224,0.4)',
          marginBottom: 28,
        }}>
          <svg width="26" height="20" viewBox="0 0 26 20" fill="none">
            <line x1="2" y1="4" x2="24" y2="4" stroke="rgba(4,7,0,0.9)" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="2" y1="10" x2="24" y2="10" stroke="rgba(4,7,0,0.9)" strokeWidth="2.4" strokeLinecap="round" />
            <line x1="2" y1="16" x2="16" y2="16" stroke="rgba(4,7,0,0.9)" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>

        {/* 태그라인 */}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', color: '#605850', marginBottom: 16, textTransform: 'uppercase' }}>
          Daily Chord Challenge
        </div>

        <h1 style={{
          fontSize: 36, fontWeight: 900, color: '#f0ece0',
          letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 18,
        }}>
          매일 코드,<br />매일 성장
        </h1>

        <p style={{ fontSize: 15, color: '#605850', lineHeight: 1.8, maxWidth: 300, marginBottom: 48 }}>
          AI가 매일 코드 진행을 내고<br />
          연주 영상을 올려 함께 연습해요
        </p>

        {/* 미리보기 카드 */}
        <div style={{
          width: '100%', maxWidth: 340,
          background: 'linear-gradient(145deg, #111110, #0d0d0c)',
          border: '1px solid rgba(240,236,224,0.15)',
          borderRadius: 20, padding: '20px 20px 16px',
          marginBottom: 40,
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#605850', letterSpacing: '0.12em', marginBottom: 12, textAlign: 'left' }}>
            TODAY&apos;S CHALLENGE
          </div>

          {/* 가짜 악보 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {['Cmaj7', 'Am7', 'Dm7', 'G7'].map((chord, i) => (
              <div key={i} style={{
                flex: 1, padding: '10px 4px',
                background: 'rgba(240,236,224,0.06)',
                border: '1px solid rgba(240,236,224,0.12)',
                borderRadius: 10, textAlign: 'center',
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#f8f4ec', letterSpacing: '-0.02em' }}>{chord}</div>
                <div style={{ fontSize: 9, color: '#403830', marginTop: 3 }}>♩</div>
              </div>
            ))}
          </div>

          {/* 가짜 업로드 버튼 */}
          <div style={{
            padding: '11px', borderRadius: 12, textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 13, fontWeight: 800,
          }}>
            챌린지 참여하기
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 340 }}>
          <Link href="/login" style={{
            display: 'block', padding: '16px', borderRadius: 14, textAlign: 'center',
            background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
            color: '#0a0a08', fontSize: 16, fontWeight: 900,
            textDecoration: 'none',
            boxShadow: '0 8px 28px rgba(240,236,224,0.35)',
            letterSpacing: '-0.01em',
          }}>
            지금 시작하기
          </Link>
          <Link href="/" style={{
            display: 'block', padding: '14px', borderRadius: 14, textAlign: 'center',
            background: 'transparent',
            border: '1px solid rgba(240,236,224,0.15)',
            color: '#605850', fontSize: 14, fontWeight: 700,
            textDecoration: 'none',
          }}>
            피드 구경하기
          </Link>
        </div>
      </div>

      {/* 기능 소개 */}
      <div style={{
        padding: '40px 24px 60px', maxWidth: 400, margin: '0 auto', width: '100%',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { icon: '🎹', title: 'AI 코드 챌린지', desc: '매일 낮 12시, 새로운 코드 진행이 올라와요' },
            { icon: '🎬', title: '연주 영상 공유', desc: '나의 연주를 올리고 다른 사람과 비교해요' },
            { icon: '🔥', title: '연속 참여 기록', desc: '매일 참여해서 스트릭을 이어가세요' },
          ].map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              background: 'rgba(240,236,224,0.04)',
              border: '1px solid rgba(240,236,224,0.08)',
              borderRadius: 16, padding: '16px 18px',
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e0dcd0', marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: '#403830', lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
