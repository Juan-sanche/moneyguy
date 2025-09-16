// src/app/api/alerts/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, errorResponse, successResponse } from '../../../../lib/auth-helpers';

interface AlertRule {
  id: string;
  type: 'BUDGET_EXCEEDED' | 'GOAL_DEADLINE' | 'SPENDING_PATTERN' | 'ACHIEVEMENT' | 'RECOMMENDATION';
  condition: any;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  isActive: boolean;
}

// GET /api/alerts - Get user's active alerts
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    // Generar alertas dinámicas basadas en datos actuales
    const alerts = await generateSmartAlerts(user.id);
    
    // Guardar alertas nuevas en BD si no existen
    for (const alert of alerts) {
      await prisma.alert.upsert({
        where: {
          userId_type_condition: {
            userId: user.id,
            type: alert.type,
            condition: JSON.stringify(alert.condition)
          }
        },
        update: {
          message: alert.message,
          priority: alert.priority,
          isRead: false,
          updatedAt: new Date()
        },
        create: {
          userId: user.id,
          type: alert.type,
          condition: JSON.stringify(alert.condition),
          message: alert.message,
          priority: alert.priority,
          isRead: false,
          isActive: true
        }
      });
    }
    
    return successResponse({
      success: true,
      data: alerts,
      message: 'Smart alerts generated successfully'
    });

  } catch (error) {
    console.error('Error generating alerts:', error);
    return errorResponse('Failed to generate alerts', 500);
  }
}

// POST /api/alerts/mark-read - Mark alerts as read
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { alertIds } = await request.json();
    
    await prisma.alert.updateMany({
      where: {
        id: { in: alertIds },
        userId: user.id
      },
      data: {
        isRead: true,
        updatedAt: new Date()
      }
    });
    
    return successResponse({
      success: true,
      message: 'Alerts marked as read'
    });

  } catch (error) {
    return errorResponse('Failed to mark alerts as read', 500);
  }
}

async function generateSmartAlerts(userId: string): Promise<AlertRule[]> {
  const alerts: AlertRule[] = [];
  
  // Obtener datos del usuario
  const [transactions, budgets, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 100
    }),
    prisma.budget.findMany({
      where: { userId },
      include: { category: true }
    }),
    prisma.goal.findMany({
      where: { userId }
    })
  ]);

  // 1. Alertas de Presupuesto
  for (const budget of budgets) {
    const spent = await calculateBudgetSpent(userId, budget);
    const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
    
    if (percentage > 90) {
      alerts.push({
        id: `budget-${budget.id}`,
        type: 'BUDGET_EXCEEDED',
        condition: { budgetId: budget.id, percentage },
        message: `⚠️ Presupuesto de ${budget.category?.name || 'Sin categoría'} al ${percentage.toFixed(0)}% (${spent.toFixed(2)}€ de ${budget.amount}€)`,
        priority: percentage > 100 ? 'URGENT' : 'HIGH',
        isActive: true
      });
    } else if (percentage > 75) {
      alerts.push({
        id: `budget-warning-${budget.id}`,
        type: 'BUDGET_EXCEEDED',
        condition: { budgetId: budget.id, percentage },
        message: `💛 Te acercas al límite de ${budget.category?.name || 'Sin categoría'}: ${percentage.toFixed(0)}%`,
        priority: 'MEDIUM',
        isActive: true
      });
    }
  }

  // 2. Alertas de Metas con Deadline
  const today = new Date();
  for (const goal of goals) {
    if (goal.targetDate && !goal.isCompleted) {
      const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
      
      if (daysLeft <= 0) {
        alerts.push({
          id: `goal-overdue-${goal.id}`,
          type: 'GOAL_DEADLINE',
          condition: { goalId: goal.id, daysLeft },
          message: `🚨 Meta "${goal.title}" venció. Progreso: ${progress.toFixed(0)}%`,
          priority: 'URGENT',
          isActive: true
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          id: `goal-deadline-${goal.id}`,
          type: 'GOAL_DEADLINE',
          condition: { goalId: goal.id, daysLeft },
          message: `⏰ Meta "${goal.title}" vence en ${daysLeft} días. Progreso: ${progress.toFixed(0)}%`,
          priority: 'HIGH',
          isActive: true
        });
      } else if (daysLeft <= 30 && progress < 50) {
        alerts.push({
          id: `goal-progress-${goal.id}`,
          type: 'GOAL_DEADLINE',
          condition: { goalId: goal.id, progress },
          message: `📈 Meta "${goal.title}": ${progress.toFixed(0)}% completado, ${daysLeft} días restantes`,
          priority: 'MEDIUM',
          isActive: true
        });
      }
    }
  }

  // 3. Patrones de Gasto Anómalos
  const spendingAlerts = await generateSpendingPatternAlerts(userId, transactions);
  alerts.push(...spendingAlerts);

  // 4. Logros y Achievements
  const achievementAlerts = await generateAchievementAlerts(userId, transactions, budgets, goals);
  alerts.push(...achievementAlerts);

  // 5. Recomendaciones Inteligentes
  const recommendationAlerts = await generateRecommendationAlerts(userId, transactions, budgets);
  alerts.push(...recommendationAlerts);

  return alerts;
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

