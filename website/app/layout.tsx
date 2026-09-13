import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Telegate — More life. Less screen.',
  description:
    'Talk through your next idea, then delegate it to your AI agents. Open-source voice delegation for iPhone, your computers and cloud harnesses.',
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'Telegate — More life. Less screen.',
    description:
      'Talk through the idea. Send it to your AI agents. Get your day back.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Telegate — More life. Less screen.',
    description: 'Open-source voice delegation for your iPhone and AI agents.',
  },
  metadataBase: new URL('https://telegate.danielfoch.chatgpt.site'),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
