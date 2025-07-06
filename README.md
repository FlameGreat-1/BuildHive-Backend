# BuildHive Backend API - Frontend Integration Guide

## 🚀 Quick Start

**Base URL:** `https://buildhive-api.onrender.com`  
**API Documentation:** `https://buildhive-api.onrender.com/api-docs`  
**Version:** 1.0.0  
**Market Focus:** Australian Construction Industry  
**Total Endpoints:** 44 across 8 modules  

### First API Call
```bash
curl -X GET "https://buildhive-api.onrender.com/health" \
  -H "Content-Type: application/json"
```

## 📊 API Overview

### Available Modules
- **🔐 Authentication** (12 endpoints) - Registration, login, password management
- **✅ Validation** (12 endpoints) - Real-time input validation
- **👤 Profile Management** (13 endpoints) - User profile operations
- **💼 Job Management** (16 endpoints) - Complete job lifecycle
- **👥 Client Management** (8 endpoints) - Client relationship management
- **🔧 Material Management** (3 endpoints) - Job materials tracking
- **📎 File Attachments** (2 endpoints) - Document management

### Response Format
All API responses follow this standardized format:
```typescript
{
  "success": boolean,
  "message": string,
  "data": any,
  "errors": ValidationError[],
  "timestamp": string,
  "requestId": string
}
```

## 🔐 Authentication System

### User Roles
```typescript
enum UserRole {
  CLIENT = 'client',      // Job posters
  TRADIE = 'tradie',      // Service providers  
  ENTERPRISE = 'enterprise' // Large organizations
}
```

### Authentication Providers
```typescript
enum AuthProvider {
  LOCAL = 'local',        // Email/password
  GOOGLE = 'google',      // Google OAuth
  LINKEDIN = 'linkedin',  // LinkedIn OAuth
  FACEBOOK = 'facebook'   // Facebook OAuth
}
```

### Authentication Flow

#### 1. Local Registration
```typescript
POST /api/v1/auth/register/local
Content-Type: application/json

{
  "username": "john_tradie",
  "email": "john@example.com", 
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123",
  "role": "tradie"
}

// Response
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": {
      "id": "123",
      "username": "john_tradie",
      "email": "john@example.com",
      "role": "tradie",
      "status": "pending",
      "emailVerified": false,
      "createdAt": "2025-07-06T10:30:00Z"
    },
    "requiresVerification": true,
    "verificationSent": true
  }
}
```

#### 2. Social Registration
```typescript
POST /api/v1/auth/register/social
Content-Type: application/json

{
  "authProvider": "google",
  "socialId": "google_user_id_123",
  "socialData": {
    "id": "google_user_id_123",
    "email": "john@gmail.com",
    "name": "John Smith",
    "picture": "https://lh3.googleusercontent.com/...",
    "provider": "google"
  },
  "role": "tradie"
}
```

#### 3. Login
```typescript
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123",
  "rememberMe": true
}

// Response
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "123",
      "username": "john_tradie",
      "email": "john@example.com",
      "role": "tradie",
      "status": "active",
      "emailVerified": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 3600
    },
    "profile": {
      "firstName": "John",
      "lastName": "Smith",
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

#### 4. Token Refresh
```typescript
POST /api/v1/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 5. Password Management
```typescript
// Forgot Password
POST /api/v1/auth/forgot-password
{
  "email": "john@example.com"
}

// Reset Password
POST /api/v1/auth/reset-password
{
  "token": "reset_token_here",
  "newPassword": "NewSecurePass123",
  "confirmPassword": "NewSecurePass123"
}

// Change Password (Authenticated)
POST /api/v1/auth/change-password
Authorization: Bearer <access_token>
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewSecurePass123", 
  "confirmPassword": "NewSecurePass123"
}
```

### Authentication Requirements

#### Password Requirements
- **Length:** 8-128 characters
- **Uppercase:** Required (temporarily disabled)
- **Lowercase:** Required (temporarily disabled)  
- **Numbers:** Required (temporarily disabled)
- **Special Characters:** Required (temporarily disabled)

