import './globals.css';

export const metadata = {
  title: 'Instagram',
  description: 'Instagram',
  icons: {
    icon: 'https://a.favicon.im/instagram.com',
    shortcut: 'https://a.favicon.im/instagram.com',
    apple: 'https://a.favicon.im/instagram.com',
  },
};

export const viewport = {
  themeColor: '#000000',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="icon" type="image/png" href="https://a.favicon.im/instagram.com" />
        <link rel="apple-touch-icon" href="https://a.favicon.im/instagram.com" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className="dark-theme">
        <div id="app">
          {children}
        </div>
      </body>
    </html>
  );
}
