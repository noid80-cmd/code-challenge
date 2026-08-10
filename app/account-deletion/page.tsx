export default function AccountDeletionPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#eeeeee', background: '#0a0a08', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>계정 및 데이터 삭제</h1>
      <p style={{ color: '#888', marginBottom: 40 }}>Account &amp; Data Deletion</p>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>삭제 요청 방법 / How to Request Deletion</h2>
        <p>
          앱에 로그인한 상태라면 &lsquo;내 성장 기록&rsquo; 페이지 하단의 &lsquo;계정 삭제&rsquo; 버튼으로 즉시 계정을 삭제할 수 있습니다.
          <br />
          If you&rsquo;re logged in, you can delete your account instantly using the &lsquo;Delete Account&rsquo; button at the bottom of the &lsquo;My Records&rsquo; page.
        </p>
        <p style={{ marginTop: 16 }}>
          앱을 이용할 수 없는 경우 아래 이메일로 가입하신 계정의 이메일 주소를 포함해 요청해주세요.
          <br />
          If you can&rsquo;t access the app, please email us at the address below with the email address associated with your account.
        </p>
        <p style={{ marginTop: 16 }}>
          <a href="mailto:noid80@hanmail.net?subject=계정%20삭제%20요청" style={{ color: '#4f46e5', fontWeight: 700 }}>
            noid80@hanmail.net
          </a>
        </p>
      </section>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>삭제되는 데이터 / What Gets Deleted</h2>
        <ul style={{ paddingLeft: 20 }}>
          <li>계정 정보 (이메일, 프로필 이름 및 사진) — Account info (email, profile name and photo)</li>
          <li>업로드한 연주 영상 — Uploaded performance videos</li>
          <li>좋아요 및 활동 기록 — Likes and activity history</li>
        </ul>
        <p style={{ marginTop: 16 }}>
          요청 확인 후 30일 이내에 모든 데이터가 삭제됩니다.
          <br />
          All data will be deleted within 30 days of confirming your request.
        </p>
      </section>
    </div>
  )
}
