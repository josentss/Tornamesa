import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'Tornamesa',
  description: 'Registra los discos que escuchas. Guarda tus favoritos. Compártelos.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0f16',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-[#0a0f16] text-[#f0f9ff] min-h-screen flex flex-col antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
