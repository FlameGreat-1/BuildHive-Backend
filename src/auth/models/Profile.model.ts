import { database } from '../../shared/database';
import { Profile, CreateProfileData, ProfilePreferences, ProfileMetadata } from '../types';
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
        location, timezone, preferences, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id, user_id, first_name, last_name, phone, avatar, bio,
                location, timezone, preferences, metadata, created_at, updated_at
    `;

    const values = [
      profileData.userId,
      profileData.firstName || null,
      profileData.lastName || null,
      profileData.phone || null,
      profileData.avatar || null,
      null, // bio
      null, // location
      null, // timezone
      JSON.stringify(preferences),
      JSON.stringify(defaultMetadata)
    ];

    const result = await database.query<Profile>(query, values);
    const profile = result.rows[0];
    
    return {
      ...profile,
      preferences: JSON.parse(profile.preferences as any),
      metadata: JSON.parse(profile.metadata as any)
    };
  }

  static async findByUserId(userId: string): Promise<Profile | null> {
    const query = `
      SELECT id, user_id, first_name, last_name, phone, avatar, bio,
             location, timezone, preferences, metadata, created_at, updated_at
      FROM ${this.tableName}
      WHERE user_id = $1
    `;

    const result = await database.query<Profile>(query, [userId]);
    if (result.rows.length === 0) {
      return null;
    }

    const profile = result.rows[0];
    return {
      ...profile,
      preferences: JSON.parse(profile.preferences as any),
      metadata: JSON.parse(profile.metadata as any)
    };
  }

  static async updateRegistrationMetadata(
    userId: string, 
    source: string
  ): Promise<void> {
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

    await database.query(query, [JSON.stringify(updatedMetadata), userId]);
  }

  static async calculateCompleteness(userId: string): Promise<number> {
    const profile = await this.findByUserId(userId);
    if (!profile) return 0;

    let completeness = 20; // Base for having a profile

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

    await database.query(query, [JSON.stringify(updatedMetadata), userId]);
  }
}
