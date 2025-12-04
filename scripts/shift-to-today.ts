/**
 * Shift flight dates to today/tomorrow for testing
 * Changes Dec 2 → Dec 4, Dec 3 → Dec 5
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const INPUT_FILE = join(process.cwd(), 'public', '2025_santa_tracker.csv')
const OUTPUT_FILE = INPUT_FILE // Overwrite in place

console.log('📖 Reading 2025_santa_tracker.csv...')
let content = readFileSync(INPUT_FILE, 'utf-8')

// Count replacements
let dec2Count = (content.match(/2025-12-02/g) || []).length
let dec3Count = (content.match(/2025-12-03/g) || []).length

// Shift dates: Dec 2 → Dec 4, Dec 3 → Dec 5
content = content.replace(/2025-12-02/g, '2025-12-04')
content = content.replace(/2025-12-03/g, '2025-12-05')

writeFileSync(OUTPUT_FILE, content)

console.log('✅ Dates shifted!')
console.log(`   2025-12-02 → 2025-12-04 (${dec2Count} replacements)`)
console.log(`   2025-12-03 → 2025-12-05 (${dec3Count} replacements)`)
console.log('')
console.log('📝 Run "npm run build" to regenerate flight-window.ts')
