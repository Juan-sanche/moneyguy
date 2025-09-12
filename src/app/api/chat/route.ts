import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../lib/auth-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DAILY_MESSAGE_LIMIT = 50; // Aumentamos el límite

// Function calling definitions
const functions = [
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
  }
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
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
        
      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return { error: `Failed to execute ${name}` };
  }
}

// Function implementations
async function addTransaction(userId: string, params: any) {
  const { amount, description, category, type, date } = params;
  
  let categoryId = null;
  if (category) {
    let categoryRecord = await prisma.category.findFirst({
      where: {
        userId,
        name: category.trim(),
        type: 'EXPENSE'
      }
    });
    
    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: {
          userId,
          name: category.trim(),
          type: 'EXPENSE'
        }
      });
    }
    categoryId = categoryRecord.id;
  }

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: parseFloat(amount),
      description,
      categoryId,
      type,
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
  return `You are MoneyGuyAI, a friendly personal finance assistant with access to powerful tools.

Your capabilities:
- addTransaction: Create new transactions
- getTransactions: Retrieve transaction history  
- addBudget: Create budgets
- getBudgets: Check budget progress
- addGoal: Set financial goals
- getGoals: Track goal progress
- getFinancialSummary: Get complete overview

Always use these functions when the user asks to:
- Add/record/log expenses or income
- Check budgets, spending, or goals
- Create new budgets or goals  
- Get financial summaries or overviews

User Context:
- Name: ${userContext.firstName}
- Transactions: ${userContext.transactions?.length || 0}
- Budgets: ${userContext.budgets?.length || 0}  
- Goals: ${userContext.goals?.length || 0}

Communication Style:
- Be encouraging and supportive
- Give specific, actionable advice
- Keep responses concise (2-4 sentences)
- Use natural language, avoid being robotic
- When using functions, explain what you did clearly

Example interactions:
- "I spent 25€ on coffee today" → Use addTransaction
- "How are my budgets doing?" → Use getBudgets and provide insights
- "Set a goal to save 5000€ for vacation" → Use addGoal`;
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
      }
    });

  } catch (error) {
    return errorResponse('Failed to fetch chat history', 500);
  }
}