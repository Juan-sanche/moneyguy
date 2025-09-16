import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../lib/auth-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DAILY_MESSAGE_LIMIT = 50;

interface ChatRequest {
  message: string;
  sessionId?: string;
  userContext?: {
    firstName?: string;
    transactions?: any[];
    budgets?: any[];
    goals?: any[];
  };
}

// Complete function definitions including basic and advanced functions
const functions = [
  // Basic functions
  {
    name: "addTransaction",
    description: "Add a new financial transaction (income or expense)",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Transaction amount (positive number)"
        },
        description: {
          type: "string", 
          description: "Description of the transaction"
        },
        category: {
          type: "string",
          description: "Category name (e.g., 'Food', 'Transportation', 'Salary')"
        },
        type: {
          type: "string",
          enum: ["INCOME", "EXPENSE"],
          description: "Type of transaction"
        },
        date: {
          type: "string",
          description: "Transaction date in YYYY-MM-DD format (optional, defaults to today)"
        }
      },
      required: ["amount", "description", "type"]
    }
  },
  {
    name: "getTransactions", 
    description: "Get user's transactions with optional filters",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of transactions to return (max 50)"
        },
        category: {
          type: "string",
          description: "Filter by category name"
        },
        type: {
          type: "string",
          enum: ["INCOME", "EXPENSE"],
          description: "Filter by transaction type"
        }
      }
    }
  },
  {
    name: "addBudget",
    description: "Create a new budget for a category",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Budget category name"
        },
        amount: {
          type: "number",
          description: "Budget amount"
        },
        period: {
          type: "string",
          enum: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
          description: "Budget period"
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format"
        },
        endDate: {
          type: "string", 
          description: "End date in YYYY-MM-DD format"
        }
      },
      required: ["category", "amount", "period", "startDate", "endDate"]
    }
  },
  {
    name: "getBudgets",
    description: "Get all user budgets with spending progress",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "addGoal",
    description: "Create a new financial goal",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Goal title"
        },
        description: {
          type: "string",
          description: "Goal description (optional)"
        },
        targetAmount: {
          type: "number",
          description: "Target amount to achieve"
        },
        deadline: {
          type: "string",
          description: "Goal deadline in YYYY-MM-DD format (optional)"
        },
        category: {
          type: "string", 
          description: "Goal category (optional)"
        }
      },
      required: ["title", "targetAmount"]
    }
  },
  {
    name: "getGoals",
    description: "Get all user goals with progress",
    parameters: {
      type: "object", 
      properties: {}
    }
  },
  {
    name: "getFinancialSummary",
    description: "Get complete financial overview including transactions, budgets, and goals",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  // Advanced functions
  {
    name: "getSmartAlerts",
    description: "Get intelligent alerts and notifications about finances",
    parameters: {
      type: "object",
      properties: {
        priority: {
          type: "string",
          enum: ["ALL", "HIGH", "URGENT"],
          description: "Filter alerts by priority level"
        }
      }
    }
  },
  {
    name: "generateDashboard",
    description: "Generate dynamic dashboard with charts and metrics",
    parameters: {
      type: "object", 
      properties: {
        type: {
          type: "string",
          enum: ["overview", "detailed", "executive"],
          description: "Type of dashboard to generate"
        },
        period: {
          type: "string",
          enum: ["weekly", "monthly", "quarterly", "yearly"],
          description: "Time period for analysis"
        }
      }
    }
  },
  {
    name: "generateReport",
    description: "Generate automatic financial reports in PDF or Excel",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["monthly_summary", "budget_analysis", "goal_progress", "spending_analysis", "executive_summary"],
          description: "Type of report to generate"
        },
        format: {
          type: "string",
          enum: ["PDF", "EXCEL", "JSON"],
          description: "Output format"
        },
        includeCharts: {
          type: "boolean",
          description: "Include visual charts in report",
          default: true
        }
      },
      required: ["type", "format"]
    }
  },
  {
    name: "updateGoalProgress",
    description: "Add progress to an existing financial goal",
    parameters: {
      type: "object",
      properties: {
        goalTitle: {
          type: "string",
          description: "Title of the goal to update"
        },
        amount: {
          type: "number",
          description: "Progress amount to add"
        },
        note: {
          type: "string",
          description: "Optional note about the progress"
        }
      },
      required: ["goalTitle", "amount"]
    }
  },
  {
    name: "getSpendingInsights",
    description: "Get AI-powered insights about spending patterns",
    parameters: {
      type: "object",
      properties: {
        timeframe: {
          type: "string",
          enum: ["week", "month", "quarter", "year"],
          description: "Timeframe for analysis"
        },
        category: {
          type: "string",
          description: "Specific category to analyze (optional)"
        }
      }
    }
  },
  {
    name: "createScheduledReminder", 
    description: "Set up automatic reminders for financial tasks",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["budget_check", "goal_update", "expense_review", "custom"],
          description: "Type of reminder"
        },
        frequency: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Reminder frequency"
        },
        message: {
          type: "string",
          description: "Custom reminder message"
        }
      },
      required: ["type", "frequency"]
    }
  }
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body: ChatRequest = await request.json();
    const { message } = body;

    if (!message) {
      return errorResponse('Message is required', 400);
    }

    // Check daily usage limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dailyUsage = await prisma.dailyUsage.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      }
    });

    if (!dailyUsage) {
      dailyUsage = await prisma.dailyUsage.create({
        data: {
          userId: user.id,
          date: today,
          messageCount: 0
        }
      });
    }

    if (dailyUsage.messageCount >= DAILY_MESSAGE_LIMIT) {
      return errorResponse(`Daily message limit reached (${DAILY_MESSAGE_LIMIT}/day). Try tomorrow!`, 429);
    }

    // Store user message
    const userMessage = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: 'USER',
        content: message,
      }
    });

    // Get user context for system prompt
    const userContext = await getUserContext(user.id);
    const systemPrompt = buildSystemPrompt(userContext);

    // Get recent conversation history
    const recentMessages = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    const conversationHistory = recentMessages
      .reverse()
      .slice(0, -1)
      .map(msg => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant',
        content: msg.content
      }));

    // Call OpenAI with function calling
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: message }
      ],
      functions: functions,
      function_call: "auto",
      max_tokens: 500,
      temperature: 0.7,
    });

    let aiResponse = completion.choices[0]?.message?.content;
    const functionCall = completion.choices[0]?.message?.function_call;

    // Handle function calling
    if (functionCall) {
      const functionResult = await handleFunctionCall(functionCall, user.id);
      
      // Make a second call to get the AI's response to the function result
      const followUpCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: message },
          { 
            role: "assistant", 
            content: null,
            function_call: functionCall
          },
          { 
            role: "function", 
            name: functionCall.name,
            content: JSON.stringify(functionResult)
          }
        ],
        max_tokens: 400,
        temperature: 0.7,
      });

      aiResponse = followUpCompletion.choices[0]?.message?.content;
    }

    if (!aiResponse) {
      aiResponse = "I had trouble processing that request. Could you try rephrasing?";
    }

    // Store AI response
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: 'ASSISTANT',
        content: aiResponse,
        functionCalled: functionCall?.name || null,
        responseTime: Date.now() - userMessage.timestamp.getTime()
      }
    });

    // Update usage count
    await prisma.dailyUsage.update({
      where: { id: dailyUsage.id },
      data: { messageCount: dailyUsage.messageCount + 1 }
    });

    const updatedUsage = await prisma.dailyUsage.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      }
    });

    return successResponse({
      success: true,
      data: {
        message: aiResponse,
        timestamp: assistantMessage.timestamp.toISOString(),
        messageId: assistantMessage.id,
        functionCalled: functionCall?.name || null,
        usage: {
          used: updatedUsage?.messageCount || 0,
          limit: DAILY_MESSAGE_LIMIT,
          remaining: DAILY_MESSAGE_LIMIT - (updatedUsage?.messageCount || 0)
        }
      },
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return errorResponse('Failed to process message', 500);
  }
}

