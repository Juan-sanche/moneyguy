// COPIA ESTE CÓDIGO EN: src/app/api/transactions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../../lib/auth-helpers';

// GET /api/transactions/[id] - Get specific transaction
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id // Ensure user owns this transaction
      },
      include: {
        category: true
      }
    });
    
    if (!transaction) {
      return errorResponse('Transaction not found', 404);
    }
    
    return successResponse({
      success: true,
      data: transaction,
      message: 'Transaction retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching transaction:', error);
    return errorResponse('Failed to fetch transaction', 500);
  }
}

// PUT /api/transactions/[id] - Update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    const body = await request.json();
    
    const { amount, description, categoryId, type, date } = body;
    
    // Check if transaction exists and belongs to user
    const existingTransaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!existingTransaction) {
      return errorResponse('Transaction not found', 404);
    }
    
    // Validate category if provided
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId: user.id
        }
      });
      
      if (!category) {
        return errorResponse('Category not found or does not belong to user');
      }
    }
    
    // Update transaction
    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(amount && { amount: parseFloat(amount) }),
        ...(description && { description }),
        ...(categoryId !== undefined && { categoryId }),
        ...(type && { type }),
        ...(date && { date: new Date(date) }),
      },
      include: {
        category: true
      }
    });
    
    return successResponse({
      success: true,
      data: updatedTransaction,
      message: 'Transaction updated successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error updating transaction:', error);
    return errorResponse('Failed to update transaction', 500);
  }
}

// DELETE /api/transactions/[id] - Delete transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(request);
    const { id } = params;
    
    // Check if transaction exists and belongs to user
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
        userId: user.id
      }
    });
    
    if (!transaction) {
      return errorResponse('Transaction not found', 404);
    }
    
    // Delete transaction
    await prisma.transaction.delete({
      where: { id }
    });
    
    return successResponse({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error deleting transaction:', error);
    return errorResponse('Failed to delete transaction', 500);
  }
}