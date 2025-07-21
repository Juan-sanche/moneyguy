import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../../lib/auth-helpers';

// GET /api/budgets/[id] - Get specific budget
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    
    const budget = await prisma.budget.findFirst({
      where: {
        id,
        userId: user.id // Ensure user owns this budget
      },
      include: {
        category: true
      }
    });
    
    if (!budget) {
      return errorResponse('Budget not found', 404);
    }
    
    return successResponse({
      success: true,
      data: {
        ...budget,
        amount: Number(budget.amount)
      },
      message: 'Budget retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching budget:', error);
    return errorResponse('Failed to fetch budget', 500);
  }
}

// PUT /api/budgets/[id] - Update budget
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();
    
    const { category, amount, period, startDate, endDate } = body;
    
    // Check if budget exists and belongs to user
    const existingBudget = await prisma.budget.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!existingBudget) {
      return errorResponse('Budget not found', 404);
    }

    // If category is being updated, find or create the category
    let categoryId = existingBudget.categoryId;
    if (category) {
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
      categoryId = categoryRecord.id;
    }
    
    // Update budget
    const updatedBudget = await prisma.budget.update({
      where: { id },
      data: {
        ...(categoryId && { categoryId }),
        ...(amount && { amount: parseFloat(amount) }),
        ...(period && { period }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        category: true
      }
    });
    
    return successResponse({
      success: true,
      data: {
        ...updatedBudget,
        amount: Number(updatedBudget.amount)
      },
      message: 'Budget updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error updating budget:', error);
    return errorResponse('Failed to update budget', 500);
  }
}

// DELETE /api/budgets/[id] - Delete budget
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    
    // Check if budget exists and belongs to user
    const budget = await prisma.budget.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!budget) {
      return errorResponse('Budget not found', 404);
    }
    
    // Delete budget
    await prisma.budget.delete({
      where: { id }
    });
    
    return successResponse({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error deleting budget:', error);
    return errorResponse('Failed to delete budget', 500);
  }
}
