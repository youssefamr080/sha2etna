import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// =============================================================================
// 🚀 WORLD-CLASS PWA CONFIGURATION
// =============================================================================
// This configuration transforms the app into a high-performance PWA with:
// - Smart caching strategies (CacheFirst for assets, StaleWhileRevalidate for API)
// - Complete manifest for installability on iOS/Android
// - Offline support with graceful degradation
// =============================================================================

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, 'public', 'manifest.json'), 'utf-8')
    );
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        
        // =====================================================================
        // 📦 VITE-PLUGIN-PWA - Ultimate Configuration
        // =====================================================================
        VitePWA({
          // Registration strategy: auto-inject the service worker registration
          registerType: 'autoUpdate',
          injectRegister: 'auto',
          
          // Include these file types in the precache manifest
          includeAssets: [
            'favicon.ico',
            'apple-icon-180.png',
            'manifest-icon-192.png',
            'manifest-icon-512.png',
            'manifest-icon-192.maskable.png',
            'manifest-icon-512.maskable.png'
          ],
          
          // =================================================================
          // 📋 WEB APP MANIFEST - Complete Configuration
          // =================================================================
          manifest,
          
          // =================================================================
          // 🧠 WORKBOX - Advanced Service Worker Caching Strategies
          // =================================================================
          workbox: {
            // Files to precache (generated at build time)
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
            
            // Don't precache source maps
            globIgnores: ['**/node_modules/**', '**/*.map'],
            
            // Clean up old caches on new SW activation
            cleanupOutdatedCaches: true,
            
            // Skip waiting - activate new SW immediately
            skipWaiting: true,
            
            // Claim all clients immediately
            clientsClaim: true,
            
            // =============================================================
            // 🔄 RUNTIME CACHING STRATEGIES
            // =============================================================
            runtimeCaching: [
              // ---------------------------------------------------------
              // 📦 JS CHUNKS: NetworkFirst for lazy-loaded chunks
              // Ensures fresh chunks are always fetched first
              // Falls back to cache if offline
              // ---------------------------------------------------------
              {
                urlPattern: /\.js$/,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'js-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                  },
                  networkTimeoutSeconds: 10, // Fall back to cache after 10s
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              
              // ---------------------------------------------------------
              // 🎨 CSS & FONTS: CacheFirst - these rarely change
              // ---------------------------------------------------------
              {
                urlPattern: /\.(?:css|woff|woff2|ttf|eot)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'static-assets-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              
              // ---------------------------------------------------------
              // 🖼️ IMAGES: CacheFirst with size limit
              // Images are large, cache them but limit storage
              // ---------------------------------------------------------
              {
                urlPattern: /\.(?:png|jpg|jpeg|gif|svg|ico|webp)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-cache',
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              
              // ---------------------------------------------------------
              // 🔌 SUPABASE API: StaleWhileRevalidate
              // Show cached data instantly, update in background
              // Critical for offline-first experience
              // ---------------------------------------------------------
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'supabase-api-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  },
                  // Broadcast updates to the app
                  backgroundSync: {
                    name: 'supabase-sync-queue',
                    options: {
                      maxRetentionTime: 60 * 24 // 24 hours
                    }
                  }
                }
              },
              
              // ---------------------------------------------------------
              // 🔐 SUPABASE AUTH: NetworkFirst
              // Auth must be fresh, but cache as fallback
              // ---------------------------------------------------------
              {
                urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/.*/i,
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'supabase-auth-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 // 1 hour
                  },
                  networkTimeoutSeconds: 10,
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              
              // ---------------------------------------------------------
              // 🌐 GOOGLE FONTS: CacheFirst
              // Fonts rarely change, cache aggressively
              // ---------------------------------------------------------
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-stylesheets',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              
              // ---------------------------------------------------------
              // 🤖 GEMINI API: NetworkOnly
              // AI responses should always be fresh
              // ---------------------------------------------------------
              {
                urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\/.*/i,
                handler: 'NetworkOnly',
                options: {
                  backgroundSync: {
                    name: 'gemini-sync-queue',
                    options: {
                      maxRetentionTime: 60 * 24 // 24 hours
                    }
                  }
                }
              }
            ]
          },
          
          // =================================================================
          // 🛠️ DEVELOPMENT OPTIONS
          // =================================================================
          devOptions: {
            enabled: true,          // Enable PWA in dev mode for testing
            type: 'module',
            navigateFallback: 'index.html'
          }
        })
      ],
      
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
        'process.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      
      // =================================================================
      // 📦 BUILD OPTIMIZATION - Code Splitting
      // =================================================================
      // Split large dependencies into separate chunks to:
      // - Reduce initial bundle size below 500KB warning threshold
      // - Enable better caching (vendor chunks rarely change)
      // - Improve load time with parallel chunk loading
      // =================================================================
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // React core - rarely changes
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              
              // Supabase SDK - large but stable
              'vendor-supabase': ['@supabase/supabase-js'],
              
              // Recharts - only needed on stats page
              'vendor-charts': ['recharts'],
              
              // Lucide icons - tree-shakeable but still significant
              'vendor-icons': ['lucide-react'],
            }
          }
        }
      }
    };
});
