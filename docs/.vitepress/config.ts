import { defineConfig } from 'vitepress';

/** Production site origin (GitHub Pages project site) */
const SITE_ORIGIN = 'https://0xtanzim.github.io';
const SITE_PATH = '/nextrush-log/';

export default defineConfig({
  base: SITE_PATH,

  title: '@nextrush/log',
  description:
    'Universal, zero-dependency logger for Node, edge, serverless, browsers, React, and Next.js',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#4f46e5' }],
    ['meta', { name: 'robots', content: 'index, follow' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: '@nextrush/log' }],
    ['meta', { property: 'og:title', content: '@nextrush/log — Universal logger for JavaScript' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Structured logging for Node, edge, serverless, browsers, React, and Next.js. Global singleton config, redaction, transports.',
      },
    ],
    ['meta', { property: 'og:url', content: `${SITE_ORIGIN}${SITE_PATH}` }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: '@nextrush/log' }],
    [
      'meta',
      {
        name: 'twitter:description',
        content:
          'Zero-dependency logger: global configure, levels, browser + React, async context.',
      },
    ],
  ],

  lastUpdated: true,

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api' },
      { text: 'Examples', link: '/examples' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Log Levels', link: '/log-levels' },
          { text: 'Environment Config', link: '/environment' },
          { text: 'Global Configuration', link: '/global-configuration' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Child Loggers', link: '/child-loggers' },
          { text: 'Request Tracing', link: '/tracing' },
          { text: 'Async Context', link: '/async-context' },
          { text: 'Custom Transports', link: '/transports' },
          { text: 'Browser & React', link: '/browser-react' },
          { text: 'Testing', link: '/testing' },
          { text: 'Best Practices', link: '/best-practices' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API Reference', link: '/api' },
          { text: 'Examples', link: '/examples' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'FAQ', link: '/faq' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/0xTanzim/nextrush-log' },
      { icon: 'npm', link: 'https://www.npmjs.com/package/@nextrush/log' },
    ],

    footer: {
      message: 'MIT License · zero runtime dependencies',
      copyright: 'Copyright © 2026 Tanzim Hossain',
    },

    search: {
      provider: 'local',
    },

    editLink: {
      pattern:
        'https://github.com/0xTanzim/nextrush-log/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
});
