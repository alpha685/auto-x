const OpenAI = require("openai");

class MessagePersonalizer {
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
    }

    async generatePersonalizedMessage(lead, template) {
        const prompt = `
        Generate a personalized DM for this Twitter user:
        
        Username: ${lead.username}
        Bio: ${lead.bio}
        Industry context: ${this.extractIndustry(lead.bio)}
        
        Template: ${template}
        
        Requirements:
        - Keep under 160 characters
        - Sound natural and conversational
        - Reference something specific from their bio
        - Include a clear call-to-action
        - Don't sound sales-y
        
        Generate 3 variations and return the best one:
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 200,
                temperature: 0.7
            });

            return response.choices[0].message.content.trim();
        } catch (error) {
            console.error("AI personalization failed:", error);
            // Fallback to template
            return this.fallbackPersonalization(lead, template);
        }
    }

    extractIndustry(bio) {
        const industries = {
            "startup": ["startup", "entrepreneur", "founder"],
            "tech": ["developer", "engineer", "tech", "software"],
            "marketing": ["marketing", "growth", "digital"],
            "finance": ["finance", "fintech", "investment"],
            "ecommerce": ["ecommerce", "retail", "shopify"]
        };

        for (const [industry, keywords] of Object.entries(industries)) {
            if (keywords.some(keyword => bio.toLowerCase().includes(keyword))) {
                return industry;
            }
        }
        return "business";
    }

    fallbackPersonalization(lead, template) {
        return template
            .replace("{username}", lead.username)
            .replace("{industry}", this.extractIndustry(lead.bio));
    }
}