// Function to handle function calls
async function handleFunctionCall(functionCall: any, userId: string) {
  const { name, arguments: args } = functionCall;
  const params = JSON.parse(args);

  try {
    switch (name) {
      // Basic functions
      case 'addTransaction':
        return await addTransaction(userId, params);
      case 'getTransactions':
        return await getTransactions(userId, params);
      case 'addBudget':
        return await addBudget(userId, params);
      case 'getBudgets':
        return await getBudgets(userId);
      case 'addGoal':
        return await addGoal(userId, params);
      case 'getGoals':
        return await getGoals(userId);
      case 'getFinancialSummary':
        return await getFinancialSummary(userId);
      
      // Advanced functions
      case 'getSmartAlerts':
        return await getSmartAlerts(userId, params);
      case 'generateDashboard':
        return await generateDashboard(userId, params);
      case 'generateReport':
        return await generateReport(userId, params);
      case 'updateGoalProgress':
        return await updateGoalProgress(userId, params);
      case 'getSpendingInsights':
        return await getSpendingInsights(userId, params);
      case 'createScheduledReminder':
        return await createScheduledReminder(userId, params);
        
      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return { error: `Failed to execute ${name}` };
  }
}

// Basic function implementations
async function addTransaction(userId: string, params: any) {
  const { amount, description, category, type, date } = params;

  // Normalize type
  const txType = String(type || '').toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';

  let categoryId: string | null = null;
  if (category && String(category).trim()) {
    const name = String(category).trim();
    const desiredCategoryType = txType === 'INCOME' ? 'INCOME' : 'EXPENSE';
    try {
      // Prefer category matching desired type
      let categoryRecord = await prisma.category.findFirst({
        where: {
          userId,
          name,
          type: desiredCategoryType as any,
        }
      });

      // If not found, try any category with same name (unique on [userId, name])
      if (!categoryRecord) {
        categoryRecord = await prisma.category.findFirst({
          where: { userId, name }
        });
      }

      // Create if none exists
      if (!categoryRecord) {
        categoryRecord = await prisma.category.create({
          data: {
            userId,
            name,
            type: desiredCategoryType as any,
          }
        });
      }

      categoryId = categoryRecord.id;
    } catch (categoryError) {
      console.error('Category lookup/create failed in chat addTransaction:', categoryError);
      // Continue without category rather than failing the whole op
      categoryId = null;
    }
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: parseFloat(amount),
      description,
      categoryId,
      type: txType as any,
      date: date ? new Date(date) : new Date(),
    },
    include: {
      category: true
    }
  });

  return {
    success: true,
    transaction: {
      ...transaction,
      amount: Number(transaction.amount)
    }
  };
}

