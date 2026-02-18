import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Game Admin Panel',
  description: '통합 게임 관리자 패널',
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';
const wsUrl = apiUrl.replace(/^http/, 'ws');
const isDev = process.env.NODE_ENV === 'development';
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline'";
const cspContent = `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${apiUrl} ${wsUrl};`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={cspContent}
        />
      </head>
      {/* TODO: Migrate sensitive tokens from localStorage to httpOnly cookies for production */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
