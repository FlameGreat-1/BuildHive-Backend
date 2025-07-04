import { 
  Material, 
  CreateMaterialData,
  UpdateMaterialData
} from '../types';
import { MATERIAL_CONSTANTS, JOB_CONSTANTS } from '../../config/jobs';

export class MaterialUtils {
  static calculateTotalCost(quantity: number, unitCost: number): number {
    return Math.round((quantity * unitCost) * 100) / 100;
  }

  static formatMaterialName(name: string): string {
    return name.trim().replace(/\s+/g, ' ').toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  static validateQuantity(quantity: number): boolean {
    return quantity >= MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY && 
           quantity <= MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY;
  }

  static validateUnitCost(unitCost: number): boolean {
    return unitCost >= MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST && 
           unitCost <= MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST;
  }

  static formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  static calculateMaterialsTotal(materials: Material[]): number {
    return materials.reduce((total, material) => total + material.totalCost, 0);
  }

  static groupMaterialsBySupplier(materials: Material[]): Record<string, Material[]> {
    return materials.reduce((groups, material) => {
      const supplier = material.supplier || 'Unknown Supplier';
      if (!groups[supplier]) {
        groups[supplier] = [];
      }
      groups[supplier].push(material);
      return groups;
    }, {} as Record<string, Material[]>);
  }

  static sortMaterialsByCost(materials: Material[], ascending: boolean = false): Material[] {
    return materials.sort((a, b) => 
      ascending ? a.totalCost - b.totalCost : b.totalCost - a.totalCost
    );
  }

  static findMostExpensiveMaterial(materials: Material[]): Material | null {
    if (materials.length === 0) return null;
    
    return materials.reduce((max, material) => 
      material.totalCost > max.totalCost ? material : max
    );
  }

  static findCheapestMaterial(materials: Material[]): Material | null {
    if (materials.length === 0) return null;
    
    return materials.reduce((min, material) => 
      material.totalCost < min.totalCost ? material : min
    );
  }

  static calculateAverageMaterialCost(materials: Material[]): number {
    if (materials.length === 0) return 0;
    
    const total = this.calculateMaterialsTotal(materials);
    return Math.round((total / materials.length) * 100) / 100;
  }

  static getMaterialsByUnit(materials: Material[], unit: string): Material[] {
    return materials.filter(material => material.unit === unit);
  }

  static searchMaterials(materials: Material[], searchTerm: string): Material[] {
    const term = searchTerm.toLowerCase();
    
    return materials.filter(material => 
      material.name.toLowerCase().includes(term) ||
      (material.supplier && material.supplier.toLowerCase().includes(term)) ||
      material.unit.toLowerCase().includes(term)
    );
  }

  static validateMaterialData(data: CreateMaterialData | UpdateMaterialData): string[] {
    const errors: string[] = [];

    if ('name' in data && data.name) {
      if (data.name.length < MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH) {
        errors.push(`Material name must be at least ${MATERIAL_CONSTANTS.VALIDATION.NAME_MIN_LENGTH} characters`);
      }
      if (data.name.length > MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH) {
        errors.push(`Material name cannot exceed ${MATERIAL_CONSTANTS.VALIDATION.NAME_MAX_LENGTH} characters`);
      }
    }

    if ('quantity' in data && data.quantity !== undefined) {
      if (!this.validateQuantity(data.quantity)) {
        errors.push(`Quantity must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_QUANTITY} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_QUANTITY}`);
      }
    }

    if ('unitCost' in data && data.unitCost !== undefined) {
      if (!this.validateUnitCost(data.unitCost)) {
        errors.push(`Unit cost must be between ${MATERIAL_CONSTANTS.VALIDATION.MIN_UNIT_COST} and ${MATERIAL_CONSTANTS.VALIDATION.MAX_UNIT_COST}`);
      }
    }

    if ('unit' in data && data.unit) {
      if (!Object.values(JOB_CONSTANTS.MATERIAL_UNITS).includes(data.unit as any)) {
        errors.push('Invalid material unit');
      }
    }

    return errors;
  }

  static generateMaterialSummary(materials: Material[]): {
    totalItems: number;
    totalCost: number;
    averageCost: number;
    mostExpensive: Material | null;
    cheapest: Material | null;
    supplierCount: number;
  } {
    return {
      totalItems: materials.length,
      totalCost: this.calculateMaterialsTotal(materials),
      averageCost: this.calculateAverageMaterialCost(materials),
      mostExpensive: this.findMostExpensiveMaterial(materials),
      cheapest: this.findCheapestMaterial(materials),
      supplierCount: Object.keys(this.groupMaterialsBySupplier(materials)).length
    };
  }
}
