import OpenAI from 'openai';
import { AIPricingService, AIPricingRequest, AIPricingResponse } from '../types';
import { AI_PRICING_CONSTANTS } from '../../config/quotes';
import { environment } from '../../config/auth';
import { logger } from '../../shared/utils';
import { AppError } from '../../shared/utils';
import { HTTP_STATUS_CODES } from '../../config/auth';

export class AIPricingServiceImpl implements AIPricingService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: environment.OPENAI_API_KEY
    });
  }

  async getSuggestedPricing(request: AIPricingRequest): Promise<AIPricingResponse> {
    try {
      const complexity = await this.analyzeJobComplexity(request.jobDescription, request.jobType);
      const estimatedDuration = request.estimatedDuration || this.estimateDuration(request.jobDescription, request.jobType);
      
      const breakdown = await this.generatePricingBreakdown(
        request.tradieHourlyRate,
        estimatedDuration,
        complexity
      );

      const suggestedTotal = breakdown.labour + breakdown.materials + breakdown.markup;

      const response: AIPricingResponse = {
        suggestedTotal: parseFloat(suggestedTotal.toFixed(2)),
        complexityFactor: complexity,
        breakdown,
        reasoning: await this.generatePricingReasoning(request, complexity, estimatedDuration),
        confidence: this.calculateConfidence(request, complexity)
      };

      logger.info('AI pricing suggestion generated', {
        jobType: request.jobType,
        tradieRate: request.tradieHourlyRate,
        complexity,
        suggestedTotal: response.suggestedTotal,
        confidence: response.confidence
      });

      return response;

    } catch (error) {
      logger.error('Failed to generate AI pricing suggestion', {
        jobType: request.jobType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to generate pricing suggestion',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'AI_PRICING_ERROR'
      );
    }
  }

  async analyzeJobComplexity(jobDescription: string, jobType: string): Promise<number> {
    try {
      const prompt = this.buildComplexityAnalysisPrompt(jobDescription, jobType);
      
      const completion = await this.openai.chat.completions.create({
        model: AI_PRICING_CONSTANTS.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are an expert construction and trade work analyst. Analyze job complexity and return only a numeric complexity factor between 0.8 and 3.0.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: AI_PRICING_CONSTANTS.OPENAI_MAX_TOKENS,
        temperature: AI_PRICING_CONSTANTS.OPENAI_TEMPERATURE
      });

      const response = completion.choices[0]?.message?.content?.trim();
      const complexity = parseFloat(response || AI_PRICING_CONSTANTS.DEFAULT_COMPLEXITY_FACTOR.toString());

      if (isNaN(complexity) || complexity < AI_PRICING_CONSTANTS.MIN_COMPLEXITY_FACTOR || complexity > AI_PRICING_CONSTANTS.MAX_COMPLEXITY_FACTOR) {
        logger.warn('Invalid complexity factor from AI, using default', {
          aiResponse: response,
          defaultUsed: AI_PRICING_CONSTANTS.DEFAULT_COMPLEXITY_FACTOR
        });
        return AI_PRICING_CONSTANTS.DEFAULT_COMPLEXITY_FACTOR;
      }

      return complexity;

    } catch (error) {
      logger.error('Failed to analyze job complexity with AI', {
        jobType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return AI_PRICING_CONSTANTS.DEFAULT_COMPLEXITY_FACTOR;
    }
  }

  async generatePricingBreakdown(baseRate: number, duration: number, complexity: number): Promise<AIPricingResponse['breakdown']> {
    try {
      const labourCost = baseRate * duration * complexity;
      const materialsCost = labourCost * 0.3;
      const markupCost = (labourCost + materialsCost) * AI_PRICING_CONSTANTS.MARKUP_PERCENTAGE;

      return {
        labour: parseFloat(labourCost.toFixed(2)),
        materials: parseFloat(materialsCost.toFixed(2)),
        markup: parseFloat(markupCost.toFixed(2))
      };

    } catch (error) {
      logger.error('Failed to generate pricing breakdown', {
        baseRate,
        duration,
        complexity,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new AppError(
        'Failed to generate pricing breakdown',
        HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
        'PRICING_BREAKDOWN_ERROR'
      );
    }
  }

  private buildComplexityAnalysisPrompt(jobDescription: string, jobType: string): string {
    return `
      Analyze the complexity of this ${jobType} job and return a complexity factor between 0.8 and 3.0:

      Job Description: ${jobDescription}
      Job Type: ${jobType}

      Consider these factors:
      - Technical difficulty and skill level required
      - Time complexity and potential delays
      - Material requirements and availability
      - Safety considerations and regulations
      - Access difficulties and site conditions
      - Coordination with other trades

      Complexity Scale:
      - 0.8-1.0: Simple, routine work
      - 1.0-1.5: Standard complexity
      - 1.5-2.0: Above average complexity
      - 2.0-2.5: High complexity
      - 2.5-3.0: Very high complexity

      Return only the numeric complexity factor.
    `;
  }

  private estimateDuration(jobDescription: string, jobType: string): number {
    const keywords = jobDescription.toLowerCase();
    const baseHours: { [key: string]: number } = {
      'plumbing': 4,
      'electrical': 6,
      'carpentry': 8,
      'painting': 6,
      'roofing': 12,
      'flooring': 10,
      'tiling': 8,
      'landscaping': 16,
      'renovation': 24,
      'installation': 4
    };

    let estimatedHours = baseHours[jobType.toLowerCase()] || 8;

    if (keywords.includes('small') || keywords.includes('minor')) {
      estimatedHours *= 0.5;
    } else if (keywords.includes('large') || keywords.includes('major')) {
      estimatedHours *= 2;
    } else if (keywords.includes('complete') || keywords.includes('full')) {
      estimatedHours *= 1.5;
    }

    return Math.max(AI_PRICING_CONSTANTS.MIN_ESTIMATED_DURATION, 
                   Math.min(estimatedHours, AI_PRICING_CONSTANTS.MAX_ESTIMATED_DURATION));
  }

  private async generatePricingReasoning(request: AIPricingRequest, complexity: number, duration: number): Promise<string> {
    try {
      const prompt = `
        Explain the pricing for this ${request.jobType} job in 2-3 sentences:
        
        Job: ${request.jobDescription}
        Hourly Rate: $${request.tradieHourlyRate}
        Estimated Duration: ${duration} hours
        Complexity Factor: ${complexity}
        
        Focus on key factors that justify the pricing.
      `;

      const completion = await this.openai.chat.completions.create({
        model: AI_PRICING_CONSTANTS.OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a professional trade estimator. Provide clear, concise pricing explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      });

      return completion.choices[0]?.message?.content?.trim() || 
             `Pricing based on ${duration} hours at $${request.tradieHourlyRate}/hour with ${complexity}x complexity factor for ${request.jobType} work.`;

    } catch (error) {
      logger.error('Failed to generate pricing reasoning', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return `Pricing based on ${duration} hours at $${request.tradieHourlyRate}/hour with ${complexity}x complexity factor for ${request.jobType} work.`;
    }
  }

  private calculateConfidence(request: AIPricingRequest, complexity: number): number {
    let confidence = AI_PRICING_CONSTANTS.CONFIDENCE_THRESHOLD;

    if (request.jobDescription.length > 50) confidence += 0.1;
    if (request.estimatedDuration) confidence += 0.1;
    if (request.location) confidence += 0.05;
    if (complexity >= 1.0 && complexity <= 2.0) confidence += 0.1;

    return Math.min(1.0, parseFloat(confidence.toFixed(2)));
  }
}
