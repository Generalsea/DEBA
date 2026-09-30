const fs = require('node:fs');
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
'20260930000000_phase4_4_true_vector_search.sql'
];
if (!fs.existsSync(dir)) throw new Error('Missing migration directory: ' + dir);
const files = fs.readdirSync(dir).filter((name) => /^\\d{14}_.+\\.sql$/.test(name));
for (const name of required) if (!files.includes(name)) throw new Error('Missing migration: ' + name);
const versions = required.map((name) => name.slice(0,14));
for (let i=1; i<versions.length; i += 1) if (versions[i-1] >= versions[i]) throw new Error('Migration order invalid: ' + versions[i-1] + ' >= ' + versions[i]);
console.log('PASS: Phase 4.1 -> 4.2 -> 4.3 -> 4.4 migration chain is complete and strictly ordered.');
