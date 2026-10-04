import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('C1 chat location contract matches the database RPC', async () => {
  const ui = await read('src/components/ChatCommsExact.tsx')
  const api = await read('src/app/api/chat/rooms/[id]/messages/route.ts')
  const rpc = await read('supabase/migrations/20260925162444_lock_direct_chat_message_insert.sql')

  assert.match(ui, /location:\s*\{\s*lat: position\.coords\.latitude,\s*lng: position\.coords\.longitude,\s*accuracy:/s)
  assert.doesNotMatch(ui, /location:\s*\{\s*latitude:\s*position\.coords\.latitude,\s*longitude:\s*position\.coords\.longitude/s)
  assert.match(api, /return \{\s*lat: latitude,\s*lng: longitude,/s)
  assert.match(rpc, /v_metadata -> 'location' ->> 'lat'/)
  assert.match(rpc, /v_metadata -> 'location' ->> 'lng'/)
})

test('C1 chat UI does not manufacture presence or verification claims', async () => {
  const ui = await read('src/components/ChatCommsExact.tsx')
  assert.match(ui, /online: false/)
  assert.match(ui, /verified: false/)
  assert.doesNotMatch(ui, /online:\s*true,\s*verified:\s*true/)
})

test('C1 chat RPC errors are mapped to truthful HTTP classes', async () => {
  const api = await read('src/app/api/chat/rooms/[id]/messages/route.ts')
  const rooms = await read('src/app/api/chat/rooms/route.ts')

  assert.match(api, /error\.code === '42501'\) return 403/)
  assert.match(api, /error\.code === 'P0002'\) return 404/)
  assert.match(api, /error\.code === 'P0001'\) return 400/)
  assert.match(api, /return 500/)
  assert.match(api, /chat participant lookup failed/)
  assert.match(api, /status: 500/)
  assert.match(rooms, /status: error\.code === 'P0001' \? 400 : 500/)
})

test('C1 normal chat messages create recipient-scoped in-app notifications server-side', async () => {
  const api = await read('src/app/api/chat/rooms/[id]/messages/route.ts')
  const admin = await read('src/utils/supabase/admin.ts')
  const notifications = await read('src/hooks/useNotifications.ts')

  assert.match(api, /^import .*createAdminClient.*$/m)
  assert.match(api, /chat_participants/)
  assert.match(api, /is_muted !== true/)
  assert.match(api, /admin\.from\('notifications'\)\.insert/)
  assert.match(api, /type: 'chat\.message'/)
  assert.match(api, /message_id: message\.id/)
  assert.match(api, /product_id: productId/)
  assert.match(api, /notification: result\.notification/)
  assert.match(api, /if \\(message\.message_type === 'offer'\\)/)
  assert.match(admin, /^import 'server-only'/m)
  assert.doesNotMatch(admin, /NEXT_PUBLIC_/)
  assert.match(notifications, /table: 'notifications'/)
  assert.match(notifications, /filter: 'user_id=eq\.' \+ user\.id/)
})

test('C1 keeps direct message inserts behind the server-enforced RPC', async () => {
  const api = await read('src/app/api/chat/rooms/[id]/messages/route.ts')
  const rpcMigration = await read('supabase/migrations/20260925162444_lock_direct_chat_message_insert.sql')

  assert.match(api, /send_chat_message/)
  assert.doesNotMatch(api, /from\(['"]messages['"]\)\.insert/)
  assert.match(rpcMigration, /revoke execute on function public\.send_chat_message\(uuid, text, text, jsonb\) from public, anon/)
  assert.match(rpcMigration, /grant execute on function public\.send_chat_message\(uuid, text, text, jsonb\) to authenticated/)
})

test('C1 package test command includes the milestone contract suite', async () => {
  const packageJson = JSON.parse(await read('package.json'))
  assert.match(packageJson.scripts.test, /tests\/phase-c1-critical-flow\.test\.mjs/)
  assert.equal(packageJson.scripts['test:phase-c1'], 'node --test tests/phase-c1-critical-flow.test.mjs')
})