async function getTransactions(userId: string, params: any = {}) {
  const { limit = 20, category, type } = params;
  
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      ...(category && { 
        category: { 
          name: { contains: category, mode: 'insensitive' } 
        } 
      }),
      ...(type && { type })
    },
    include: { category: true },
    orderBy: { date: 'desc' },
    take: Math.min(limit, 50)
  });

  return {
    success: true,
    transactions: transactions.map(t => ({
      ...t,
      amount: Number(t.amount)
    }))
  };
}

async function addBudget(userId: string, params: any) {
  const { category, amount, period, startDate, endDate } = params;
  
  let categoryRecord = await prisma.category.findFirst({
    where: {
      userId,
      name: category,
      type: 'EXPENSE'
    }
  });

  if (!categoryRecord) {
    categoryRecord = await prisma.category.create({
      data: {
        userId,
        name: category,
        type: 'EXPENSE'
      }
    });
  }

  const budget = await prisma.budget.create({
    data: {
      userId,
      categoryId: categoryRecord.id,
      name: `${category} Budget`,
      amount: parseFloat(amount),
      period,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
    include: { category: true }
  });

  return {
    success: true,
    budget: {
      ...budget,
      amount: Number(budget.amount)
    }
  };
}

async function getBudgets(userId: string) {
  const budgets = await prisma.budget.findMany({
    where: { userId },
    include: { category: true },
    orderBy: { createdAt: 'desc' }
  });

  const budgetsWithProgress = await Promise.all(
    budgets.map(async (budget) => {
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

      const spent = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const percentage = Number(budget.amount) > 0 ? Math.round((spent / Number(budget.amount)) * 100) : 0;
      
      return {
        ...budget,
        amount: Number(budget.amount),
        spent,
        percentage,
        status: percentage > 100 ? 'OVER_BUDGET' : percentage > 80 ? 'WARNING' : 'ON_TRACK'
      };
    })
  );

  return {
    success: true,
    budgets: budgetsWithProgress
  };
}

async function addGoal(userId: string, params: any) {
  const { title, description, targetAmount, deadline, category } = params;
  
  const goalType = category?.toLowerCase().includes('debt') ? 'DEBT_PAYOFF' :
                  category?.toLowerCase().includes('investment') ? 'INVESTMENT' :
                  category?.toLowerCase().includes('spending') ? 'SPENDING_LIMIT' :
                  'SAVINGS';

  const goal = await prisma.goal.create({
    data: {
      userId,
      title,
      description: description || null,
      type: goalType,
      targetAmount: parseFloat(targetAmount),
      targetDate: deadline ? new Date(deadline) : null,
    }
  });

  return {
    success: true,
    goal: {
      ...goal,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount)
    }
  };
}