#### Username Requirements
- **Length:** 3-30 characters
- **Pattern:** Alphanumeric + underscore/hyphen only (`/^[a-zA-Z0-9_-]+$/`)
- **Case:** Converted to lowercase

#### Email Requirements
- **Format:** Valid email format with normalization
- **Max Length:** 254 characters

## ✅ Real-time Validation System

### Available Validation Endpoints

#### 1. Email Availability
```typescript
POST /api/v1/validation/email/availability
{
  "email": "test@example.com"
}

// Response
{
  "success": true,
  "message": "Email availability checked",
  "data": {
    "available": true,
    "email": "test@example.com"
  }
}
```

#### 2. Username Availability
```typescript
POST /api/v1/validation/username/availability
{
  "username": "john_tradie"
}
```

#### 3. Format Validation
```typescript
// Email Format
POST /api/v1/validation/email/format
{
  "email": "test@example.com"
}

// Username Format  
POST /api/v1/validation/username/format
{
  "username": "john_tradie"
}

// Password Strength
POST /api/v1/validation/password/strength
{
  "password": "SecurePass123"
}
```

#### 4. Bulk Validation
```typescript
POST /api/v1/validation/bulk-availability
{
  "email": "test@example.com",
  "username": "john_tradie"
}
```

#### 5. Username Generation
```typescript
POST /api/v1/validation/generate-username
{
  "name": "John Smith"
}

// Response
{
  "success": true,
  "message": "Username generated",
  "data": {
    "suggestions": [
      "john_smith",
      "johnsmith123", 
      "john_s_2025"
    ]
  }
}
```

## 👥 User Profile Management

### Profile Data Structure
```typescript
interface Profile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  timezone?: string;
  preferences: ProfilePreferences;
  metadata: ProfileMetadata;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfilePreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  language: string; // 'en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko'
  currency: string; // 'AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD'
}
```

### Profile Operations

#### 1. Create Profile
```typescript
POST /api/v1/profile/create
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith", 
  "phone": "+61412345678",
  "bio": "Experienced electrician with 10+ years",
  "location": "Sydney, NSW",
  "timezone": "Australia/Sydney",
  "preferences": {
    "emailNotifications": true,
    "smsNotifications": false,
    "marketingEmails": true,
    "language": "en",
    "currency": "AUD"
  }
}
```

#### 2. Get Profile
```typescript
GET /api/v1/profile/me
Authorization: Bearer <access_token>

// Response
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "profile_123",
    "userId": "user_123",
    "firstName": "John",
    "lastName": "Smith",
    "phone": "+61412345678",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Experienced electrician with 10+ years",
    "location": "Sydney, NSW", 
    "timezone": "Australia/Sydney",
    "preferences": {
      "emailNotifications": true,
      "smsNotifications": false,
      "marketingEmails": true,
      "language": "en",
      "currency": "AUD"
    },
    "metadata": {
      "registrationSource": "web",
      "lastLoginAt": "2025-07-06T10:30:00Z",
      "loginCount": 15,
      "profileCompleteness": 85
    }
  }
}
```

### Role-Specific Profile Extensions

#### Tradie Profile
```typescript
interface TradieProfileExtension {
  abn?: string;                    // 11-digit Australian Business Number
  qualifications: string[];        // Professional qualifications
  hourlyRate?: number;            // 0-1000 AUD
  serviceTypes: string[];         // Services offered
  availability: string;           // 'full-time' | 'part-time' | 'weekends' | 'evenings' | 'flexible'
  skills: string[];              // Professional skills
  experienceYears?: number;      // 0-50 years
}

// Example
{
  "abn": "12345678901",
  "qualifications": ["Licensed Electrician", "Safety Certificate"],
  "hourlyRate": 85.00,
  "serviceTypes": ["Electrical Installation", "Maintenance", "Emergency Repairs"],
  "availability": "full-time",
  "skills": ["Residential Wiring", "Commercial Systems", "Solar Installation"],
  "experienceYears": 12
}
```

