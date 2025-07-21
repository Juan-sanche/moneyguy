import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../../lib/auth-helpers';

// GET /api/goals/[id] - Get specific goal
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    
    const goal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id // Ensure user owns this goal
      },
      include: {
        progress: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    if (!goal) {
      return errorResponse('Goal not found', 404);
    }
    
    return successResponse({
      success: true,
      data: {
        ...goal,
        targetAmount: Number(goal.targetAmount),
        currentAmount: Number(goal.currentAmount),
      },
      message: 'Goal retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching goal:', error);
    return errorResponse('Failed to fetch goal', 500);
  }
}

// PUT /api/goals/[id] - Update goal
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();
    
    const { title, description, targetAmount, currentAmount, deadline, category } = body;
    
    // Check if goal exists and belongs to user
    const existingGoal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!existingGoal) {
      return errorResponse('Goal not found', 404);
    }

    // Determine if goal should be marked as completed
    const newCurrentAmount = currentAmount !== undefined ? parseFloat(currentAmount) : Number(existingGoal.currentAmount);
    const newTargetAmount = targetAmount !== undefined ? parseFloat(targetAmount) : Number(existingGoal.targetAmount);
    const isCompleted = newCurrentAmount >= newTargetAmount;
    
    // Update goal
    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(targetAmount && { targetAmount: parseFloat(targetAmount) }),
        ...(currentAmount !== undefined && { currentAmount: parseFloat(currentAmount) }),
        ...(deadline !== undefined && { targetDate: deadline ? new Date(deadline) : null }),
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
        ...updatedGoal,
        targetAmount: Number(updatedGoal.targetAmount),
        currentAmount: Number(updatedGoal.currentAmount),
      },
      message: 'Goal updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error updating goal:', error);
    return errorResponse('Failed to update goal', 500);
  }
}

// DELETE /api/goals/[id] - Delete goal
export async function DELETE(
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
    
    // Delete goal (this will also delete related progress records due to cascade)
    await prisma.goal.delete({
      where: { id }
    });
    
    return successResponse({
      success: true,
      message: 'Goal deleted successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error deleting goal:', error);
    return errorResponse('Failed to delete goal', 500);
  }
}