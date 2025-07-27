import { 
    JobApplicationEntity,
    JobApplicationCreateData,
    JobApplicationSummary,
    JobApplicationDetails,
    JobApplicationFilters,
    JobApplicationSearchParams,
    ApplicationValidationResult,
    ApplicationStatusUpdate,
    ApplicationWithdrawal,
    TradieApplicationHistory
  } from '../types';
  import {
    APPLICATION_STATUS,
    MARKETPLACE_LIMITS,
    MARKETPLACE_VALIDATION_RULES,
    MARKETPLACE_CREDIT_COSTS,
    URGENCY_LEVEL,
    MARKETPLACE_JOB_TYPES
  } from '../../config/feeds';
  import { sanitizeString, validateCurrency } from '../../shared/utils';
  import { calculateCreditCost } from './marketplace.utils';
  
  export const validateApplicationData = (applicationData: JobApplicationCreateData): ApplicationValidationResult => {
    const errors: Array<{ field: string; message: string; code: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];
  
    if (!applicationData.custom_quote || applicationData.custom_quote < MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE) {
      errors.push({
        field: 'custom_quote',
        message: `Custom quote must be at least $${MARKETPLACE_LIMITS.MIN_CUSTOM_QUOTE}`,
        code: 'QUOTE_TOO_LOW'
      });
    }
  
    if (applicationData.custom_quote > MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE) {
      errors.push({
        field: 'custom_quote',
        message: `Custom quote cannot exceed $${MARKETPLACE_LIMITS.MAX_CUSTOM_QUOTE}`,
        code: 'QUOTE_TOO_HIGH'
      });
    }
  
    if (!applicationData.proposed_timeline || applicationData.proposed_timeline.trim().length < MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MIN_LENGTH) {
      errors.push({
        field: 'proposed_timeline',
        message: `Proposed timeline must be at least ${MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MIN_LENGTH} characters`,
        code: 'TIMELINE_TOO_SHORT'
      });
    }
  
    if (applicationData.proposed_timeline && applicationData.proposed_timeline.length > MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MAX_LENGTH) {
      errors.push({
        field: 'proposed_timeline',
        message: `Proposed timeline cannot exceed ${MARKETPLACE_LIMITS.APPLICATION_TIMELINE_MAX_LENGTH} characters`,
        code: 'TIMELINE_TOO_LONG'
      });
    }
  
    if (!applicationData.approachDescription || applicationData.approachDescription.trim().length < MARKETPLACE_LIMITS.APPLICATION_APPROACH_MIN_LENGTH) {
      errors.push({
        field: 'approachDescription',
        message: `Approach description must be at least ${MARKETPLACE_LIMITS.APPLICATION_APPROACH_MIN_LENGTH} characters`,
        code: 'APPROACH_TOO_SHORT'
      });
    }
  
    if (applicationData.approachDescription && applicationData.approachDescription.length > MARKETPLACE_LIMITS.APPLICATION_APPROACH_MAX_LENGTH) {
      errors.push({
        field: 'approachDescription',
        message: `Approach description cannot exceed ${MARKETPLACE_LIMITS.APPLICATION_APPROACH_MAX_LENGTH} characters`,
        code: 'APPROACH_TOO_LONG'
      });
    }
  
    if (!applicationData.availabilityDates || applicationData.availabilityDates.length === 0) {
      errors.push({
        field: 'availabilityDates',
        message: 'At least one availability date is required',
        code: 'AVAILABILITY_REQUIRED'
      });
    }
  
    if (applicationData.availabilityDates && applicationData.availabilityDates.length > MARKETPLACE_LIMITS.MAX_AVAILABILITY_DATES) {
      errors.push({
        field: 'availabilityDates',
        message: `Maximum ${MARKETPLACE_LIMITS.MAX_AVAILABILITY_DATES} availability dates allowed`,
        code: 'TOO_MANY_AVAILABILITY_DATES'
      });
    }
  
    if (applicationData.availabilityDates) {
      const now = new Date();
      const invalidDates = applicationData.availabilityDates.filter(date => new Date(date) <= now);
      if (invalidDates.length > 0) {
        errors.push({
          field: 'availabilityDates',
          message: 'All availability dates must be in the future',
          code: 'INVALID_AVAILABILITY_DATES'
        });
      }
    }
  
    if (applicationData.coverMessage && applicationData.coverMessage.length > MARKETPLACE_LIMITS.APPLICATION_COVER_MESSAGE_MAX_LENGTH) {
      errors.push({
        field: 'coverMessage',
        message: `Cover message cannot exceed ${MARKETPLACE_LIMITS.APPLICATION_COVER_MESSAGE_MAX_LENGTH} characters`,
        code: 'COVER_MESSAGE_TOO_LONG'
      });
    }
  
    if (applicationData.relevantExperience && applicationData.relevantExperience.length > MARKETPLACE_LIMITS.APPLICATION_EXPERIENCE_MAX_LENGTH) {
      errors.push({
        field: 'relevantExperience',
        message: `Relevant experience cannot exceed ${MARKETPLACE_LIMITS.APPLICATION_EXPERIENCE_MAX_LENGTH} characters`,
        code: 'EXPERIENCE_TOO_LONG'
      });
    }
  
    if (applicationData.questionsForClient && applicationData.questionsForClient.length > MARKETPLACE_LIMITS.APPLICATION_QUESTIONS_MAX_LENGTH) {
      errors.push({
        field: 'questionsForClient',
        message: `Questions for client cannot exceed ${MARKETPLACE_LIMITS.APPLICATION_QUESTIONS_MAX_LENGTH} characters`,
        code: 'QUESTIONS_TOO_LONG'
      });
    }
  
    if (applicationData.specialOffers && applicationData.specialOffers.length > MARKETPLACE_LIMITS.APPLICATION_OFFERS_MAX_LENGTH) {
      errors.push({
        field: 'specialOffers',
        message: `Special offers cannot exceed ${MARKETPLACE_LIMITS.APPLICATION_OFFERS_MAX_LENGTH} characters`,
        code: 'OFFERS_TOO_LONG'
      });
    }
  
    if (applicationData.materialsList && applicationData.materialsList.length > MARKETPLACE_LIMITS.MATERIALS_LIST_MAX_LENGTH) {
      errors.push({
        field: 'materialsList',
        message: `Materials list cannot exceed ${MARKETPLACE_LIMITS.MATERIALS_LIST_MAX_LENGTH} characters`,
        code: 'MATERIALS_LIST_TOO_LONG'
      });
    }
  
    if (applicationData.additionalPhotos && applicationData.additionalPhotos.length > MARKETPLACE_LIMITS.MAX_ADDITIONAL_PHOTOS) {
      errors.push({
        field: 'additionalPhotos',
        message: `Maximum ${MARKETPLACE_LIMITS.MAX_ADDITIONAL_PHOTOS} additional photos allowed`,
        code: 'TOO_MANY_ADDITIONAL_PHOTOS'
      });
    }
  
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      creditCheck: {
        hasEnoughCredits: true,
        requiredCredits: 0,
        currentBalance: 0
      },
      eligibilityCheck: {
        canApply: errors.length === 0,
        hasAlreadyApplied: false,
        profileComplete: true,
        meetsCriteria: true
      }
    };
  };
  
  export const sanitizeApplicationData = (applicationData: JobApplicationCreateData): JobApplicationCreateData => {
    return {
      ...applicationData,
      proposed_timeline: sanitizeString(applicationData.proposed_timeline.trim()),
      approachDescription: sanitizeString(applicationData.approachDescription.trim()),
      materialsList: applicationData.materialsList ? sanitizeString(applicationData.materialsList.trim()) : undefined,
      coverMessage: applicationData.coverMessage ? sanitizeString(applicationData.coverMessage.trim()) : undefined,
      relevantExperience: applicationData.relevantExperience ? sanitizeString(applicationData.relevantExperience.trim()) : undefined,
      questionsForClient: applicationData.questionsForClient ? sanitizeString(applicationData.questionsForClient.trim()) : undefined,
      specialOffers: applicationData.specialOffers ? sanitizeString(applicationData.specialOffers.trim()) : undefined
    };
  };
  
  export const canWithdrawApplication = (application: JobApplicationEntity): boolean => {
    if (application.status !== APPLICATION_STATUS.SUBMITTED) {
      return false;
    }
  
    const now = new Date();
    const applicationTime = new Date(application.applicationTimestamp);
    const withdrawalDeadline = new Date(applicationTime.getTime() + (24 * 60 * 60 * 1000));
  
    return now < withdrawalDeadline;
  };
  
  export const canModifyApplication = (application: JobApplicationEntity): boolean => {
    return application.status === APPLICATION_STATUS.SUBMITTED;
  };
  
  export const getApplicationStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      [APPLICATION_STATUS.SUBMITTED]: '#17a2b8',
      [APPLICATION_STATUS.UNDER_REVIEW]: '#ffc107',
      [APPLICATION_STATUS.SELECTED]: '#28a745',
      [APPLICATION_STATUS.REJECTED]: '#dc3545',
      [APPLICATION_STATUS.WITHDRAWN]: '#6c757d'
    };
    return statusColors[status] || '#6c757d';
  };
  
  export const getApplicationStatusIcon = (status: string): string => {
    const statusIcons: Record<string, string> = {
      [APPLICATION_STATUS.SUBMITTED]: 'send',
      [APPLICATION_STATUS.UNDER_REVIEW]: 'visibility',
      [APPLICATION_STATUS.SELECTED]: 'check-circle',
      [APPLICATION_STATUS.REJECTED]: 'cancel',
      [APPLICATION_STATUS.WITHDRAWN]: 'undo'
    };
    return statusIcons[status] || 'help';
  };
  
  export const formatApplicationSummary = (application: JobApplicationEntity): JobApplicationSummary => {
    return {
      id: application.id,
      marketplace_job_id : application.marketplace_job_id ,
      tradie_id: application.tradie_id,
      custom_quote: application.custom_quote,
      proposed_timeline: application.proposed_timeline,
      status: application.status,
      applicationTimestamp: application.applicationTimestamp,
      credits_used: application.credits_used,
      tradieName: '',
      tradieRating: undefined,
      tradieCompletedJobs: 0,
      jobTitle: '',
      job_type: MARKETPLACE_JOB_TYPES.GENERAL,
      jobLocation: '',
      isSelected: application.status === APPLICATION_STATUS.SELECTED,
      canWithdraw: canWithdrawApplication(application)
    };
  };
  
  export const calculateApplicationScore = (application: JobApplicationDetails, jobRequirements: {
    estimated_budget?: number;
    urgency_level: string;
    job_type: string;
    location: string;
  }): number => {
    let score = 0;
  
    if (jobRequirements.estimated_budget && application.custom_quote) {
      const budgetDifference = Math.abs(application.custom_quote - jobRequirements.estimated_budget) / jobRequirements.estimated_budget;
      if (budgetDifference <= 0.1) score += 20;
      else if (budgetDifference <= 0.2) score += 15;
      else if (budgetDifference <= 0.3) score += 10;
      else if (budgetDifference <= 0.5) score += 5;
    }
  
    if (application.tradie.profile.serviceTypes.includes(jobRequirements.job_type)) {
      score += 25;
    }
  
    if (application.tradie.profile.location.toLowerCase().includes(jobRequirements.location.toLowerCase())) {
      score += 15;
    }
  
    if (application.tradie.profile.rating) {
      score += Math.floor(application.tradie.profile.rating * 4);
    }
  
    if (application.tradie.profile.completedJobs >= 50) score += 10;
    else if (application.tradie.profile.completedJobs >= 20) score += 7;
    else if (application.tradie.profile.completedJobs >= 10) score += 5;
    else if (application.tradie.profile.completedJobs >= 5) score += 3;
  
    if (application.tradie.marketplaceStats.conversionRate >= 80) score += 10;
    else if (application.tradie.marketplaceStats.conversionRate >= 60) score += 7;
    else if (application.tradie.marketplaceStats.conversionRate >= 40) score += 5;
  
    if (application.relevantExperience && application.relevantExperience.length > 100) score += 5;
    if (application.coverMessage && application.coverMessage.length > 50) score += 3;
    if (application.additionalPhotos && application.additionalPhotos.length > 0) score += 5;
  
    return Math.min(score, 100);
  };
  
  export const rankApplications = (applications: JobApplicationDetails[], jobRequirements: {
    estimated_budget?: number;
    urgency_level: string;
    job_type: string;
    location: string;
  }): JobApplicationDetails[] => {
    return applications
      .map(app => ({
        ...app,
        score: calculateApplicationScore(app, jobRequirements)
      }))
      .sort((a, b) => (b as any).score - (a as any).score);
  };
  
  export const getRecommendedApplications = (applications: JobApplicationDetails[], jobRequirements: {
    estimated_budget?: number;
    urgency_level: string;
    job_type: string;
    location: string;
  }, limit: number = 3): JobApplicationDetails[] => {
    const rankedApplications = rankApplications(applications, jobRequirements);
    return rankedApplications.slice(0, limit);
  };

  export const buildApplicationSearchQuery = (searchParams: JobApplicationSearchParams): {
    whereClause: string;
    orderClause: string;
    parameters: any[];
  } => {
    const conditions: string[] = ['1=1'];
    const parameters: any[] = [];
    let paramIndex = 1;
  
    if (searchParams.status) {
      conditions.push(`ja.status = $${paramIndex}`);
      parameters.push(searchParams.status);
      paramIndex++;
    }
  
    if (searchParams.marketplace_job_id ) {
      conditions.push(`ja.marketplace_job_id = $${paramIndex}`);
      parameters.push(searchParams.marketplace_job_id );
      paramIndex++;
    }
  
    if (searchParams.tradie_id) {
      conditions.push(`ja.tradie_id = $${paramIndex}`);
      parameters.push(searchParams.tradie_id);
      paramIndex++;
    }
  
    if (searchParams.job_type) {
      conditions.push(`mj.job_type = $${paramIndex}`);
      parameters.push(searchParams.job_type);
      paramIndex++;
    }
  
    if (searchParams.minQuote !== undefined) {
      conditions.push(`ja.custom_quote >= $${paramIndex}`);
      parameters.push(searchParams.minQuote);
      paramIndex++;
    }
  
    if (searchParams.maxQuote !== undefined) {
      conditions.push(`ja.custom_quote <= $${paramIndex}`);
      parameters.push(searchParams.maxQuote);
      paramIndex++;
    }
  
    if (searchParams.location) {
      conditions.push(`mj.location ILIKE $${paramIndex}`);
      parameters.push(`%${searchParams.location}%`);
      paramIndex++;
    }
  
    if (searchParams.dateRange) {
      conditions.push(`ja.application_timestamp >= $${paramIndex}`);
      parameters.push(searchParams.dateRange.startDate);
      paramIndex++;
      conditions.push(`ja.application_timestamp <= $${paramIndex}`);
      parameters.push(searchParams.dateRange.endDate);
      paramIndex++;
    }
  
    if (searchParams.query) {
      conditions.push(`(
        ja.approach_description ILIKE $${paramIndex} OR 
        ja.cover_message ILIKE $${paramIndex} OR 
        ja.relevant_experience ILIKE $${paramIndex}
      )`);
      parameters.push(`%${searchParams.query}%`);
      paramIndex++;
    }
  
    const whereClause = conditions.join(' AND ');
    const orderClause = buildApplicationOrderClause(searchParams.sortBy, searchParams.sortOrder);
  
    return {
      whereClause,
      orderClause,
      parameters
    };
  };
  
  export const buildApplicationOrderClause = (sortBy?: string, sortOrder?: 'asc' | 'desc'): string => {
    const order = sortOrder?.toUpperCase() || 'DESC';
    
    switch (sortBy) {
      case 'application_timestamp':
        return `ORDER BY ja.application_timestamp ${order}`;
      case 'custom_quote':
        return `ORDER BY ja.custom_quote ${order}`;
      case 'tradie_rating':
        return `ORDER BY p.rating ${order} NULLS LAST`;
      case 'status':
        return `ORDER BY ja.status ${order}`;
      default:
        return `ORDER BY ja.application_timestamp ${order}`;
    }
  };
  
  export const getApplicationTimeline = (application: JobApplicationEntity): Array<{
    status: string;
    timestamp: Date;
    description: string;
    icon: string;
    color: string;
  }> => {
    const timeline = [
      {
        status: APPLICATION_STATUS.SUBMITTED,
        timestamp: application.applicationTimestamp,
        description: 'Application submitted',
        icon: 'send',
        color: '#17a2b8'
      }
    ];
  
    if (application.status !== APPLICATION_STATUS.SUBMITTED) {
      timeline.push({
        status: application.status,
        timestamp: application.updatedAt,
        description: getStatusDescription(application.status),
        icon: getApplicationStatusIcon(application.status),
        color: getApplicationStatusColor(application.status)
      });
    }
  
    return timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  };
  
  export const getStatusDescription = (status: string): string => {
    const descriptions: Record<string, string> = {
      [APPLICATION_STATUS.SUBMITTED]: 'Application submitted and awaiting review',
      [APPLICATION_STATUS.UNDER_REVIEW]: 'Application is being reviewed by client',
      [APPLICATION_STATUS.SELECTED]: 'Congratulations! You have been selected for this job',
      [APPLICATION_STATUS.REJECTED]: 'Application was not selected',
      [APPLICATION_STATUS.WITHDRAWN]: 'Application was withdrawn'
    };
    return descriptions[status] || 'Status updated';
  };
  
  export const formatApplicationQuote = (quote: number): string => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(quote);
  };
  
  export const calculateQuoteCompetitiveness = (quote: number, allQuotes: number[]): {
    percentile: number;
    isCompetitive: boolean;
    ranking: number;
  } => {
    const sortedQuotes = [...allQuotes].sort((a, b) => a - b);
    const ranking = sortedQuotes.findIndex(q => q >= quote) + 1;
    const percentile = ((sortedQuotes.length - ranking + 1) / sortedQuotes.length) * 100;
    
    return {
      percentile: Math.round(percentile),
      isCompetitive: percentile >= 75,
      ranking
    };
  };
  
  export const generateApplicationInsights = (application: JobApplicationDetails, allApplications: JobApplicationDetails[]): {
    quoteCompetitiveness: string;
    profileStrength: string;
    recommendations: string[];
  } => {
    const allQuotes = allApplications.map(app => app.custom_quote);
    const quoteAnalysis = calculateQuoteCompetitiveness(application.custom_quote, allQuotes);
    
    const recommendations: string[] = [];
    
    if (!quoteAnalysis.isCompetitive) {
      recommendations.push('Consider adjusting your quote to be more competitive');
    }
    
    if (!application.coverMessage || application.coverMessage.length < 50) {
      recommendations.push('Add a personalized cover message to stand out');
    }
    
    if (!application.additionalPhotos || application.additionalPhotos.length === 0) {
      recommendations.push('Include photos of similar work to showcase your skills');
    }
    
    if (!application.relevantExperience || application.relevantExperience.length < 100) {
      recommendations.push('Provide more details about your relevant experience');
    }
    
    if (application.tradie.profile.rating && application.tradie.profile.rating < 4.0) {
      recommendations.push('Focus on improving your overall rating through quality work');
    }
  
    return {
      quoteCompetitiveness: quoteAnalysis.isCompetitive ? 'Competitive' : 'Above average',
      profileStrength: application.tradie.profile.rating && application.tradie.profile.rating >= 4.5 ? 'Strong' : 'Good',
      recommendations
    };
  };
  
  export const validateApplicationStatusTransition = (currentStatus: string, newStatus: string): {
    isValid: boolean;
    error?: string;
  } => {
    const validTransitions: Record<string, string[]> = {
      [APPLICATION_STATUS.SUBMITTED]: [APPLICATION_STATUS.UNDER_REVIEW, APPLICATION_STATUS.SELECTED, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN],
      [APPLICATION_STATUS.UNDER_REVIEW]: [APPLICATION_STATUS.SELECTED, APPLICATION_STATUS.REJECTED],
      [APPLICATION_STATUS.SELECTED]: [],
      [APPLICATION_STATUS.REJECTED]: [],
      [APPLICATION_STATUS.WITHDRAWN]: []
    };
  
    const allowedTransitions = validTransitions[currentStatus] || [];
    
    if (!allowedTransitions.includes(newStatus)) {
      return {
        isValid: false,
        error: `Cannot transition from ${currentStatus} to ${newStatus}`
      };
    }
  
    return { isValid: true };
  };
  
  export const calculateApplicationMetrics = (applications: JobApplicationSummary[]): {
    totalApplications: number;
    averageQuote: number;
    statusDistribution: Record<string, number>;
    conversionRate: number;
    averageResponseTime: number;
  } => {
    const totalApplications = applications.length;
    const averageQuote = applications.reduce((sum, app) => sum + app.custom_quote, 0) / totalApplications || 0;
    
    const statusDistribution = applications.reduce((dist, app) => {
      dist[app.status] = (dist[app.status] || 0) + 1;
      return dist;
    }, {} as Record<string, number>);
  
    const selectedApplications = applications.filter(app => app.status === APPLICATION_STATUS.SELECTED).length;
    const conversionRate = totalApplications > 0 ? (selectedApplications / totalApplications) * 100 : 0;
  
    return {
      totalApplications,
      averageQuote: Math.round(averageQuote),
      statusDistribution,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageResponseTime: 0
    };
  };
  
  export const groupApplicationsByStatus = (applications: JobApplicationSummary[]): Record<string, JobApplicationSummary[]> => {
    return applications.reduce((groups, application) => {
      const status = application.status;
      if (!groups[status]) {
        groups[status] = [];
      }
      groups[status].push(application);
      return groups;
    }, {} as Record<string, JobApplicationSummary[]>);
  };
  
  export const filterApplicationsByDateRange = (applications: JobApplicationSummary[], startDate: Date, endDate: Date): JobApplicationSummary[] => {
    return applications.filter(app => {
      const appDate = new Date(app.applicationTimestamp);
      return appDate >= startDate && appDate <= endDate;
    });
  };
  
  export const getApplicationAnalytics = (applications: JobApplicationSummary[], period: 'week' | 'month' | 'quarter'): {
    totalApplications: number;
    successRate: number;
    averageQuote: number;
    trendData: Array<{ date: string; count: number; successCount: number }>;
  } => {
    const now = new Date();
    let startDate: Date;
  
    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }
  
    const filteredApplications = filterApplicationsByDateRange(applications, startDate, now);
    const metrics = calculateApplicationMetrics(filteredApplications);
  
    const trendData = generateTrendData(filteredApplications, startDate, now, period);
  
    return {
      totalApplications: metrics.totalApplications,
      successRate: metrics.conversionRate,
      averageQuote: metrics.averageQuote,
      trendData
    };
  };
  
  export const generateTrendData = (applications: JobApplicationSummary[], startDate: Date, endDate: Date, period: 'week' | 'month' | 'quarter'): Array<{ date: string; count: number; successCount: number }> => {
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trendData: Array<{ date: string; count: number; successCount: number }> = [];
  
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dayApplications = applications.filter(app => {
        const appDate = new Date(app.applicationTimestamp);
        return appDate.toDateString() === date.toDateString();
      });
  
      trendData.push({
        date: date.toISOString().split('T')[0],
        count: dayApplications.length,
        successCount: dayApplications.filter(app => app.status === APPLICATION_STATUS.SELECTED).length
      });
    }
  
    return trendData;
  };
  
  export const isValidApplicationStatus = (status: string): boolean => {
    return Object.values(APPLICATION_STATUS).includes(status as any);
  };
  
  export const getApplicationPriority = (application: JobApplicationDetails, jobUrgency: string): 'high' | 'medium' | 'low' => {
    let score = 0;
  
    if (application.tradie.profile.rating && application.tradie.profile.rating >= 4.5) score += 3;
    else if (application.tradie.profile.rating && application.tradie.profile.rating >= 4.0) score += 2;
    else if (application.tradie.profile.rating && application.tradie.profile.rating >= 3.5) score += 1;
  
    if (application.tradie.profile.completedJobs >= 50) score += 3;
    else if (application.tradie.profile.completedJobs >= 20) score += 2;
    else if (application.tradie.profile.completedJobs >= 10) score += 1;
  
    if (application.tradie.marketplaceStats.conversionRate >= 80) score += 2;
    else if (application.tradie.marketplaceStats.conversionRate >= 60) score += 1;
  
    if (jobUrgency === URGENCY_LEVEL.URGENT) score += 2;
    else if (jobUrgency === URGENCY_LEVEL.HIGH) score += 1;
  
    if (score >= 8) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };
  
  