// src/app/api/goals/[id]/progress/route.ts
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
    
    // Validation
    if (amount === undefined || amount === null) {
      return errorResponse('Progress amount is required');
    }
    
    if (amount < 0) {
      return errorResponse('Progress amount cannot be negative');
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
    
    // Calculate new current amount
    const progressAmount = parseFloat(amount.toString());
    const newCurrentAmount = Number(goal.currentAmount) + progressAmount;
    
    // Determine if goal should be marked as completed
    const isCompleted = newCurrentAmount >= Number(goal.targetAmount);
    
    // Start transaction to update both goal and create progress record
    const result = await prisma.$transaction(async (tx) => {
      // Update goal current amount
      const updatedGoal = await tx.goal.update({
        where: { id },
        data: {
          currentAmount: newCurrentAmount,
          isCompleted,
          updatedAt: new Date()
        },
        include: {
          progress: {
            orderBy: {
              createdAt: 'desc'
            }
          }
        }
      });
      
      // Create progress record
      const progressRecord = await tx.goalProgress.create({
        data: {
          goalId: id,
          amount: progressAmount,
          note: note || null,
        }
      });
      
      return { updatedGoal, progressRecord };
    });
    
    return successResponse({
      success: true,
      data: {
        ...result.updatedGoal,
        targetAmount: Number(result.updatedGoal.targetAmount),
        currentAmount: Number(result.updatedGoal.currentAmount),
        progressAdded: progressAmount,
        isCompleted,
      },
      message: isCompleted 
        ? '🎉 ¡Felicidades! Has completado tu meta' 
        : 'Progreso actualizado exitosamente'
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
    const progress = await prisma.goalProgress.findMany({
      where: {
        goalId: id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return successResponse({
      success: true,
      data: {
        goalId: id,
        goalTitle: goal.title,
        progress: progress.map(p => ({
          ...p,
          amount: Number(p.amount)
        }))
      },
      message: 'Goal progress history retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching goal progress:', error);
    return errorResponse('Failed to fetch goal progress', 500);
  }
}