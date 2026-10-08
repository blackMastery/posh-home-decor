// Dev-only setup: creates the shared admin login, renders placeholder product
// photos and static brand images, and uploads them to local Supabase Storage.
//
//   npm run seed:dev        (after `supabase db reset`)
//
// Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL and
// ADMIN_PASSWORD from .env.local.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { randomUUID } from 'node:crypto'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD

if (!url || !serviceKey) throw new Error('Missing Supabase env vars (run with --env-file=.env.local)')
if (!url.includes('127.0.0.1') && !url.includes('localhost')) {
  throw new Error('seed-dev only runs against a local Supabase instance')
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } })

// ---------------------------------------------------------------------------
// Admin user
// ---------------------------------------------------------------------------

async function ensureAdmin() {
  if (!adminEmail || !adminPassword) {
    console.log('• ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user')
    return
  }
  const { data: list } = await db.auth.admin.listUsers()
  let user = list?.users.find((u) => u.email === adminEmail)
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    })
    if (error) throw error
    user = data.user
  } else {
    await db.auth.admin.updateUserById(user.id, { password: adminPassword })
  }
  const { error } = await db.from('admins').upsert({ user_id: user.id })
  if (error) throw error
  console.log(`• Admin login ready: ${adminEmail} (password in .env.local)`)
}

// ---------------------------------------------------------------------------
// Placeholder art (SVG → JPEG via sharp)
// ---------------------------------------------------------------------------

const W = 1600
const H = 2000

