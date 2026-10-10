import './globals.css';

export const metadata = { title: 'POS Pearl', description: 'Quick Service POS + Membership' };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