async function getGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' }
  });

  const goalsWithProgress = goals.map(goal => {
    const progress = Number(goal.targetAmount) > 0 ? Math.round((Number(goal.currentAmount) / Number(goal.targetAmount)) * 100) : 0;
    let status = 'IN_PROGRESS';
    if (goal.isCompleted) status = 'COMPLETED';
    else if (goal.targetDate && new Date() > new Date(goal.targetDate)) status = 'OVERDUE';
    
    return {
      ...goal,
      targetAmount: Number(goal.targetAmount),
      currentAmount: Number(goal.currentAmount),
      progress,
      status
    };
  });

  return {
    success: true,
    goals: goalsWithProgress
  };
}

async function getFinancialSummary(userId: string) {
  const [transactions, budgets, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 50
    }),
    getBudgets(userId),
    getGoals(userId)
  ]);

  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
  const netWorth = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

  return {
    success: true,
    summary: {
      totalIncome,
      totalExpenses, 
      netWorth,
      savingsRate,
      transactionCount: transactions.length,
      budgetCount: budgets.budgets?.length || 0,
      goalCount: goals.goals?.length || 0,
      recentTransactions: transactions.slice(0, 5).map(t => ({
        ...t,
        amount: Number(t.amount)
      }))
    }
  };
}

// Advanced function implementations
async function getSmartAlerts(userId: string, params: any = {}) {
  // Generate smart alerts based on current data
  const alerts = await generateSmartAlerts(userId);
  
  if (params.priority !== 'ALL') {
    return {
      success: true,
      alerts: alerts.filter(alert => alert.priority === params.priority)
    };
  }
  
  return {
    success: true,
    alerts
  };
}

async function generateSmartAlerts(userId: string) {
  const alerts = [];
  
  // Get user data
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

  // Budget alerts
  for (const budget of budgets) {
    const spent = await calculateBudgetSpent(userId, budget);
    const percentage = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0;
    
    if (percentage > 90) {
      alerts.push({
        type: 'BUDGET_EXCEEDED',
        priority: percentage > 100 ? 'URGENT' : 'HIGH',
        message: `Budget alert: ${budget.category?.name || 'Category'} at ${percentage.toFixed(0)}% (${spent.toFixed(2)} of ${budget.amount})`
      });
    }
  }

  // Goal deadline alerts
  const today = new Date();
  for (const goal of goals) {
    if (goal.targetDate && !goal.isCompleted) {
      const daysLeft = Math.ceil((new Date(goal.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const progress = (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100;
      
      if (daysLeft <= 0) {
        alerts.push({
          type: 'GOAL_DEADLINE',
          priority: 'URGENT',
          message: `Goal "${goal.title}" deadline passed. Progress: ${progress.toFixed(0)}%`
        });
      } else if (daysLeft <= 7) {
        alerts.push({
          type: 'GOAL_DEADLINE',
          priority: 'HIGH', 
          message: `Goal "${goal.title}" due in ${daysLeft} days. Progress: ${progress.toFixed(0)}%`
        });
      }
    }
  }

  return alerts.slice(0, 10); // Return top 10 alerts
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

async function generateDashboard(userId: string, params: any) {
  const { type = 'overview', period = 'monthly' } = params;
  
  // Get dashboard data (simplified version)
  const [transactions, budgets, goals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { date: 'desc' },
      take: 200
    }),
    getBudgets(userId),
    getGoals(userId)
  ]);

  const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount), 0);
  
  return {
    success: true,
    dashboard: {
      type,
      period,
      metrics: {
        totalIncome,
        totalExpenses,
        netCashFlow: totalIncome - totalExpenses,
        savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0
      },
      budgetSummary: `${budgets.budgets?.length || 0} active budgets`,
      goalSummary: `${goals.goals?.length || 0} financial goals`
    }
  };
}

