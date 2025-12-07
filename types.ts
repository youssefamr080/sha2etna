export enum ExpenseCategory {
  RENT = 'Rent',
  UTILITIES = 'Utilities',
  GROCERIES = 'Groceries',
  INTERNET = 'Internet',
  ELECTRICITY = 'Electricity',
  WATER = 'Water',
  GAS = 'Gas',
  ENTERTAINMENT = 'Entertainment',
  FOOD = 'Food',
  TRANSPORTATION = 'Transportation',
  MAINTENANCE = 'Maintenance',
  OTHER = 'Other'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
}

export enum NotificationType {
  EXPENSE_ADDED = 'EXPENSE_ADDED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  DEBT_REMINDER = 'DEBT_REMINDER',
  BILL_DUE = 'BILL_DUE',
  NEW_MEMBER = 'NEW_MEMBER',
  CHAT_MESSAGE = 'CHAT_MESSAGE'
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  avatar?: string;
  created_at?: string;
}

export interface Group {
  id: string;
  name: string;
  code: string;
  password?: string;
  members: string[];
  created_by?: string;
  created_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Expense {
  id: string;
  groupId: string;
  payerId: string;
  amount: number;
  description: string;
  category: ExpenseCategory;
  date: string;
  receiptUrl?: string;
  splitBetween: string[];
  splitAmounts?: { [userId: string]: number };
  notes?: string;
  created_at?: string;
}

export interface Debt {
  id?: string;
  from: string;
  to: string;
  amount: number;
  description?: string;
  dueDate?: string;
  isPersonal?: boolean;
  groupId?: string;
  status?: 'active' | 'paid' | 'overdue';
  created_at?: string;
}

export interface Payment {
  id: string;
  from: string;
  to: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  notes?: string;
  groupId?: string;
  confirmed_at?: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  text: string;
  timestamp: number;
  type?: 'text' | 'image' | 'system';
  imageUrl?: string;
}

export interface ShoppingItem {
  id: string;
  groupId: string;
  text: string;
  addedBy: string;
  completed: boolean;
  completedBy?: string;
  priority?: 'low' | 'medium' | 'high';
  quantity?: number;
  created_at?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  date: number;
  data?: Record<string, unknown>;
  actionUrl?: string;
}

export interface Bill {
  id: string;
  groupId: string;
  name: string;
  amount: number;
  category: ExpenseCategory;
  dueDate: string;
  recurring: boolean;
  recurringPeriod?: 'monthly' | 'quarterly' | 'yearly';
  reminder: boolean;
  reminderDays?: number;
  lastPaid?: string;
  status: 'pending' | 'paid' | 'overdue';
}

export interface ExpenseSplit {
  id: string;
  expenseId: string;
  userId: string;
  amount: number;
  paid: boolean;
  paidAt?: string | null;
}

export interface ExpenseWithSplits extends Expense {
  splits: ExpenseSplit[];
}

export interface ExpenseCursor {
  id: string;
  date: string;
}

export interface UserStats {
  totalPaid: number;
  totalOwed: number;
  totalOwing: number;
  balance: number;
  monthlyExpenses: { month: string; amount: number }[];
  categoryBreakdown: { category: string; amount: number }[];
}

export interface GroupStats {
  totalExpenses: number;
  monthlyTotal: number;
  highestSpender: { userId: string; amount: number };
  categoryDistribution: { category: string; amount: number; percentage: number }[];
  monthlyTrend: { month: string; amount: number }[];
  memberContributions: { userId: string; amount: number; percentage: number }[];
}

export interface UserBalance {
  userId: string;
  totalPaid: number;
  totalShare: number;
  totalSent: number;
  totalReceived: number;
  balance: number;
}

export interface PaginatedResult<T, Cursor = string | number | null> {
  items: T[];
  nextCursor?: Cursor | null;
  hasMore: boolean;
}

export interface Theme {
  mode: 'light' | 'dark';
}