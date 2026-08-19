// 챌린지 타입별 포인트 컬러. 전체 톤은 다크를 유지하되, 이 색으로만
// 타입 구분/CTA/강조를 표현한다.
export const TYPE_COLORS = {
  chord: {
    grad: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
    solid: '#8b5cf6',
    glow: 'rgba(139,92,246,0.45)',
    glowSoft: 'rgba(139,92,246,0.14)',
    border: 'rgba(139,92,246,0.35)',
  },
  rhythm: {
    grad: 'linear-gradient(135deg, #67e8f9, #0891b2)',
    solid: '#22d3ee',
    glow: 'rgba(34,211,238,0.45)',
    glowSoft: 'rgba(34,211,238,0.14)',
    border: 'rgba(34,211,238,0.35)',
  },
  melody: {
    grad: 'linear-gradient(135deg, #f9a8d4, #db2777)',
    solid: '#ec4899',
    glow: 'rgba(236,72,153,0.45)',
    glowSoft: 'rgba(236,72,153,0.14)',
    border: 'rgba(236,72,153,0.35)',
  },
} as const

export type ChallengeType = keyof typeof TYPE_COLORS
