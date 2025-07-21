'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSuccess: () => void;
  onToggleMode: () => void;
}

export function AuthForm({ mode, onSuccess, onToggleMode }: AuthFormProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    // Clear error when user starts typing
    if (errors[e.target.name]) {
      setErrors(prev => ({
        ...prev,
        [e.target.name]: '',
      }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'register') {
      if (!formData.firstName) {
        newErrors.firstName = 'First name is required';
      }
      if (!formData.lastName) {
        newErrors.lastName = 'Last name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      const { auth } = await import('../../../lib/auth');
      
      let user;
      if (mode === 'login') {
        user = auth.login(formData.email, formData.password);
        if (!user) {
          setErrors({ submit: 'Invalid email or password' });
          setIsLoading(false);
          return;
        }
      } else {
        user = auth.register(formData.email, formData.password, formData.firstName, formData.lastName);
        if (!user) {
          setErrors({ submit: 'Email already exists' });
          setIsLoading(false);
          return;
        }
      }

      onSuccess();
    } catch (error) {
      setErrors({ submit: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen buddy-gradient flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💰</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === 'login' ? 'Welcome Back' : 'Join MoneyGuy'}
          </h1>
          <p className="text-gray-600 mt-2">
            {mode === 'login' 
              ? 'Sign in to your account to continue' 
              : 'Create your account to start managing your finances'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="First Name"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                error={errors.firstName}
                placeholder="John"
              />
              <Input
                label="Last Name"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={errors.lastName}
                placeholder="Doe"
              />
            </div>
          )}

          <Input
            label="Email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            placeholder="you@example.com"
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="Enter your password"
          />

          {errors.submit && (
            <div className="text-sm text-red-600 text-center">
              {errors.submit}
            </div>
          )}

          <Button
            type="submit"
            variant="buddy"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading 
              ? (mode === 'login' ? 'Signing in...' : 'Creating account...') 
              : (mode === 'login' ? 'Sign In' : 'Create Account')
            }
          </Button>
        </form>

        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={onToggleMode}
              className="text-blue-600 hover:underline font-medium"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
          
          {mode === 'login' && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Demo Account:</p>
              <p className="text-xs text-gray-600">
                <strong>Email:</strong> demo@moneyguy.com<br />
                <strong>Password:</strong> password123
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
