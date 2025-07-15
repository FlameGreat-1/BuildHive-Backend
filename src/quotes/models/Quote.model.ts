import { DatabaseConnection } from '../../shared/database/connection';
import { QuoteData, QuoteWithRelations, QuoteCreateData, QuoteUpdateData } from '../types';
import { QuoteStatus } from '../../shared/types';
import { DatabaseRecord } from '../../shared/types';
import { connection } from '../../shared/database/connection';

export interface QuoteRecord extends DatabaseRecord {
  id: number;
  tradie_id: number;
  client_id: number;
  job_id?: number;
  quote_number: string;
  title: string;
  description?: string;
  status: QuoteStatus;
  subtotal: number;
  gst_amount: number;
  total_amount: number;
  gst_enabled: boolean;
  valid_until: Date;
  terms_conditions?: string;
  notes?: string;
  sent_at?: Date;
  viewed_at?: Date;
  accepted_at?: Date;
  rejected_at?: Date;
  payment_status?: string;
  payment_id?: string;
  invoice_id?: string;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface QuoteWithRelationsRecord extends QuoteRecord {
  client_name: string;
  client_email: string;
  client_phone: string;
  tradie_username: string;
  tradie_email: string;
}

export class QuoteModel {
  private db: DatabaseConnection;

  constructor() {
    this.db = connection;
  }

  static fromRecord(record: QuoteRecord): QuoteData {
    return {
      id: record.id,
      tradieId: record.tradie_id,
      clientId: record.client_id,
      jobId: record.job_id,
      quoteNumber: record.quote_number,
      title: record.title,
      description: record.description,
      status: record.status,
      subtotal: parseFloat(record.subtotal.toString()),
      gstAmount: parseFloat(record.gst_amount.toString()),
      totalAmount: parseFloat(record.total_amount.toString()),
      gstEnabled: record.gst_enabled,
      validUntil: record.valid_until,
      termsConditions: record.terms_conditions,
      notes: record.notes,
      items: [],
      sentAt: record.sent_at,
      viewedAt: record.viewed_at,
      acceptedAt: record.accepted_at,
      rejectedAt: record.rejected_at,
      paymentStatus: record.payment_status,
      paymentId: record.payment_id,
      invoiceId: record.invoice_id,
      paidAt: record.paid_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  static fromRecordWithRelations(record: QuoteWithRelationsRecord): QuoteWithRelations {
    return {
      ...QuoteModel.fromRecord(record),
      clientName: record.client_name,
      clientEmail: record.client_email,
      clientPhone: record.client_phone,
      tradieUsername: record.tradie_username,
      tradieEmail: record.tradie_email
    };
  }

  static toCreateRecord(tradieId: number, data: QuoteCreateData, quoteNumber: string, calculations: any): Partial<QuoteRecord> {
    return {
      tradie_id: tradieId,
      client_id: data.clientId,
      job_id: data.jobId,
      quote_number: quoteNumber,
      title: data.title,
      description: data.description,
      status: 'draft' as QuoteStatus,
      subtotal: calculations.subtotal,
      gst_amount: calculations.gstAmount,
      total_amount: calculations.totalAmount,
      gst_enabled: data.gstEnabled,
      valid_until: data.validUntil,
      terms_conditions: data.termsConditions,
      notes: data.notes
    };
  }

  static toUpdateRecord(data: QuoteUpdateData, calculations?: any): Partial<QuoteRecord> {
    const record: Partial<QuoteRecord> = {};

    if (data.title !== undefined) record.title = data.title;
    if (data.description !== undefined) record.description = data.description;
    if (data.gstEnabled !== undefined) record.gst_enabled = data.gstEnabled;
    if (data.validUntil !== undefined) record.valid_until = data.validUntil;
    if (data.termsConditions !== undefined) record.terms_conditions = data.termsConditions;
    if (data.notes !== undefined) record.notes = data.notes;

    if (calculations) {
      record.subtotal = calculations.subtotal;
      record.gst_amount = calculations.gstAmount;
      record.total_amount = calculations.totalAmount;
    }

    return record;
  }

  static validateRecord(record: Partial<QuoteRecord>): string[] {
    const errors: string[] = [];

    if (record.tradie_id && (typeof record.tradie_id !== 'number' || record.tradie_id <= 0)) {
      errors.push('Invalid tradie ID');
    }

    if (record.client_id && (typeof record.client_id !== 'number' || record.client_id <= 0)) {
      errors.push('Invalid client ID');
    }

    if (record.job_id && (typeof record.job_id !== 'number' || record.job_id <= 0)) {
      errors.push('Invalid job ID');
    }

    if (record.title && (typeof record.title !== 'string' || record.title.trim().length === 0)) {
      errors.push('Quote title is required');
    }

    if (record.subtotal && (typeof record.subtotal !== 'number' || record.subtotal < 0)) {
      errors.push('Invalid subtotal amount');
    }

    if (record.gst_amount && (typeof record.gst_amount !== 'number' || record.gst_amount < 0)) {
      errors.push('Invalid GST amount');
    }

    if (record.total_amount && (typeof record.total_amount !== 'number' || record.total_amount < 0)) {
      errors.push('Invalid total amount');
    }

    if (record.valid_until && !(record.valid_until instanceof Date)) {
      errors.push('Invalid valid until date');
    }

    return errors;
  }

  static sanitizeRecord(record: Partial<QuoteRecord>): Partial<QuoteRecord> {
    const sanitized = { ...record };

    if (sanitized.title) {
      sanitized.title = sanitized.title.trim();
    }

    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
    }

    if (sanitized.terms_conditions) {
      sanitized.terms_conditions = sanitized.terms_conditions.trim();
    }

    if (sanitized.notes) {
      sanitized.notes = sanitized.notes.trim();
    }

    if (sanitized.subtotal) {
      sanitized.subtotal = parseFloat(sanitized.subtotal.toString());
    }

    if (sanitized.gst_amount) {
      sanitized.gst_amount = parseFloat(sanitized.gst_amount.toString());
    }

    if (sanitized.total_amount) {
      sanitized.total_amount = parseFloat(sanitized.total_amount.toString());
    }

    return sanitized;
  }

  static getTableName(): string {
    return 'quotes';
  }

  static getColumns(): string[] {
    return [
      'id',
      'tradie_id',
      'client_id',
      'job_id',
      'quote_number',
      'title',
      'description',
      'status',
      'subtotal',
      'gst_amount',
      'total_amount',
      'gst_enabled',
      'valid_until',
      'terms_conditions',
      'notes',
      'sent_at',
      'viewed_at',
      'accepted_at',
      'rejected_at',
      'payment_status',
      'payment_id',
      'invoice_id',
      'paid_at',
      'created_at',
      'updated_at'
    ];
  }

  static getSelectColumns(): string {
    return QuoteModel.getColumns().join(', ');
  }

  static getInsertColumns(): string[] {
    return [
      'tradie_id',
      'client_id',
      'job_id',
      'quote_number',
      'title',
      'description',
      'status',
      'subtotal',
      'gst_amount',
      'total_amount',
      'gst_enabled',
      'valid_until',
      'terms_conditions',
      'notes'
    ];
  }

  static getUpdateColumns(): string[] {
    return [
      'title',
      'description',
      'status',
      'subtotal',
      'gst_amount',
      'total_amount',
      'gst_enabled',
      'valid_until',
      'terms_conditions',
      'notes',
      'sent_at',
      'viewed_at',
      'accepted_at',
      'rejected_at',
      'payment_status',
      'payment_id',
      'invoice_id',
      'paid_at'
    ];
  }
}
