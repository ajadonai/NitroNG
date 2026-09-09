/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    // Emits an [dir="rtl"] counterpart for every rule that has a physical
    // side, so Arabic gets a mirrored layout without 691 hand edits and
    // without new code being able to reintroduce the bug. LTR rules are left
    // exactly as they were — see the diff in the commit message.
    'postcss-rtlcss': { mode: 'combined', ltrPrefix: '[dir="ltr"]', rtlPrefix: '[dir="rtl"]', bothPrefix: '[dir]' },
  },
};

export default config;
