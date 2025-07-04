import { 
  Client, 
  ClientTag,
  Job,
  JobStatus
} from '../types';
import { CLIENT_CONSTANTS } from '../../config/jobs';
import { logger } from '../../shared/utils';

export class ClientUtils {
  static formatClientName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  static formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    
    return phone;
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static generateClientReference(clientId: number): string {
    const year = new Date().getFullYear().toString().slice(-2);
    const paddedId = clientId.toString().padStart(4, '0');
    return `CLI-${year}-${paddedId}`;
  }

  static calculateClientValue(client: Client): number {
    return client.totalRevenue || 0;
  }

  static getClientLifetimeValue(client: Client, jobs: Job[]): number {
    const clientJobs = jobs.filter(job => job.clientEmail === client.email);
    return clientJobs.reduce((total, job) => {
      return total + (job.totalCost || 0);
    }, 0);
  }

  static getClientJobCount(client: Client): number {
    return client.totalJobs || 0;
  }

  static isVIPClient(client: Client): boolean {
    const vipThreshold = CLIENT_CONSTANTS.VIP_THRESHOLDS.REVENUE;
    const jobThreshold = CLIENT_CONSTANTS.VIP_THRESHOLDS.JOB_COUNT;
    
    return (client.totalRevenue || 0) >= vipThreshold || 
           (client.totalJobs || 0) >= jobThreshold;
  }

  static getClientRating(client: Client, jobs: Job[]): number {
    const clientJobs = jobs.filter(job => job.clientEmail === client.email);
    
    if (clientJobs.length === 0) return 0;
    
    let score = 100;
    
    // Deduct points for cancelled jobs
    const cancelledJobs = clientJobs.filter(job => job.status === JobStatus.CANCELLED);
    score -= (cancelledJobs.length / clientJobs.length) * 30;
    
    // Add points for completed jobs
    const completedJobs = clientJobs.filter(job => job.status === JobStatus.COMPLETED);
    score += (completedJobs.length / clientJobs.length) * 10;
    
    // Consider payment history (if available)
    const paidJobs = clientJobs.filter(job => job.tags?.includes('paid' as any));
    if (paidJobs.length > 0) {
      score += (paidJobs.length / clientJobs.length) * 20;
    }
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  static getClientTags(client: Client): ClientTag[] {
    const tags: ClientTag[] = [...(client.tags || [])];
    
    if (this.isVIPClient(client) && !tags.includes(ClientTag.VIP)) {
      tags.push(ClientTag.VIP);
    }
    
    if ((client.totalJobs || 0) > 1 && !tags.includes(ClientTag.REPEAT_CUSTOMER)) {
      tags.push(ClientTag.REPEAT_CUSTOMER);
    }
    
    return tags;
  }

  static sortClientsByValue(clients: Client[]): Client[] {
    return clients.sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
  }

  static sortClientsByJobCount(clients: Client[]): Client[] {
    return clients.sort((a, b) => (b.totalJobs || 0) - (a.totalJobs || 0));
  }

  static filterClientsByTag(clients: Client[], tag: ClientTag): Client[] {
    return clients.filter(client => client.tags?.includes(tag));
  }

  static getRecentClients(clients: Client[], days: number = 30): Client[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return clients.filter(client => 
      client.lastJobDate && client.lastJobDate >= cutoffDate
    );
  }

  static getInactiveClients(clients: Client[], days: number = 90): Client[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return clients.filter(client => 
      !client.lastJobDate || client.lastJobDate < cutoffDate
    );
  }

  static validateClientData(client: Partial<Client>): string[] {
    const errors: string[] = [];

    if (client.name && client.name.length < CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH) {
      errors.push(`Name must be at least ${CLIENT_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters`);
    }

    if (client.email && !this.validateEmail(client.email)) {
      errors.push('Invalid email format');
    }

    if (client.phone && client.phone.length < CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH) {
      errors.push(`Phone must be at least ${CLIENT_CONSTANTS.VALIDATION.PHONE_MIN_LENGTH} characters`);
    }

    return errors;
  }

  static searchClients(clients: Client[], searchTerm: string): Client[] {
    const term = searchTerm.toLowerCase();
    
    return clients.filter(client => 
      client.name.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      (client.company && client.company.toLowerCase().includes(term)) ||
      (client.phone && client.phone.includes(term))
    );
  }
}
