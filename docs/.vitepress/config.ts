import { defineConfig } from 'vitepress';

export default defineConfig({
  title: '@nextrush/log',
  description: 'Universal logging for modern JavaScript',

  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]],

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
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Child Loggers', link: '/child-loggers' },
          { text: 'Request Tracing', link: '/tracing' },
          { text: 'Custom Transports', link: '/transports' },
          { text: 'Browser & React', link: '/browser-react' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API Reference', link: '/api' },
          { text: 'Examples', link: '/examples' },
          { text: 'Architecture', link: '/architecture' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/0xTanzim/nextrush-log' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Tanzim Hossain',
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