#### Client Profile
```typescript
interface ClientProfileExtension {
  companyName?: string;
  industry?: string;
  jobsPosted: number;
  totalSpent: number;
}
```

#### Enterprise Profile
```typescript
interface EnterpriseProfileExtension {
  companyName: string;           // Required
  abn: string;                   // Required 11-digit ABN
  industry: string;              // Required
  teamSize: number;              // 1-10,000 employees
  departments: string[];
  adminUsers: string[];          // Email addresses
}
```

### Profile Validation Rules

#### Basic Fields
- **First/Last Name:** 1-50 characters, letters/spaces/hyphens/apostrophes only
- **Phone:** International mobile format
- **Bio:** Max 500 characters
- **Location:** 2-100 characters
- **Avatar:** Valid URL format

#### Supported Languages
`['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko']`

#### Supported Currencies  
`['AUD', 'USD', 'EUR', 'GBP', 'CAD', 'NZD']`


## 🛡️ Security & Authentication

### Security Headers
The API implements comprehensive security headers:

```typescript
// Content Security Policy
defaultSrc: ["'self'"]
scriptSrc: ["'self'"]                    // No inline scripts allowed
styleSrc: ["'self'", "'unsafe-inline'"]  // Inline styles allowed
imgSrc: ["'self'", "data:", "https:"]    // Images from self, data URLs, HTTPS
objectSrc: ["'none'"]                    // No plugins allowed
frameSrc: ["'none'"]                     // No iframes allowed

// Additional Security Headers
X-XSS-Protection: 1; mode=block
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
X-Powered-By: BuildHive
```

### CORS Configuration
```typescript
// Allowed Origins: Environment-based
// Methods: GET, POST, PUT, DELETE, OPTIONS
// Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID
// Credentials: true
// Max Age: 24 hours
```

### Input Sanitization
All user inputs are automatically sanitized:

```typescript
// XSS Prevention
- Script tag removal: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
- JavaScript protocol blocking: /javascript:/gi  
- Event handler removal: /on\w+\s*=/gi
- HTML entity encoding
- String trimming and validation
```

### Role-Based Access Control

#### Access Requirements by Endpoint
```typescript
// Public Endpoints (No Authentication)
- GET /health
- POST /api/v1/validation/* (all validation endpoints)

// Authenticated Endpoints (Any Role)
- GET /api/v1/auth/me
- GET /api/v1/auth/validate-session
- All /api/v1/profile/* endpoints

// Tradie/Enterprise Only
- All /api/v1/jobs/* endpoints
- All /api/v1/clients/* endpoints  
- All /api/v1/materials/* endpoints
- All /api/v1/attachments/* endpoints

// Enterprise Only
- Advanced reporting features
- Team management features
```

#### JWT Token Structure
```typescript
// Access Token Payload
{
  "userId": "123",
  "email": "john@example.com", 
  "role": "tradie",
  "iat": 1625097600,
  "exp": 1625101200
}

// Refresh Token Payload  
{
  "userId": "123",
  "email": "john@example.com",
  "role": "tradie", 
  "tokenId": "refresh_token_id",
  "iat": 1625097600,
  "exp": 1625702400
}
```

## ⚡ Rate Limiting System

### Rate Limit Matrix

#### Authentication Limits
```typescript
// Registration: 5 attempts per 15 minutes (per IP)
// Login: 5 attempts per 15 minutes (per IP + email)
// Password Reset: 3 attempts per hour (per IP + email)
// Email Verification: 3 attempts per hour (per IP + email)
// Token Refresh: 10 attempts per 5 minutes (per IP)
// Change Password: 5 attempts per 15 minutes (per IP)
// Logout: 20 attempts per 5 minutes (per IP)
```

