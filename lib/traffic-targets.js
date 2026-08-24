// The traffic provider's published options, in their vocabulary.
//
// Their API takes numbers where our UI uses words, and names the fields
// differently from every other service type: device is 1-5, the traffic type is
// its own required field, the keyword is google_keyword and the referrer is
// referring_url. Sending our own names produced "device_type.blank" no matter
// what value we chose, because none of them were being read.
export const TRAFFIC_CONTINENTS = {
  AFR: 'Africa', ASI: 'Asia', EUR: 'Europe',
  NAM: 'North America', SAM: 'South America', MEA: 'Middle East',
};

export const TRAFFIC_COUNTRIES = {
  WW: 'Worldwide',
  US: 'United States', CA: 'Canada',
  AR: 'Argentina', BR: 'Brazil', CL: 'Chile',
  AT: 'Austria', BE: 'Belgium', CZ: 'Czech Republic', DK: 'Denmark', FR: 'France',
  DE: 'Germany', HU: 'Hungary', LT: 'Lithuania', NL: 'Netherlands', PL: 'Poland',
  RO: 'Romania', RU: 'Russia', RS: 'Serbia', ES: 'Spain', SE: 'Sweden',
  CH: 'Switzerland', TR: 'Turkey', UA: 'Ukraine', UK: 'United Kingdom',
  HK: 'Hong Kong', IN: 'India', ID: 'Indonesia', JP: 'Japan', KR: 'South Korea',
  PK: 'Pakistan', SG: 'Singapore', TW: 'Taiwan', TH: 'Thailand', VN: 'Vietnam',
  AE: 'United Arab Emirates',
  AU: 'Australia', ZA: 'South Africa',
};

// Our stored value -> the provider's numeric device code.
export const TRAFFIC_DEVICES = {
  all: { code: 5, label: 'All devices' },
  desktop: { code: 1, label: 'Desktop only' },
  mobile: { code: 4, label: 'Mobile only' },
  android: { code: 2, label: 'Android only' },
  ios: { code: 3, label: 'iPhone only' },
};

// Our stored value -> the provider's numeric traffic type.
export const TRAFFIC_TYPES = {
  keyword: 1,   // arrives via a Google search for the keyword
  referrer: 2,  // arrives from a referring URL
  blank: 3,     // arrives directly, no referrer
};

/**
 * Provider payload for a stored trafficConfig, or null when there is none.
 * Kept here so the dispatcher and any future caller share one translation.
 */
export function trafficProviderParams(trafficConfig) {
  if (!trafficConfig) return null;
  const { country, device, trafficType, keyword, referrer } = trafficConfig;
  const params = {};
  if (country) params.country = String(country).toUpperCase();
  const deviceCode = TRAFFIC_DEVICES[device]?.code;
  if (deviceCode) params.device = deviceCode;
  const typeCode = TRAFFIC_TYPES[trafficType];
  if (typeCode) params.type_of_traffic = typeCode;
  if (trafficType === 'keyword' && keyword) params.google_keyword = keyword;
  if (trafficType === 'referrer' && referrer) params.referring_url = referrer;
  return params;
}
