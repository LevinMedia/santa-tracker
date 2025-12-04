/**
 * Updates the 2024_santa_tracker.csv to have correct 2024 dates
 * 
 * - All local_time dates should be 2024-12-25 (Christmas Day 2024)
 * - utc_time dates should be 2024-12-24 or 2024-12-25 depending on timezone
 * 
 * Usage: npx tsx scripts/update-2024-dates.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const INPUT_FILE = path.join(process.cwd(), 'public/2024_santa_tracker.csv');
const OUTPUT_FILE = path.join(process.cwd(), 'public/2024_santa_tracker.csv');

console.log('📖 Reading 2024_santa_tracker.csv...');
let content = readFileSync(INPUT_FILE, 'utf-8');

console.log('🔄 Updating dates from 2025 to 2024...');

// Replace 2025-12-24 with 2024-12-24 (UTC times on Dec 24)
const dec24Matches = (content.match(/2025-12-24/g) || []).length;
content = content.replace(/2025-12-24/g, '2024-12-24');
console.log(`   Replaced ${dec24Matches} instances of 2025-12-24 → 2024-12-24`);

// Replace 2025-12-25 with 2024-12-25 (local times and late UTC times)
const dec25Matches = (content.match(/2025-12-25/g) || []).length;
content = content.replace(/2025-12-25/g, '2024-12-25');
console.log(`   Replaced ${dec25Matches} instances of 2025-12-25 → 2024-12-25`);

console.log('💾 Writing updated CSV...');
writeFileSync(OUTPUT_FILE, content);

console.log('\n✅ Done!');
console.log(`   📄 Output: ${OUTPUT_FILE}`);
console.log(`   📊 Total replacements: ${dec24Matches + dec25Matches}`);




