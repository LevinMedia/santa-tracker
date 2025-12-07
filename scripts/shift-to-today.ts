/**
 * Shift flight dates to today/tomorrow for testing
 * Changes Dec 24 → Dec 6, Dec 25 → Dec 7
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const INPUT_FILE = join(process.cwd(), 'public', '2025_santa_tracker.csv')
const OUTPUT_FILE = INPUT_FILE // Overwrite in place

console.log('📖 Reading 2025_santa_tracker.csv...')
let content = readFileSync(INPUT_FILE, 'utf-8')

// Count replacements
let dec24Count = (content.match(/2025-12-24/g) || []).length
let dec25Count = (content.match(/2025-12-25/g) || []).length

// Shift dates: Dec 24 → Dec 6, Dec 25 → Dec 7
content = content.replace(/2025-12-24/g, '2025-12-06')
content = content.replace(/2025-12-25/g, '2025-12-07')

writeFileSync(OUTPUT_FILE, content)

console.log('✅ Dates shifted!')
console.log(`   2025-12-24 → 2025-12-06 (${dec24Count} replacements)`)
console.log(`   2025-12-25 → 2025-12-07 (${dec25Count} replacements)`)
console.log('')
console.log('📝 Run "npm run build" to regenerate flight-window.ts')
