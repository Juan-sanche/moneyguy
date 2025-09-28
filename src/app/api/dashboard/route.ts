// src/app/api/dashboard/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, errorResponse, successResponse } from '../../../../lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DashboardMetric {
  id: string;
  title: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  format: 'currency' | 'percentage' | 'number' | 'days';
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

interface ChartData {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'donut';
  data: any[];
  config: {
    xKey?: string;
    yKey?: string;
    categoryKey?: string;
    valueKey?: string;
    colors?: string[];
  };
}

// GET /api/dashboard - Generar dashboard dinámico
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview'; // overview, detailed, custom
    const period = searchParams.get('period') || 'monthly'; // weekly, monthly, quarterly, yearly
    
    // Generar métricas y gráficos según el tipo solicitado
    const dashboardData = await generateDynamicDashboard(user.id, type, period);
    
    return successResponse({
      success: true,
      data: dashboardData,
      message: 'Dynamic dashboard generated successfully'
    });

  } catch (error) {
    console.error('Error generating dashboard:', error);
    return errorResponse('Failed to generate dashboard', 500);
  }
}

async function generateDynamicDashboard(userId: string, type: string, period: string) {
  // Obtener datos base
  const [transactions, budgets, goals, alerts] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 500 // Últimas 500 transacciones
    }),
    prisma.budget.findMany({
      where: { userId },
      include: { category: true }
    }),
    prisma.goal.findMany({
      where: { userId }
    }),
    prisma.alert.findMany({
      where: { userId, isActive: true },
      take: 10
    })
  ]);

  // Calcular período de análisis
  const periodDates = calculatePeriodDates(period);
  const filteredTransactions = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    return transactionDate >= periodDates.start && transactionDate <= periodDates.end;
  });

  // Generar métricas clave
  const metrics = generateKeyMetrics(filteredTransactions, budgets, goals);
  
  // Generar gráficos dinámicos
  const charts = await generateDynamicCharts(userId, filteredTransactions, budgets, goals, type);
  
  // Generar insights automáticos
  const insights = generateAutomaticInsights(filteredTransactions, budgets, goals);

  return {
    period: {
      type: period,
      start: periodDates.start,
      end: periodDates.end,
      label: formatPeriodLabel(period, periodDates)
    },
    metrics,
    charts,
    insights,
    alerts: alerts.slice(0, 5), // Top 5 alertas
    summary: generateExecutiveSummary(metrics, insights)
  };
}

