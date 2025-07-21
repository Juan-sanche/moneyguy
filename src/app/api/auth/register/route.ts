import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../../lib/prisma';
import { errorResponse, successResponse } from '../../../../../lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body;
    
    // Validation
    if (!email || !password || !firstName || !lastName) {
      return errorResponse('All fields are required');
    }
    
    if (password.length < 6) {
      return errorResponse('Password must be at least 6 characters');
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      return errorResponse('Invalid email format');
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return errorResponse('User with this email already exists');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user with profile and hashed password
    const user = await prisma.user.create({
      data: {
        email,
        name: `${firstName} ${lastName}`,
        password: hashedPassword, // Store hashed password
        profile: {
          create: {
            firstName,
            lastName,
          }
        }
      },
      include: {
        profile: true
      }
    });
    
    return successResponse({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
        }
      },
      message: 'User registered successfully'
    }, 201);
    
  } catch (error) {
    console.error('Registration error:', error);
    return errorResponse('Failed to register user', 500);
  }
}