#### Profile & General Limits
```typescript
// Profile Updates: 20 attempts per 10 minutes (per IP)
// General API: 100 requests per 15 minutes (per IP)
// Validation Requests: 50 attempts per 10 minutes (per IP)
// Strict Operations: 10 attempts per 5 minutes (per IP)
```

#### Job Management Limits
```typescript
// Job Creation: 30 attempts per 10 minutes (per user)
// Job Updates: 50 attempts per 5 minutes (per user)
// Job Search: 30 requests per minute (per user)
// File Uploads: 20 attempts per 15 minutes (per user)
// Client Operations: 40 attempts per 10 minutes (per user)
// Material Updates: 60 attempts per 5 minutes (per user)
```

### Rate Limit Headers
```typescript
// Response Headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
Retry-After: 900 (when rate limited)
```

### Rate Limit Error Response
```typescript
// HTTP 429 Too Many Requests
{
  "success": false,
  "message": "Too many requests from this IP, please try again after 15 minutes",
  "timestamp": "2025-07-06T10:30:00Z",
  "requestId": "req_123456789"
}
```

## ⚠️ Error Handling System

### Error Response Structure
```typescript
interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
  statusCode: number;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### HTTP Status Codes Used
```typescript
200 - OK (Success)
201 - Created (Resource created)
400 - Bad Request (Invalid input)
401 - Unauthorized (Authentication required)
403 - Forbidden (Insufficient permissions)
404 - Not Found (Resource not found)
409 - Conflict (Resource already exists)
422 - Unprocessable Entity (Validation failed)
429 - Too Many Requests (Rate limited)
500 - Internal Server Error (Server error)
```

### Common Error Codes

#### Authentication Errors
```typescript
VALIDATION_ERROR - Input validation failed
USER_EXISTS - User already exists
EMAIL_EXISTS - Email already registered
USERNAME_EXISTS - Username already taken
INVALID_CREDENTIALS - Wrong email/password
INVALID_TOKEN - Token is invalid or malformed
TOKEN_EXPIRED - Token has expired
ACCOUNT_LOCKED - Too many failed login attempts
EMAIL_NOT_VERIFIED - Email verification required
PASSWORD_RESET_REQUIRED - Password reset needed
SAME_PASSWORD - New password same as current
```

#### Job Management Errors
```typescript
JOB_NOT_FOUND - Job does not exist
CLIENT_NOT_FOUND - Client does not exist
MATERIAL_NOT_FOUND - Material does not exist
ATTACHMENT_NOT_FOUND - Attachment does not exist
UNAUTHORIZED_JOB_ACCESS - User cannot access this job
INVALID_JOB_STATUS - Invalid status transition
INVALID_JOB_TYPE - Invalid job type provided
INVALID_PRIORITY - Invalid priority level
INVALID_MATERIAL_UNIT - Invalid material unit
FILE_UPLOAD_ERROR - File upload failed
INVALID_FILE_TYPE - Unsupported file type
FILE_TOO_LARGE - File exceeds size limit
DUPLICATE_CLIENT_EMAIL - Client email already exists
INVALID_DATE_RANGE - Invalid start/end dates
MATERIALS_LIMIT_EXCEEDED - Too many materials
ATTACHMENTS_LIMIT_EXCEEDED - Too many attachments
```

### Error Examples

#### Validation Error
```typescript
// HTTP 422 Unprocessable Entity
{
  "success": false,
  "message": "Job validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title must be at least 3 characters long",
      "code": "VALIDATION_ERROR"
    },
    {
      "field": "clientEmail", 
      "message": "Please provide a valid email address",
      "code": "VALIDATION_ERROR"
    }
  ],
  "timestamp": "2025-07-06T10:30:00Z",
  "requestId": "req_123456789",
  "statusCode": 422
}
```

#### Authentication Error
```typescript
// HTTP 401 Unauthorized
{
  "success": false,
  "message": "Invalid credentials provided",
  "timestamp": "2025-07-06T10:30:00Z", 
  "requestId": "req_123456789",
  "statusCode": 401
}
```

#### Resource Not Found
```typescript
// HTTP 404 Not Found
{
  "success": false,
  "message": "Job not found",
  "timestamp": "2025-07-06T10:30:00Z",
  "requestId": "req_123456789", 
  "statusCode": 404
}
```

## 💰 Business Rules & Calculations

### Australian Business Focus
- **Currency:** Australian Dollar (AUD) primary
- **ABN Validation:** 11-digit Australian Business Number required for Tradie/Enterprise
- **Tax Rate:** 10% GST (Goods and Services Tax)
- **Phone Format:** International format accepted, Australian numbers preferred

### Pricing & Financial Rules
```typescript
// Default Rates
DEFAULT_HOURLY_RATE: 75 AUD
OVERHEAD_PERCENTAGE: 15%
PROFIT_MARGIN: 25%
TAX_RATE: 10% (GST)

