import { QuoteItemCreateData, QuoteCalculation, QuoteItemData } from '../types';
import { QUOTE_CONSTANTS, GST_CONSTANTS } from '../../config/quotes';
import { QuoteStatus } from '../../shared/types';

export const calculateQuoteTotal = (
  items: QuoteItemCreateData[] | QuoteItemData[],
  gstEnabled: boolean = true
): QuoteCalculation => {
  const subtotal = items.reduce((total, item) => {
    const itemTotal = item.quantity * item.unitPrice;
    return total + itemTotal;
  }, 0);

  const gstAmount = gstEnabled ? subtotal * GST_CONSTANTS.GST_RATE : 0;
  const totalAmount = subtotal + gstAmount;

  const itemTotals = items.reduce((totals, item, index) => {
    totals[index] = item.quantity * item.unitPrice;
    return totals;
  }, {} as { [key: number]: number });

  return {
    subtotal: parseFloat(subtotal.toFixed(GST_CONSTANTS.GST_DECIMAL_PLACES)),
    gstAmount: parseFloat(gstAmount.toFixed(GST_CONSTANTS.GST_DECIMAL_PLACES)),
    totalAmount: parseFloat(totalAmount.toFixed(GST_CONSTANTS.GST_DECIMAL_PLACES)),
    itemTotals
  };
};

export const generateQuoteNumber = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const suffix = timestamp.slice(-4) + random;
  return `${QUOTE_CONSTANTS.QUOTE_NUMBER_PREFIX}${suffix}`;
};

export const isQuoteExpired = (validUntil: Date): boolean => {
  return new Date() > new Date(validUntil);
};

export const isQuoteExpiringSoon = (validUntil: Date, warningDays: number = 3): boolean => {
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + warningDays);
  return new Date(validUntil) <= warningDate && !isQuoteExpired(validUntil);
};

export const getDaysUntilExpiry = (validUntil: Date): number => {
  const now = new Date();
  const expiry = new Date(validUntil);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
};

export const getQuoteValidUntilDate = (days: number = QUOTE_CONSTANTS.DEFAULT_VALID_DAYS): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

export const validateQuoteStatusTransition = (currentStatus: QuoteStatus, newStatus: QuoteStatus): boolean => {
  const allowedTransitions: Record<QuoteStatus, QuoteStatus[]> = {
    'draft': ['sent', 'cancelled'],
    'sent': ['viewed', 'accepted', 'rejected', 'expired', 'cancelled'],
    'viewed': ['accepted', 'rejected', 'expired', 'cancelled'],
    'accepted': [],
    'rejected': [],
    'expired': [],
    'cancelled': []
  };

  return allowedTransitions[currentStatus]?.includes(newStatus) || false;
};

export const formatQuoteAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatQuoteNumber = (quoteNumber: string): string => {
  return quoteNumber.toUpperCase();
};

export const sanitizeQuoteInput = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

export const validateQuoteItems = (items: QuoteItemCreateData[]): string[] => {
  const errors: string[] = [];

  if (!items || items.length === 0) {
    errors.push('At least one quote item is required');
    return errors;
  }

  if (items.length > QUOTE_CONSTANTS.MAX_ITEMS_PER_QUOTE) {
    errors.push(`Maximum ${QUOTE_CONSTANTS.MAX_ITEMS_PER_QUOTE} items allowed per quote`);
  }

  items.forEach((item, index) => {
    if (!item.description || item.description.trim().length === 0) {
      errors.push(`Item ${index + 1}: Description is required`);
    }

    if (item.description && item.description.length > QUOTE_CONSTANTS.MAX_ITEM_DESCRIPTION_LENGTH) {
      errors.push(`Item ${index + 1}: Description cannot exceed ${QUOTE_CONSTANTS.MAX_ITEM_DESCRIPTION_LENGTH} characters`);
    }

    if (!item.quantity || item.quantity <= 0) {
      errors.push(`Item ${index + 1}: Quantity must be greater than 0`);
    }

    if (!item.unitPrice || item.unitPrice < 0) {
      errors.push(`Item ${index + 1}: Unit price must be 0 or greater`);
    }

    if (!item.unit || item.unit.trim().length === 0) {
      errors.push(`Item ${index + 1}: Unit is required`);
    }

    if (!item.itemType || item.itemType.trim().length === 0) {
      errors.push(`Item ${index + 1}: Item type is required`);
    }
  });

  return errors;
};

