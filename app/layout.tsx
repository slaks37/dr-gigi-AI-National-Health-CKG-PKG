import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Providers from '../components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'dr Gigi AI - Healthy Teeth, Healthy Life',
  description: 'Healthy Teeth, Healthy Life. Sistem pakar kedokteran gigi digital dengan AI Vision dan NLP.',
};

// App created by Stefen Laksana

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
                  if (!g) return;

                  // Listen and suppress unhandled errors for fetch injection and WebKit DOMException
                  if (typeof g.addEventListener === 'function') {
                    var shouldSuppress = function(msg) {
                      if (!msg || typeof msg !== 'string') return false;
                      return msg.indexOf('Cannot set property fetch') !== -1 ||
                             msg.indexOf('The string did not match the expected pattern') !== -1;
                    };

                    g.addEventListener('error', function(e) {
                      var msg = (e && (e.message || (e.error && e.error.message))) || '';
                      if (shouldSuppress(msg)) {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                        return true;
                      }
                    }, true);

                    g.addEventListener('unhandledrejection', function(e) {
                      var reason = (e && (e.reason && (e.reason.message || e.reason.toString()))) || '';
                      if (shouldSuppress(reason)) {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
                        return true;
                      }
                    }, true);
                  }

                  var _activeFetch = g.fetch;
                  try {
                    Object.defineProperty(g, 'fetch', {
                      get: function() { return _activeFetch; },
                      set: function(val) { _activeFetch = val; },
                      configurable: true,
                      enumerable: true
                    });
                  } catch (e1) {
                    if (g.Window && g.Window.prototype) {
                      try {
                        Object.defineProperty(g.Window.prototype, 'fetch', {
                          get: function() { return _activeFetch; },
                          set: function(val) { _activeFetch = val; },
                          configurable: true,
                          enumerable: true
                        });
                      } catch (e2) {}
                    }
                  }
                } catch (err) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