// Material Calculations
MARKUP_PERCENTAGE: 20%
DECIMAL_PLACES: 2

// VIP Client Thresholds
VIP_REVENUE_THRESHOLD: 10,000 AUD
VIP_JOB_COUNT_THRESHOLD: 10 jobs
```

### Job Lifecycle Rules
```typescript
// Status Transitions
PENDING → ACTIVE → COMPLETED
PENDING → CANCELLED
ACTIVE → ON_HOLD → ACTIVE
ACTIVE → CANCELLED
ON_HOLD → CANCELLED

// Business Logic
- Start date cannot be in the past
- Due date must be after start date
- Hours worked cannot exceed estimated duration by more than 50%
- Materials can be added/removed only in PENDING or ACTIVE status
- Jobs can only be deleted in PENDING status
```

### Data Retention & Limits
```typescript
// Job Limits
MAX_MATERIALS_PER_JOB: 100
MAX_ATTACHMENTS_PER_JOB: 20
MAX_FILE_SIZE: 10MB
MAX_ESTIMATED_DURATION: 720 hours (30 days)
MAX_HOURS_WORKED: 1,000 hours

// Client Limits  
MAX_TAGS_PER_CLIENT: 10
MAX_NOTES_LENGTH: 2,000 characters

// Profile Limits
MAX_BIO_LENGTH: 500 characters
MAX_SKILLS: No limit (array)
MAX_QUALIFICATIONS: No limit (array)
```

## 🔧 Advanced Features

### Caching Strategy
```typescript
// Cache TTL (Time To Live)
JOB_LIST: 5 minutes
JOB_DETAILS: 10 minutes  
CLIENT_LIST: 5 minutes
MATERIAL_LIST: 5 minutes
STATISTICS: 15 minutes

// Redis Key Patterns
job:{jobId}
client:{clientId}
job_list:{tradieId}:{filters_hash}
job_stats:{tradieId}
```

### Event System
```typescript
// Job Events
job.created - New job created
job.updated - Job details updated
job.deleted - Job deleted
job.status_changed - Status transition

// Client Events
client.created - New client added
client.updated - Client details updated
client.deleted - Client removed

// Material Events  
material.added - Material added to job
material.updated - Material details updated
material.removed - Material removed from job

// File Events
attachment.added - File uploaded
attachment.removed - File deleted
file.uploaded - File processing complete
```

### Pagination & Filtering
```typescript
// Default Pagination
DEFAULT_PAGE: 1
DEFAULT_LIMIT: 20
MAX_LIMIT: 100
MIN_LIMIT: 1

// Job Filtering Options
status: JobStatus
jobType: JobType  
priority: JobPriority
clientId: number
startDate: ISO8601 date
endDate: ISO8601 date
tags: JobTag[]
sortBy: 'created_at' | 'updated_at' | 'title' | 'status' | 'priority' | 'due_date'
sortOrder: 'asc' | 'desc'

