const fs = require('node:fs');
const dir = 'supabase/migrations';
const required = ['20260929224200_phase4_realtime_notifications.sql','20260929224300_phase4_2_deal_matching_price_intelligence.sql','20260929230000_phase4_3_future_engine.sql','20260930000000_phase4_4_true_vector_search.sql'];
const files = fs.readdirSync(dir).filter((name) => /^\d{14}_.+\.sql$/.test(name));
for (const name of required) { if (!files.includes(name)) throw new Error('Missing migration: ' + name); }
const versions = required.map((name) => name.slice(0,14));
for (let i=1; i<versions.length; i += 1) if (versions[i-1] >= versions[i]) throw new Error('Migration order invalid');
console.log('PASS: Phase 4 core migration order is valid.');
