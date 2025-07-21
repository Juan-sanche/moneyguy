import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../../../lib/auth-helpers';

// PUT /api/goals/[id]/progress - Update goal progress
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();
    const { amount, note } = body;
    
    if (!amount || isNaN(amount)) {
      return errorResponse('Valid amount is required');
    }
    
    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!goal) {
      return errorResponse('Goal not found', 404);
    }
    
    const progressAmount = parseFloat(amount);
    const newCurrentAmount = Number(goal.currentAmount) + progressAmount;
    const isCompleted = newCurrentAmount >= Number(goal.targetAmount);
    
    // Create progress record
    const progress = await prisma.goalProgress.create({
      data: {
        goalId: id,
        amount: progressAmount,
        note: note || null,
      }
    });
    
    // Update goal's current amount and completion status
    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        currentAmount: newCurrentAmount,
        isCompleted,
      },
      include: {
        progress: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    return successResponse({
      success: true,
      data: {
        goal: {
          ...updatedGoal,
          targetAmount: Number(updatedGoal.targetAmount),
          currentAmount: Number(updatedGoal.currentAmount),
        },
        progress: {
          ...progress,
          amount: Number(progress.amount)
        }
      },
      message: 'Goal progress updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error updating goal progress:', error);
    return errorResponse('Failed to update goal progress', 500);
  }
}

// GET /api/goals/[id]/progress - Get goal progress history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    
    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!goal) {
      return errorResponse('Goal not found', 404);
    }
    
    // Get progress history
    const progressHistory = await prisma.goalProgress.findMany({
      where: {
        goalId: id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const progressWithNumbers = progressHistory.map(p => ({
      ...p,
      amount: Number(p.amount)
    }));
    
    return successResponse({
      success: true,
      data: progressWithNumbers,
      message: 'Goal progress retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching goal progress:', error);
    return errorResponse('Failed to fetch goal progress', 500);
  }
}

// POST /api/goals/[id]/progress - Add new progress entry (alternative to PUT)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();
    const { amount, note } = body;
    
    if (!amount || isNaN(amount)) {
      return errorResponse('Valid amount is required');
    }
    
    // Check if goal exists and belongs to user
    const goal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!goal) {
      return errorResponse('Goal not found', 404);
    }
    
    const progressAmount = parseFloat(amount);
    const newCurrentAmount = Number(goal.currentAmount) + progressAmount;
    const isCompleted = newCurrentAmount >= Number(goal.targetAmount);
    
    // Create progress record
    const progress = await prisma.goalProgress.create({
      data: {
        goalId: id,
        amount: progressAmount,
        note: note || null,
      }
    });
    
    // Update goal's current amount and completion status
    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        currentAmount: newCurrentAmount,
        isCompleted,
      },
      include: {
        progress: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    return successResponse({
      success: true,
      data: {
        goal: {
          ...updatedGoal,
          targetAmount: Number(updatedGoal.targetAmount),
          currentAmount: Number(updatedGoal.currentAmount),
        },
        progress: {
          ...progress,
          amount: Number(progress.amount)
        }
      },
      message: 'Goal progress added successfully'
    }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error adding goal progress:', error);
    return errorResponse('Failed to add goal progress', 500);
  }
}