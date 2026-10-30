
import './globals.css';
import { Fraunces, Outfit } from 'next/font/google';

const fr = Fraunces({ subsets: ['latin'], variable: '--serif' });
const ou = Outfit({ subsets: ['latin'], variable: '--sans' });

export const metadata = {
  title: 'Tomo – Coffee Brunch Bakery',
  description: 'Le menu de Tomo : brunch, coffee, matcha et cookies.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={`${fr.variable} ${ou.variable}`}>
        {children}
      </body>
    </html>
  );
}