// Example Filter Request
GET /api/v1/jobs?status=active&jobType=electrical&priority=high&sortBy=due_date&sortOrder=asc&page=1&limit=20
```

### Search Functionality
```typescript
// Search Parameters
MIN_SEARCH_LENGTH: 2 characters
MAX_SEARCH_LENGTH: 100 characters

// Searchable Fields
- Job title and description
- Client name and company
- Site address
- Material names
- Notes content

// Example Search
GET /api/v1/jobs?search=kitchen+renovation&page=1&limit=10

## 🛡️ Security & Authentication

### Security Headers
The API implements comprehensive security headers:

```typescript
// Content Security Policy
defaultSrc: ["'self'"]
scriptSrc: ["'self'"]                    // No inline scripts allowed
styleSrc: ["'self'", "'unsafe-inline'"]  // Inline styles allowed
imgSrc: ["'self'", "data:", "https:"]    // Images from self, data URLs, HTTPS
objectSrc: ["'none'"]                    // No plugins allowed
frameSrc: ["'none'"]                     // No iframes allowed

// Additional Security Headers
X-XSS-Protection: 1; mode=block
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
X-Powered-By: BuildHive
```

### CORS Configuration
```typescript
// Allowed Origins: Environment-based
// Methods: GET, POST, PUT, DELETE, OPTIONS
// Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID
// Credentials: true
// Max Age: 24 hours
```

### Input Sanitization
All user inputs are automatically sanitized:

```typescript
// XSS Prevention
- Script tag removal: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
- JavaScript protocol blocking: /javascript:/gi  
- Event handler removal: /on\w+\s*=/gi
- HTML entity encoding
- String trimming and validation
```

### Role-Based Access Control

#### Access Requirements by Endpoint
```typescript
// Public Endpoints (No Authentication)
- GET /health
- POST /api/v1/validation/* (all validation endpoints)

// Authenticated Endpoints (Any Role)
- GET /api/v1/auth/me
- GET /api/v1/auth/validate-session
- All /api/v1/profile/* endpoints

// Tradie/Enterprise Only
- All /api/v1/jobs/* endpoints
- All /api/v1/clients/* endpoints  
- All /api/v1/materials/* endpoints
- All /api/v1/attachments/* endpoints

// Enterprise Only
- Advanced reporting features
- Team management features
```

#### JWT Token Structure
```typescript
// Access Token Payload
{
  "userId": "123",
  "email": "john@example.com", 
  "role": "tradie",
  "iat": 1625097600,
  "exp": 1625101200
}

// Refresh Token Payload  
{
  "userId": "123",
  "email": "john@example.com",
  "role": "tradie", 
  "tokenId": "refresh_token_id",
  "iat": 1625097600,
  "exp": 1625702400
}
```

## ⚡ Rate Limiting System

### Rate Limit Matrix

#### Authentication Limits
```typescript
// Registration: 5 attempts per 15 minutes (per IP)
// Login: 5 attempts per 15 minutes (per IP + email)
// Password Reset: 3 attempts per hour (per IP + email)
// Email Verification: 3 attempts per hour (per IP + email)
// Token Refresh: 10 attempts per 5 minutes (per IP)
// Change Password: 5 attempts per 15 minutes (per IP)
// Logout: 20 attempts per 5 minutes (per IP)
```

#### Profile & General Limits
```typescript
// Profile Updates: 20 attempts per 10 minutes (per IP)
// General API: 100 requests per 15 minutes (per IP)
// Validation Requests: 50 attempts per 10 minutes (per IP)
// Strict Operations: 10 attempts per 5 minutes (per IP)
```

#### Job Management Limits
```typescript
// Job Creation: 30 attempts per 10 minutes (per user)
// Job Updates: 50 attempts per 5 minutes (per user)
// Job Search: 30 requests per minute (per user)
// File Uploads: 20 attempts per 15 minutes (per user)
// Client Operations: 40 attempts per 10 minutes (per user)
// Material Updates: 60 attempts per 5 minutes (per user)
```

