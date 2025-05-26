import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import ConditionalNavbar from '@/components/ConditionalNavbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Family Photo Share',
  description: 'Share your precious family moments with loved ones',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ConditionalNavbar />
          <main>
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}