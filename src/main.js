import { Actor } from 'apify';
import axios from 'axios';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_PRICING = {
    'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
    'google/gemini-2.0-flash-exp:free': { input: 0, output: 0 }
};

await Actor.main(async () => {
    const input = await Actor.getInput();
    if (!input?.productName) throw new Error('Product name is required');
    if (!input?.openrouterApiKey) throw new Error('OpenRouter API key is required');

    const {
        productName,
        features = [],
        targetAudience = 'general consumers',
        brand = '',
        category = '',
        tone = 'professional',
        length = 'medium',
        model = 'google/gemini-2.0-flash-exp:free',
        openrouterApiKey
    } = input;

    console.log(`Creating product description for: ${productName}`);

    const lengthWords = { short: 50, medium: 100, long: 200 };
    const prompt = `Create a compelling e-commerce product description:

Product: ${productName}
${brand ? `Brand: ${brand}` : ''}
${category ? `Category: ${category}` : ''}
${features.length > 0 ? `Features: ${features.join(', ')}` : ''}
Target Audience: ${targetAudience}
Tone: ${tone}
Length: ~${lengthWords[length]} words

Provide:
1. Short description (100 chars for product listings)
2. Full description (HTML formatted, ${lengthWords[length]} words)
3. Bullet points highlighting key features/benefits
4. SEO keywords
5. Call-to-action

Return JSON:
{
    "shortDescription": "string",
    "fullDescription": "HTML string",
    "bulletPoints": ["string"],
    "seoKeywords": ["string"],
    "callToAction": "string"
}`;

    const result = await callOpenRouter(prompt, model, openrouterApiKey);
    const description = JSON.parse(result.content);
    const cost = calculateCost(result.usage, model);

    await Actor.pushData({
        productName,
        brand,
        category,
        ...description,
        cost: parseFloat(cost.totalCost.toFixed(6)),
        chargePrice: 0.30,
        profit: parseFloat((0.30 - cost.totalCost).toFixed(4)),
        createdAt: new Date().toISOString()
    });

    console.log(`✓ Product description created! Cost: $${cost.totalCost.toFixed(6)}`);
});

async function callOpenRouter(prompt, model, apiKey) {
    const response = await axios.post(OPENROUTER_API_URL, {
        model,
        messages: [
            { role: 'system', content: 'You are an expert e-commerce copywriter creating persuasive product descriptions.' },
            { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
    }, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://apify.com',
            'X-Title': 'Product Description Writer'
        }
    });
    return { content: response.data.choices[0].message.content, usage: response.data.usage };
}

function calculateCost(usage, model) {
    const pricing = MODEL_PRICING[model];
    return { totalCost: (usage.prompt_tokens / 1000000) * pricing.input + (usage.completion_tokens / 1000000) * pricing.output };
}