async function generateSpendingPatternAlerts(_userId: string, transactions: any[]): Promise<AlertRule[]> {
  const alerts: AlertRule[] = [];
  const last7Days = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return transactionDate >= weekAgo && t.type === 'EXPENSE';
  });

  const last30Days = transactions.filter(t => {
    const transactionDate = new Date(t.date);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return transactionDate >= monthAgo && t.type === 'EXPENSE';
  });

  // Análisis de gastos por categoría
  const categorySpending: { [key: string]: { week: number, month: number } } = {};
  
  last7Days.forEach(t => {
    const category = t.category?.name || 'Sin categoría';
    if (!categorySpending[category]) categorySpending[category] = { week: 0, month: 0 };
    categorySpending[category].week += Number(t.amount);
  });
  
  last30Days.forEach(t => {
    const category = t.category?.name || 'Sin categoría';
    if (!categorySpending[category]) categorySpending[category] = { week: 0, month: 0 };
    categorySpending[category].month += Number(t.amount);
  });

  // Detectar categorías con gasto anormal
  Object.entries(categorySpending).forEach(([category, amounts]) => {
    const weeklyAverage = amounts.month / 4; // Promedio semanal del mes
    if (amounts.week > weeklyAverage * 1.5 && amounts.week > 50) { // 50% más que promedio y > 50€
      alerts.push({
        id: `spending-spike-${category}`,
        type: 'SPENDING_PATTERN',
        condition: { category, weekSpending: amounts.week, average: weeklyAverage },
        message: `📊 Gasto elevado en ${category} esta semana: ${amounts.week.toFixed(2)}€ (promedio: ${weeklyAverage.toFixed(2)}€)`,
        priority: 'MEDIUM',
        isActive: true
      });
    }
  });

  return alerts;
}

async function generateAchievementAlerts(userId: string, transactions: any[], budgets: any[], goals: any[]): Promise<AlertRule[]> {
  const alerts: AlertRule[] = [];
  
  // Achievement: Primera meta completada
  const completedGoals = goals.filter(g => g.isCompleted);
  if (completedGoals.length === 1) {
    alerts.push({
      id: 'achievement-first-goal',
      type: 'ACHIEVEMENT',
      condition: { achievement: 'first_goal' },
      message: `🎉 ¡Felicidades! Completaste tu primera meta: "${completedGoals[0].title}"`,
      priority: 'MEDIUM',
      isActive: true
    });
  }

  // Achievement: 100 transacciones registradas
  if (transactions.length >= 100) {
    const existing = await prisma.alert.findFirst({
      where: {
        userId,
        type: 'ACHIEVEMENT',
        condition: {
          path: ['achievement'],
          equals: '100_transactions'
        }
      }
    });
    
    if (!existing) {
      alerts.push({
        id: 'achievement-100-transactions',
        type: 'ACHIEVEMENT',
        condition: { achievement: '100_transactions' },
        message: `🏆 ¡Milestone desbloqueado! Has registrado ${transactions.length} transacciones`,
        priority: 'LOW',
        isActive: true
      });
    }
  }

  // Achievement: Mes completo dentro del presupuesto
  const currentMonthBudgets = budgets.filter(b => {
    const now = new Date();
    const budgetStart = new Date(b.startDate);
    const budgetEnd = new Date(b.endDate);
    return budgetStart <= now && budgetEnd >= now;
  });

  let allBudgetsOnTrack = true;
  for (const budget of currentMonthBudgets) {
    const spent = await calculateBudgetSpent(userId, budget);
    const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
    if (percentage > 100) {
      allBudgetsOnTrack = false;
      break;
    }
  }

  if (allBudgetsOnTrack && currentMonthBudgets.length > 0) {
    alerts.push({
      id: 'achievement-budget-master',
      type: 'ACHIEVEMENT',
      condition: { achievement: 'budget_master' },
      message: `💪 ¡Excelente! Todos tus presupuestos están bajo control este mes`,
      priority: 'LOW',
      isActive: true
    });
  }

  return alerts;
}

async function generateRecommendationAlerts(_userId: string, transactions: any[], budgets: any[]): Promise<AlertRule[]> {
  const alerts: AlertRule[] = [];
  
  // Análisis de gastos frecuentes pequeños
  const smallFrequentExpenses = transactions
    .filter(t => t.type === 'EXPENSE' && Number(t.amount) < 10 && Number(t.amount) > 2)
    .reduce((acc: { [key: string]: { count: number, total: number } }, t) => {
      const category = t.category?.name || t.description || 'Sin categoría';
      if (!acc[category]) acc[category] = { count: 0, total: 0 };
      acc[category].count++;
      acc[category].total += Number(t.amount);
      return acc;
    }, {});

  Object.entries(smallFrequentExpenses).forEach(([category, data]) => {
    if (data.count >= 10 && data.total > 50) { // 10+ transacciones pequeñas que suman >50€
      alerts.push({
        id: `recommendation-small-expenses-${category}`,
        type: 'RECOMMENDATION',
        condition: { category, count: data.count, total: data.total },
        message: `💡 Tienes ${data.count} gastos pequeños en ${category} (${data.total.toFixed(2)}€). ¿Considera suscripción o compra mayor?`,
        priority: 'LOW',
        isActive: true
      });
    }
  });

  // Recomendación: Crear presupuesto para categorías sin límite
  const categoriesWithExpenses = [...new Set(transactions
    .filter(t => t.type === 'EXPENSE' && t.category?.name)
    .map(t => t.category!.name)
  )];
  
  const categoriesWithBudgets = budgets.map(b => b.category?.name).filter(Boolean);
  const categoriesWithoutBudget = categoriesWithExpenses.filter(c => !categoriesWithBudgets.includes(c));
  
  if (categoriesWithoutBudget.length > 0) {
    const topCategory = categoriesWithoutBudget[0]; // Simplificado, podrías calcular la más gastada
    alerts.push({
      id: `recommendation-create-budget-${topCategory}`,
      type: 'RECOMMENDATION',
      condition: { category: topCategory },
      message: `🎯 Considera crear un presupuesto para "${topCategory}" para mejor control de gastos`,
      priority: 'LOW',
      isActive: true
    });
  }

  return alerts;
}
