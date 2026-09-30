import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function read(path) {
  return readFile(new URL('../' + path, import.meta.url), 'utf8')
}

test('Phase 5 database contract is RLS-protected and policy-first', async () => {
  const migration = await read(
    'supabase/migrations/20260930010000_phase5_ai_broker_vision.sql',
  )

  assert.match(migration, /create table if not exists public\.ai_broker_rules/)
  assert.match(migration, /create table if not exists private\.ai_broker_rule_secrets/)
  assert.match(migration, /pgp_sym_encrypt/)
  assert.match(migration, /deba_ai_broker_policy_key/)
  assert.match(migration, /create table if not exists public\.ai_negotiation_sessions/)
  assert.match(migration, /create table if not exists public\.ai_negotiation_logs/)
  assert.match(migration, /create table if not exists public\.product_visual_inspections/)

  assert.match(migration, /alter table public\.ai_broker_rules enable row level security/)
  assert.match(migration, /alter table public\.ai_negotiation_sessions enable row level security/)
  assert.match(migration, /alter table public\.ai_negotiation_logs enable row level security/)
  assert.match(migration, /alter table public\.product_visual_inspections enable row level security/)

  assert.match(migration, /grant execute on function public\.initiate_ai_broker_negotiation\(uuid\)\s+to authenticated/)
  assert.match(migration, /grant execute on function public\.evaluate_broker_counter_offer\(uuid\)\s+to authenticated/)
  assert.match(migration, /grant execute on function public\.grade_product_visual_condition\(uuid, jsonb\)\s+to authenticated/)
  assert.match(migration, /grant execute on function public\.complete_product_visual_inspection\(/)
  assert.match(migration, /grant execute on function public\.record_ai_broker_advisory\(/)
})

test('Phase 5 broker evaluation fails closed and does not mutate offers directly', async () => {
  const migration = await read(
    'supabase/migrations/20260930010000_phase5_ai_broker_vision.sql',
  )

  assert.match(migration, /private\.get_broker_market_context/)
  assert.match(migration, /get_product_deal_score/)
  assert.match(migration, /'phase4\.2'/)
  assert.match(migration, /minimum_offer_amount/)
  assert.match(migration, /'insufficient_market_context'/)
  assert.match(migration, /'no_feasible_deal'/)
  assert.match(migration, /'round_limit'/)
  assert.match(migration, /'policy_rejected'|model_rejected_by_policy|rejected_by_policy/)
  assert.match(migration, /create or replace function public\.apply_ai_broker_accepted_proposal\(/)
  assert.match(migration, /grant execute on function public\.apply_ai_broker_accepted_proposal\(uuid, uuid\)\s+to service_role/)
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.apply_ai_broker_accepted_proposal\(uuid, uuid\)\s+to authenticated/,
  )
})

test('vision grading is evidence-backed and conservative', async () => {
  const migration = await read(
    'supabase/migrations/20260930010000_phase5_ai_broker_vision.sql',
  )
  const adapter = await read('src/lib/vision/provider.ts')
  const route = await read('src/app/api/vision/products/[id]/route.ts')

  assert.match(migration, /visual_score numeric/)
  assert.match(migration, /structural_score numeric/)
  assert.match(migration, /cleanliness_score numeric/)
  assert.match(migration, /description_consistency_score numeric/)
  assert.match(migration, /damage_flags jsonb/)
  assert.match(migration, /verified_badge boolean/)
  assert.match(migration, /jsonb_array_length\(coalesce\(p_damage_flags/)
  assert.match(migration, /p_description_consistency_score[^\n]*>= 80/)

  assert.match(adapter, /import 'server-only'/)
  assert.match(adapter, /DEBA_VISION_API_URL/)
  assert.match(adapter, /fetch\(/)
  assert.doesNotMatch(adapter, /NEXT_PUBLIC_/)
  assert.doesNotMatch(adapter, /SUPABASE_SERVICE_ROLE_KEY/)

  assert.match(route, /grade_product_visual_condition/)
  assert.match(route, /inspectProductImages/)
  assert.match(route, /complete_product_visual_inspection/)
})

test('broker model adapter is advisory-only and server-only', async () => {
  const adapter = await read('src/lib/ai-broker/provider.ts')
  const route = await read('src/app/api/ai-broker/offers/[offerId]/route.ts')

  assert.match(adapter, /import 'server-only'/)
  assert.match(adapter, /DEBA_BROKER_API_URL/)
  assert.match(adapter, /DEBA_BROKER_API_KEY/)
  assert.match(adapter, /DEBA_BROKER_MODEL/)
  assert.match(adapter, /fetch\(/)
  assert.match(adapter, /database policy is authoritative/)
  assert.doesNotMatch(adapter, /NEXT_PUBLIC_/)
  assert.doesNotMatch(adapter, /SUPABASE_SERVICE_ROLE_KEY/)

  assert.match(route, /initiate_ai_broker_negotiation/)
  assert.match(route, /evaluate_broker_counter_offer/)
  assert.match(route, /generateBrokerDecision/)
  assert.match(route, /record_ai_broker_advisory/)
  assert.match(route, /performed: false/)
})

test('Phase 5 contract test is wired into both CI workflows and provider env is documented', async () => {
  const packageJson = await read('package.json')
  const verify = await read('.github/workflows/deba-ci.yml')
  const quality = await read('.github/workflows/ci.yml')
  const env = await read('.env.example')

  assert.match(packageJson, /"test:phase5"/)
  assert.match(verify, /npm run test:phase5/)
  assert.match(quality, /npm run test:phase5/)

  assert.match(env, /DEBA_BROKER_API_URL=/)
  assert.match(env, /DEBA_BROKER_API_KEY=/)
  assert.match(env, /DEBA_BROKER_MODEL=/)
  assert.match(env, /DEBA_VISION_API_URL=/)
  assert.match(env, /DEBA_VISION_API_KEY=/)
  assert.match(env, /DEBA_VISION_MODEL=/)
})


test('AI broker execution gate is deterministic, idempotent, round-bounded, and policy-locked', async () => {
  const migration = await read(
    'supabase/migrations/20260930010000_phase5_ai_broker_vision.sql',
  )
  const route = await read('src/app/api/ai-broker/offers/[offerId]/route.ts')

  assert.match(migration, /create table if not exists public\.ai_broker_proposals/)
  assert.match(migration, /status in \('proposed','accepted_by_policy','applied'/)
  assert.match(migration, /Only accepted_by_policy proposals can be applied/)
  assert.match(migration, /Proposal round is stale/)
  assert.match(migration, /Source offer is no longer pending/)
  assert.match(migration, /Broker proposal financial context changed/)
  assert.match(migration, /Broker proposal violates current financial policy/)
  assert.match(migration, /Negotiation round is outside the allowed bounds/)
  assert.match(migration, /idempotent/)
  assert.match(migration, /request\.jwt\.claim\.sub/)
  assert.match(migration, /grant execute on function public\.apply_ai_broker_accepted_proposal\(uuid, uuid\)\s+to service_role/)
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.apply_ai_broker_accepted_proposal\(uuid, uuid\)\s+to authenticated/,
  )

  assert.match(route, /evaluate_broker_counter_offer/)
  assert.match(route, /execution:/)
  assert.match(route, /performed: false/)
})

test('visual trust evidence is public-safe and does not expose private image/request fields', async () => {
  const migration = await read(
    'supabase/migrations/20260930010000_phase5_ai_broker_vision.sql',
  )
  const page = await read('src/app/products/[slug]/page.tsx')

  assert.match(migration, /public\.get_product_trust_evidence/)
  assert.match(migration, /security invoker/)
  assert.match(migration, /grant select \(\s*product_id,\s*visual_score/)
  assert.match(migration, /product_visual_inspections_public_select/)
  assert.doesNotMatch(
    migration,
    /grant select on public\.product_visual_inspections to authenticated/,
  )
  assert.match(migration, /verified_badge/)
  assert.match(page, /get_product_trust_evidence/)
  assert.match(page, /فحص بصري موثوق/)
  assert.match(page, /trustEvidence\?\.verified_badge/)
  assert.match(page, /description.*condition/)
})
