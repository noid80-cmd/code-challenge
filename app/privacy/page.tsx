export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#eeeeee', background: '#0a0a08', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>개인정보처리방침</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>Privacy Policy — Last updated: 2026-08-05</p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>1. 수집하는 정보 / Information We Collect</h2>
        <p>초견챌린지는 서비스 제공을 위해 다음 정보를 수집합니다:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>이메일 주소 및 계정 정보 (Email address and account information)</li>
          <li>프로필 이름 및 사진 (Profile name and photo)</li>
          <li>업로드한 연주 영상 (Uploaded performance videos)</li>
          <li>앱 사용 데이터 (App usage data)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>2. 정보 이용 목적 / How We Use Your Information</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>서비스 제공 및 계정 관리 (Service provision and account management)</li>
          <li>연주 영상 업로드 및 학습 비교 기능 제공 (Uploading performances and peer comparison for learning)</li>
          <li>매일 새로운 초견 챌린지 생성 (Generating daily sight-reading challenges)</li>
          <li>앱 개선 및 분석 (App improvement and analytics)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>3. 정보 공유 / Information Sharing</h2>
        <p>초견챌린지는 다음의 경우를 제외하고 개인정보를 제3자와 공유하지 않습니다:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>사용자의 동의가 있는 경우 (With your consent)</li>
          <li>법적 의무 이행이 필요한 경우 (When required by law)</li>
          <li>서비스 운영에 필요한 제3자 서비스 제공업체 (Service providers: Supabase, Vercel, Anthropic)</li>
        </ul>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>4. 데이터 보관 / Data Retention</h2>
        <p>계정 삭제 시 모든 개인정보 및 업로드 콘텐츠는 30일 이내에 삭제됩니다.<br />
        Upon account deletion, all personal data and uploaded content will be deleted within 30 days.</p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>5. 사용자 권리 / Your Rights</h2>
        <p>사용자는 언제든지 자신의 데이터에 대한 열람, 수정, 삭제를 요청할 수 있습니다.<br />
        You may request access, correction, or deletion of your data at any time.</p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>6. 미성년자 / Children</h2>
        <p>초견챌린지는 만 14세 미만 아동의 개인정보를 의도적으로 수집하지 않습니다.<br />
        We do not knowingly collect personal information from children under 14.</p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>7. 문의 / Contact</h2>
        <p>개인정보 관련 문의: <a href="mailto:noid80@hanmail.net" style={{ color: '#4f46e5' }}>noid80@hanmail.net</a></p>
      </section>
    </div>
  )
}
