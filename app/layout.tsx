import type {Metadata} from 'next';
import './globals.css';
import Providers from '../components/Providers';

export const metadata: Metadata = {
  title: 'dr Gigi AI - Healthy Teeth, Healthy Life',
  description: 'Healthy Teeth, Healthy Life. Sistem pakar kedokteran gigi digital dengan AI Vision dan NLP.',
};

// App created by Stefen Laksana

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
