import sharp from 'sharp'

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f8f4ec"/>
      <stop offset="100%" stop-color="#c8c4b0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <line x1="116" y1="182" x2="396" y2="182" stroke="#0a0a08" stroke-width="54" stroke-linecap="round"/>
  <line x1="116" y1="256" x2="396" y2="256" stroke="#0a0a08" stroke-width="54" stroke-linecap="round"/>
  <line x1="116" y1="330" x2="280" y2="330" stroke="#0a0a08" stroke-width="54" stroke-linecap="round"/>
</svg>`

const buf = Buffer.from(svg)

await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')

console.log('아이콘 생성 완료!')
