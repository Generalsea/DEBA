import fs from 'node:fs';

const dir = 'supabase/migrations';

const required = [
  '20260929224200_phase4_realtime_notifications.sql',
  '20260929224300_phase4_2_deal_matching_price_intelligence.sql',
  '20260929230000_phase4_3_future_engine.sql',
  '20260929230100_phase4_3_boost_aware_search.sql',
  '20260929230200_phase4_3_rpc_security_hardening.sql',
  '20260929230300_phase4_3_placement_storage_correction.sql',
  '20260929230400_phase4_3_handshake_cryptographic_hardening.sql',
  '20260929230500_phase4_3_negotiation_constraint_fix.sql',
  '20260929230600_phase4_3_order_reservation_lifecycle_bridge.sql',
  '20260929230700_phase4_3_negotiation_eligibility_hardening.sql',
  '20260930000000_phase4_4_true_vector_search.sql',
  '20260930010000_phase5_ai_broker_vision.sql',
];

if (!fs.existsSync(dir)) {
  throw new Error('Missing migration directory: ' + dir);
}

if (required.length !== 12) {
  throw new Error('Release manifest must contain exactly 12 migrations.');
}

const files = fs
  .readdirSync(dir)
  .filter((name) => /^\d{14}_.+\.sql$/.test(name));

for (const name of required) {
  if (!files.includes(name)) {
    throw new Error('Missing required release migration: ' + name);
  }
}

const versions = required.map((name) => name.slice(0, 14));

for (let i = 1; i < versions.length; i += 1) {
  if (versions[i - 1] >= versions[i]) {
    throw new Error(
      'Migration order invalid: ' + versions[i - 1] + ' >= ' + versions[i],
    );
  }
}

const distinctVersions = new Set(versions);
if (distinctVersions.size !== required.length) {
  throw new Error('Duplicate migration version detected in release manifest.');
}

console.log(
  'PASS: DEBA 12-migration release chain is complete and strictly ordered:',
);
for (const [index, name] of required.entries()) {
  console.log(String(index + 1).padStart(2, '0') + '. ' + name);
}
