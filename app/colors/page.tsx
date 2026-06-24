export default function ColorsPage() {
  const palettes = [
    {
      name: 'Electric Cyan',
      sub: '테크 · 미래적',
      primary: '#00e5ff',
      primaryDark: '#00b8cc',
      bg: '#020d10',
      card: '#061418',
      border: 'rgba(0,229,255,0.18)',
      text: '#d0f8ff',
      muted: '#1a4a52',
      btnText: '#000',
    },
    {
      name: 'Hot Rose',
      sub: 'K-pop · 에너지',
      primary: '#ff2d78',
      primaryDark: '#cc1055',
      bg: '#0d0008',
      card: '#140010',
      border: 'rgba(255,45,120,0.18)',
      text: '#ffe0ee',
      muted: '#4a0020',
      btnText: '#fff',
    },
    {
      name: 'Cobalt Blue',
      sub: '소셜 · 신뢰감',
      primary: '#3b82f6',
      primaryDark: '#1d4ed8',
      bg: '#020510',
      card: '#050a18',
      border: 'rgba(59,130,246,0.18)',
      text: '#ddeeff',
      muted: '#0f254a',
      btnText: '#fff',
    },
    {
      name: 'Mint / Teal',
      sub: '프레시 · 트렌디',
      primary: '#10d9a0',
      primaryDark: '#0aaa7c',
      bg: '#020e0a',
      card: '#051410',
      border: 'rgba(16,217,160,0.18)',
      text: '#d0fff0',
      muted: '#0a3828',
      btnText: '#000',
    },
    {
      name: 'Fuchsia',
      sub: 'Twitch · 크리에이터',
      primary: '#d946ef',
      primaryDark: '#a21caf',
      bg: '#0a0010',
      card: '#110018',
      border: 'rgba(217,70,239,0.18)',
      text: '#f5d0ff',
      muted: '#380050',
      btnText: '#fff',
    },
    {
      name: 'Warm Ivory',
      sub: '미니멀 · 프리미엄',
      primary: '#f0ece0',
      primaryDark: '#c8c4b0',
      bg: '#080808',
      card: '#101010',
      border: 'rgba(240,236,224,0.15)',
      text: '#f0ece0',
      muted: '#303030',
      btnText: '#000',
    },
    {
      name: 'Solar Orange',
      sub: '임팩트 · 스포티',
      primary: '#ff6b00',
      primaryDark: '#cc5000',
      bg: '#0d0500',
      card: '#140800',
      border: 'rgba(255,107,0,0.18)',
      text: '#ffe8d0',
      muted: '#4a2000',
      btnText: '#000',
    },
    {
      name: 'Sky Blue',
      sub: '가볍고 모던',
      primary: '#38bdf8',
      primaryDark: '#0ea5e9',
      bg: '#020810',
      card: '#050f18',
      border: 'rgba(56,189,248,0.18)',
      text: '#e0f4ff',
      muted: '#0a2840',
      btnText: '#000',
    },
    {
      name: 'Violet Purple',
      sub: 'Discord · 커뮤니티',
      primary: '#7c3aed',
      primaryDark: '#5b21b6',
      bg: '#07000f',
      card: '#0f0020',
      border: 'rgba(124,58,237,0.18)',
      text: '#ede0ff',
      muted: '#2a0060',
      btnText: '#fff',
    },
    {
      name: 'Rose Gold',
      sub: '감성 · 여성적',
      primary: '#fb7185',
      primaryDark: '#e11d48',
      bg: '#0d0408',
      card: '#150810',
      border: 'rgba(251,113,133,0.18)',
      text: '#ffe4e8',
      muted: '#4a1028',
      btnText: '#000',
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '40px 20px 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8, letterSpacing: '-0.02em' }}>
            시그니처 컬러 선택
          </h1>
          <p style={{ color: '#444', fontSize: 14 }}>각 카드를 보고 마음에 드는 걸 알려주세요</p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 20,
        }}>
          {palettes.map(p => (
            <div key={p.name} style={{
              background: p.bg,
              border: `1px solid ${p.border}`,
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
            }}>
              {/* Mini header */}
              <div style={{
                padding: '12px 16px',
                background: `${p.bg}ee`,
                borderBottom: `1px solid ${p.border}`,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`,
                  boxShadow: `0 3px 8px ${p.primary}55`,
                }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: p.text, letterSpacing: '-0.01em' }}>
                  코드 챌린지
                </span>
              </div>

              {/* Mini card */}
              <div style={{ padding: 14 }}>
                <div style={{
                  background: p.card,
                  border: `1px solid ${p.border}`,
                  borderRadius: 14, padding: '14px',
                  marginBottom: 10,
                  boxShadow: `0 4px 20px ${p.primary}18`,
                }}>
                  {/* Date badge */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: p.primary }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: p.primary, letterSpacing: '0.1em' }}>
                      오늘의 챌린지
                    </span>
                  </div>
                  {/* Chords */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {['Cmaj7', 'Am7', 'Dm7', 'G7'].map(c => (
                      <span key={c} style={{
                        padding: '3px 8px', borderRadius: 5,
                        background: `${p.primary}14`,
                        border: `1px solid ${p.primary}30`,
                        fontSize: 10, fontWeight: 800, color: p.primary,
                      }}>{c}</span>
                    ))}
                  </div>
                  {/* Button */}
                  <div style={{
                    padding: '9px', borderRadius: 9, textAlign: 'center',
                    background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`,
                    fontSize: 11, fontWeight: 800, color: p.btnText,
                    boxShadow: `0 4px 14px ${p.primary}40`,
                  }}>
                    챌린지 참여하기
                  </div>
                </div>

                {/* Mini submission card */}
                <div style={{
                  background: p.card,
                  border: `1px solid ${p.border}`,
                  borderRadius: 12, padding: '10px 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 800, color: p.btnText,
                    }}>김</div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: p.text }}>김민준</div>
                      <div style={{ fontSize: 9, color: p.muted }}>방금</div>
                    </div>
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: p.primary,
                    background: `${p.primary}12`,
                    border: `1px solid ${p.primary}30`,
                    padding: '3px 8px', borderRadius: 6,
                  }}>♥ 24</div>
                </div>
              </div>

              {/* Label */}
              <div style={{
                padding: '10px 14px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: p.text }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: p.muted, marginTop: 2 }}>{p.sub}</div>
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${p.primary}, ${p.primaryDark})`,
                  boxShadow: `0 4px 12px ${p.primary}55`,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
