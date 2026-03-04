import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sports Lobby',
  description: 'Challenge-first sports app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main>
          <nav style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <a href="/lobby">Lobby</a>
            <a href="/auth">Auth</a>
            <a href="/book">Book</a>
            <a href="/tournaments">Tournaments</a>
            <a href="/leaderboard">Leaderboard</a>
            <a href="/profile">Profile</a>
            <a href="/vendor">Vendor</a>
            <a href="/admin">Admin</a>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
