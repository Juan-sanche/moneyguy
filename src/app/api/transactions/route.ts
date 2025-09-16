import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireAuth, unauthorizedResponse, errorResponse, successResponse } from '../../../../lib/auth-helpers';

// GET /api/transactions - Get all transactions for user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id
      },
      include: {
        category:true
      },
      orderBy: {
        date: 'desc' // Most recent first
      }
    });
    
    return successResponse({
      success: true,
      data: transactions,
      message: 'Transactions retrieved successfully'
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error fetching transactions:', error);
    return errorResponse('Failed to fetch transactions', 500);
  }
}

// POST /api/transactions - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    
    const { amount, description, category, type, date } = body;
    
    // Validation
    if (!amount || !description || !type) {
      return errorResponse('Missing required fields: amount, description, type');
    }
    
    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return errorResponse('Type must be INCOME or EXPENSE');
    }
    
    let categoryId = null;

    // Create or find category if provided
    if (category && category.trim()) {
      const name = category.trim();
      const desiredCategoryType = type === 'INCOME' ? 'INCOME' : 'EXPENSE';
      try {
        // Prefer category matching desired type
        let categoryRecord = await prisma.category.findFirst({
          where: {
            userId: user.id,
            name,
            type: desiredCategoryType
          }
        });

        // If not found, try any category with same name (unique by name)
        if (!categoryRecord) {
          categoryRecord = await prisma.category.findFirst({
            where: { userId: user.id, name }
          });
        }

        // Create if none exists
        if (!categoryRecord) {
          categoryRecord = await prisma.category.create({
            data: {
              userId: user.id,
              name,
              type: desiredCategoryType
            }
          });
        }
        
        categoryId = categoryRecord.id;
      } catch (categoryError) {
        console.error('Category creation/lookup error:', categoryError);
        // Continue without category rather than failing
      }
    }
    
    
    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: parseFloat(amount),
        description,
        categoryId: categoryId,
        type,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        category: true
      }
    });
     
    return successResponse({
      success: true,
      data: {
        ...transaction,
        amount: Number(transaction.amount)
      },
      message: 'Transaction created successfully'
    }, 201);
    
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return unauthorizedResponse();
    }
    
    console.error('Error creating transaction:', error);
    return errorResponse('Failed to create transaction', 500);
  }
}
