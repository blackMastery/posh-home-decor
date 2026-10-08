// Acceptance check (spec §13): the anon key cannot read inquiries or write anything.
//   npm run check:rls
import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const results = []
const expectBlocked = async (label, fn) => {
  const { data, error } = await fn()
  const blocked = Boolean(error) || (Array.isArray(data) && data.length === 0) || data === null
  results.push([blocked ? 'PASS' : 'FAIL', label, error?.message ?? `rows: ${JSON.stringify(data)?.slice(0, 80)}`])
}

await expectBlocked('read inquiries', () => db.from('inquiries').select('*').limit(1))
await expectBlocked('read admins', () => db.from('admins').select('*').limit(1))
await expectBlocked('insert inquiry', () =>
  db.from('inquiries').insert({ ref: 'PH-00000', customer_name: 'x', phone_raw: '1', phone_e164: '1', fulfilment: 'collection', styling_advice: false, items: [], item_count: 0, subtotal: 0, message_text: 'x' }).select())
await expectBlocked('update product', () => db.from('products').update({ price: 1 }).neq('id', '00000000-0000-0000-0000-000000000000').select())
await expectBlocked('delete category', () => db.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000').select())
await expectBlocked('update settings', () => db.from('settings').update({ whatsapp_number: '5920000000' }).eq('id', 1).select())
await expectBlocked('insert redirect', () => db.from('redirects').insert({ from_path: '/x', to_path: '/y' }).select())
await expectBlocked('call add_redirect', () => db.rpc('add_redirect', { p_from: '/a', p_to: '/b' }))
await expectBlocked('upload to product-images', () =>
  db.storage.from('product-images').upload(`products/x/${Date.now()}.jpg`, new Blob(['x'], { type: 'image/jpeg' })))
await expectBlocked('read draft products', () => db.from('products').select('id').neq('status', 'published'))
await expectBlocked('read hidden gallery photos', () => db.from('gallery_photos').select('id').eq('is_visible', false))
await expectBlocked('insert gallery photo', () =>
  db.from('gallery_photos').insert({ storage_path: 'gallery/00000000-0000-0000-0000-000000000000.jpg' }).select())
await expectBlocked('update gallery photo', () =>
  db.from('gallery_photos').update({ is_visible: true }).neq('id', '00000000-0000-0000-0000-000000000000').select())
await expectBlocked('link gallery product', () =>
  db.from('gallery_photo_products').insert({ photo_id: '00000000-0000-0000-0000-000000000000', product_id: '00000000-0000-0000-0000-000000000000' }).select())
await expectBlocked('upload to site/gallery', () =>
  db.storage.from('site').upload(`gallery/${Date.now()}.jpg`, new Blob(['x'], { type: 'image/jpeg' })))

const { data: pub } = await db.from('products').select('id').eq('status', 'published')
results.push([pub?.length ? 'PASS' : 'FAIL', 'can read published products', `rows: ${pub?.length ?? 0}`])

for (const r of results) console.log(r.join('  '))
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0)
