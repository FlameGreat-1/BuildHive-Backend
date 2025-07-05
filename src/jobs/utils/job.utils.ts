import { 
  Job, 
  JobStatus, 
  JobPriority, 
  JobType, 
  JobTag,
  Material,
  JobSummary,
  JobStatistics
} from '../types';
import { JOB_CONSTANTS } from '../../config/jobs';
import { logger } from '../../shared/utils';

export class JobUtils {
  static calculateJobProgress(job: Job): number {
    const statusWeights = {
      [JobStatus.PENDING]: 0,
      [JobStatus.ACTIVE]: 50,
      [JobStatus.ON_HOLD]: 25,
      [JobStatus.COMPLETED]: 100,
      [JobStatus.CANCELLED]: 0
    };

    let progress = statusWeights[job.status];

    if (job.status === JobStatus.ACTIVE && job.hoursWorked && job.estimatedDuration) {
      const workProgress = Math.min((job.hoursWorked / job.estimatedDuration) * 50, 50);
      progress = 50 + workProgress;
    }

    return Math.round(progress);
  }

  static calculateTotalMaterialCost(materials: Material[]): number {
    return materials.reduce((total, material) => total + material.totalCost, 0);
  }

  static calculateEstimatedJobValue(job: Job): number {
    const materialCost = this.calculateTotalMaterialCost(job.materials || []);
    const laborCost = job.estimatedDuration * JOB_CONSTANTS.CALCULATIONS.DEFAULT_HOURLY_RATE;
    const overhead = (materialCost + laborCost) * JOB_CONSTANTS.CALCULATIONS.OVERHEAD_PERCENTAGE;
    
    return materialCost + laborCost + overhead;
  }

  static getJobPriorityWeight(priority: JobPriority): number {
    const weights = {
      [JobPriority.LOW]: 1,
      [JobPriority.MEDIUM]: 2,
      [JobPriority.HIGH]: 3,
      [JobPriority.URGENT]: 4
    };
    
    return weights[priority];
  }

  static isJobOverdue(job: Job): boolean {
    const now = new Date();
    return job.dueDate < now && job.status !== JobStatus.COMPLETED;
  }