function calculatePeriodDates(period: string) {
  const now = new Date();
  let start: Date, end: Date = now;

  switch (period) {
    case 'weekly':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarterly':
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { start, end };
}

function generateKeyMetrics(transactions: any[], budgets: any[], goals: any[]): DashboardMetric[] {
  const currentPeriodIncome = transactions
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const currentPeriodExpenses = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netCashFlow = currentPeriodIncome - currentPeriodExpenses;
  const savingsRate = currentPeriodIncome > 0 ? (netCashFlow / currentPeriodIncome) * 100 : 0;


  // Budget compliance
  const budgetCompliance = budgets.length > 0 ? 
    budgets.filter(b => {
      const percentage = b.amount > 0 ? (Number(b.spent) / Number(b.amount)) * 100 : 0;
      return percentage <= 100;
    }).length / budgets.length * 100 : 100;

  // Goal progress average
  const goalProgress = goals.length > 0 ? 
    goals.reduce((sum, g) => {
      const progress = Number(g.targetAmount) > 0 ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100 : 0;
      return sum + progress;
    }, 0) / goals.length : 0;

  return [
    {
      id: 'net-cash-flow',
      title: 'Flujo de Caja Neto',
      value: netCashFlow,
      format: 'currency',
      trend: netCashFlow > 0 ? 'up' : netCashFlow < 0 ? 'down' : 'neutral',
      color: netCashFlow > 0 ? '#10B981' : netCashFlow < 0 ? '#EF4444' : '#6B7280'
    },
    {
      id: 'savings-rate',
      title: 'Tasa de Ahorro',
      value: savingsRate,
      format: 'percentage',
      trend: savingsRate > 20 ? 'up' : savingsRate > 10 ? 'neutral' : 'down',
      color: savingsRate > 20 ? '#10B981' : savingsRate > 10 ? '#F59E0B' : '#EF4444'
    },
    {
      id: 'budget-compliance',
      title: 'Cumplimiento Presupuestario',
      value: budgetCompliance,
      format: 'percentage',
      trend: budgetCompliance > 80 ? 'up' : budgetCompliance > 60 ? 'neutral' : 'down',
      color: budgetCompliance > 80 ? '#10B981' : budgetCompliance > 60 ? '#F59E0B' : '#EF4444'
    },
    {
      id: 'goal-progress',
      title: 'Progreso de Metas',
      value: goalProgress,
      format: 'percentage',
      trend: goalProgress > 70 ? 'up' : goalProgress > 40 ? 'neutral' : 'down',
      color: goalProgress > 70 ? '#10B981' : goalProgress > 40 ? '#F59E0B' : '#EF4444'
    },
    {
      id: 'total-income',
      title: 'Ingresos del Período',
      value: currentPeriodIncome,
      format: 'currency',
      color: '#3B82F6'
    },
    {
      id: 'total-expenses',
      title: 'Gastos del Período',
      value: currentPeriodExpenses,
      format: 'currency',
      color: '#EF4444'
    }
  ];
}

async function generateDynamicCharts(userId: string, transactions: any[], budgets: any[], goals: any[], _type: string): Promise<ChartData[]> {
  const charts: ChartData[] = [];

  // 1. Gráfico de Cash Flow (línea temporal)
  const cashFlowData = generateCashFlowChartData(transactions);
  charts.push({
    id: 'cash-flow-trend',
    title: 'Tendencia de Flujo de Caja',
    type: 'line',
    data: cashFlowData,
    config: {
      xKey: 'date',
      yKey: 'cumulative',
      colors: ['#3B82F6']
    }
  });

  // 2. Distribución de gastos por categoría (pie chart)
  const categoryData = generateCategoryDistribution(transactions);
  charts.push({
    id: 'expense-distribution',
    title: 'Distribución de Gastos por Categoría',
    type: 'pie',
    data: categoryData,
    config: {
      categoryKey: 'category',
      valueKey: 'amount',
      colors: ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']
    }
  });

  // 3. Progreso de presupuestos (bar chart)
  if (budgets.length > 0) {
    const budgetProgressData = await generateBudgetProgressData(userId, budgets);
    charts.push({
      id: 'budget-progress',
      title: 'Estado de Presupuestos',
      type: 'bar',
      data: budgetProgressData,
      config: {
        xKey: 'category',
        yKey: 'percentage',
        colors: ['#10B981', '#F59E0B', '#EF4444']
      }
    });
  }

  // 4. Progreso de metas (bar chart)
  if (goals.length > 0) {
    const goalProgressData = generateGoalProgressData(goals);
    charts.push({
      id: 'goals-progress',
      title: 'Progreso de Metas Financieras',
      type: 'bar',
      data: goalProgressData,
      config: {
        xKey: 'goal',
        yKey: 'progress',
        colors: ['#8B5CF6']
      }
    });
  }

  // 5. Análisis temporal de ingresos vs gastos
  const incomeVsExpensesData = generateIncomeVsExpensesData(transactions);
  charts.push({
    id: 'income-vs-expenses',
    title: 'Ingresos vs Gastos por Mes',
    type: 'bar',
    data: incomeVsExpensesData,
    config: {
      xKey: 'month',
      colors: ['#10B981', '#EF4444']
    }
  });

  return charts;
}

function generateCashFlowChartData(transactions: any[]) {
  const dailyFlow: { [key: string]: { income: number, expenses: number } } = {};
  
  transactions.forEach(t => {
    const date = new Date(t.date).toISOString().split('T')[0];
    if (!dailyFlow[date]) dailyFlow[date] = { income: 0, expenses: 0 };
    
    if (t.type === 'INCOME') {
      dailyFlow[date].income += Number(t.amount);
    } else {
      dailyFlow[date].expenses += Number(t.amount);
    }
  });

  let cumulative = 0;
  return Object.entries(dailyFlow)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, flow]) => {
      const net = flow.income - flow.expenses;
      cumulative += net;
      return {
        date,
        income: flow.income,
        expenses: flow.expenses,
        net,
        cumulative
      };
    });
}

function generateCategoryDistribution(transactions: any[]) {
  const categoryTotals: { [key: string]: number } = {};
  
  transactions
    .filter(t => t.type === 'EXPENSE')
    .forEach(t => {
      const category = t.category?.name || 'Sin Categoría';
      categoryTotals[category] = (categoryTotals[category] || 0) + Number(t.amount);
    });

  return Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: 0 // Se calculará en el frontend
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8); // Top 8 categorías
}

async function generateBudgetProgressData(userId: string, budgets: any[]) {
  const data = [];
  
  for (const budget of budgets) {
    const spent = await calculateBudgetSpent(userId, budget);
    const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
    
    data.push({
      category: budget.category?.name || budget.name,
      budgeted: Number(budget.amount),
      spent,
      percentage: Math.min(percentage, 100),
      status: percentage > 100 ? 'over' : percentage > 80 ? 'warning' : 'good'
    });
  }
  
  return data;
}

async function calculateBudgetSpent(userId: string, budget: any): Promise<number> {
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      ...(budget.categoryId && { categoryId: budget.categoryId }),
      date: {
        gte: budget.startDate,
        lte: budget.endDate
      }
    }
  });
  
  return transactions.reduce((sum, t) => sum + Number(t.amount), 0);
}

