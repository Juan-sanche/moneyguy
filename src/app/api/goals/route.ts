import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../lib/auth-helpers';

// GET /api/goals - Get all goals for user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const goals = await prisma.goal.findMany({
      where: {
        userId: user.id
      },
      include: {
        progress: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate progress for each goal
    const goalsWithProgress = goals.map(goal => {
      const progress = Number(goal.targetAmount) > 0 ? Math.round((Number(goal.currentAmount) / Number(goal.targetAmount)) * 100) : 0;
      const remaining = Number(goal.targetAmount) - Number(goal.currentAmount);
      
      let status = 'IN_PROGRESS';
      if (goal.isCompleted) {
        status = 'COMPLETED';
      } else if (goal.targetDate && new Date() > new Date(goal.targetDate)) {
        status = 'OVERDUE';
      }
      
      return {
        ...goal,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
        progress,
        remaining,
        status,
      };
    });
    
    return successResponse({
      success: true,
      data: goalsWithProgress,
      message: 'Goals retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching goals:', error);
    return errorResponse('Failed to fetch goals', 500);
  }
}

// POST /api/goals - Create new goal
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { title, description, targetAmount, currentAmount, deadline, category, priority } = body;
    
    // Validation
    if (!title || !targetAmount) {
      return errorResponse('Title and target amount are required');
    }
    
    if (targetAmount <= 0) {
      return errorResponse('Target amount must be greater than 0');
    }

    // Determine goal type based on category or default to SAVINGS
    const goalType = category?.toLowerCase().includes('debt') ? 'DEBT_PAYOFF' :
                    category?.toLowerCase().includes('investment') ? 'INVESTMENT' :
                    category?.toLowerCase().includes('spending') || category?.toLowerCase().includes('limit') ? 'SPENDING_LIMIT' :
                    'SAVINGS';
    
    // Create goal
    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title,
        description: description || null,
        type: goalType,
        targetAmount: parseFloat(targetAmount),
        currentAmount: currentAmount ? parseFloat(currentAmount) : 0,
        targetDate: deadline ? new Date(deadline) : null,
      },
      include: {
        progress: true
      }
    });
    
    return successResponse({
      success: true,
      data: {
        ...goal,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
      },
      message: 'Goal created successfully'
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error creating goal:', error);
    return errorResponse('Failed to create goal', 500);
  }
}