  static getDaysUntilDue(job: Job): number {
    const now = new Date();
    const timeDiff = job.dueDate.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  static getJobDuration(job: Job): number {
    const timeDiff = job.dueDate.getTime() - job.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  static canTransitionStatus(currentStatus: JobStatus, newStatus: JobStatus): boolean {
    const validTransitions: Record<JobStatus, JobStatus[]> = {
      [JobStatus.PENDING]: [JobStatus.ACTIVE, JobStatus.CANCELLED],
      [JobStatus.ACTIVE]: [JobStatus.COMPLETED, JobStatus.ON_HOLD, JobStatus.CANCELLED],
      [JobStatus.ON_HOLD]: [JobStatus.ACTIVE, JobStatus.CANCELLED],
      [JobStatus.COMPLETED]: [],
      [JobStatus.CANCELLED]: []
    };

    return validTransitions[currentStatus].includes(newStatus);
  }

  static getNextValidStatuses(currentStatus: JobStatus): JobStatus[] {
    const validTransitions: Record<JobStatus, JobStatus[]> = {
      [JobStatus.PENDING]: [JobStatus.ACTIVE, JobStatus.CANCELLED],
      [JobStatus.ACTIVE]: [JobStatus.COMPLETED, JobStatus.ON_HOLD, JobStatus.CANCELLED],
      [JobStatus.ON_HOLD]: [JobStatus.ACTIVE, JobStatus.CANCELLED],
      [JobStatus.COMPLETED]: [],
      [JobStatus.CANCELLED]: []
    };

    return validTransitions[currentStatus];
  }

  static formatJobTitle(title: string): string {
    return title.trim().replace(/\s+/g, ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  static generateJobReference(jobId: number, jobType: JobType): string {
    const typePrefix = {
      [JobType.ELECTRICAL]: 'ELE',
      [JobType.PLUMBING]: 'PLU',
      [JobType.CARPENTRY]: 'CAR',
      [JobType.PAINTING]: 'PAI',
      [JobType.ROOFING]: 'ROO',
      [JobType.FLOORING]: 'FLO',
      [JobType.TILING]: 'TIL',
      [JobType.HVAC]: 'HVA',
      [JobType.HANDYMAN]: 'HAN', 
      [JobType.GENERAL]: 'GEN',
      [JobType.LANDSCAPING]: 'LAN',
      [JobType.CLEANING]: 'CLE',
      [JobType.MAINTENANCE]: 'MAI',
      [JobType.RENOVATION]: 'REN',
      [JobType.INSTALLATION]: 'INS',
      [JobType.REPAIR]: 'REP',
      [JobType.INSPECTION]: 'ISP',
      [JobType.OTHER]: 'OTH'
    };

    const year = new Date().getFullYear().toString().slice(-2);
    const paddedId = jobId.toString().padStart(4, '0');
    
    return `${typePrefix[jobType]}-${year}-${paddedId}`;
  }

  static sortJobsByPriority(jobs: Job[]): Job[] {
    return jobs.sort((a, b) => {
      const priorityDiff = this.getJobPriorityWeight(b.priority) - this.getJobPriorityWeight(a.priority);
      
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }

  static filterJobsByDateRange(jobs: Job[], startDate: Date, endDate: Date): Job[] {
    return jobs.filter(job => 
      job.startDate >= startDate && job.startDate <= endDate
    );
  }

  static getJobsByStatus(jobs: Job[], status: JobStatus): Job[] {
    return jobs.filter(job => job.status === status);
  }

  static getOverdueJobs(jobs: Job[]): Job[] {
    return jobs.filter(job => this.isJobOverdue(job));
  }

  static getUpcomingJobs(jobs: Job[], days: number = 7): Job[] {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    
    return jobs.filter(job => 
      job.startDate >= now && 
      job.startDate <= futureDate &&
      job.status === JobStatus.PENDING
    );
  }

  static calculateJobEfficiency(job: Job): number {
    if (!job.hoursWorked || !job.estimatedDuration) {
      return 0;
    }

    return Math.round((job.estimatedDuration / job.hoursWorked) * 100);
  }

  static getJobHealthScore(job: Job): number {
    let score = 100;

    if (this.isJobOverdue(job)) {
      score -= 30;
    }

    const daysUntilDue = this.getDaysUntilDue(job);
    if (daysUntilDue <= 1 && job.status !== JobStatus.COMPLETED) {
      score -= 20;
    }

    if (job.status === JobStatus.ON_HOLD) {
      score -= 15;
    }

    const efficiency = this.calculateJobEfficiency(job);
    if (efficiency < 80 && efficiency > 0) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  static validateJobData(job: Partial<Job>): string[] {
    const errors: string[] = [];

    if (job.title && job.title.length < JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH) {
      errors.push(`Title must be at least ${JOB_CONSTANTS.VALIDATION.TITLE_MIN_LENGTH} characters`);
    }

    if (job.startDate && job.dueDate && job.startDate >= job.dueDate) {
      errors.push('Due date must be after start date');
    }

    if (job.estimatedDuration && (job.estimatedDuration < JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION || 
        job.estimatedDuration > JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION)) {
      errors.push(`Estimated duration must be between ${JOB_CONSTANTS.VALIDATION.MIN_ESTIMATED_DURATION} and ${JOB_CONSTANTS.VALIDATION.MAX_ESTIMATED_DURATION} hours`);
    }

    if (job.hoursWorked && (job.hoursWorked < 0 || job.hoursWorked > JOB_CONSTANTS.VALIDATION.MAX_HOURS_WORKED)) {
      errors.push(`Hours worked must be between 0 and ${JOB_CONSTANTS.VALIDATION.MAX_HOURS_WORKED}`);
    }

    return errors;
  }
}