### Rate Limit Headers
```typescript
// Response Headers
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
Retry-After: 900 (when rate limited)
```

### Rate Limit Error Response
```typescript
// HTTP 429 Too Many Requests
{
  "success": false,
  "message": "Too many requests from this IP, please try again after 15 minutes",
  "timestamp": "2025-07-06T10:30:00Z",
  "requestId": "req_123456789"
}
```

## ⚠️ Error Handling System

### Error Response Structure
```typescript
interface ErrorResponse {
  success: false;
  message: string;
  errors?: ValidationError[];
  timestamp: string;
  requestId: string;
  statusCode: number;
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

### HTTP Status Codes Used
```typescript
200 - OK (Success)
201 - Created (Resource created)
400 - Bad Request (Invalid input)
401 - Unauthorized (Authentication required)
403 - Forbidden (Insufficient permissions)
404 - Not Found (Resource not found)
409 - Conflict (Resource already exists)
422 - Unprocessable Entity (Validation failed)
429 - Too Many Requests (Rate limited)
500 - Internal Server Error (Server error)
```

### Common Error Codes

#### Authentication Errors
```typescript
VALIDATION_ERROR - Input validation failed
USER_EXISTS - User already exists
EMAIL_EXISTS - Email already registered
USERNAME_EXISTS - Username already taken
INVALID_CREDENTIALS - Wrong email/password
INVALID_TOKEN - Token is invalid or malformed
TOKEN_EXPIRED - Token has expired
ACCOUNT_LOCKED - Too many failed login attempts
EMAIL_NOT_VERIFIED - Email verification required
PASSWORD_RESET_REQUIRED - Password reset needed
SAME_PASSWORD - New password same as current
```

#### Job Management Errors
```typescript
JOB_NOT_FOUND - Job does not exist
CLIENT_NOT_FOUND - Client does not exist
MATERIAL_NOT_FOUND - Material does not exist
ATTACHMENT_NOT_FOUND - Attachment does not exist
UNAUTHORIZED_JOB_ACCESS - User cannot access this job
INVALID_JOB_STATUS - Invalid status transition
INVALID_JOB_TYPE - Invalid job type provided
INVALID_PRIORITY - Invalid priority level
INVALID_MATERIAL_UNIT - Invalid material unit
FILE_UPLOAD_ERROR - File upload failed
INVALID_FILE_TYPE - Unsupported file type
FILE_TOO_LARGE - File exceeds size limit
DUPLICATE_CLIENT_EMAIL - Client email already exists
INVALID_DATE_RANGE - Invalid start/end dates
MATERIALS_LIMIT_EXCEEDED - Too many materials
ATTACHMENTS_LIMIT_EXCEEDED - Too many attachments
```

### Error Examples

#### Validation Error
```typescript
// HTTP 422 Unprocessable Entity
{
  "success": false,
  "message": "Job validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title must be at least 3 characters long",
      "code": "VALIDATION_ERROR"
    },
    {
      "field": "clientEmail", 
      "message": "Please provide a valid email address",
      "code": "VALIDATION_ERROR"
    }
  ],
  "timestamp": "2025-07-06T10:30:00Z",
  "requestId": "req_123456789",
  "statusCode": 422
}
```

#### Authentication Error
```typescript
// HTTP 401 Unauthorized
{
  "success": false,
  "message": "Invalid credentials provided",
  "timestamp": "2025-07-06T10:30:00Z", 
  "requestId": "req_123456789",
  "statusCode": 401
}
```

#### Resource Not Found
```typescript
// HTTP 404 Not Found
{
  "success": false,
  "message": "Job not found",
  "timestamp": "2025-07-06T10:30:00Z",
  "requestId": "req_123456789", 
  "statusCode": 404
}
```

## 💰 Business Rules & Calculations

### Australian Business Focus
- **Currency:** Australian Dollar (AUD) primary
- **ABN Validation:** 11-digit Australian Business Number required for Tradie/Enterprise
- **Tax Rate:** 10% GST (Goods and Services Tax)
- **Phone Format:** International format accepted, Australian numbers preferred

### Pricing & Financial Rules
```typescript
// Default Rates
DEFAULT_HOURLY_RATE: 75 AUD
OVERHEAD_PERCENTAGE: 15%
PROFIT_MARGIN: 25%
TAX_RATE: 10% (GST)