function backdrop(top, bottom, floor = '#E6D7BC') {
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
      </linearGradient>
      <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#3E0710" stop-opacity="0.28"/>
        <stop offset="1" stop-color="#3E0710" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F1D79C"/><stop offset="0.5" stop-color="#C9A050"/><stop offset="1" stop-color="#8E6A2A"/>
      </linearGradient>
      <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="${floor}"/>
    <ellipse cx="${W / 2}" cy="${H * 0.74}" rx="520" ry="70" fill="url(#shadow)"/>`
}

const art = {
  jar: (v) => `
    ${backdrop(v ? '#F4EADB' : '#EFE4CF', '#E5D3B3')}
    <g transform="translate(${W / 2} ${H * 0.73})">
      <path d="M-260 0 C-380 -260 -380 -620 -230 -760 L230 -760 C380 -620 380 -260 260 0 Z" fill="#F7F0E1"/>
      <path d="M-260 0 C-380 -260 -380 -620 -230 -760 L230 -760 C380 -620 380 -260 260 0 Z" fill="none" stroke="url(#gold)" stroke-width="10"/>
      <g stroke="url(#gold)" stroke-width="7" opacity="0.9">
        ${Array.from({ length: 9 }, (_, i) => `<line x1="${-300 + i * 75}" y1="-80" x2="${-300 + i * 75 + 160}" y2="-680"/><line x1="${300 - i * 75}" y1="-80" x2="${300 - i * 75 - 160}" y2="-680"/>`).join('')}
      </g>
      <rect x="-200" y="-830" width="400" height="80" rx="18" fill="#F7F0E1" stroke="url(#gold)" stroke-width="8"/>
      <path d="M-150 -830 C-150 -960 150 -960 150 -830 Z" fill="url(#gold)"/>
      <circle cy="-950" r="30" fill="url(#gold)"/>
      <rect x="-330" y="-760" width="200" height="760" fill="url(#shine)" opacity="0.5"/>
    </g>`,
  holders: (v) => `
    ${backdrop(v ? '#F3E9D6' : '#EDE0C6', '#DDC7A0')}
    ${[[-230, 1], [230, 0.78]].map(([x, s]) => `
    <g transform="translate(${W / 2 + x} ${H * 0.73}) scale(${s})">
      <path d="M-170 0 C-170 -60 -60 -90 -60 -170 L-60 -520 L60 -520 L60 -170 C60 -90 170 -60 170 0 Z" fill="url(#gold)"/>
      <rect x="-110" y="-560" width="220" height="50" rx="10" fill="url(#gold)"/>
      <rect x="-90" y="-1020" width="180" height="460" rx="14" fill="#FBF6EA"/>
      <path d="M0 -1100 C30 -1060 25 -1030 0 -1020 C-25 -1030 -30 -1060 0 -1100 Z" fill="#E9B25A"/>
    </g>`).join('')}`,
  orb: (v) => `
    ${backdrop(v ? '#F1E6D0' : '#EADBBE', '#D9C7A4')}
    <g transform="translate(${W / 2} ${H * 0.73 - 380})">
      <circle r="380" fill="#B68A4E"/>
      ${Array.from({ length: 14 }, (_, i) => `<ellipse rx="${380 - i * 2}" ry="${40 + i * 26}" fill="none" stroke="#8E6532" stroke-width="10" transform="rotate(${i * 13})" opacity="0.7"/>`).join('')}
      <circle r="380" fill="none" stroke="#7A5428" stroke-width="14"/>
      <ellipse cy="-360" rx="120" ry="34" fill="#3E2A16"/>
    </g>`,
  basket: (v) => `
    ${backdrop(v ? '#F6EDDD' : '#F1E6D0', '#E3D1AE')}
    <g transform="translate(${W / 2} ${H * 0.73})">
      <path d="M-420 -760 L420 -760 L360 0 L-360 0 Z" fill="#C7A36A"/>
      ${Array.from({ length: 16 }, (_, i) => `<line x1="-430" y1="${-740 + i * 47}" x2="430" y2="${-740 + i * 47}" stroke="#A9834A" stroke-width="16"/>`).join('')}
      <rect x="-440" y="-790" width="880" height="60" rx="20" fill="#B48F55"/>
      <path d="M-300 -790 C-300 -900 -180 -900 -180 -790" fill="none" stroke="#6B3A1F" stroke-width="30"/>
      <path d="M300 -790 C300 -900 180 -900 180 -790" fill="none" stroke="#6B3A1F" stroke-width="30"/>
    </g>`,
  bud: (v) => `
    ${backdrop(v ? '#F4EBDC' : '#EEE2CB', '#DDC9A6')}
    <g transform="translate(${W / 2} ${H * 0.73})">
      <path d="M-200 0 C-300 -150 -300 -420 -90 -560 L-70 -900 L70 -900 L90 -560 C300 -420 300 -150 200 0 Z" fill="#8A4B1C" opacity="0.82"/>
      <path d="M-120 -40 C-220 -200 -200 -420 -40 -540" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="22"/>
      <path d="M0 -900 C10 -1100 -60 -1250 -40 -1400" fill="none" stroke="#5E6B3A" stroke-width="12"/>
      <ellipse cx="-40" cy="-1420" rx="60" ry="90" fill="#E9C7B0"/>
      <path d="M0 -1000 C80 -1040 140 -1020 170 -980 C120 -960 60 -960 0 -1000Z" fill="#6E7C45"/>
    </g>`,
  tray: (v) => `
    ${backdrop(v ? '#F2E8D8' : '#ECE0CA', '#D8C29C')}
    <g transform="translate(${W / 2} ${H * 0.66})">
      <path d="M-560 0 L560 0 L640 180 L-640 180 Z" fill="#F4F1EC"/>
      <path d="M-560 0 L560 0 L640 180 L-640 180 Z" fill="none" stroke="#CFC8BE" stroke-width="6"/>
      <path d="M-400 40 C-200 90 0 30 200 120 S 480 110 560 150" stroke="#B9B2A8" stroke-width="5" fill="none"/>
      <path d="M-300 30 C-100 60 100 140 400 60" stroke="#CBC4BA" stroke-width="4" fill="none"/>
      <rect x="-640" y="180" width="1280" height="50" fill="#E6E1DA"/>
      <rect x="-700" y="40" width="80" height="40" rx="18" fill="url(#gold)"/>
      <rect x="620" y="40" width="80" height="40" rx="18" fill="url(#gold)"/>
    </g>`,
  cushion: (v) => `
    ${backdrop(v ? '#F3E8D4' : '#EFE4CF', '#DCC8A6')}
    <g transform="translate(${W / 2} ${H * 0.73 - 470})">
      <path d="M-520 -440 C-300 -500 300 -500 520 -440 C560 -200 560 200 520 440 C300 500 -300 500 -520 440 C-560 200 -560 -200 -520 -440 Z" fill="#6B0F1A"/>
      <path d="M-420 -360 C-200 -420 100 -400 300 -330" stroke="#8C2533" stroke-width="40" fill="none" opacity="0.6"/>
      <path d="M-520 -440 C-300 -500 300 -500 520 -440 C560 -200 560 200 520 440 C300 500 -300 500 -520 440 C-560 200 -560 -200 -520 -440 Z" fill="none" stroke="#3E0710" stroke-width="12"/>
    </g>`,
  lamp: (v) => `
    ${backdrop(v ? '#F5ECDD' : '#F1E6D0', '#E0CDAA')}
    <circle cx="${W / 2 + 120}" cy="${H * 0.28}" r="420" fill="#FFF3D6" opacity="0.6"/>
    <g transform="translate(${W / 2} ${H * 0.73})">
      <ellipse rx="200" ry="40" fill="url(#gold)"/>
      <path d="M-20 -20 C-20 -700 300 -900 140 -1000" fill="none" stroke="url(#gold)" stroke-width="34"/>
      <path d="M-160 -980 L440 -980 L360 -1300 L-80 -1300 Z" fill="#F6EFE0"/>
      <path d="M-160 -980 L440 -980 L360 -1300 L-80 -1300 Z" fill="none" stroke="#D9C7A4" stroke-width="6"/>
    </g>`,
}

const products = [
  ['a0000000-0000-4000-8000-000000000001', 'jar', 'Gilded Lattice Ginger Jar'],
  ['a0000000-0000-4000-8000-000000000002', 'holders', 'Gold Pillar Holders'],
  ['a0000000-0000-4000-8000-000000000003', 'orb', 'Rattan Orb Vase'],
  ['a0000000-0000-4000-8000-000000000004', 'basket', 'Woven Jute Basket'],
  ['a0000000-0000-4000-8000-000000000005', 'bud', 'Smoked Glass Bud Vase'],
  ['a0000000-0000-4000-8000-000000000006', 'tray', 'Marble Serving Tray'],
  ['a0000000-0000-4000-8000-000000000007', 'cushion', 'Garnet Velvet Cushion'],
  ['a0000000-0000-4000-8000-000000000008', 'lamp', 'Arched Brass Table Lamp'],
  ['a0000000-0000-4000-8000-000000000009', 'tray', 'Carved Teak Console'],
  ['a0000000-0000-4000-8000-000000000010', 'lamp', 'Pleated Silk Floor Lamp'],
]

function svg(body, w = W, h = H) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>`)
}

