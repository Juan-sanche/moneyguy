'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { api } from '../../lib/api';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Auth form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // App state
  const [currentPage, setCurrentPage] = useState('dashboard');

  // Transactions state
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showEditTransaction, setShowEditTransaction] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  // Add transaction form
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    description: '',
    category: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    date: new Date().toISOString().split('T')[0],
  });
  // Add edit form state
  const [editTransaction, setEditTransaction] = useState({
    amount: '',
    description: '',
    category: '',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    date: '',
  });

  // Budgets state
  const [budgets, setBudgets] = useState<any[]>([]);
  const [isLoadingBudgets, setIsLoadingBudgets] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);

  // Add budget form
  const [newBudget, setNewBudget] = useState({
    category: '',
    amount: '',
    period: 'MONTHLY' as 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  });

  // Goals state
  const [goals, setGoals] = useState<any[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddProgress, setShowAddProgress] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);

  // Add goal form
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    targetAmount: '',
    currentAmount: '0',
    deadline: '',
    category: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
  });

  // Add progress form
  const [newProgress, setNewProgress] = useState({
    amount: '',
    note: '',
  });

  // AI Chat state
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [usageData, setUsageData] = useState<{used: number, limit: number, remaining: number} | null>(null);

  // Profile & Settings state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
  });
  const [settings, setSettings] = useState({
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    notifications: {
      budgetAlerts: true,
      goalReminders: true,
      weeklyReports: false,
      achievements: true,
    },
    privacy: {
      shareData: false,
      publicProfile: false,
    },
    darkMode: false,
  });

  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') {
      setIsLoading(true);
      return;
    }
  
    if (session?.user) {
      setIsAuthenticated(true);
      setUser({
        id: session.user.id,
        email: session.user.email,
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ')[1] || '',
      });
      // Initialize profile data from user
      setProfileData({
        firstName: session.user.name?.split(' ')[0] || '',
        lastName: session.user.name?.split(' ')[1] || '',
        email: session.user.email || '',
        phone: '',
        bio: '',
      });
    }
    setIsLoading(false);
  }, [session, status]);


  // Cargar transacciones cuando el usuario esté autenticado
  useEffect(() => {
    if (session && (currentPage === 'transactions'|| currentPage === 'dashboard')) {
      loadTransactions();
    }
  }, [session, currentPage]);

  // Cargar budgets cuando el usuario esté autenticado
  useEffect(() => {
    if (session && (currentPage === 'budgets'|| currentPage === 'dashboard')) {
      loadBudgets();
    }
  }, [session, currentPage]);

  // Load goals cuando el usuario esté autenticado
  useEffect(() => {
    if (session && (currentPage === 'goals'|| currentPage === 'dashboard')) {
      loadGoals();
    }
  }, [session, currentPage]);

  // Initialize AI chat when user enters chat page
  useEffect(() => {
    if (session && currentPage === 'chat' && messages.length === 0) {
      loadChatHistory();
    }
  }, [session, currentPage]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch('/api/chat?limit=50');
      const result = await response.json();
    
      if (result.success && result.data) {
        const formattedMessages = result.data.map((msg: any) => ({
          id: msg.id,
          text: msg.content,
          sender: msg.role.toLowerCase() === 'user' ? 'user' : 'ai',
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(formattedMessages);
        setUsageData(result.data.usage)
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      // If loading fails, show welcome message
      initializeChat();
    }
  };

  const initializeChat = () => {
    const welcomeMessage = {
      id: Date.now(),
      text: `Hi ${session?.user?.name?.split(' ')[0]}! 👋 I'm your AI financial assistant. I can help you with budgeting, saving tips, investment advice, and analyzing your financial data. What would you like to discuss?`,
      sender: 'ai',
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

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
      // No need to prepare userContext - API will get real data from database
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.text,
          sessionId: 'main-chat', // Optional: use a session ID
        }),
      });

      const result = await response.json();

      if (result.success && result.data?.message) {
        const aiMessage = {
          id: result.data.messageId || Date.now() + 1,
          text: result.data.message,
          sender: 'ai',
          timestamp: new Date(result.data.timestamp),
        };
      
        setMessages(prev => [...prev, aiMessage]);
        setUsageData(result.data.usage);
      } else if (result.error){
        alert(result.error)
      }
    } catch (error) {
      console.error('Error calling AI:', error);
    
      // Fallback message if API fails
      const fallbackMessage = {
        id: Date.now() + 1,
        text: "I'm having trouble connecting right now 🤖 But I'm here to help with your finances! Try asking me about budgeting, saving strategies, or your financial goals.",
        sender: 'ai',
        timestamp: new Date(),
      };
    
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };
  const clearChat = async () => {
  if (confirm('Clear chat history? This cannot be undone.')) {
    setMessages([]);
    initializeChat();
  }
};

  const quickSuggestions = [
    "How can I save more money?",
    "Help me create a budget",
    "Investment tips for beginners",
    "How to build an emergency fund",
  ];

  const handleQuickSuggestion = (suggestion: string) => {
    setNewMessage(suggestion);
  };

  // Profile functions
  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Here you would typically call an API to update profile
      // For now, we'll just update the local user state
      const updatedUser = {
        ...user,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email,
      };
      
      setUser(updatedUser);
      setShowEditProfile(false);
      
      // Show success message
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    }
  };

  const handleSettingToggle = (category: string, setting: string) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...(prev as any)[category],
        [setting]: !(prev as any)[category][setting],
      },
    }));
  };

  const handleSettingChange = (setting: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [setting]: value,
    }));
  };

  const getJoinDate = () => {
    // Mock join date - in real app this would come from user data
    return new Date(2024, 0, 15).toLocaleDateString();
  };

  const getAccountStats = () => {
    return {
      totalTransactions: transactions.length,
      totalBudgets: budgets.length,
      totalGoals: goals.length,
      completedGoals: completedGoals.length,
      accountAge: Math.floor((new Date().getTime() - new Date(2024, 0, 15).getTime()) / (1000 * 60 * 60 * 24)),
    };
  };
  // Dashboard analytics functions
  const getSpendingByCategory = () => {
    const categoryTotals: { [key: string]: number } = {};
  
    transactions.filter(t => t.type === 'EXPENSE').forEach(transaction => {
      // Handle category name properly
      const categoryName = transaction.category?.name || transaction.category || 'Uncategorized';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + Number(transaction.amount);
    });
  
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5); // Top 5 categories
  
    const total = sortedCategories.reduce((sum, [,amount]) => sum + amount, 0);
  
    return sortedCategories.map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }));
  };

  const getMonthlyTrend = () => {
    const monthlyData: { [key: string]: { income: number, expenses: number } } = {};
    
    transactions.forEach(transaction => {
      const month = new Date(transaction.date).toLocaleDateString('en-US', { month: 'short' });
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expenses: 0 };
      }
      
      if (transaction.type === 'INCOME') {
        monthlyData[month].income += Number(transaction.amount);
      } else {
        monthlyData[month].expenses += Number(transaction.amount);
      }
    });
    
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
      net: data.income - data.expenses,
    }));
  };

  const getBudgetHealth = () => {
    return budgets.map(budget => ({
      ...budget,
      healthScore: budget.percentage <= 75 ? 'good' : budget.percentage <= 90 ? 'warning' : 'danger',
    }));
  };

  const getRecentActivity = () => {
    const recentTransactions = [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
    
    const recentGoalUpdates = goals
      .filter(goal => goal.currentAmount > 0)
      .slice(0, 2);
    
    return {
      transactions: recentTransactions,
      goalUpdates: recentGoalUpdates,
    };
  };

  const getFinancialInsights = () => {
    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    const insights = [];
    
    if (savingsRate > 20) {
      insights.push({
        type: 'positive',
        icon: '🎉',
        title: 'Great Savings Rate!',
        description: `You're saving ${savingsRate.toFixed(1)}% of your income`,
      });
    } else if (savingsRate < 10) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        title: 'Low Savings Rate',
        description: `Try to save at least 10-20% of income`,
      });
    }
    
    if (completedGoals.length > 0) {
      insights.push({
        type: 'positive',
        icon: '🏆',
        title: 'Goal Achiever!',
        description: `You've completed ${completedGoals.length} financial goals`,
      });
    }
    
    if (budgets.some(b => b.percentage > 90)) {
      insights.push({
        type: 'warning',
        icon: '💰',
        title: 'Budget Alert',
        description: 'Some budgets are close to their limits',
      });
    }
    
    return insights;
  };
  
  const loadTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch('/api/transactions');
      const result = await response.json();
  
      if (result.success && result.data) {
      
        const transactionsWithCategories = result.data.map((transaction: any) => {
          return {
            ...transaction,
            amount: Number(transaction.amount),
            category: transaction.category?.name || transaction.category || 'Uncategorized'
          };
        });
      
        setTransactions(transactionsWithCategories);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const transactionData = {
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.description,
        category: newTransaction.category,
        type: newTransaction.type,
        date: newTransaction.date,
      };
      

      await api.createTransaction(transactionData);
      
      // Recargar transacciones
      await loadTransactions();
      
      // Limpiar form
      setNewTransaction({
        amount: '',
        description: '',
        category: '',
        type: 'EXPENSE',
        date: new Date().toISOString().split('T')[0],
      });
      
      setShowAddTransaction(false);
      
      // Si estamos en dashboard, ir a transactions
      if (currentPage === 'dashboard') {
        setCurrentPage('transactions');
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Error adding transaction');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      try {
        await api.deleteTransaction(id);
        await loadTransactions();
      } catch (error) {
        console.error('Error deleting transaction:', error);
        alert('Error deleting transaction');
      }
    }
  };
  const handleEditTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
  
    if (!editingTransaction) return;
  
    try {
      const transactionData = {
        amount: parseFloat(editTransaction.amount),
        description: editTransaction.description,
        category: editTransaction.category,
        type: editTransaction.type,
        date: editTransaction.date,
      };

      // You'll need to add this API method
      await api.updateTransaction(editingTransaction.id, transactionData);
    
      // Reload transactions
      await loadTransactions();
    
      // Close modal
      setShowEditTransaction(false);
      setEditingTransaction(null);
    
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Error updating transaction');
    }
  };

  const openEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setEditTransaction({
      amount: transaction.amount.toString(),
      description: transaction.description,
      category: transaction.category?.name || transaction.category || '',
      type: transaction.type,
      date: new Date(transaction.date).toISOString().split('T')[0],
    });
    setShowEditTransaction(true);
  };


  const loadBudgets = async () => {
    setIsLoadingBudgets(true);
    try {
      const data = await api.getBudgets();
      setBudgets(data);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setIsLoadingBudgets(false);
    }
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const budgetData = {
        category: newBudget.category,
        amount: parseFloat(newBudget.amount),
        period: newBudget.period,
        startDate: newBudget.startDate,
        endDate: newBudget.endDate,
      };

      await api.createBudget(budgetData);
      
      // Recargar budgets
      await loadBudgets();
      
      // Limpiar form
      setNewBudget({
        category: '',
        amount: '',
        period: 'MONTHLY',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      });
      
      setShowAddBudget(false);
      
      // Si estamos en dashboard, ir a budgets
      if (currentPage === 'dashboard') {
        setCurrentPage('budgets');
      }
    } catch (error) {
      console.error('Error adding budget:', error);
      alert('Error adding budget');
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (confirm('Are you sure you want to delete this budget?')) {
      try {
        await api.deleteBudget(id);
        await loadBudgets();
      } catch (error) {
        console.error('Error deleting budget:', error);
        alert('Error deleting budget');
      }
    }
  };

  // Goals functions
  const loadGoals = async () => {
    setIsLoadingGoals(true);
    try {
      const data = await api.getGoals();
      setGoals(data);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setIsLoadingGoals(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const goalData = {
        title: newGoal.title,
        description: newGoal.description,
        targetAmount: parseFloat(newGoal.targetAmount),
        currentAmount: parseFloat(newGoal.currentAmount),
        deadline: newGoal.deadline,
        category: newGoal.category,
        priority: newGoal.priority,
      };

      await api.createGoal(goalData);
      
      // Recargar goals
      await loadGoals();
      
      // Limpiar form
      setNewGoal({
        title: '',
        description: '',
        targetAmount: '',
        currentAmount: '0',
        deadline: '',
        category: '',
        priority: 'MEDIUM',
      });
      
      setShowAddGoal(false);
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Error adding goal');
    }
  };

  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGoal) return;
    
    try {
      const progressData = {
        goalId: selectedGoal.id,
        amount: parseFloat(newProgress.amount),
        note: newProgress.note,
      };

      await api.updateGoalProgress(selectedGoal.id, parseFloat(newProgress.amount));
      
      // Recargar goalsf
      await loadGoals();
      
      // Limpiar form
      setNewProgress({
        amount: '',
        note: '',
      });
      
      setShowAddProgress(false);
      setSelectedGoal(null);
    } catch (error) {
      console.error('Error adding progress:', error);
      alert('Error adding progress');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      try {
        await api.deleteGoal(id);
        await loadGoals();
      } catch (error) {
        console.error('Error deleting goal:', error);
        alert('Error deleting goal');
      }
    }
  };

  const openAddProgress = (goal: any) => {
    setSelectedGoal(goal);
    setShowAddProgress(true);
  };

  const getGoalStatus = (goal: any) => {
    const now = new Date();
    const deadline = new Date(goal.deadline);
    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    
    if (progress >= 100) return 'COMPLETED';
    if (deadline < now) return 'OVERDUE';
    return 'IN_PROGRESS';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-500';
      case 'OVERDUE': return 'bg-red-500';
      case 'IN_PROGRESS': return 'bg-blue-500';
      case 'ON_TRACK': return 'bg-green-500';
      case 'WARNING': return 'bg-yellow-500';
      case 'OVER_BUDGET': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-700';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
      case 'LOW': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const activeGoals = goals.filter(goal => getGoalStatus(goal) !== 'COMPLETED');
  const completedGoals = goals.filter(goal => getGoalStatus(goal) === 'COMPLETED');

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
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (authMode === 'register') {
      if (!formData.firstName) errors.firstName = 'First name is required';
      if (!formData.lastName) errors.lastName = 'Last name is required';
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
          setFormErrors({ submit: 'Invalid email or password' });
          setIsSubmitting(false);
          return;
        }
        // Session will update automatically through useEffect
    }   else {
        // Registration
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            firstName: formData.firstName,
            lastName: formData.lastName,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setFormErrors({ submit: result.error || 'Registration failed' });
          setIsSubmitting(false);
          return;
        }

        // After successful registration, automatically sign in
        const signInResult = await signIn('credentials', {
          email: formData.email,
          password: formData.password,
          redirect: false,
        });

        if (signInResult?.error) {
          // Registration succeeded but login failed - shouldn't happen
          setFormErrors({ submit: 'Registration successful! Please try logging in.' });
          setAuthMode('login');
          setIsSubmitting(false);
          return;
        }
        // Session will update automatically
      }
    } catch (error) {
      setFormErrors({ submit: 'Something went wrong' });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    setUser(null);
    setTransactions([]);
    setBudgets([]);
    setGoals([]);
    setMessages([]);
    setFormData({ email: '', password: '', firstName: '', lastName: '' });
  };

  if (status==="loading") {
    return (
      <div className="min-h-screen buddy-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 mx-auto">
            <span className="text-3xl">💰</span>
          </div>
          <h2 className="text-white text-xl font-semibold">Loading MoneyGuy...</h2>
        </div>
      </div>
    );
  }

  // Auth Form
  if (!session) {
    return (
      <div className="min-h-screen buddy-gradient flex items-center justify-center p-4">
        <div className="buddy-card w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
              <span className="text-3xl">💰</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {authMode === 'login' ? 'Welcome Back' : 'Join MoneyGuy'}
            </h1>
            <p className="text-gray-600 mt-2">
              {authMode === 'login' 
                ? 'Sign in to your account' 
                : 'Create your account to start'
              }
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="John"
                  />
                  {formErrors.firstName && <p className="text-sm text-red-600 mt-1">{formErrors.firstName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="input-field"
                    placeholder="Doe"
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
                className="input-field"
                placeholder="you@example.com"
              />
              {formErrors.email && <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Enter password"
              />
              {formErrors.password && <p className="text-sm text-red-600 mt-1">{formErrors.password}</p>}
            </div>

            {formErrors.submit && (
              <div className="text-sm text-red-600 text-center">{formErrors.submit}</div>
            )}

            <button type="submit" className="w-full buddy-button" disabled={isSubmitting}>
              {isSubmitting 
                ? (authMode === 'login' ? 'Signing in...' : 'Creating account...') 
                : (authMode === 'login' ? 'Sign In' : 'Create Account')
              }
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-blue-600 hover:underline font-medium"
              >
                {authMode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main App - Mobile Navigation
  const navigation = [
    { name: 'Dashboard', id: 'dashboard', emoji: '📊' },
    { name: 'Transactions', id: 'transactions', emoji: '💳' },
    { name: 'Budgets', id: 'budgets', emoji: '🎯' },
    { name: 'Goals', id: 'goals', emoji: '🏆' },
    { name: 'Chat with AI', id: 'chat', emoji: '🤖' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 pb-20">
      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="buddy-card w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Transaction</h3>
              <button
                onClick={() => setShowAddTransaction(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field"
                  placeholder="What was this for?"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={newTransaction.category}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field"
                  placeholder="Food, Transportation, etc."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newTransaction.type}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, type: e.target.value as 'INCOME' | 'EXPENSE' }))}
                  className="input-field"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))}
                  className="input-field"
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 buddy-button">
                  Add Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditTransaction && editingTransaction && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="buddy-card w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">✏️ Edit Transaction</h3>
              <button
                onClick={() => {
                  setShowEditTransaction(false);
                  setEditingTransaction(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleEditTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={editTransaction.amount}
                  onChange={(e) => setEditTransaction(prev => ({ ...prev, amount: e.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={editTransaction.description}
                  onChange={(e) => setEditTransaction(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field"
                  placeholder="What was this for?"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editTransaction.category}
                  onChange={(e) => setEditTransaction(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field"
                  placeholder="Food, Transportation, etc."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={editTransaction.type}
                  onChange={(e) => setEditTransaction(prev => ({ ...prev, type: e.target.value as 'INCOME' | 'EXPENSE' }))}
                  className="input-field"
                >
                  <option value="EXPENSE">Expense</option>
                  <option value="INCOME">Income</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={editTransaction.date}
                  onChange={(e) => setEditTransaction(prev => ({ ...prev, date: e.target.value }))}
                  className="input-field"
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditTransaction(false);
                    setEditingTransaction(null);
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 buddy-button">
                  💾 Update Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Budget Modal */}
      {showAddBudget && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="buddy-card w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create Budget</h3>
              <button
                onClick={() => setShowAddBudget(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddBudget} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={newBudget.category}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, category: e.target.value }))}
                  className="input-field"
                  placeholder="Food, Transportation, etc."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBudget.amount}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, amount: e.target.value }))}
                  className="input-field"
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select
                  value={newBudget.period}
                  onChange={(e) => setNewBudget(prev => ({ ...prev, period: e.target.value as any }))}
                  className="input-field"
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newBudget.startDate}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, startDate: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newBudget.endDate}
                    onChange={(e) => setNewBudget(prev => ({ ...prev, endDate: e.target.value }))}
                    className="input-field"
                  />
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddBudget(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 buddy-button">
                  Create Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="buddy-card w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">🏆 Create New Goal</h3>
              <button
                onClick={() => setShowAddGoal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Title</label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  className="input-field"
                  placeholder="Emergency Fund, New Car, Vacation..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field"
                  placeholder="Describe your goal..."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, targetAmount: e.target.value }))}
                    className="input-field"
                    placeholder="10000.00"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Starting Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newGoal.currentAmount}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, currentAmount: e.target.value }))}
                    className="input-field"
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline</label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, deadline: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={newGoal.category}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, category: e.target.value }))}
                    className="input-field"
                    placeholder="Savings, Investment, Travel..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={newGoal.priority}
                    onChange={(e) => setNewGoal(prev => ({ ...prev, priority: e.target.value as any }))}
                    className="input-field"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </select>
                </div>
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddGoal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 buddy-button">
                  🚀 Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Progress Modal */}
      {showAddProgress && selectedGoal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="buddy-card w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">📈 Add Progress</h3>
              <button
                onClick={() => {
                  setShowAddProgress(false);
                  setSelectedGoal(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="font-medium text-blue-900">{selectedGoal.title}</p>
              <p className="text-sm text-blue-700">
                Current: ${Number(selectedGoal.currentAmount).toFixed(2)} / ${Number(selectedGoal.targetAmount).toFixed(2)}
              </p>
            </div>
            
            <form onSubmit={handleAddProgress} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Progress Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={newProgress.amount}
                  onChange={(e) => setNewProgress(prev => ({ ...prev, amount: e.target.value }))}
                  className="input-field"
                  placeholder="500.00"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  value={newProgress.note}
                  onChange={(e) => setNewProgress(prev => ({ ...prev, note: e.target.value }))}
                  className="input-field"
                  placeholder="Bonus from work, savings..."
                />
              </div>
              
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProgress(false);
                    setSelectedGoal(null);
                  }}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 buddy-button">
                  💪 Add Progress
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="p-4 lg:p-8">
        {/* ENHANCED DASHBOARD */}
        {currentPage === 'dashboard' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.firstName}! Here's your financial overview</p>
            </div>

            {/* Quick Actions */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">⚡ Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  className="p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  onClick={() => setShowAddTransaction(true)}
                >
                  <div className="text-2xl mb-1">💳</div>
                  <div className="text-sm font-medium">Add Transaction</div>
                </button>
                <button 
                  className="p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  onClick={() => setShowAddGoal(true)}
                >
                  <div className="text-2xl mb-1">🎯</div>
                  <div className="text-sm font-medium">Create Goal</div>
                </button>
                <button 
                  className="p-4 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                  onClick={() => setShowAddBudget(true)}
                >
                  <div className="text-2xl mb-1">📊</div>
                  <div className="text-sm font-medium">New Budget</div>
                </button>
                <button 
                  className="p-4 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition-colors"
                  onClick={() => setCurrentPage('chat')}
                >
                  <div className="text-2xl mb-1">🤖</div>
                  <div className="text-sm font-medium">Ask AI</div>
                </button>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Balance</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  ${(
                    transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0) -
                    transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0)
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">Net worth from transactions</p>
              </div>

              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Income</h3>
                  <span className="text-2xl">📈</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  ${transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">{transactions.filter(t => t.type === 'INCOME').length} income transactions</p>
              </div>

              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Expenses</h3>
                  <span className="text-2xl">📉</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  ${transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">{transactions.filter(t => t.type === 'EXPENSE').length} expense transactions</p>
              </div>

              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Savings Rate</h3>
                  <span className="text-2xl">💪</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  {(() => {
                    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
                    const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
                    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
                    return `${savingsRate.toFixed(1)}%`;
                  })()}
                </div>
                <p className="text-xs text-gray-500">
                  {(() => {
                    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
                    const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
                    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
                    return savingsRate >= 20 ? 'Excellent progress!' : 
                          savingsRate >= 10 ? 'Good progress!' : 
                          'Try to save more!';
                  })()}
                </p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Spending by Category */}
              <div className="buddy-card">
                <h3 className="text-lg font-semibold mb-4">📊 Spending by Category</h3>
                {getSpendingByCategory().length > 0 ? (
                  <div className="space-y-3">
                    {getSpendingByCategory().map((item, index) => (
                      <div key={item.category} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{item.category}</span>
                          <span className="text-gray-600">${Number(item.amount).toFixed(0)} ({Number(item.percentage).toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-500 ${
                              index === 0 ? 'bg-blue-500' : 
                              index === 1 ? 'bg-green-500' :
                              index === 2 ? 'bg-purple-500' :
                              index === 3 ? 'bg-orange-500' : 'bg-pink-500'
                            }`}
                            style={{ width: `${item.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📊</div>
                    <p>No expense data yet</p>
                  </div>
                )}
              </div>

              {/* Monthly Trend */}
              <div className="buddy-card">
                <h3 className="text-lg font-semibold mb-4">📈 Monthly Trend</h3>
                {getMonthlyTrend().length > 0 ? (
                  <div className="space-y-4">
                    {getMonthlyTrend().map((month) => (
                      <div key={month.month} className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                          <span>{month.month}</span>
                          <span className={month.net >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {month.net >= 0 ? '+' : ''}${Number(month.net).toFixed(0)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-green-100 rounded text-center py-1">
                            <div className="text-xs text-green-700">Income</div>
                            <div className="text-sm font-medium text-green-800">${Number(month.income).toFixed(0)}</div>
                          </div>
                          <div className="bg-red-100 rounded text-center py-1">
                            <div className="text-xs text-red-700">Expenses</div>
                            <div className="text-sm font-medium text-red-800">${Number(month.expenses).toFixed(0)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📈</div>
                    <p>No trend data yet</p>
                  </div>
                )}
              </div>
            </div>
            {/* Goals Progress */}
            {activeGoals.length > 0 && (
              <div className="buddy-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">🎯 Active Goals Progress</h3>
                  <button 
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    onClick={() => setCurrentPage('goals')}
                  >
                    View All →
                  </button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {activeGoals.slice(0, 4).map((goal) => {
                    const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
                    const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={goal.id} className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-medium text-gray-900">{goal.title}</h4>
                          <span className="text-sm text-gray-600">{Number(progress).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-2 mb-2">
                          <div 
                            className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>${Number(goal.currentAmount).toLocaleString()} / ${Number(goal.targetAmount).toLocaleString()}</span>
                          <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Overdue'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Budget Health */}
            {budgets.length > 0 && (
              <div className="buddy-card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">💰 Budget Health</h3>
                  <button 
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    onClick={() => setCurrentPage('budgets')}
                  >
                    Manage →
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {getBudgetHealth().slice(0, 6).map((budget) => (
                    <div key={budget.id} className={`p-3 rounded-lg border-l-4 ${
                      budget.healthScore === 'good' ? 'border-green-500 bg-green-50' :
                      budget.healthScore === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                      'border-red-500 bg-red-50'
                    }`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-sm">{budget.category?.name || budget.category || 'Uncategorized'}</h4>
                          <p className="text-xs text-gray-600">${budget.spent} / ${Number(budget.amount)}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          budget.healthScore === 'good' ? 'bg-green-100 text-green-700' :
                          budget.healthScore === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {budget.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Insights */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">💡 Financial Insights</h3>
              <div className="space-y-3">
                {getFinancialInsights().map((insight, index) => (
                  <div key={index} className={`p-4 rounded-lg border-l-4 ${
                    insight.type === 'positive' ? 'border-green-500 bg-green-50' :
                    'border-yellow-500 bg-yellow-50'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl">{insight.icon}</div>
                      <div>
                        <h4 className="font-medium text-gray-900">{insight.title}</h4>
                        <p className="text-sm text-gray-600">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {getFinancialInsights().length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-4xl mb-2">💡</div>
                    <p>Add more transactions to see personalized insights!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">📋 Recent Activity</h3>
              <div className="space-y-4">
                {/* Recent Transactions */}
                {getRecentActivity().transactions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Latest Transactions</h4>
                    <div className="space-y-2">
                      {getRecentActivity().transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                              transaction.type === 'INCOME' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}>
                              {transaction.type === 'INCOME' ? '↗' : '↘'}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{transaction.description}</p>
                              <p className="text-xs text-gray-500">{transaction.category}</p>
                            </div>
                          </div>
                          <div className={`text-sm font-medium ${
                            transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'INCOME' ? '+' : '-'}${Number(transaction.amount).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Goal Updates */}
                {getRecentActivity().goalUpdates.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Goal Progress</h4>
                    <div className="space-y-2">
                      {getRecentActivity().goalUpdates.map((goal) => (
                        <div key={goal.id} className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm">
                              🎯
                            </div>
                            <div>
                              <p className="text-sm font-medium">{goal.title}</p>
                              <p className="text-xs text-blue-600">
                                {Number((goal.currentAmount / goal.targetAmount) * 100).toFixed(1)}% complete
                              </p>
                            </div>
                          </div>
                          <div className="text-sm text-blue-600 font-medium">
                            ${goal.currentAmount.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {getRecentActivity().transactions.length === 0 && getRecentActivity().goalUpdates.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <div className="text-4xl mb-2">📋</div>
                    <p>No recent activity yet. Start by adding a transaction!</p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Profile Access */}
            <div className="buddy-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold">{user?.firstName} {user?.lastName}</h3>
                    <p className="text-sm text-gray-600">MoneyGuy Member since {getJoinDate()}</p>
                  </div>
                </div>
                <button 
                  className="text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => setCurrentPage('profile')}
                >
                  View Profile →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE & SETTINGS */}
        {currentPage === 'profile' && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div className="buddy-card text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-3xl">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{user?.firstName} {user?.lastName}</h1>
              <p className="text-gray-600">{user?.email}</p>
              <p className="text-sm text-gray-500 mt-1">Member since {getJoinDate()}</p>
              
              <button 
                className="buddy-button mt-4"
                onClick={() => setShowEditProfile(true)}
              >
                ✏️ Edit Profile
              </button>
            </div>

            {/* Account Statistics */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">📊 Account Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{getAccountStats().totalTransactions}</div>
                  <div className="text-sm text-gray-600">Transactions</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{getAccountStats().completedGoals}</div>
                  <div className="text-sm text-gray-600">Goals Achieved</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{getAccountStats().totalBudgets}</div>
                  <div className="text-sm text-gray-600">Active Budgets</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{getAccountStats().accountAge}</div>
                  <div className="text-sm text-gray-600">Days Active</div>
                </div>
              </div>
            </div>

            {/* App Settings */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">⚙️ App Settings</h3>
              
              <div className="space-y-4">
                {/* Currency Setting */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Currency</h4>
                    <p className="text-sm text-gray-600">Default currency for amounts</p>
                  </div>
                  <select
                    value={settings.currency}
                    onChange={(e) => handleSettingChange('currency', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>

                {/* Date Format Setting */}
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Date Format</h4>
                    <p className="text-sm text-gray-600">How dates are displayed</p>
                  </div>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-lg"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">🔔 Notifications</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Budget Alerts</h4>
                    <p className="text-sm text-gray-600">Get notified when you exceed budgets</p>
                  </div>
                  <button
                    onClick={() => handleSettingToggle('notifications', 'budgetAlerts')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.notifications.budgetAlerts ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.notifications.budgetAlerts ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Goal Reminders</h4>
                    <p className="text-sm text-gray-600">Reminders to update goal progress</p>
                  </div>
                  <button
                    onClick={() => handleSettingToggle('notifications', 'goalReminders')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.notifications.goalReminders ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.notifications.goalReminders ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Weekly Reports</h4>
                    <p className="text-sm text-gray-600">Weekly spending summary emails</p>
                  </div>
                  <button
                    onClick={() => handleSettingToggle('notifications', 'weeklyReports')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.notifications.weeklyReports ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.notifications.weeklyReports ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Achievement Alerts</h4>
                    <p className="text-sm text-gray-600">Celebrate when you complete goals</p>
                  </div>
                  <button
                    onClick={() => handleSettingToggle('notifications', 'achievements')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.notifications.achievements ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.notifications.achievements ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">🔒 Privacy</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Share Anonymous Data</h4>
                    <p className="text-sm text-gray-600">Help improve MoneyGuy with usage data</p>
                  </div>
                  <button
                    onClick={() => handleSettingToggle('privacy', 'shareData')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.privacy.shareData ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.privacy.shareData ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Public Profile</h4>
                    <p className="text-sm text-gray-600">Allow others to see your achievements</p>
                  </div>
                  <button
                    onClick={() => handleSettingToggle('privacy', 'publicProfile')}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.privacy.publicProfile ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.privacy.publicProfile ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Account Management */}
            <div className="buddy-card">
              <h3 className="text-lg font-semibold mb-4">👤 Account Management</h3>
              
              <div className="space-y-3">
                <button className="w-full py-3 px-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-left">
                  🔑 Change Password
                </button>
                
                <button className="w-full py-3 px-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-left">
                  📄 Export My Data
                </button>
                
                <button 
                  onClick={handleLogout}
                  className="w-full py-3 px-4 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  🚪 Sign Out
                </button>
                
                <button className="w-full py-3 px-4 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-left">
                  🗑️ Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditProfile && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="buddy-card w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">✏️ Edit Profile</h3>
                <button
                  onClick={() => setShowEditProfile(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleEditProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                    className="input-field"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio (Optional)</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    className="input-field h-20 resize-none"
                    placeholder="Tell us a bit about yourself..."
                  />
                </div>
                
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowEditProfile(false)}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 buddy-button">
                    💾 Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TRANSACTIONS */}
        {currentPage === 'transactions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Transactions</h1>
                <p className="text-gray-600">Track and manage all your financial transactions</p>
              </div>
              <button 
                className="buddy-button"
                onClick={() => setShowAddTransaction(true)}
              >
                ➕ Add Transaction
              </button>
            </div>

            {/* Search Bar */}
            <div className="buddy-card">
              <div className="flex items-center space-x-4">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2">🔍</span>
                  <input
                    placeholder="Search transactions..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button className="py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50">
                  🔽 Filter
                </button>
              </div>
            </div>

            {/* Transactions List */}
            <div className="buddy-card">
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold">Recent Transactions</h3>
                <p className="text-gray-600">Your latest financial activities</p>
              </div>
              
              {isLoadingTransactions ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">⏳</div>
                  <p className="text-gray-500">Loading transactions...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">💳</div>
                  <p className="text-gray-500">No transactions yet</p>
                  <button 
                    className="buddy-button mt-4"
                    onClick={() => setShowAddTransaction(true)}
                  >
                    Add Your First Transaction
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          transaction.type === 'INCOME' 
                            ? 'bg-green-100' 
                            : 'bg-red-100'
                        }`}>
                          {transaction.type === 'INCOME' ? '⬆️' : '⬇️'}
                        </div>
                        <div>
                          <p className="font-medium">{transaction.description}</p>
                          <p className="text-sm text-gray-500">
                            {transaction.category} • {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`font-semibold ${
                          transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'INCOME' ? '+' : '-'}
                          ${Number(transaction.amount).toFixed(2)}
                        </div>
                        <button
                          onClick={() => openEditTransaction(transaction)}
                          className="text-blue-500 hover:text-blue-700 p-1"
                          title="Edit transaction"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(transaction.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Delete transaction"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* BUDGETS */}
        {currentPage === 'budgets' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">Budgets</h1>
                <p className="text-gray-600">Track your spending and stay within your budget limits</p>
              </div>
              <button 
                className="buddy-button"
                onClick={() => setShowAddBudget(true)}
              >
                ➕ Create Budget
              </button>
            </div>

            {/* Budget Overview Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Budgets</h3>
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="text-2xl font-bold">{budgets.length}</div>
                <p className="text-xs text-gray-500">Active budget categories</p>
              </div>
              
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Allocated</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  ${Number(budgets.reduce((sum, b) => sum + b.amount, 0)).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">Across all categories</p>
              </div>
              
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Spent</h3>
                  <span className="text-2xl">📊</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  ${Number(budgets.reduce((sum, b) => sum + (b.spent || 0), 0)).toFixed(2)}
                </div>
                <p className="text-xs text-gray-500">This period</p>
              </div>
            </div>

            {/* Budgets List */}
            <div className="buddy-card">
              <div className="border-b pb-4 mb-4">
                <h3 className="text-lg font-semibold">Your Budgets</h3>
                <p className="text-gray-600">Monitor your spending across different categories</p>
              </div>
              
              {isLoadingBudgets ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">⏳</div>
                  <p className="text-gray-500">Loading budgets...</p>
                </div>
              ) : budgets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2">🎯</div>
                  <p className="text-gray-500">No budgets yet</p>
                  <button 
                    className="buddy-button mt-4"
                    onClick={() => setShowAddBudget(true)}
                  >
                    Create Your First Budget
                  </button>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {budgets.map((budget) => (
                    <div key={budget.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold">{budget.category?.name || budget.category || 'Uncategorized'}</h3>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            budget.status === 'ON_TRACK' ? 'bg-green-100 text-green-700' :
                            budget.status === 'WARNING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {budget.percentage}%
                          </span>
                          <button
                            onClick={() => handleDeleteBudget(budget.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Delete budget"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>${budget.spent} / ${Number(budget.amount)}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-300 ${getStatusColor(budget.status)}`}
                              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Remaining:</span>
                          <span className={`font-medium ${budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Number(budget.remaining).toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Period:</span>
                          <span className="capitalize">{budget.period.toLowerCase()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GOALS */}
        {currentPage === 'goals' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">🏆 Goals</h1>
                <p className="text-gray-600">Set and track your financial goals to achieve your dreams</p>
              </div>
              <button 
                className="buddy-button"
                onClick={() => setShowAddGoal(true)}
              >
                ✨ Create Goal
              </button>
            </div>

            {/* Goals Overview Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Goals</h3>
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="text-2xl font-bold">{goals.length}</div>
                <p className="text-xs text-gray-500">All time goals</p>
              </div>
              
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Active Goals</h3>
                  <span className="text-2xl">🚀</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">{activeGoals.length}</div>
                <p className="text-xs text-gray-500">In progress</p>
              </div>
              
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Completed</h3>
                  <span className="text-2xl">🎉</span>
                </div>
                <div className="text-2xl font-bold text-green-600">{completedGoals.length}</div>
                <p className="text-xs text-gray-500">Achieved goals</p>
              </div>
              
              <div className="buddy-card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Target</h3>
                  <span className="text-2xl">💰</span>
                </div>
                <div className="text-2xl font-bold text-purple-600">
                  ${goals.reduce((sum, g) => sum + g.targetAmount, 0).toLocaleString()}
                </div>
                <p className="text-xs text-gray-500">Dream value</p>
              </div>
            </div>

            {isLoadingGoals ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">⏳</div>
                <p className="text-gray-500">Loading goals...</p>
              </div>
            ) : goals.length === 0 ? (
              <div className="buddy-card text-center py-12">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-xl font-semibold mb-2">No goals yet</h3>
                <p className="text-gray-500 mb-6">Start your financial journey by creating your first goal!</p>
                <button 
                  className="buddy-button"
                  onClick={() => setShowAddGoal(true)}
                >
                  🚀 Create Your First Goal
                </button>
              </div>
            ) : (
              <>
                {/* Active Goals Section */}
                {activeGoals.length > 0 && (
                  <div className="buddy-card">
                    <div className="border-b pb-4 mb-6">
                      <h3 className="text-lg font-semibold">🚀 Active Goals</h3>
                      <p className="text-gray-600">Goals you're currently working towards</p>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {activeGoals.map((goal) => {
                        const status = getGoalStatus(goal);
                        const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
                        const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
                        const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        
                        return (
                          <div key={goal.id} className="border rounded-lg p-5 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white to-blue-50">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <h4 className="text-lg font-semibold text-gray-900">{goal.title}</h4>
                                <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(goal.priority)}`}>
                                  {goal.priority}
                                </span>
                                <button
                                  onClick={() => handleDeleteGoal(goal.id)}
                                  className="text-red-500 hover:text-red-700 p-1"
                                  title="Delete goal"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Progress</span>
                                  <span className="font-medium">{Number(progress).toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div 
                                    className={`h-3 rounded-full transition-all duration-500 ${
                                      status === 'OVERDUE' ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500 block">Current</span>
                                  <span className="font-semibold text-blue-600">${Number(goal.currentAmount).toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">Target</span>
                                  <span className="font-semibold text-purple-600">${Number(goal.targetAmount).toLocaleString()}</span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500 block">Remaining</span>
                                  <span className="font-semibold text-orange-600">${remaining.toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">Days Left</span>
                                  <span className={`font-semibold ${daysLeft < 0 ? 'text-red-600' : daysLeft < 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                                    {daysLeft < 0 ? 'Overdue' : `${daysLeft} days`}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Category:</span>
                                <span className="font-medium text-gray-700">{goal.category}</span>
                              </div>
                              
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Status:</span>
                                <span className={`font-medium px-2 py-1 rounded-full text-xs ${
                                  status === 'OVERDUE' ? 'bg-red-100 text-red-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {status === 'OVERDUE' ? '⚠️ Overdue' : '🚀 In Progress'}
                                </span>
                              </div>
                              
                              <button
                                onClick={() => openAddProgress(goal)}
                                className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                              >
                                📈 Add Progress
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Completed Goals Section */}
                {completedGoals.length > 0 && (
                  <div className="buddy-card">
                    <div className="border-b pb-4 mb-6">
                      <h3 className="text-lg font-semibold">🎉 Completed Goals</h3>
                      <p className="text-gray-600">Congratulations on achieving these goals!</p>
                    </div>
                    
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {completedGoals.map((goal) => {
                        const completedDate = new Date(goal.updatedAt).toLocaleDateString();
                        
                        return (
                          <div key={goal.id} className="border rounded-lg p-5 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-lg transition-all duration-300">
                            <div className="flex justify-between items-start mb-4">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="text-lg font-semibold text-gray-900">{goal.title}</h4>
                                  <span className="text-2xl">🎉</span>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                              </div>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                                title="Delete goal"
                              >
                                🗑️
                              </button>
                            </div>
                            
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Progress</span>
                                  <span className="font-medium text-green-600">100% ✅</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                  <div className="h-3 rounded-full bg-green-500 w-full transition-all duration-500" />
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500 block">Achieved</span>
                                  <span className="font-semibold text-green-600">${Number(goal.currentAmount).toLocaleString()}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">Target</span>
                                  <span className="font-semibold text-green-600">${Number(goal.targetAmount).toLocaleString()}</span>
                                </div>
                              </div>
                              
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Completed:</span>
                                <span className="font-medium text-green-700">{completedDate}</span>
                              </div>
                              
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Category:</span>
                                <span className="font-medium text-gray-700">{goal.category}</span>
                              </div>
                              
                              <div className="p-3 bg-green-100 rounded-lg text-center">
                                <span className="text-green-800 font-medium">🏆 Goal Completed!</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* CHAT WITH AI - ENHANCED WITH OPENAI */}
      {currentPage === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-140px)]">
          {/* Chat Header */}
          <div className="buddy-card mb-4">
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold">🤖 AI Financial Assistant</h1>
                <p className="text-gray-600">Your personal finance advisor powered by OpenAI</p>
              </div>
              <button
                onClick={clearChat}
                className="px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                title="Clear chat history"
              >
                🗑️ Clear
              </button>
            </div>
          </div>

          {/* Quick Suggestions - Only show when no messages */}
          {messages.length <= 1 && (
            <div className="buddy-card mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Questions:</h3>
              <div className="grid grid-cols-1 gap-2">
                {quickSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickSuggestion(suggestion)}
                    className="text-left p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                  >
                    💡 {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages Container */}
          <div className="flex-1 buddy-card overflow-hidden flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}

              {/* AI Typing Indicator */}
              {isAiTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">AI is thinking...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="border-t p-4">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isAiTyping && sendMessage()}
                  placeholder="Ask me anything about your finances..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isAiTyping}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isAiTyping}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    newMessage.trim() && !isAiTyping
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isAiTyping ? '...' : '📤'}
                </button>
              </div>
              
              {/* Show context hint */}
              <p className="text-xs text-gray-500 mt-2 text-center">
                💡 I can see your {transactions.length} transactions, {budgets.length} budgets, and {goals.length} goals
                <br />
                📊 Messages today: {usageData?.used || 0}/{usageData?.limit || 10} remaining: {usageData?.remaining || 10}
              </p>
            </div>
          </div>
        </div>
      )}
      
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="grid grid-cols-5 h-16">
          {navigation.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`flex flex-col items-center justify-center space-y-1 transition-colors ${
                  isActive 
                    ? 'text-blue-600 bg-blue-50' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{item.emoji}</span>
                <span className="text-xs font-medium">
                  {item.name === 'Chat with AI' ? 'Chat' : item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