function generateGoalProgressData(goals: any[]) {
  return goals.map(goal => {
    const progress = Number(goal.targetAmount) > 0 ? 
      (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 : 0;
    
    return {
      goal: goal.title,
      target: Number(goal.targetAmount),
      current: Number(goal.currentAmount),
      progress: Math.min(progress, 100),
      status: goal.isCompleted ? 'completed' : 
              progress > 80 ? 'near-complete' : 
              progress > 50 ? 'on-track' : 'needs-attention'
    };
  }).slice(0, 5); // Top 5 metas
}

function generateIncomeVsExpensesData(transactions: any[]) {
  const monthlyData: { [key: string]: { income: number, expenses: number } } = {};
  
  transactions.forEach(t => {
    const month = new Date(t.date).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0 };
    
    if (t.type === 'INCOME') {
      monthlyData[month].income += Number(t.amount);
    } else {
      monthlyData[month].expenses += Number(t.amount);
    }
  });

  return Object.entries(monthlyData)
    .map(([month, data]) => ({
      month,
      income: data.income,
      expenses: data.expenses,
      net: data.income - data.expenses
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function generateAutomaticInsights(transactions: any[], _budgets: any[], goals: any[]) {
  const insights = [];
  
  // Insight 1: Mayor categoría de gasto
  const expensesByCategory = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => {
      const category = t.category?.name || 'Sin Categoría';
      acc[category] = (acc[category] || 0) + Number(t.amount);
      return acc;
    }, {} as { [key: string]: number });
  
  if (Object.keys(expensesByCategory).length > 0) {
    const topExpenseCategory = Object.entries(expensesByCategory)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0];
    
    insights.push({
      type: 'spending-pattern',
      title: 'Mayor Categoría de Gasto',
      description: `Tu mayor gasto es en ${topExpenseCategory[0]} con ${(topExpenseCategory[1] as number).toFixed(2)}€`,
      actionable: `Considera revisar tus gastos en ${topExpenseCategory[0]} para posibles ahorros`,
      priority: 'medium'
    });
  }

  // Insight 2: Días de la semana con mayor gasto
  const expensesByDay: { [key: string]: number } = {};
  transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
    const day = new Date(t.date).toLocaleDateString('es-ES', { weekday: 'long' });
    expensesByDay[day] = (expensesByDay[day] || 0) + Number(t.amount);
  });
  
  if (Object.keys(expensesByDay).length > 0) {
    const topSpendingDay = Object.entries(expensesByDay)
      .sort(([,a], [,b]) => b - a)[0];
    
    insights.push({
      type: 'temporal-pattern',
      title: 'Patrón Temporal de Gastos',
      description: `Gastas más los ${topSpendingDay[0]}s (${topSpendingDay[1].toFixed(2)}€)`,
      actionable: `Planifica mejor tus gastos para los ${topSpendingDay[0]}s`,
      priority: 'low'
    });
  }

  // Insight 3: Eficiencia de metas
  const activeGoals = goals.filter(g => !g.isCompleted);
  if (activeGoals.length > 0) {
    const avgProgress = activeGoals.reduce((sum, g) => {
      const progress = Number(g.targetAmount) > 0 ? (Number(g.currentAmount) / Number(g.targetAmount)) * 100 : 0;
      return sum + progress;
    }, 0) / activeGoals.length;

    insights.push({
      type: 'goal-performance',
      title: 'Progreso de Metas',
      description: `Progreso promedio de metas: ${avgProgress.toFixed(1)}%`,
      actionable: avgProgress < 50 ? 'Considera aumentar las contribuciones a tus metas' : 'Buen progreso en tus metas financieras',
      priority: avgProgress < 30 ? 'high' : 'low'
    });
  }

  return insights;
}

function generateExecutiveSummary(metrics: DashboardMetric[], insights: any[]) {
  const netCashFlow = metrics.find(m => m.id === 'net-cash-flow')?.value as number || 0;
  const savingsRate = metrics.find(m => m.id === 'savings-rate')?.value as number || 0;
  
  let summary = '';
  
  if (netCashFlow > 0) {
    summary += `Flujo de caja positivo de ${netCashFlow.toFixed(2)}€. `;
  } else if (netCashFlow < 0) {
    summary += `Déficit de ${Math.abs(netCashFlow).toFixed(2)}€ este período. `;
  }
  
  if (savingsRate > 20) {
    summary += 'Excelente tasa de ahorro. ';
  } else if (savingsRate > 10) {
    summary += 'Tasa de ahorro moderada. ';
  } else {
    summary += 'Considera mejorar tu tasa de ahorro. ';
  }
  
  const highPriorityInsights = insights.filter(i => i.priority === 'high').length;
  if (highPriorityInsights > 0) {
    summary += `${highPriorityInsights} área(s) requieren atención inmediata.`;
  } else {
    summary += 'Situación financiera estable.';
  }
  
  return summary;
}

function formatPeriodLabel(period: string, dates: { start: Date, end: Date }) {
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'long' 
  };
  
  switch (period) {
    case 'weekly':
      return `Semana del ${dates.start.toLocaleDateString('es-ES')}`;
    case 'monthly':
      return dates.start.toLocaleDateString('es-ES', options);
    case 'quarterly':
      const quarter = Math.floor(dates.start.getMonth() / 3) + 1;
      return `Q${quarter} ${dates.start.getFullYear()}`;
    case 'yearly':
      return `Año ${dates.start.getFullYear()}`;
    default:
      return dates.start.toLocaleDateString('es-ES', options);
  }
}