async function jpeg(buf, w, h) {
  return sharp(buf).resize(w, h, { fit: 'cover' }).jpeg({ quality: 85, mozjpeg: true }).toBuffer()
}

async function seedProductImages() {
  for (const [id, kind, name] of products) {
    const { count } = await db.from('product_images').select('id', { count: 'exact', head: true }).eq('product_id', id)
    if (count) continue
    for (const variant of [0, 1]) {
      const body = await jpeg(svg(art[kind](variant)), W, H)
      const path = `products/${id}/${randomUUID()}.jpg`
      const { error: upErr } = await db.storage.from('product-images').upload(path, body, { contentType: 'image/jpeg', upsert: true })
      if (upErr) throw upErr
      const { error } = await db.from('product_images').insert({
        product_id: id, storage_path: path, width: W, height: H, alt: name, sort_order: variant,
      })
      if (error) throw error
    }
  }
  console.log('• Product photos uploaded')
}

// Showroom gallery: mixed portrait/landscape, linked to a few products.
const gallery = [
  ['lamp', 1600, 1067, 'A reading corner with the arched brass lamp', ['a0000000-0000-4000-8000-000000000008']],
  ['jar', 1600, 2000, 'Ginger jars styled in pairs on a console', ['a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002']],
  ['tray', 1600, 1200, 'Marble tray on the ottoman', ['a0000000-0000-4000-8000-000000000006']],
  ['cushion', 1600, 2000, 'Garnet velvet on a linen sofa', ['a0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000003']],
  ['basket', 1600, 1067, null, []],
  ['bud', 1600, 1800, 'Smoked glass in afternoon light', ['a0000000-0000-4000-8000-000000000005']],
]

async function seedGallery() {
  const { count } = await db.from('gallery_photos').select('id', { count: 'exact', head: true })
  if (count) return
  for (const [i, [kind, w, h, caption, productIds]] of gallery.entries()) {
    const body = await jpeg(svg(art[kind](i % 2), w, h), w, h)
    const path = `gallery/${randomUUID()}.jpg`
    const { error: upErr } = await db.storage.from('site').upload(path, body, { contentType: 'image/jpeg', upsert: true })
    if (upErr) throw upErr
    const { data, error } = await db
      .from('gallery_photos')
      .insert({ storage_path: path, width: w, height: h, caption, alt: caption, is_visible: i < 5, sort_order: i })
      .select('id')
      .single()
    if (error) throw error
    if (productIds.length) {
      const { error: linkErr } = await db
        .from('gallery_photo_products')
        .insert(productIds.map((product_id, sort_order) => ({ photo_id: data.id, product_id, sort_order })))
      if (linkErr) throw linkErr
    }
  }
  console.log('• Gallery photos uploaded')
}

await ensureAdmin()
await seedProductImages()
await seedGallery()
console.log('Done.')
