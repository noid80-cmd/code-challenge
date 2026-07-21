export default function AcademyCard({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href="https://www.khmusic.co.kr"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: compact ? 14 : 18,
        textDecoration: 'none',
        background: 'linear-gradient(145deg, #111110, #0d0d0c)',
        border: '1px solid rgba(240,236,224,0.15)',
        borderRadius: compact ? 18 : 22,
        padding: compact ? '16px 18px' : '22px 24px',
      }}
    >
      <div style={{
        width: compact ? 44 : 52, height: compact ? 44 : 52, borderRadius: 14, flexShrink: 0,
        background: 'linear-gradient(135deg, #f8f4ec, #c8c4b0)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: compact ? 15 : 17, fontWeight: 900, color: '#0a0a08',
      }}>
        KH
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 14 : 16, fontWeight: 900, color: '#f0ece0', letterSpacing: '-0.01em', marginBottom: 3 }}>
          KH Music이 만든 앱이에요
        </div>
        <div style={{ fontSize: compact ? 12 : 13, color: '#605850', lineHeight: 1.5 }}>
          입시 코드·리듬·멜로디 초견 전문 학원의 노하우를 담았어요
        </div>
      </div>
      <span style={{ fontSize: 13, color: '#a0988c', fontWeight: 700, flexShrink: 0 }}>→</span>
    </a>
  )
}
