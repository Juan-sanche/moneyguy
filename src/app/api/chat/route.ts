import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../lib/auth-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const DAILY_MESSAGE_LIMIT = 10;

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

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body: ChatRequest = await request.json();
    const { message, sessionId, userContext } = body;

    if (!message) {
      return errorResponse('Message is required', 400);
    }

    // Check daily usage limit
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    let dailyUsage = await prisma.dailyUsage.findUnique({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      }
    });

    if (!dailyUsage) {
      // Create new daily usage record
      dailyUsage = await prisma.dailyUsage.create({
        data: {
          userId: user.id,
          date: today,
          messageCount: 0
        }
      });
    }

    // Check if user has exceeded daily limit
    if (dailyUsage.messageCount >= DAILY_MESSAGE_LIMIT) {
      return errorResponse(
        `Daily message limit reached (${DAILY_MESSAGE_LIMIT} messages per day). Try again tomorrow!`,
        429 // Too Many Requests
      );
    }

    // Increment usage count
    await prisma.dailyUsage.update({
      where: { id: dailyUsage.id },
      data: {
        messageCount: dailyUsage.messageCount + 1
      }
    });

    // Store user message in database
    const userMessage = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: 'USER',
        content: message,
        sessionId: sessionId || null,
      }
    });

    // Get user's actual financial data from database
    const [transactions, budgets, goals, userProfile] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
        take: 50 // Last 50 transactions for context
      }),
      prisma.budget.findMany({
        where: { userId: user.id },
        include: { category: true }
      }),
      prisma.goal.findMany({
        where: { userId: user.id }
      }),
      prisma.userProfile.findUnique({
        where: { userId: user.id }
      })
    ]);

    // Build context with real data
    const contextData = {
      firstName: userProfile?.firstName || user.name?.split(' ')[0] || 'there',
      transactions: transactions.map(t => ({
        ...t,
        amount: Number(t.amount)
      })),
      budgets: budgets.map(b => ({
        ...b,
        amount: Number(b.amount),
        spent: Number(b.spent || 0)
      })),
      goals: goals.map(g => ({
        ...g,
        targetAmount: Number(g.targetAmount),
        currentAmount: Number(g.currentAmount)
      }))
    };

    // Build context about the user's financial situation
    const contextPrompt = buildFinancialContext(contextData);

    // Create the system prompt
    const systemPrompt = `You are MoneyGuy AI, a friendly and knowledgeable personal financial advisor. 

Your role:
- Provide helpful, personalized financial advice
- Be encouraging and supportive
- Give specific, actionable recommendations
- Use emojis to make responses engaging
- Keep responses concise but informative (2-4 sentences max)
- Focus on practical advice the user can implement

User's Financial Context:
${contextPrompt}

Guidelines:
- Always be encouraging and positive
- Provide specific dollar amounts or percentages when relevant
- Suggest concrete next steps
- If you don't have enough data, ask clarifying questions
- Use the user's name when available
- Reference their actual financial data when giving advice`;

    // Get recent chat history for context
    const recentMessages = await prisma.chatMessage.findMany({
      where: {
        userId: user.id,
        ...(sessionId && { sessionId })
      },
      orderBy: { timestamp: 'desc' },
      take: 10 // Last 10 messages for context
    });

    // Build conversation history
    const conversationHistory = recentMessages
      .reverse()
      .slice(0, -1) // Exclude the current message we just added
      .map(msg => ({
        role: msg.role.toLowerCase() as 'user' | 'assistant',
        content: msg.content
      }));

    // Call OpenAI API with GPT-3.5
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Changed from gpt-4 to save costs
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...conversationHistory,
        {
          role: "user",
          content: message,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    // Store AI response in database
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: 'ASSISTANT',
        content: aiResponse,
        sessionId: sessionId || null,
      }
    });

    // Get updated usage count for response
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
        usage: {
          used: updatedUsage?.messageCount || 0,
          limit: DAILY_MESSAGE_LIMIT,
          remaining: DAILY_MESSAGE_LIMIT - (updatedUsage?.messageCount || 0)
        }
      },
    });

  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }

    console.error('OpenAI API Error:', error);
    
    // Store fallback message in database if user is authenticated
    try {
      const user = await requireAuth(request);
      const fallbackResponse = "I'm having trouble connecting right now 🤖 But I'm here to help with your finances! Try asking me about budgeting, saving strategies, or your financial goals.";
      
      const assistantMessage = await prisma.chatMessage.create({
        data: {
          userId: user.id,
          role: 'ASSISTANT',
          content: fallbackResponse,
          sessionId: null,
        }
      });

      return successResponse({
        success: true,
        data: {
          message: fallbackResponse,
          timestamp: assistantMessage.timestamp.toISOString(),
          messageId: assistantMessage.id,
        },
      });
    } catch {
      // If even auth fails, return basic fallback
      return successResponse({
        success: true,
        data: {
          message: "I'm having trouble connecting right now 🤖 But I'm here to help with your finances! Try asking me about budgeting, saving strategies, or your financial goals.",
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}

// GET /api/chat - Get chat history (unchanged)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '50');

    const messages = await prisma.chatMessage.findMany({
      where: {
        userId: user.id,
        ...(sessionId && { sessionId })
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    // Get today's usage for the response
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
        messages: messages.reverse(), // Return in chronological order
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

function buildFinancialContext(userContext?: {
  firstName?: string;
  transactions?: any[];
  budgets?: any[];
  goals?: any[];
}): string {
  if (!userContext) {
    return "No financial data available yet.";
  }

  const { firstName, transactions = [], budgets = [], goals = [] } = userContext;
  
  let context = '';
  
  if (firstName) {
    context += `User's name: ${firstName}\n`;
  }

  // Transaction analysis
  if (transactions.length > 0) {
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    // Get spending by category
    const categorySpending: { [key: string]: number } = {};
    transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
      const categoryName = t.category?.name || t.category || 'Uncategorized';
      categorySpending[categoryName] = (categorySpending[categoryName] || 0) + t.amount;
    });
    
    const topCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category, amount]) => `${category}: $${amount.toFixed(0)}`)
      .join(', ');

    context += `\nFinancial Summary:
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Total Transactions: ${transactions.length}
- Top Spending Categories: ${topCategories || 'None yet'}`;
  }

  // Budget analysis
  if (budgets.length > 0) {
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = budgets.reduce((sum, b) => sum + (b.spent || 0), 0);
    const overBudgetCount = budgets.filter(b => {
      const percentage = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
      return percentage > 100;
    }).length;
    
    context += `\n\nBudget Summary:
- Active Budgets: ${budgets.length}
- Total Budgeted: $${totalBudgeted.toFixed(2)}
- Total Spent: $${totalSpent.toFixed(2)}
- Over-budget Categories: ${overBudgetCount}`;
  }

  // Goals analysis
  if (goals.length > 0) {
    const activeGoals = goals.filter(g => !g.isCompleted);
    const completedGoals = goals.filter(g => g.isCompleted);
    const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrentAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const overallProgress = totalTargetAmount > 0 ? (totalCurrentAmount / totalTargetAmount) * 100 : 0;

    context += `\n\nGoals Summary:
- Total Goals: ${goals.length}
- Active Goals: ${activeGoals.length}
- Completed Goals: ${completedGoals.length}
- Overall Progress: ${overallProgress.toFixed(1)}%
- Total Target Amount: $${totalTargetAmount.toLocaleString()}
- Total Saved: $${totalCurrentAmount.toLocaleString()}`;
  }

  return context || "User is just getting started with MoneyGuy.";
}
