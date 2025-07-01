import { SessionModel, Session, CreateSessionData } from '../models';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES, ERROR_CODES } from '../../config/auth';

export class SessionRepository {
  async createSession(sessionData: CreateSessionData): Promise<Session> {
    try {
      return await SessionModel.create(sessionData);
    } catch (error) {
      throw new AppError(
        'Failed to create session',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findSessionByToken(token: string): Promise<Session | null> {
    try {
      return await SessionModel.findByToken(token);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve session',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async findSessionsByUserId(userId: string, type?: string): Promise<Session[]> {
    try {
      return await SessionModel.findByUserId(userId, type);
    } catch (error) {
      throw new AppError(
        'Failed to retrieve user sessions',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async deleteSession(token: string): Promise<void> {
    try {
      await SessionModel.deleteByToken(token);
    } catch (error) {
      throw new AppError(
        'Failed to delete session',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async deleteUserSessions(userId: string, type?: string): Promise<void> {
    try {
      await SessionModel.deleteByUserId(userId, type);
    } catch (error) {
      throw new AppError(
        'Failed to delete user sessions',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      return await SessionModel.cleanupExpired();
    } catch (error) {
      throw new AppError(
        'Failed to cleanup expired sessions',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async updateSessionExpiry(token: string, expiresAt: Date): Promise<void> {
    try {
      await SessionModel.updateExpiry(token, expiresAt);
    } catch (error) {
      throw new AppError(
        'Failed to update session expiry',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async isSessionValid(token: string): Promise<boolean> {
    try {
      const session = await SessionModel.findByToken(token);
      return session !== null && session.expiresAt > new Date();
    } catch (error) {
      return false;
    }
  }
}
