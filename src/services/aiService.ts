import OpenAI from 'openai';
import { db } from '../db/drizzle';
import { aiInsights, bills, customers, products, gstTransactions } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface AIInsightData {
    type: 'tax_optimization' | 'risk' | 'trend' | 'forecast' | 'expense_analysis';
    title: string;
    description: string;
    recommendations: string[];
    confidence: number;
    data: any;
}

export class AIService {
    async generateTaxOptimizationInsights(companyId: string): Promise<AIInsightData> {
        try {
            // Get recent GST transactions
            const gstData = await db
                .select()
                .from(gstTransactions)
                .where(eq(gstTransactions.companyId, companyId))
                .orderBy(desc(gstTransactions.date))
                .limit(100);

            const prompt = `
                Analyze the following GST transaction data and provide tax optimization insights:
                ${JSON.stringify(gstData, null, 2)}
                
                Please provide:
                1. Tax optimization opportunities
                2. Potential savings
                3. Compliance recommendations
                4. Risk areas to watch
                
                Format the response as JSON with title, description, recommendations array, and confidence score.
            `;

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            });

            const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

            const insightData: AIInsightData = {
                type: 'tax_optimization',
                title: aiResponse.title || 'Tax Optimization Analysis',
                description: aiResponse.description || 'AI-generated tax optimization insights',
                recommendations: aiResponse.recommendations || [],
                confidence: aiResponse.confidence || 0.8,
                data: { gstTransactions: gstData.length, analysis: aiResponse },
            };

            // Save to database
            await db.insert(aiInsights).values({
                companyId,
                type: 'tax_optimization',
                data: insightData,
            });

            return insightData;
        } catch (error) {
            console.error('Tax optimization AI error:', error);
            return {
                type: 'tax_optimization',
                title: 'Tax Optimization Analysis',
                description: 'Unable to generate AI insights at this time',
                recommendations: ['Review GST compliance regularly', 'Maintain proper documentation'],
                confidence: 0.5,
                data: {},
            };
        }
    }

    async generateRiskAnalysis(companyId: string): Promise<AIInsightData> {
        try {
            // Get bills and customer data
            const billsData = await db
                .select()
                .from(bills)
                .where(eq(bills.companyId, companyId))
                .orderBy(desc(bills.createdAt))
                .limit(50);

            const customersData = await db
                .select()
                .from(customers)
                .where(eq(customers.companyId, companyId));

            const prompt = `
                Analyze the following business data for risk assessment:
                Bills: ${JSON.stringify(billsData.slice(0, 10), null, 2)}
                Customers: ${JSON.stringify(customersData.slice(0, 10), null, 2)}
                
                Identify:
                1. Payment default risks
                2. Cash flow risks
                3. Customer concentration risks
                4. Operational risks
                
                Provide actionable recommendations to mitigate these risks.
            `;

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            });

            const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

            const insightData: AIInsightData = {
                type: 'risk',
                title: aiResponse.title || 'Risk Analysis Report',
                description: aiResponse.description || 'AI-generated risk assessment',
                recommendations: aiResponse.recommendations || [],
                confidence: aiResponse.confidence || 0.8,
                data: { bills: billsData.length, customers: customersData.length, analysis: aiResponse },
            };

            await db.insert(aiInsights).values({
                companyId,
                type: 'risk',
                data: insightData,
            });

            return insightData;
        } catch (error) {
            console.error('Risk analysis AI error:', error);
            return {
                type: 'risk',
                title: 'Risk Analysis Report',
                description: 'Unable to generate risk analysis at this time',
                recommendations: ['Monitor payment patterns', 'Diversify customer base'],
                confidence: 0.5,
                data: {},
            };
        }
    }

    async generateTrendAnalysis(companyId: string): Promise<AIInsightData> {
        try {
            // Get historical data for trend analysis
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

            const billsData = await db
                .select()
                .from(bills)
                .where(
                    and(
                        eq(bills.companyId, companyId),
                        gte(bills.date, sixMonthsAgo)
                    )
                )
                .orderBy(bills.date);

            const prompt = `
                Analyze the following sales data for trends and patterns:
                ${JSON.stringify(billsData, null, 2)}
                
                Identify:
                1. Sales trends (growth/decline)
                2. Seasonal patterns
                3. Customer behavior trends
                4. Product performance trends
                
                Provide insights and future predictions.
            `;

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            });

            const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

            const insightData: AIInsightData = {
                type: 'trend',
                title: aiResponse.title || 'Trend Analysis Report',
                description: aiResponse.description || 'AI-generated trend analysis',
                recommendations: aiResponse.recommendations || [],
                confidence: aiResponse.confidence || 0.8,
                data: { bills: billsData.length, period: '6 months', analysis: aiResponse },
            };

            await db.insert(aiInsights).values({
                companyId,
                type: 'trend',
                data: insightData,
            });

            return insightData;
        } catch (error) {
            console.error('Trend analysis AI error:', error);
            return {
                type: 'trend',
                title: 'Trend Analysis Report',
                description: 'Unable to generate trend analysis at this time',
                recommendations: ['Track sales metrics regularly', 'Monitor market conditions'],
                confidence: 0.5,
                data: {},
            };
        }
    }

    async generateExpenseAnalysis(companyId: string): Promise<AIInsightData> {
        try {
            // Get expense data from bills and transactions
            const expenseData = await db
                .select()
                .from(bills)
                .where(eq(bills.companyId, companyId))
                .orderBy(desc(bills.date))
                .limit(100);

            const prompt = `
                Analyze the following expense data:
                ${JSON.stringify(expenseData, null, 2)}
                
                Provide:
                1. Expense categorization
                2. Cost optimization opportunities
                3. Budget recommendations
                4. Spending pattern analysis
                
                Focus on actionable insights for cost reduction.
            `;

            const response = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
            });

            const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

            const insightData: AIInsightData = {
                type: 'expense_analysis',
                title: aiResponse.title || 'Expense Analysis Report',
                description: aiResponse.description || 'AI-generated expense analysis',
                recommendations: aiResponse.recommendations || [],
                confidence: aiResponse.confidence || 0.8,
                data: { expenses: expenseData.length, analysis: aiResponse },
            };

            await db.insert(aiInsights).values({
                companyId,
                type: 'expense_analysis',
                data: insightData,
            });

            return insightData;
        } catch (error) {
            console.error('Expense analysis AI error:', error);
            return {
                type: 'expense_analysis',
                title: 'Expense Analysis Report',
                description: 'Unable to generate expense analysis at this time',
                recommendations: ['Track expenses by category', 'Set budget limits'],
                confidence: 0.5,
                data: {},
            };
        }
    }

    async getInsights(companyId: string, type?: string): Promise<AIInsightData[]> {
        try {
            const query = db
                .select()
                .from(aiInsights)
                .where(eq(aiInsights.companyId, companyId))
                .orderBy(desc(aiInsights.createdAt));

            if (type) {
                query.where(and(eq(aiInsights.companyId, companyId), eq(aiInsights.type, type as any)));
            }

            const insights = await query.limit(10);
            return insights.map(insight => insight.data as AIInsightData);
        } catch (error) {
            console.error('Get insights error:', error);
            return [];
        }
    }

    async generateAllInsights(companyId: string): Promise<AIInsightData[]> {
        const insights = await Promise.all([
            this.generateTaxOptimizationInsights(companyId),
            this.generateRiskAnalysis(companyId),
            this.generateTrendAnalysis(companyId),
            this.generateExpenseAnalysis(companyId),
        ]);

        return insights;
    }
}

export const aiService = new AIService();