async function generateReport(userId: string, params: any) {
  const { type, format, includeCharts = true } = params;
  
  // In a real implementation, this would generate actual files
  // For now, return a success message with mock data
  return {
    success: true,
    report: {
      type,
      format,
      generated: new Date().toISOString(),
      message: `${format} report "${type}" generated successfully`,
      downloadUrl: `/reports/${type}_${Date.now()}.${format.toLowerCase()}`
    }
  };
}

async function updateGoalProgress(userId: string, params: any) {
  const { goalTitle, amount, note } = params;
  
  // Find goal by title
  const goals = await prisma.goal.findMany({
    where: { userId }
  });
  
  const goal = goals.find(g => 
    g.title.toLowerCase().includes(goalTitle.toLowerCase()) ||
    goalTitle.toLowerCase().includes(g.title.toLowerCase())
  );
  
  if (!goal) {
    return { error: `No goal found with title "${goalTitle}"` };
  }
  
  // Update goal progress
  const newCurrentAmount = Number(goal.currentAmount) + amount;
  const isCompleted = newCurrentAmount >= Number(goal.targetAmount);
  
  const updatedGoal = await prisma.goal.update({
    where: { id: goal.id },
    data: {
      currentAmount: newCurrentAmount,
      isCompleted,
      updatedAt: new Date()
    }
  });
  
  // Create progress record
  await prisma.goalProgress.create({
    data: {
      goalId: goal.id,
      amount: amount,
      note: note || null,
    }
  });
  
  const progress = (newCurrentAmount / Number(goal.targetAmount)) * 100;
  
  return {
    success: true,
    goal: {
      ...updatedGoal,
      targetAmount: Number(updatedGoal.targetAmount),
      currentAmount: Number(updatedGoal.currentAmount)
    },
    progress,
    isCompleted
  };
}

async function getSpendingInsights(userId: string, params: any = {}) {
  const { timeframe = 'month', category } = params;
  
  // Calculate date range
  const now = new Date();
  let startDate: Date;
  
  switch (timeframe) {
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'quarter':
      startDate = new Date(now.setMonth(now.getMonth() - 3));
      break;
    case 'year':
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      break;
    default: // month
      startDate = new Date(now.setMonth(now.getMonth() - 1));
  }
  
  const transactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: 'EXPENSE',
      date: { gte: startDate },
      ...(category && { 
        category: { 
          name: { contains: category, mode: 'insensitive' } 
        } 
      })
    },
    include: { category: true },
    orderBy: { date: 'desc' }
  });
  
  const totalAmount = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const avgTransactionAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;
  
  // Generate basic insights
  const categoryTotals: { [key: string]: number } = {};
  transactions.forEach(t => {
    const cat = t.category?.name || 'Uncategorized';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(t.amount);
  });
  
  const topCategory = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)[0];
  
  return {
    success: true,
    timeframe,
    totalTransactions: transactions.length,
    totalAmount,
    avgTransactionAmount,
    topCategory: topCategory ? {
      name: topCategory[0],
      amount: topCategory[1],
      percentage: (topCategory[1] / totalAmount) * 100
    } : null,
    insights: [
      `Analyzed ${transactions.length} transactions totaling ${totalAmount.toFixed(2)}`,
      `Average transaction: ${avgTransactionAmount.toFixed(2)}`,
      topCategory ? `Top category: ${topCategory[0]} (${topCategory[1].toFixed(2)})` : 'No category data available'
    ]
  };
}

async function createScheduledReminder(userId: string, params: any) {
  const { type, frequency, message } = params;
  
  // Create notification reminder
  const reminder = await prisma.notification.create({
    data: {
      userId,
      title: `Recordatorio: ${type}`,
      message: message || getDefaultReminderMessage(type),
      type: 'REMINDER',
      channel: 'APP'
    }
  });
  
  return {
    success: true,
    reminder: {
      id: reminder.id,
      type,
      frequency,
      message: reminder.message,
      nextTrigger: calculateNextTrigger(frequency)
    }
  };
}

