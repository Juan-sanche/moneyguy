'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '../../../lib/utils';

interface MoneyGuyAppProps {
  onLogout: () => void;
}

export function MoneyGuyApp({ onLogout }: MoneyGuyAppProps) {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      const { auth } = await import('../../../lib/auth');
      setUser(auth.getCurrentUser());
    };
    loadUser();
  }, []);

  const navigation = [
    { name: 'Dashboard', id: 'dashboard', emoji: '📊' },
    { name: 'Transactions', id: 'transactions', emoji: '💳' },
    { name: 'Budgets', id: 'budgets', emoji: '🎯' },
    { name: 'Goals', id: 'goals', emoji: '🏆' },
    { name: 'Insights', id: 'insights', emoji: '🧠' },
  ];

  const Sidebar = () => (
    <div className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
      isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="buddy-gradient h-full p-6">
        {/* Logo */}
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <span className="text-2xl">💰</span>
          </div>
          <h1 className="text-xl font-bold text-white">MoneyGuy</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navigation.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentPage(item.id);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-white/20 text-white shadow-lg'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="border-t border-white/20 pt-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{user?.firstName} {user?.lastName}</p>
                <p className="text-white/70 text-sm">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full py-2 px-4 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const DashboardPage = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.firstName}! Here's your financial overview</p>
        </div>
        <button className="buddy-button">
          ➕ Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="buddy-card p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Balance</h3>
            <span className="text-2xl">💰</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(4350)}</div>
          <p className="text-xs text-gray-500">+2.5% from last month</p>
        </div>

        <div className="buddy-card p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Income</h3>
            <span className="text-2xl">📈</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(3800)}</div>
          <p className="text-xs text-gray-500">+12% from last month</p>
        </div>

        <div className="buddy-card p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Expenses</h3>
            <span className="text-2xl">📉</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{formatCurrency(2450)}</div>
          <p className="text-xs text-gray-500">+5% from last month</p>
        </div>

        <div className="buddy-card p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-medium text-gray-600">Transactions</h3>
            <span className="text-2xl">📊</span>
          </div>
          <div className="text-2xl font-bold">42</div>
          <p className="text-xs text-gray-500">+8 this month</p>
        </div>
      </div>

      {/* AI Assistant Card */}
      <div className="buddy-card p-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4">🤖 AI Financial Assistant</h3>
          <button className="buddy-button mb-4">
            💬 Chat with MoneyGuy AI
          </button>
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p>📊 Dining spending decreased 10%</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p>🎯 85% toward emergency fund goal</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p>💡 Review subscription expenses</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'transactions':
        return <div className="text-center py-12"><h2 className="text-2xl">🚧 Transactions Coming Soon</h2></div>;
      case 'budgets':
        return <div className="text-center py-12"><h2 className="text-2xl">🚧 Budgets Coming Soon</h2></div>;
      case 'goals':
        return <div className="text-center py-12"><h2 className="text-2xl">🚧 Goals Coming Soon</h2></div>;
      case 'insights':
        return <div className="text-center py-12"><h2 className="text-2xl">🚧 Insights Coming Soon</h2></div>;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="bg-white p-2 rounded-lg shadow-lg border"
        >
          {isSidebarOpen ? '✕' : '☰'}
        </button>
      </div>

      <Sidebar />

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:ml-64">
        <main className="p-4 lg:p-8 pt-16 lg:pt-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
