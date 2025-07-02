import { database } from '../../shared/database';
import { Profile, CreateProfileData, UpdateProfileData, ProfilePreferences, ProfileMetadata } from '../types';
import { DATABASE_TABLES } from '../../config/auth';

export class ProfileModel {
  private static tableName = DATABASE_TABLES.PROFILES;

  static async create(profileData: CreateProfileData): Promise<Profile> {
    const defaultPreferences: ProfilePreferences = {
      emailNotifications: true,
      smsNotifications: false,
      marketingEmails: false,
      language: 'en',
      currency: 'AUD'
    };

    const defaultMetadata: ProfileMetadata = {
      registrationSource: 'web',
      loginCount: 0,
      profileCompleteness: 20
    };

    const preferences = { ...defaultPreferences, ...profileData.preferences };

    const query = `
      INSERT INTO ${this.tableName} (
        user_id, first_name, last_name, phone, avatar, bio, 
        location, timezone, preferences, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id, first_name, last_name, phone, avatar, bio,
                location, timezone, preferences, metadata, created_at, updated_at
    `;

    const values = [
      parseInt(profileData.userId),
      profileData.firstName || null,
      profileData.lastName || null,
      profileData.phone || null,
      profileData.avatar || null,
      null,
      null,
      null,
      JSON.stringify(preferences),
      JSON.stringify(defaultMetadata)
    ];

    const result = await database.query<any>(query, values);
    const dbProfile = result.rows[0];
    
    return this.mapDbProfileToProfile(dbProfile);
  }

