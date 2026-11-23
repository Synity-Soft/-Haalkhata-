// Root App component — sets up providers and routing
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { LanguageProvider } from '@/i18n'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ShopProvider } from '@/hooks/useShopContext'
import Layout from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Pages
import AuthPage  from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import Inventory from '@/pages/Inventory'
import Purchase  from '@/pages/Purchase'
import Expiry    from '@/pages/Expiry'
import Discounts from '@/pages/Discounts'
import Assistant from '@/pages/Assistant'
import Reports   from '@/pages/Reports'
import Festivals from '@/pages/Festivals'
import Settings  from '@/pages/Settings'
import Credit    from '@/pages/Credit'
import ShopNetwork from '@/pages/ShopNetwork'

import { api } from '@/lib/api'

function LoginGate() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-light dark:bg-surface-dark">
        <div className="w-10 h-10 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Only redirect to dashboard if the user is authenticated AND possesses a valid backend token
  if (isAuthenticated && api.getAuthToken()) {
    return <Navigate to="/" replace />
  }

  return <AuthPage />
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ShopProvider>
            <BrowserRouter>
              <Routes>
                {/* At first, log in and account registration page will appear */}
                <Route
                  path="/login"
                  element={
                    <ErrorBoundary fallbackTitle="লগইন পেজ লোড হতে সমস্যা হয়েছে">
                      <LoginGate />
                    </ErrorBoundary>
                  }
                />

                {/* Protected ERP Application Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route
                      index
                      element={
                        <ErrorBoundary fallbackTitle="ড্যাশবোর্ড লোড হতে সমস্যা হয়েছে">
                          <Dashboard />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="inventory"
                      element={
                        <ErrorBoundary fallbackTitle="ইনভেন্টরি পাতা লোড হতে সমস্যা হয়েছে">
                          <Inventory />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="purchase"
                      element={
                        <ErrorBoundary fallbackTitle="ক্রয় সুপারিশ লোড হতে সমস্যা হয়েছে">
                          <Purchase />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="expiry"
                      element={
                        <ErrorBoundary fallbackTitle="মেয়াদ পর্যবেক্ষণ পাতা লোড হতে সমস্যা হয়েছে">
                          <Expiry />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="discounts"
                      element={
                        <ErrorBoundary fallbackTitle="ছাড় সুপারিশ পাতা লোড হতে সমস্যা হয়েছে">
                          <Discounts />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="assistant"
                      element={
                        <ErrorBoundary fallbackTitle="এআই সহকারী লোড হতে সমস্যা হয়েছে">
                          <Assistant />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="reports"
                      element={
                        <ErrorBoundary fallbackTitle="রিপোর্ট পাতা লোড হতে সমস্যা হয়েছে">
                          <Reports />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="festivals"
                      element={
                        <ErrorBoundary fallbackTitle="উৎসব ও চাহিদার পূর্বাভাস লোড হতে সমস্যা হয়েছে">
                          <Festivals />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <ErrorBoundary fallbackTitle="সেটিংস পাতা লোড হতে সমস্যা হয়েছে">
                          <Settings />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="credit"
                      element={
                        <ErrorBoundary fallbackTitle="বাকির খাতা লোড হতে সমস্যা হয়েছে">
                          <Credit />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="network"
                      element={
                        <ErrorBoundary fallbackTitle="দোকান নেটওয়ার্ক পাতা লোড হতে সমস্যা হয়েছে">
                          <ShopNetwork />
                        </ErrorBoundary>
                      }
                    />
                  </Route>
                </Route>

                {/* Fallback to root (which redirects to /login if unauthenticated) */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ShopProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}
