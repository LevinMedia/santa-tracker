/**
 * US State and Canadian Province abbreviations
 * Maps full names to their standard 2-letter codes
 */

export const US_STATE_ABBREVIATIONS: Record<string, string> = {
  'Alabama': 'AL',
  'Alaska': 'AK',
  'Arizona': 'AZ',
  'Arkansas': 'AR',
  'California': 'CA',
  'Colorado': 'CO',
  'Connecticut': 'CT',
  'Delaware': 'DE',
  'Florida': 'FL',
  'Georgia': 'GA',
  'Hawaii': 'HI',
  'Idaho': 'ID',
  'Illinois': 'IL',
  'Indiana': 'IN',
  'Iowa': 'IA',
  'Kansas': 'KS',
  'Kentucky': 'KY',
  'Louisiana': 'LA',
  'Maine': 'ME',
  'Maryland': 'MD',
  'Massachusetts': 'MA',
  'Michigan': 'MI',
  'Minnesota': 'MN',
  'Mississippi': 'MS',
  'Missouri': 'MO',
  'Montana': 'MT',
  'Nebraska': 'NE',
  'Nevada': 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  'Ohio': 'OH',
  'Oklahoma': 'OK',
  'Oregon': 'OR',
  'Pennsylvania': 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  'Tennessee': 'TN',
  'Texas': 'TX',
  'Utah': 'UT',
  'Vermont': 'VT',
  'Virginia': 'VA',
  'Washington': 'WA',
  'West Virginia': 'WV',
  'Wisconsin': 'WI',
  'Wyoming': 'WY',
  // US Territories
  'District of Columbia': 'DC',
  'Puerto Rico': 'PR',
  'Guam': 'GU',
  'American Samoa': 'AS',
  'U.S. Virgin Islands': 'VI',
  'Northern Mariana Islands': 'MP',
}

export const CA_PROVINCE_ABBREVIATIONS: Record<string, string> = {
  'Alberta': 'AB',
  'British Columbia': 'BC',
  'Manitoba': 'MB',
  'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL',
  'Northwest Territories': 'NT',
  'Nova Scotia': 'NS',
  'Nunavut': 'NU',
  'Ontario': 'ON',
  'Prince Edward Island': 'PE',
  'Quebec': 'QC',
  'Saskatchewan': 'SK',
  'Yukon': 'YT',
}

// Reverse lookup: abbreviation -> full name (for search)
export const US_STATE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATE_ABBREVIATIONS).map(([name, abbr]) => [abbr, name])
)

export const CA_PROVINCE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(CA_PROVINCE_ABBREVIATIONS).map(([name, abbr]) => [abbr, name])
)

/**
 * Get the abbreviation for a US state or Canadian province
 * Returns the original string if no abbreviation is found
 */
export function getStateAbbreviation(stateProvince: string, country: string): string {
  if (!stateProvince) return ''
  
  if (country === 'United States' || country === 'USA' || country === 'US') {
    return US_STATE_ABBREVIATIONS[stateProvince] || stateProvince
  }
  
  if (country === 'Canada') {
    return CA_PROVINCE_ABBREVIATIONS[stateProvince] || stateProvince
  }
  
  // Return original for other countries
  return stateProvince
}

/**
 * Format location as "City, ST" for US/Canada, or "City" for others
 */
export function formatLocationWithState(city: string, stateProvince: string | undefined, country: string): string {
  if (!stateProvince) return city
  
  const abbr = getStateAbbreviation(stateProvince, country)
  if (abbr && abbr !== stateProvince) {
    // We have an abbreviation
    return `${city}, ${abbr}`
  }
  
  // No abbreviation available, just return city
  return city
}

/**
 * Format location as "City, ST, Country" for US/Canada, or "City, Country" for others
 */
export function formatLocationWithStateAndCountry(city: string, stateProvince: string | undefined, country: string): string {
  if (!stateProvince) return `${city}, ${country}`
  
  const abbr = getStateAbbreviation(stateProvince, country)
  if (abbr && abbr !== stateProvince) {
    // We have an abbreviation - include country
    return `${city}, ${abbr}, ${country}`
  }
  
  // No abbreviation available, return city and country
  return `${city}, ${country}`
}

/**
 * Check if a search query matches a state/province (by name or abbreviation)
 */
export function matchesStateProvince(stateProvince: string | undefined, country: string, query: string): boolean {
  if (!stateProvince || !query) return false
  
  const lowerQuery = query.toLowerCase()
  const lowerState = stateProvince.toLowerCase()
  
  // Direct match on full name
  if (lowerState.includes(lowerQuery)) return true
  
  // Check abbreviation match
  const abbr = getStateAbbreviation(stateProvince, country)
  if (abbr && abbr.toLowerCase() === lowerQuery) return true
  
  // Check if query is a full state name that matches the abbreviation
  if (country === 'United States' || country === 'USA' || country === 'US') {
    const fullName = US_STATE_NAMES[query.toUpperCase()]
    if (fullName && fullName.toLowerCase() === lowerState) return true
  }
  
  if (country === 'Canada') {
    const fullName = CA_PROVINCE_NAMES[query.toUpperCase()]
    if (fullName && fullName.toLowerCase() === lowerState) return true
  }
  
  return false
}

