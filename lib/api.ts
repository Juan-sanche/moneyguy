interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category?: {    // Change this to an object
    id: string;
    name: string;
  } | null;
  categoryId?: string | null;  // Add this field
  type: 'INCOME' | 'EXPENSE';
  date: string;
  createdAt: string;
}

interface Budget {
  id: string;
  userId: string;
  category: string | { name: string } | null; 
  amount: number;
  period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  createdAt: string;
  // Campos calculados
  spent?: number;
  remaining?: number;
  percentage?: number;
  status?: 'ON_TRACK' | 'WARNING' | 'OVER_BUDGET';
}

interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  isCompleted: boolean;
  createdAt: string;
  // Campos calculados
  progress?: number;
  remaining?: number;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
}

// Cliente API simple
export const api = {
  // ===== TRANSACTIONS API =====
  // GET /api/transactions
  getTransactions: async (): Promise<Transaction[]> => {
    try {
      const response = await fetch('/api/transactions');
      const result: ApiResponse<Transaction[]> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data || [];
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  },

  // POST /api/transactions
  createTransaction: async (transactionData: {
    amount: number;
    description: string;
    category: string;
    type: 'INCOME' | 'EXPENSE';
    date?: string;
  }): Promise<Transaction> => {
    try {
      console.log('Sending transaction data:', transactionData); // Debug line
    
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
    
      const result: ApiResponse<Transaction> = await response.json();
    
      console.log('API Response:', result); // Debug line
    
      if (!result.success) {
        throw new Error(result.message);
      }
    
      return result.data!;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  },
    // PUT /api/transactions/[id]
  updateTransaction: async (id: string, transactionData: {
    amount: number;
    description: string;
    category: string;
    type: 'INCOME' | 'EXPENSE';
    date?: string;
  }): Promise<Transaction> => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
      
      const result: ApiResponse<Transaction> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data!;
    } catch (error) {
      console.error('Error updating transaction:', error);
      throw error;
    }
  },

  // DELETE /api/transactions/[id]
  deleteTransaction: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });
      
      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      throw error;
    }
  },

  // ===== BUDGETS API =====
  // GET /api/budgets
  getBudgets: async (): Promise<Budget[]> => {
    try {
      const response = await fetch('/api/budgets');
      const result: ApiResponse<Budget[]> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data || [];
    } catch (error) {
      console.error('Error fetching budgets:', error);
      throw error;
    }
  },

  // POST /api/budgets
  createBudget: async (budgetData: {
    category: string;
    amount: number;
    period: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate: string;
    endDate: string;
  }): Promise<Budget> => {
    try {
      const response = await fetch('/api/budgets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(budgetData),
      });
      
      const result: ApiResponse<Budget> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data!;
    } catch (error) {
      console.error('Error creating budget:', error);
      throw error;
    }
  },

  // DELETE /api/budgets/[id]
  deleteBudget: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
      });
      
      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error deleting budget:', error);
      throw error;
    }
  },
  
  getGoals: async (): Promise<Goal[]> => {
    try {
      const response = await fetch('/api/goals');
      const result: ApiResponse<Goal[]> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data || [];
    } catch (error) {
      console.error('Error fetching goals:', error);
      throw error;
    }
  },

  // POST /api/goals
  createGoal: async (goalData: {
    title: string;
    description?: string;
    targetAmount: number;
    deadline?: string;
  }): Promise<Goal> => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });
      
      const result: ApiResponse<Goal> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data!;
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  },

  // DELETE /api/goals/[id]
  deleteGoal: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/goals/${id}`, {
        method: 'DELETE',
      });
      
      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    }
  },

  // PUT /api/goals/[id]/progress
  updateGoalProgress: async (id: string, amount: number): Promise<Goal> => {
    try {
      const response = await fetch(`/api/goals/${id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount }),
      });
      
      const result: ApiResponse<Goal> = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      return result.data!;
    } catch (error) {
      console.error('Error updating goal progress:', error);
      throw error;
    }
  },
};