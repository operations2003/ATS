const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export type UserRole = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'RECRUITER' | 'ADMIN' | 'MEMBER' | 'TEAM_LEADER' | 'USER' | 'TEAM_LEAD' | 'RECRUITER_MEMBER';

export interface User {
  id: string;
  name?: string | null;
  email: string;
  role?: UserRole;
  isActive?: boolean;
  organizationId?: string;
  avatarUrl?: string | null;
  teamName?: string;
  createdAt?: string;
  updatedAt?: string;
  password?: string;
}

export interface OrganizationQuota {
  organizationId: string;
  organizationName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  subscriptionPlan: string;
  billingCycle: string;
  subscriptionExpiry?: string | null;
  totalLimit: number;
  currentUsers: number;
  availableSlots: number;
  maxRecruiters: number;
  currentRecruiters: number;
  availableRecruiterSlots: number;
  maxActiveJobs: number;
  currentActiveJobs: number;
  availableJobSlots: number;
  maxResumesPerMonth: number;
}

export interface ClientOrganization {
  id: string;
  name: string;
  companyEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  subscriptionPlan: string;
  billingCycle: string;
  subscriptionStart: string;
  subscriptionExpiry?: string | null;
  maxUsers: number;
  maxRecruiters: number;
  maxActiveJobs: number;
  maxResumesPerMonth: number;
  createdAt: string;
  updatedAt: string;
  currentUsers: number;
  availableUserSlots: number;
  currentRecruiters: number;
  availableRecruiterSlots: number;
  currentActiveJobs: number;
  availableJobSlots: number;
  totalCandidates: number;
  totalEvaluations: number;
  clientAdmin?: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  } | null;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An unexpected error occurred');
  }

  return data as T;
}