  static async updateProfile(userId: string, updateData: UpdateProfileData): Promise<Profile> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updateData.firstName !== undefined) {
      setClause.push(`first_name = $${paramIndex++}`);
      values.push(updateData.firstName);
    }
    if (updateData.lastName !== undefined) {
      setClause.push(`last_name = $${paramIndex++}`);
      values.push(updateData.lastName);
    }
    if (updateData.phone !== undefined) {
      setClause.push(`phone = $${paramIndex++}`);
      values.push(updateData.phone);
    }
    if (updateData.avatar !== undefined) {
      setClause.push(`avatar = $${paramIndex++}`);
      values.push(updateData.avatar);
    }
    if (updateData.bio !== undefined) {
      setClause.push(`bio = $${paramIndex++}`);
      values.push(updateData.bio);
    }
    if (updateData.location !== undefined) {
      setClause.push(`location = $${paramIndex++}`);
      values.push(updateData.location);
    }
    if (updateData.timezone !== undefined) {
      setClause.push(`timezone = $${paramIndex++}`);
      values.push(updateData.timezone);
    }

    setClause.push(`updated_at = NOW()`);
    values.push(parseInt(userId));

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING id, user_id, first_name, last_name, phone, avatar, bio,
                location, timezone, preferences, metadata, created_at, updated_at
    `;

    const result = await database.query<any>(query, values);
    return this.mapDbProfileToProfile(result.rows[0]);
  }

  static async updatePreferences(userId: string, preferences: Partial<ProfilePreferences>): Promise<Profile> {
    const currentProfile = await this.findByUserId(userId);
    if (!currentProfile) {
      throw new Error('Profile not found');
    }

    const updatedPreferences = { ...currentProfile.preferences, ...preferences };

    const query = `
      UPDATE ${this.tableName}
      SET preferences = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING id, user_id, first_name, last_name, phone, avatar, bio,
                location, timezone, preferences, metadata, created_at, updated_at
    `;

    const result = await database.query<any>(query, [JSON.stringify(updatedPreferences), parseInt(userId)]);
    return this.mapDbProfileToProfile(result.rows[0]);
  }

  static async updateAvatar(userId: string, avatar: string | null): Promise<Profile> {
    const query = `
      UPDATE ${this.tableName}
      SET avatar = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING id, user_id, first_name, last_name, phone, avatar, bio,
                location, timezone, preferences, metadata, created_at, updated_at
    `;

    const result = await database.query<any>(query, [avatar, parseInt(userId)]);
    return this.mapDbProfileToProfile(result.rows[0]);
  }

  static async updateMetadata(userId: string, metadata: Partial<ProfileMetadata>): Promise<Profile> {
    const currentProfile = await this.findByUserId(userId);
    if (!currentProfile) {
      throw new Error('Profile not found');
    }

    const updatedMetadata = { ...currentProfile.metadata, ...metadata };

    const query = `
      UPDATE ${this.tableName}
      SET metadata = $1, updated_at = NOW()
      WHERE user_id = $2
      RETURNING id, user_id, first_name, last_name, phone, avatar, bio,
                location, timezone, preferences, metadata, created_at, updated_at
    `;

    const result = await database.query<any>(query, [JSON.stringify(updatedMetadata), parseInt(userId)]);
    return this.mapDbProfileToProfile(result.rows[0]);
  }

  static async deleteProfile(userId: string): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE user_id = $1`;
    await database.query(query, [parseInt(userId)]);
  }

  static async findByUserId(userId: string): Promise<Profile | null> {
    const query = `
      SELECT id, user_id, first_name, last_name, phone, avatar, bio,
             location, timezone, preferences, metadata, created_at, updated_at
      FROM ${this.tableName}
      WHERE user_id = $1
    `;

    const result = await database.query<any>(query, [parseInt(userId)]);
    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDbProfileToProfile(result.rows[0]);
  }

  static async updateRegistrationMetadata(userId: string, source: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    if (!profile) return;

    const updatedMetadata = {
      ...profile.metadata,
      registrationSource: source
    };

    const query = `
      UPDATE ${this.tableName}
      SET metadata = $1, updated_at = NOW()
      WHERE user_id = $2
    `;

    await database.query(query, [JSON.stringify(updatedMetadata), parseInt(userId)]);
  }

  static async updateLoginCount(userId: string): Promise<void> {
    const profile = await this.findByUserId(userId);
    if (!profile) return;

    const updatedMetadata = {
      ...profile.metadata,
      loginCount: (profile.metadata.loginCount || 0) + 1,
      lastLoginAt: new Date()
    };

    const query = `
      UPDATE ${this.tableName}
      SET metadata = $1, updated_at = NOW()
      WHERE user_id = $2
    `;

    await database.query(query, [JSON.stringify(updatedMetadata), parseInt(userId)]);
  }

  static async calculateCompleteness(userId: string): Promise<number> {
    const profile = await this.findByUserId(userId);
    if (!profile) return 0;

    let completeness = 20;

    if (profile.firstName) completeness += 15;
    if (profile.lastName) completeness += 15;
    if (profile.phone) completeness += 10;
    if (profile.avatar) completeness += 10;
    if (profile.bio) completeness += 10;
    if (profile.location) completeness += 10;
    if (profile.timezone) completeness += 10;

    return Math.min(completeness, 100);
  }

  static async updateCompleteness(userId: string): Promise<void> {
    const completeness = await this.calculateCompleteness(userId);
    const profile = await this.findByUserId(userId);
    
    if (!profile) return;

    const updatedMetadata = {
      ...profile.metadata,
      profileCompleteness: completeness
    };

    const query = `
      UPDATE ${this.tableName}
      SET metadata = $1, updated_at = NOW()
      WHERE user_id = $2
    `;

    await database.query(query, [JSON.stringify(updatedMetadata), parseInt(userId)]);
  }

  private static mapDbProfileToProfile(dbProfile: any): Profile {
    return {
      id: dbProfile.id,
      userId: dbProfile.user_id,
      firstName: dbProfile.first_name,
      lastName: dbProfile.last_name,
      phone: dbProfile.phone,
      avatar: dbProfile.avatar,
      bio: dbProfile.bio,
      location: dbProfile.location,
      timezone: dbProfile.timezone,
      preferences: typeof dbProfile.preferences === 'string' ? JSON.parse(dbProfile.preferences) : dbProfile.preferences,
      metadata: typeof dbProfile.metadata === 'string' ? JSON.parse(dbProfile.metadata) : dbProfile.metadata,
      createdAt: dbProfile.created_at,
      updatedAt: dbProfile.updated_at
    };
  }
}