// Material Calculations
MARKUP_PERCENTAGE: 20%
DECIMAL_PLACES: 2

// VIP Client Thresholds
VIP_REVENUE_THRESHOLD: 10,000 AUD
VIP_JOB_COUNT_THRESHOLD: 10 jobs
```

### Job Lifecycle Rules
```typescript
// Status Transitions
PENDING → ACTIVE → COMPLETED
PENDING → CANCELLED
ACTIVE → ON_HOLD → ACTIVE
ACTIVE → CANCELLED
ON_HOLD → CANCELLED

// Business Logic
- Start date cannot be in the past
- Due date must be after start date
- Hours worked cannot exceed estimated duration by more than 50%
- Materials can be added/removed only in PENDING or ACTIVE status
- Jobs can only be deleted in PENDING status
```

### Data Retention & Limits
```typescript
// Job Limits
MAX_MATERIALS_PER_JOB: 100
MAX_ATTACHMENTS_PER_JOB: 20
MAX_FILE_SIZE: 10MB
MAX_ESTIMATED_DURATION: 720 hours (30 days)
MAX_HOURS_WORKED: 1,000 hours

// Client Limits  
MAX_TAGS_PER_CLIENT: 10
MAX_NOTES_LENGTH: 2,000 characters

// Profile Limits
MAX_BIO_LENGTH: 500 characters
MAX_SKILLS: No limit (array)
MAX_QUALIFICATIONS: No limit (array)
```

## 🔧 Advanced Features

### Caching Strategy
```typescript
// Cache TTL (Time To Live)
JOB_LIST: 5 minutes
JOB_DETAILS: 10 minutes  
CLIENT_LIST: 5 minutes
MATERIAL_LIST: 5 minutes
STATISTICS: 15 minutes

// Redis Key Patterns
job:{jobId}
client:{clientId}
job_list:{tradieId}:{filters_hash}
job_stats:{tradieId}
```

### Event System
```typescript
// Job Events
job.created - New job created
job.updated - Job details updated
job.deleted - Job deleted
job.status_changed - Status transition

// Client Events
client.created - New client added
client.updated - Client details updated
client.deleted - Client removed

// Material Events  
material.added - Material added to job
material.updated - Material details updated
material.removed - Material removed from job

// File Events
attachment.added - File uploaded
attachment.removed - File deleted
file.uploaded - File processing complete
```

### Pagination & Filtering
```typescript
// Default Pagination
DEFAULT_PAGE: 1
DEFAULT_LIMIT: 20
MAX_LIMIT: 100
MIN_LIMIT: 1

// Job Filtering Options
status: JobStatus
jobType: JobType  
priority: JobPriority
clientId: number
startDate: ISO8601 date
endDate: ISO8601 date
tags: JobTag[]
sortBy: 'created_at' | 'updated_at' | 'title' | 'status' | 'priority' | 'due_date'
sortOrder: 'asc' | 'desc'

// Example Filter Request
GET /api/v1/jobs?status=active&jobType=electrical&priority=high&sortBy=due_date&sortOrder=asc&page=1&limit=20
```

### Search Functionality
```typescript
// Search Parameters
MIN_SEARCH_LENGTH: 2 characters
MAX_SEARCH_LENGTH: 100 characters

// Searchable Fields
- Job title and description
- Client name and company
- Site address
- Material names
- Notes content

// Example Search
GET /api/v1/jobs?search=kitchen+renovation&page=1&limit=10

