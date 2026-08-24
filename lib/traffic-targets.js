// Client-safe copy of the traffic provider's published targeting options.
// Lives apart from order-create-input.server.js so the order forms can render
// the list without pulling a server-only module into the browser bundle.
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
