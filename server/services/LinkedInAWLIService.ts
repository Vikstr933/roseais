import { SimpleLogger } from '../utils/SimpleLogger';
import axios from 'axios';
import crypto from 'crypto';

const logger = new SimpleLogger('LinkedInAWLIService');

// LinkedIn AWLI integration is temporarily disabled
const LINKEDIN_AWLI_DISABLED = true;

export interface LinkedInAWLIConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface LinkedInProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
  currentPosition?: string;
  currentCompany?: string;
  experience?: Array<{
    title: string;
    company: string;
    duration: string;
  }>;
  education?: Array<{
    school: string;
    degree: string;
    field: string;
  }>;
  skills?: string[];
}

/**
 * LinkedIn Apply with LinkedIn (AWLI) Service
 * 
 * NOTE: LinkedIn is currently not accepting new partners for AWLI.
 * This service is prepared for when access is granted.
 * 
 * AWLI allows job seekers to:
 * 1. Click "Apply with LinkedIn" button
 * 2. Authenticate with LinkedIn via OAuth
 * 3. Share profile information
 * 4. Pre-populate application forms
 */
export class LinkedInAWLIService {
  private config: LinkedInAWLIConfig | null = null;
  private readonly LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
  private readonly LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
  private readonly LINKEDIN_PROFILE_API = 'https://api.linkedin.com/v2/userinfo';
  private readonly LINKEDIN_PROFILE_V2_API = 'https://api.linkedin.com/v2/me';
  private readonly LINKEDIN_EMAIL_API = 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))';

  constructor() {
    this.loadConfig();
  }

  private loadConfig(): void {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const redirectUri = process.env.LINKEDIN_AWLI_REDIRECT_URI || 'http://localhost:3001/api/linkedin/awli/callback';
    const scopes = (process.env.LINKEDIN_AWLI_SCOPES || 'openid,profile,email').split(',');

    if (clientId && clientSecret) {
      this.config = {
        clientId,
        clientSecret,
        redirectUri,
        scopes: scopes.map(s => s.trim()),
      };
      logger.info('LinkedIn AWLI configuration loaded');
    } else {
      logger.warn('LinkedIn AWLI not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.');
    }
  }

  /**
   * Check if LinkedIn AWLI is available/configured
   * NOTE: LinkedIn AWLI integration is temporarily disabled
   */
  isAvailable(): boolean {
    if (LINKEDIN_AWLI_DISABLED) {
      return false;
    }
    return this.config !== null;
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(state: string, jobId?: string): string | null {
    if (!this.config) {
      return null;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      state: state,
      scope: this.config.scopes.join(' '),
    });

    if (jobId) {
      params.append('job_id', jobId);
    }

    return `${this.LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<string | null> {
    if (!this.config) {
      throw new Error('LinkedIn AWLI not configured');
    }

    try {
      const response = await axios.post(
        this.LINKEDIN_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: this.config.redirectUri,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data.access_token || null;
    } catch (error: any) {
      logger.error('Failed to exchange code for token', error as Error);
      throw error;
    }
  }

  /**
   * Fetch user profile data from LinkedIn
   */
  async fetchProfileData(accessToken: string): Promise<LinkedInProfileData> {
    try {
      // Fetch basic profile info (OpenID Connect)
      const profileResponse = await axios.get(this.LINKEDIN_PROFILE_API, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const profile = profileResponse.data;

      // Fetch email (separate endpoint)
      let email: string | undefined;
      try {
        const emailResponse = await axios.get(this.LINKEDIN_EMAIL_API, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        const emailElements = emailResponse.data?.elements || [];
        if (emailElements.length > 0) {
          email = emailElements[0]['handle~']?.emailAddress;
        }
      } catch (error) {
        logger.warn('Failed to fetch email from LinkedIn', error as Error);
      }

      // Fetch detailed profile (v2 API)
      let currentPosition: string | undefined;
      let currentCompany: string | undefined;
      let experience: Array<{ title: string; company: string; duration: string }> = [];
      let education: Array<{ school: string; degree: string; field: string }> = [];
      let skills: string[] = [];

      try {
        const v2Response = await axios.get(this.LINKEDIN_PROFILE_V2_API, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            projection: '(id,firstName,lastName,headline,positions,educations,skills)',
          },
        });

        const v2Profile = v2Response.data;
        
        // Extract current position
        if (v2Profile.positions && v2Profile.positions.values && v2Profile.positions.values.length > 0) {
          const currentPos = v2Profile.positions.values[0];
          currentPosition = currentPos.title;
          currentCompany = currentPos.company?.name;
          
          // Extract all experience
          experience = v2Profile.positions.values.map((pos: any) => ({
            title: pos.title || '',
            company: pos.company?.name || '',
            duration: `${pos.startDate?.year || ''} - ${pos.endDate?.year || 'Present'}`,
          }));
        }

        // Extract education
        if (v2Profile.educations && v2Profile.educations.values) {
          education = v2Profile.educations.values.map((edu: any) => ({
            school: edu.schoolName || '',
            degree: edu.degree || '',
            field: edu.fieldOfStudy || '',
          }));
        }

        // Extract skills
        if (v2Profile.skills && v2Profile.skills.values) {
          skills = v2Profile.skills.values.map((skill: any) => skill.skill?.name || '').filter(Boolean);
        }
      } catch (error) {
        logger.warn('Failed to fetch detailed profile from LinkedIn v2 API', error as Error);
        // Continue with basic profile data
      }

      return {
        firstName: profile.given_name || profile.firstName,
        lastName: profile.family_name || profile.lastName,
        email: email || profile.email,
        location: profile.locale || profile.location,
        currentPosition,
        currentCompany,
        experience,
        education,
        skills,
      };
    } catch (error) {
      logger.error('Failed to fetch LinkedIn profile data', error as Error);
      throw error;
    }
  }

  /**
   * Generate state parameter for OAuth (CSRF protection)
   */
  generateState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify state parameter
   */
  verifyState(state: string, storedState: string): boolean {
    return state === storedState;
  }
}

export const linkedInAWLIService = new LinkedInAWLIService();

