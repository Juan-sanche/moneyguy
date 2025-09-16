'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Home() {
  const { data: session, status } = useSession();
  
  // Navigation state
  const [currentView, setCurrentView] = useState<'chat' | 'dashboard'>('chat');
  const [dashboardTab, setDashboardTab] = useState('overview');

  // Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [usageData, setUsageData] = useState<{used: number, limit: number, remaining: number} | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth state
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [showDashboard, setShowDashboard] = useState(false);

  // Mock dashboard data (en producción vendrá de APIs)
  const mockDashboardData = {
    overview: {
      totalBalance: 2450.75,
      monthlyIncome: 3200,
      monthlyExpenses: 2180,
      savingsRate: 31.9,
    },
    budgets: [
      { category: 'Alimentación', spent: 680, budget: 800, percentage: 85, status: 'good' },
      { category: 'Transporte', spent: 420, budget: 500, percentage: 84, status: 'warning' },
      { category: 'Entretenimiento', spent: 290, budget: 400, percentage: 72.5, status: 'good' },
      { category: 'Compras', spent: 340, budget: 300, percentage: 113, status: 'over' }
    ],
    goals: [
      { name: 'Fondo Emergencia', current: 2800, target: 5000, deadline: '2024-12-31', progress: 56 },
      { name: 'Vacaciones', current: 300, target: 2000, deadline: '2025-06-01', progress: 15 },
      { name: 'Nuevo Coche', current: 1500, target: 15000, deadline: '2025-12-31', progress: 10 }
    ],
    categorySpending: [
      { name: 'Alimentación', value: 680, color: '#EF4444' },
      { name: 'Transporte', value: 420, color: '#3B82F6' },
      { name: 'Entretenimiento', value: 290, color: '#8B5CF6' },
      { name: 'Compras', value: 340, color: '#F59E0B' }
    ]
  };

  // Load chat history on mount
  useEffect(() => {
    if (session && messages.length === 0) {
      loadChatHistory();
    }
  }, [session]);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiTyping]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch('/api/chat?limit=50');
      const result = await response.json();
      
      if (result.success && result.data) {
        const formattedMessages = result.data.messages.map((msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role.toLowerCase() === 'user' ? 'user' : 'ai',
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(formattedMessages);
        setUsageData(result.data.usage);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      initializeChat();
    }
  };

  const initializeChat = () => {
    const welcomeMessage = {
      id: Date.now(),
      text: `¡Hola! 👋 Soy tu asistente financiero personal con IA. Puedo ayudarte a:\n\n💳 Registrar gastos e ingresos\n📊 Crear y revisar presupuestos\n🎯 Establecer y seguir metas financieras\n📈 Analizar tu situación económica\n\n¿En qué puedo ayudarte hoy?`,
      sender: 'ai',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isAiTyping) return;

    const userMessage = {
      id: Date.now(),
      text: newMessage.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsAiTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.text,
        }),
      });

      const result = await response.json();

      if (result.success && result.data?.message) {
        const aiMessage = {
          id: result.data.messageId || Date.now() + 1,
          text: result.data.message,
          sender: 'ai',
          timestamp: new Date(result.data.timestamp),
          functionCalled: result.data.functionCalled,
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setUsageData(result.data.usage);

        // If a function was called, might want to refresh dashboard
        if (result.data.functionCalled && ['getFinancialSummary', 'getBudgets', 'getGoals', 'getTransactions', 'generateDashboard'].includes(result.data.functionCalled)) {
          setShowDashboard(true);
        }
      } else {
        throw new Error(result.error || 'No response from AI');
      }
    } catch (error) {
      console.error('Error calling AI:', error);
      
      const fallbackMessage = {
        id: Date.now() + 1,
        text: "Disculpa, estoy teniendo problemas técnicos 🤖 ¿Puedes intentar de nuevo?",
        sender: 'ai',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handleQuickAction = (action: string) => {
    setNewMessage(action);
  };

  const clearChat = async () => {
    if (confirm('¿Borrar historial de chat? Esta acción no se puede deshacer.')) {
      setMessages([]);
      setShowDashboard(false);
      initializeChat();
    }
  };

  // Auth form handlers (mantienen tu lógica exacta)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    if (formErrors[e.target.name]) {
      setFormErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = 'Email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email inválido';
    }

    if (!formData.password) {
      errors.password = 'Contraseña es requerida';
    } else if (formData.password.length < 6) {
      errors.password = 'Contraseña debe tener al menos 6 caracteres';
    }

    if (authMode === 'register') {
      if (!formData.firstName) errors.firstName = 'Nombre es requerido';
      if (!formData.lastName) errors.lastName = 'Apellido es requerido';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (authMode === 'login') {
        const result = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (result?.error) {
          setFormErrors({ submit: 'Email o contraseña incorrectos' });
          setIsSubmitting(false);
          return;
        }
      } else {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });

        const result = await response.json();

        if (!response.ok) {
          setFormErrors({ submit: result.error || 'Error en el registro' });
          setIsSubmitting(false);
          return;
        }

        const signInResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (signInResult?.error) {
          setFormErrors({ submit: 'Registro exitoso! Intenta iniciar sesión.' });
          setAuthMode('login');
          setIsSubmitting(false);
          return;
        }
      }
    } catch (error) {
      setFormErrors({ submit: 'Algo salió mal' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setMessages([]);
    setDashboardData(null);
    setShowDashboard(false);
    setUsageData(null);
    setCurrentView('chat');
    setFormData({ email: '', password: '', firstName: '', lastName: '' });
  };

  // Loading screen (tu código exacto)
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4 mx-auto animate-pulse">
            <span className="text-3xl">💰</span>
          </div>
          <h2 className="text-gray-800 text-xl font-semibold">Cargando MoneyGuyAI...</h2>
          <p className="text-gray-600 mt-2">Tu asistente financiero inteligente</p>
        </div>
      </div>
    );
  }

  // Auth Form (tu código exacto)
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-100">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {authMode === 'login' ? 'Bienvenido de Nuevo' : 'Únete a MoneyGuyAI'}
            </h1>
            <p className="text-gray-600 mt-2">
              {authMode === 'login' 
                ? 'Inicia sesión en tu cuenta' 
                : 'Crea tu cuenta para empezar'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Juan"
                  />
                  {formErrors.firstName && <p className="text-sm text-red-600 mt-1">{formErrors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido</label>
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Pérez"
                  />
                  {formErrors.lastName && <p className="text-sm text-red-600 mt-1">{formErrors.lastName}</p>}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="tu@ejemplo.com"
              />
              {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="Ingresa tu contraseña"
              />
              {formErrors.password && <p className="text-sm text-red-600 mt-1">{formErrors.password}</p>}
            </div>

            {formErrors.submit && (
              <div className="text-sm text-red-600 text-center">{formErrors.submit}</div>
            )}

            <button 
              type="submit" 
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-700 focus:ring-4 focus:ring-blue-200 transition-all duration-200 disabled:opacity-50" 
              disabled={isSubmitting}
            >
              {isSubmitting 
                ? (authMode === 'login' ? 'Iniciando sesión...' : 'Creando cuenta...') 
                : (authMode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta')
              }
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              {authMode === 'login' ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                {authMode === 'login' ? 'Regístrate' : 'Inicia sesión'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const quickActions = [
    "Registra un gasto de 25€ en comida",
    "¿Cómo van mis presupuestos?",
    "Muéstrame mi resumen financiero",
    "Crear meta de ahorro para vacaciones",
    "Ver mis últimas transacciones"
  ];

  // CHAT VIEW COMPONENT
  const ChatView = () => (
    <>
      {/* Chat Interface - Takes up 2/3 on large screens */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 h-[calc(100vh-200px)] flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-gray-900">Chat con IA</h2>
                <p className="text-sm text-gray-600">Pregúntame sobre tus finanzas</p>
              </div>
              <button 
                onClick={() => setCurrentView('dashboard')}
                className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                📊 Dashboard
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl p-3 ${
                  message.sender === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className={`text-xs ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {message.functionCalled && (
                      <span className="text-xs bg-black/10 px-2 py-1 rounded">
                        {message.functionCalled}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* AI Typing Indicator */}
            {isAiTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-xl p-3 max-w-[80%]">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Escribe tu pregunta o solicitud..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                disabled={isAiTyping}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || isAiTyping}
                className={`px-4 py-2 rounded-xl font-medium transition-all ${
                  newMessage.trim() && !isAiTyping
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isAiTyping ? '⏳' : '📤'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Quick actions and status */}
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Acciones Rápidas</h3>
          <div className="space-y-2">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className="w-full text-left p-3 bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 rounded-xl transition-colors text-sm border border-blue-100"
            >
              📊 Ver Dashboard Completo
            </button>
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(action)}
                className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 rounded-xl transition-colors text-sm"
              >
                💡 {action}
              </button>
            ))}
          </div>
        </div>

        {/* Usage Stats */}
        {usageData && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Uso Diario</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mensajes enviados:</span>
                <span className="font-medium">{usageData.used}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Mensajes restantes:</span>
                <span className="font-medium text-blue-600">{usageData.remaining}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(usageData.used / usageData.limit) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Dashboard Preview */}
        {showDashboard && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Vista Rápida</h3>
            <p className="text-sm text-gray-600">
              Dashboard actualizado después de la última consulta
            </p>
            <button
              onClick={() => setCurrentView('dashboard')}
              className="w-full mt-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all text-sm font-medium"
            >
              Ver Dashboard Completo
            </button>
          </div>
        )}
      </div>
    </>
  );

  // DASHBOARD VIEW COMPONENT
  const DashboardView = () => (
    <div className="col-span-full">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
        {/* Dashboard Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Dashboard Financiero</h2>
              <p className="text-sm text-gray-600">Visión completa de tus finanzas</p>
            </div>
            <div className="flex items-center space-x-3">
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option>Este Mes</option>
                <option>Este Año</option>
              </select>
              <button 
                onClick={() => setCurrentView('chat')}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all text-sm font-medium"
              >
                💬 Chat IA
              </button>
            </div>
          </div>
          
          {/* Dashboard Navigation */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            {[
              { id: 'overview', label: 'Resumen', icon: '📊' },
              { id: 'spending', label: 'Gastos', icon: '🥧' },
              { id: 'goals', label: 'Metas', icon: '🎯' },
              { id: 'investments', label: 'Inversiones', icon: '📈' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDashboardTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium text-sm transition-all ${
                  dashboardTab === tab.id 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6">
          {dashboardTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Balance Total</h3>
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">€{mockDashboardData.overview.totalBalance.toLocaleString()}</div>
                  <div className="text-sm text-green-600 mt-1">+12.3% este mes</div>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Ingresos</h3>
                    <span className="text-2xl">📈</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">€{mockDashboardData.overview.monthlyIncome.toLocaleString()}</div>
                  <div className="text-sm text-blue-600 mt-1">Mensual</div>
                </div>

                <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Gastos</h3>
                    <span className="text-2xl">📉</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">€{mockDashboardData.overview.monthlyExpenses.toLocaleString()}</div>
                  <div className="text-sm text-red-600 mt-1">Este mes</div>
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-600">Ahorro</h3>
                    <span className="text-2xl">🎯</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{mockDashboardData.overview.savingsRate}%</div>
                  <div className="text-sm text-purple-600 mt-1">Tasa mensual</div>
                </div>
              </div>

              {/* Chart Placeholders */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Flujo de Efectivo</h3>
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📈</div>
                      <p>Gráfico de flujo de efectivo</p>
                      <p className="text-sm">Recharts se integrará aquí</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">🥧 Gastos por Categoría</h3>
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">🥧</div>
                      <p>Gráfico circular de categorías</p>
                      <p className="text-sm">Recharts se integrará aquí</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {dashboardTab === 'spending' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Análisis de Gastos</h3>
              
              {/* Category breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockDashboardData.categorySpending.map((category, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{category.name}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }}></div>
                    </div>
                    <div className="text-xl font-bold text-gray-900">€{category.value}</div>
                  </div>
                ))}
              </div>

              {/* Budget Progress */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Progreso de Presupuestos</h4>
                <div className="space-y-4">
                  {mockDashboardData.budgets.map((budget, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">{budget.category}</span>
                        <span className="text-sm text-gray-500">€{budget.spent} / €{budget.budget}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-500 ${
                            budget.status === 'over' ? 'bg-red-500' :
                            budget.status === 'warning' ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-medium ${
                          budget.status === 'over' ? 'text-red-600' :
                          budget.status === 'warning' ? 'text-yellow-600' :
                          'text-green-600'
                        }`}>
                          {budget.percentage.toFixed(1)}%
                        </span>
                        {budget.status === 'over' && (
                          <span className="text-xs text-red-500">🚨 Presupuesto excedido</span>
                        )}
                        {budget.status === 'warning' && (
                          <span className="text-xs text-orange-500">⚠️ Cerca del límite</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {dashboardTab === 'goals' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Seguimiento de Metas</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockDashboardData.goals.map((goal, index) => {
                  const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={index} className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">{goal.name}</h4>
                        <span className="text-sm text-blue-600">{goal.progress}%</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="w-full bg-white rounded-full h-3">
                          <div 
                            className="h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Actual</span>
                            <div className="font-semibold text-blue-600">€{goal.current.toLocaleString()}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Objetivo</span>
                            <div className="font-semibold text-purple-600">€{goal.target.toLocaleString()}</div>
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <span className="text-xs text-gray-500">Faltan</span>
                          <div className={`font-medium text-sm ${daysLeft < 30 ? 'text-orange-600' : 'text-green-600'}`}>
                            {daysLeft} días
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dashboardTab === 'investments' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📈</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Sección de Inversiones</h3>
                <p className="text-gray-600 mb-6">Próximamente: Portfolio de inversiones, análisis de rendimiento, y recomendaciones.</p>
                <button 
                  onClick={() => handleQuickAction("Quiero empezar a invertir, ¿qué me recomiendas?")}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all font-medium"
                >
                  Consultar sobre Inversiones
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Main Interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header manteniendo tu diseño actual */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-xl">💰</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">MoneyGuyAI</h1>
              <p className="text-sm text-gray-600">
                {currentView === 'chat' ? 'Tu asistente financiero inteligente' : 'Dashboard financiero'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {usageData && (
              <div className="text-sm text-gray-600">
                {usageData.remaining}/{usageData.limit} mensajes
              </div>
            )}
            <button
              onClick={clearChat}
              className="text-gray-500 hover:text-red-600 transition-colors"
              title="Limpiar chat"
            >
              🗑️
            </button>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-700 transition-colors"
              title="Cerrar sesión"
            >
              🚪
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {currentView === 'chat' ? <ChatView /> : <DashboardView />}
        </div>
      </main>
    </div>
  );
}
