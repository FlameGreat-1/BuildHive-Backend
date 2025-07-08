import { Pool } from 'pg';
import { QuoteItemData, QuoteItemCreateData, QuoteItemUpdateData } from '../types';
import { QuoteItemType, MaterialUnit } from '../../shared/types';
import { DatabaseRecord } from '../../shared/types';
import { connection } from '../../shared/database';

export interface QuoteItemRecord extends DatabaseRecord {
  id: number;
  quote_id: number;
  item_type: QuoteItemType;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  unit_price: number;
  total_price: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export class QuoteItemModel {
  private pool: Pool;

  constructor() {
    this.pool = connection;
  }

  static fromRecord(record: QuoteItemRecord): QuoteItemData {
    return {
      id: record.id,
      quoteId: record.quote_id,
      itemType: record.item_type,
      description: record.description,
      quantity: parseFloat(record.quantity.toString()),
      unit: record.unit,
      unitPrice: parseFloat(record.unit_price.toString()),
      totalPrice: parseFloat(record.total_price.toString()),
      sortOrder: record.sort_order,
      createdAt: record.created_at,
      updatedAt: record.updated_at
    };
  }

  static toCreateRecord(quoteId: number, data: QuoteItemCreateData, sortOrder: number): Partial<QuoteItemRecord> {
    const totalPrice = data.quantity * data.unitPrice;
    
    return {
      quote_id: quoteId,
      item_type: data.itemType,
      description: data.description,
      quantity: data.quantity,
      unit: data.unit,
      unit_price: data.unitPrice,
      total_price: totalPrice,
      sort_order: sortOrder
    };
  }

  static toUpdateRecord(data: QuoteItemUpdateData): Partial<QuoteItemRecord> {
    const record: Partial<QuoteItemRecord> = {};

    if (data.itemType !== undefined) record.item_type = data.itemType;
    if (data.description !== undefined) record.description = data.description;
    if (data.quantity !== undefined) record.quantity = data.quantity;
    if (data.unit !== undefined) record.unit = data.unit;
    if (data.unitPrice !== undefined) record.unit_price = data.unitPrice;
    if (data.sortOrder !== undefined) record.sort_order = data.sortOrder;

    if (data.quantity !== undefined && data.unitPrice !== undefined) {
      record.total_price = data.quantity * data.unitPrice;
    }

    return record;
  }

  static validateRecord(record: Partial<QuoteItemRecord>): string[] {
    const errors: string[] = [];

    if (record.quote_id && (typeof record.quote_id !== 'number' || record.quote_id <= 0)) {
      errors.push('Invalid quote ID');
    }

    if (record.description && (typeof record.description !== 'string' || record.description.trim().length === 0)) {
      errors.push('Item description is required');
    }

    if (record.quantity && (typeof record.quantity !== 'number' || record.quantity <= 0)) {
      errors.push('Item quantity must be greater than 0');
    }

    if (record.unit_price && (typeof record.unit_price !== 'number' || record.unit_price < 0)) {
      errors.push('Item unit price cannot be negative');
    }

    if (record.sort_order && (typeof record.sort_order !== 'number' || record.sort_order < 1)) {
      errors.push('Sort order must be at least 1');
    }

    return errors;
  }

  static sanitizeRecord(record: Partial<QuoteItemRecord>): Partial<QuoteItemRecord> {
    const sanitized = { ...record };

    if (sanitized.description) {
      sanitized.description = sanitized.description.trim();
    }

    if (sanitized.quantity) {
      sanitized.quantity = parseFloat(sanitized.quantity.toString());
    }

    if (sanitized.unit_price) {
      sanitized.unit_price = parseFloat(sanitized.unit_price.toString());
    }

    if (sanitized.total_price) {
      sanitized.total_price = parseFloat(sanitized.total_price.toString());
    }

    return sanitized;
  }

  static calculateTotalPrice(quantity: number, unitPrice: number): number {
    return parseFloat((quantity * unitPrice).toFixed(2));
  }

  static getTableName(): string {
    return 'quote_items';
  }

  static getColumns(): string[] {
    return [
      'id',
      'quote_id',
      'item_type',
      'description',
      'quantity',
      'unit',
      'unit_price',
      'total_price',
      'sort_order',
      'created_at',
      'updated_at'
    ];
  }

  static getSelectColumns(): string {
    return QuoteItemModel.getColumns().join(', ');
  }

  static getInsertColumns(): string[] {
    return [
      'quote_id',
      'item_type',
      'description',
      'quantity',
      'unit',
      'unit_price',
      'total_price',
      'sort_order'
    ];
  }

  static getUpdateColumns(): string[] {
    return [
      'item_type',
      'description',
      'quantity',
      'unit',
      'unit_price',
      'total_price',
      'sort_order'
    ];
  }
}
