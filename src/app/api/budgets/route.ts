import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../lib/auth-helpers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/budgets - Get all budgets for user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const budgets = await prisma.budget.findMany({
      where: {
        userId: user.id
      },
      include: {
        category: true // Include category info
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate spending for each budget by looking at transactions
    const budgetsWithProgress = await Promise.all(
      budgets.map(async (budget) => {
        // Get transactions for this budget's category within the budget period
        const transactions = await prisma.transaction.findMany({
          where: {
            userId: user.id,
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
        const remaining = Number(budget.amount) - spent;
        
        let status = 'ON_TRACK';
        if (percentage > 100) {
          status = 'OVER_BUDGET';
        } else if (percentage > 80) {
          status = 'WARNING';
        }
        
        return {
          ...budget,
          amount: Number(budget.amount),
          spent,
          remaining,
          percentage,
          status,
        };
      })
    );
    
    return successResponse({
      success: true,
      data: budgetsWithProgress,
      message: 'Budgets retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching budgets:', error);
    return errorResponse('Failed to fetch budgets', 500);
  }
}

// POST /api/budgets - Create new budget
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { category, amount, period, startDate, endDate } = body;
    
    // Validation
    if (!category || !amount || !period || !startDate || !endDate) {
      return errorResponse('Missing required fields: category, amount, period, startDate, endDate');
    }
    
    if (!['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].includes(period)) {
      return errorResponse('Period must be WEEKLY, MONTHLY, QUARTERLY, or YEARLY');
    }

    // First, create or find the category
    let categoryRecord = await prisma.category.findFirst({
      where: {
        userId: user.id,
        name: category,
        type: 'EXPENSE'
      }
    });

    if (!categoryRecord) {
      categoryRecord = await prisma.category.create({
        data: {
          userId: user.id,
          name: category,
          type: 'EXPENSE'
        }
      });
    }
    
    // Create budget
    const budget = await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: categoryRecord.id,
        name: `${category} Budget`,
        amount: parseFloat(amount),
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: {
        category: true
      }
    });
    
    return successResponse({
      success: true,
      data: {
        ...budget,
        amount: Number(budget.amount)
      },
      message: 'Budget created successfully'
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error creating budget:', error);
    return errorResponse('Failed to create budget', 500);
  }
}