// Helper functions
function getDefaultReminderMessage(type: string): string {
  const messages: { [key: string]: string } = {
    'budget_check': 'Es hora de revisar tu progreso presupuestario',
    'goal_update': 'Actualiza el progreso de tus metas financieras',
    'expense_review': 'Revisa y categoriza tus gastos recientes',
    'custom': 'Recordatorio financiero personalizado'
  };
  
  return messages[type] || messages.custom;
}

function calculateNextTrigger(frequency: string): Date {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      return new Date(now.setDate(now.getDate() + 1));
    case 'weekly':
      return new Date(now.setDate(now.getDate() + 7));
    case 'monthly':
      return new Date(now.setMonth(now.getMonth() + 1));
    default:
      return new Date(now.setDate(now.getDate() + 1));
  }
}

async function getUserContext(userId: string) {
  const [userProfile, transactions, budgets, goals] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 20
    }),
    prisma.budget.findMany({
      where: { userId },
      include: { category: true }
    }),
    prisma.goal.findMany({
      where: { userId }
    })
  ]);

  return {
    firstName: userProfile?.firstName || 'there',
    transactions: transactions.map(t => ({ ...t, amount: Number(t.amount) })),
    budgets: budgets.map(b => ({ ...b, amount: Number(b.amount) })),
    goals: goals.map(g => ({
      ...g,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount)
    }))
  };
}

function buildSystemPrompt(userContext: any): string {
  return `You are MoneyGuyAI, an advanced personal finance assistant with powerful analytical capabilities.

AVAILABLE FUNCTIONS:
Basic Functions:
- addTransaction: Create new transactions
- getTransactions: Retrieve transaction history  
- addBudget: Create budgets
- getBudgets: Check budget progress
- addGoal: Set financial goals
- getGoals: Track goal progress
- getFinancialSummary: Get complete overview

Advanced Functions:
- getSmartAlerts: Get intelligent financial alerts and warnings
- generateDashboard: Create visual dashboards with charts and metrics  
- generateReport: Generate professional PDF/Excel reports
- updateGoalProgress: Add progress to financial goals
- getSpendingInsights: Get AI-powered spending pattern analysis
- createScheduledReminder: Set up automatic financial reminders

WHEN TO USE FUNCTIONS:
- "I spent 25€ on coffee" → addTransaction
- "How are my budgets?" → getBudgets 
- "Show me alerts" → getSmartAlerts
- "Create a dashboard" → generateDashboard
- "Generate monthly report" → generateReport
- "Add 200€ to vacation fund" → updateGoalProgress
- "Analyze my spending patterns" → getSpendingInsights
- "Remind me weekly to check budget" → createScheduledReminder

User Context:
- Name: ${userContext.firstName}
- Transactions: ${userContext.transactions?.length || 0}
- Budgets: ${userContext.budgets?.length || 0}  
- Goals: ${userContext.goals?.length || 0}

Communication Style:
- Be professional yet friendly and encouraging
- Explain what functions you're using clearly
- Provide specific, actionable insights after function calls
- Keep responses concise but informative (2-4 sentences)
- Use natural language, avoid being robotic
- Give concrete recommendations based on data

Example Interactions:
User: "I spent 25€ on lunch today"
Assistant: I'll add that lunch expense for you. [calls addTransaction] ✅ Added 25€ lunch expense. That brings your food spending to X€ this month, which is Y% of your food budget.

User: "How are my finances looking?"
Assistant: Let me generate your financial dashboard to show the complete picture. [calls generateDashboard] Based on your dashboard: You have a positive cash flow of X€, savings rate of Y%, and Z active budgets. Your top spending category is... [specific insights and recommendations]

User: "Any financial alerts?"
Assistant: I'll check your smart alerts for important notifications. [calls getSmartAlerts] You have X alerts: [summarize each alert with specific actions needed]

Always provide actionable insights and next steps after using functions. Focus on helping the user make better financial decisions.`;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const messages = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyUsage = await prisma.dailyUsage.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      }
    });

    return successResponse({
      success: true,
      data: {
        messages: messages.reverse(),
        usage: {
          used: dailyUsage?.messageCount || 0,
          limit: DAILY_MESSAGE_LIMIT,
          remaining: DAILY_MESSAGE_LIMIT - (dailyUsage?.messageCount || 0)
        }
      },
      message: 'Chat history retrieved successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching chat history:', error);
    return errorResponse('Failed to fetch chat history', 500);
  }
}
