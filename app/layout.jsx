import './globals.css';
import WhatsAppFloat from '@/components/whatsapp-float';

export const metadata = {
  title: 'Nitro — #1 SMM Panel in Nigeria',
  description: 'Buy Instagram followers, TikTok views, YouTube subscribers and more. Instant delivery, real engagement, cheapest rates in Nigeria.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <WhatsAppFloat />
      </body>
    </html>
  );
}