export const calculateQuoteAcceptanceRate = (totalQuotes: number, acceptedQuotes: number): number => {
  if (totalQuotes === 0) return 0;
  return parseFloat(((acceptedQuotes / totalQuotes) * 100).toFixed(2));
};

export const getQuoteStatusColor = (status: QuoteStatus): string => {
  const statusColors: Record<QuoteStatus, string> = {
    'draft': '#6B7280',
    'sent': '#3B82F6',
    'viewed': '#F59E0B',
    'accepted': '#10B981',
    'rejected': '#EF4444',
    'expired': '#9CA3AF',
    'cancelled': '#6B7280'
  };

  return statusColors[status] || '#6B7280';
};

export const getQuoteStatusLabel = (status: QuoteStatus): string => {
  const statusLabels: Record<QuoteStatus, string> = {
    'draft': 'Draft',
    'sent': 'Sent',
    'viewed': 'Viewed',
    'accepted': 'Accepted',
    'rejected': 'Rejected',
    'expired': 'Expired',
    'cancelled': 'Cancelled'
  };

  return statusLabels[status] || 'Unknown';
};

export const sortQuoteItems = (items: QuoteItemData[]): QuoteItemData[] => {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
};

export const generateQuoteItemSortOrder = (existingItems: QuoteItemData[]): number => {
  if (existingItems.length === 0) return 1;
  const maxOrder = Math.max(...existingItems.map(item => item.sortOrder));
  return maxOrder + 1;
};

export const isQuoteEditable = (status: QuoteStatus): boolean => {
  return status === 'draft';
};

export const isQuoteCancellable = (status: QuoteStatus): boolean => {
  return ['draft', 'sent', 'viewed'].includes(status);
};

export const getQuoteExpiryWarningMessage = (validUntil: Date): string => {
  const daysLeft = getDaysUntilExpiry(validUntil);
  
  if (daysLeft === 0) {
    return 'Quote expires today';
  } else if (daysLeft === 1) {
    return 'Quote expires tomorrow';
  } else if (daysLeft <= 3) {
    return `Quote expires in ${daysLeft} days`;
  }
  
  return '';
};

export const buildQuoteSearchQuery = (searchTerm: string): string => {
  return `%${searchTerm.toLowerCase().trim()}%`;
};

export const parseQuoteFilters = (filters: Record<string, any>): Record<string, any> => {
  const parsed: Record<string, any> = {};

  if (filters.status) {
    parsed.status = filters.status;
  }

  if (filters.clientId) {
    const clientId = parseInt(filters.clientId);
    if (!isNaN(clientId) && clientId > 0) {
      parsed.clientId = clientId;
    }
  }

  if (filters.jobId) {
    const jobId = parseInt(filters.jobId);
    if (!isNaN(jobId) && jobId > 0) {
      parsed.jobId = jobId;
    }
  }

  if (filters.startDate) {
    parsed.startDate = new Date(filters.startDate);
  }

  if (filters.endDate) {
    parsed.endDate = new Date(filters.endDate);
  }

  if (filters.searchTerm) {
    parsed.searchTerm = filters.searchTerm.trim();
  }

  const page = parseInt(filters.page);
  parsed.page = (!isNaN(page) && page > 0) ? page : QUOTE_CONSTANTS.DEFAULT_PAGE;

  const limit = parseInt(filters.limit);
  parsed.limit = (!isNaN(limit) && limit > 0) ? Math.min(limit, QUOTE_CONSTANTS.MAX_LIMIT) : QUOTE_CONSTANTS.DEFAULT_LIMIT;

  parsed.sortBy = filters.sortBy || 'created_at';
  parsed.sortOrder = filters.sortOrder === 'asc' ? 'asc' : 'desc';

  return parsed;
};
