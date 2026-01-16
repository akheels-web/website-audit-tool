const axios = require('axios');

module.exports = async (req, res) => {

    /* ---------- CORS ---------- */
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, email, name } = req.body;

        if (!url || !email) {
            return res.status(400).json({ error: 'URL and email are required' });
        }

        /* ---------- ENV CHECK ---------- */
        if (!process.env.PAGESPEED_API_KEY) {
            return res.status(500).json({ error: 'PAGESPEED_API_KEY missing' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY missing' });
        }

        /* ---------- PAGE SPEED ---------- */
        const pageSpeedData = await getPageSpeedData(url);

        /* ---------- AI RECOMMENDATIONS ---------- */
        const aiRecommendations = await generateAIRecommendations(
            url,
            pageSpeedData
        );

        /* ---------- RESPONSE ---------- */
        return res.status(200).json({
            url,
            email,
            name: name || 'User',
            timestamp: new Date().toISOString(),
            overallScore: pageSpeedData.overallScore,
            performance: pageSpeedData.performance,
            seo: pageSpeedData.seo,
            mobile: pageSpeedData.mobile,
            accessibility: pageSpeedData.accessibility,
            recommendations: aiRecommendations
        });

    } catch (error) {
        console.error("API ERROR:", error);
        return res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
};

/* ================= PAGE SPEED ================= */

async function getPageSpeedData(url) {
    try {
        const apiKey = process.env.PAGESPEED_API_KEY;

        const apiUrl =
            `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
            `?url=${encodeURIComponent(url)}` +
            `&key=${apiKey}` +
            `&category=PERFORMANCE` +
            `&category=SEO` +
            `&category=ACCESSIBILITY` +
            `&category=BEST_PRACTICES`;

        console.log('Calling PageSpeed API for:', url);
        
        const response = await axios.get(apiUrl, { timeout: 60000 });

        const categories =
            response.data.lighthouseResult.categories;

        const performance =
            Math.round((categories.performance?.score || 0) * 100);
        const seo =
            Math.round((categories.seo?.score || 0) * 100);
        const accessibility =
            Math.round((categories.accessibility?.score || 0) * 100);
        const bestPractices =
            Math.round((categories['best-practices']?.score || 0) * 100);

        const mobile =
            Math.round((performance + bestPractices) / 2);

        const overallScore =
            Math.round((performance + seo + accessibility + mobile) / 4);

        console.log('PageSpeed scores:', {
            overallScore,
            performance,
            seo,
            mobile,
            accessibility
        });

        return {
            overallScore,
            performance,
            seo,
            mobile,
            accessibility
        };

    } catch (err) {
        console.error("PageSpeed API error:", err.response?.data || err.message);

        // Return fallback scores if PageSpeed API fails
        return {
            overallScore: 50,
            performance: 50,
            seo: 50,
            mobile: 50,
            accessibility: 50
        };
    }
}

/* ================= GEMINI PRO (STABLE) ================= */

async function generateAIRecommendations(url, pageSpeedData) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        // Using stable Gemini Pro model
        const apiUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

        const prompt = `
You are a website optimization expert. Analyze this website and provide 6 specific, actionable recommendations.

Website URL: ${url}
Performance Score: ${pageSpeedData.performance}/100
SEO Score: ${pageSpeedData.seo}/100
Mobile Score: ${pageSpeedData.mobile}/100
Accessibility Score: ${pageSpeedData.accessibility}/100

Based on these scores, provide exactly 6 recommendations. Focus on the areas with the lowest scores first.

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks, no extra text):
[
 { "title":"Brief title", "description":"Specific actionable description", "priority":"High", "impact":"Measurable expected impact" },
 { "title":"Brief title", "description":"Specific actionable description", "priority":"Medium", "impact":"Measurable expected impact" }
]

Make sure each recommendation is specific to the scores provided.
`;

        console.log('Calling Gemini Pro API for recommendations...');

        const response = await axios.post(
            `${apiUrl}?key=${apiKey}`,
            {
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            },
            { timeout: 30000 }
        );

        const text =
            response.data.candidates[0].content.parts[0].text;

        console.log('Gemini raw response:', text.substring(0, 200) + '...');

        // Extract JSON from response (handles cases where AI adds markdown)
        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (!jsonMatch) {
            console.error("Invalid AI response - no JSON found");
            throw new Error("Invalid AI response");
        }

        const recommendations = JSON.parse(jsonMatch[0]);
        
        console.log('Gemini recommendations parsed:', recommendations.length);
        
        // Ensure we return exactly 6 recommendations
        return recommendations.slice(0, 6);

    } catch (err) {
        console.error("Gemini error:", err.response?.data || err.message);
        return getFallbackRecommendations(pageSpeedData);
    }
}

/* ================= FALLBACK ================= */

function getFallbackRecommendations(data) {

    const list = [];

    if (data.performance < 70) {
        list.push({
            title: "Optimize Images",
            description: "Compress images using tools like TinyPNG, convert to WebP format, and implement lazy loading to reduce initial page load time.",
            priority: "High",
            impact: "2-5 seconds faster load time"
        });
        list.push({
            title: "Minify CSS and JavaScript",
            description: "Remove unnecessary characters, whitespace, and comments from CSS and JavaScript files to reduce file sizes.",
            priority: "High",
            impact: "10-30% reduction in file sizes"
        });
    }

    if (data.seo < 70) {
        list.push({
            title: "Improve Meta Tags",
            description: "Add unique, descriptive title tags (50-60 chars) and meta descriptions (150-160 chars) to all pages. Include target keywords naturally.",
            priority: "High",
            impact: "Better search rankings and click-through rates"
        });
        list.push({
            title: "Fix Heading Structure",
            description: "Ensure proper heading hierarchy (H1 → H2 → H3) on all pages. Use only one H1 per page containing your main keyword.",
            priority: "Medium",
            impact: "Improved SEO and accessibility"
        });
    }

    if (data.mobile < 70) {
        list.push({
            title: "Mobile Responsive Design",
            description: "Fix responsive layout issues, ensure tap targets are at least 48x48 pixels, and use appropriate font sizes (minimum 16px) for mobile devices.",
            priority: "High",
            impact: "Better mobile user experience and rankings"
        });
    }

    if (data.accessibility < 70) {
        list.push({
            title: "Improve Accessibility",
            description: "Add descriptive alt text to all images, ensure color contrast ratio is at least 4.5:1, and add ARIA labels to interactive elements.",
            priority: "Medium",
            impact: "Reach 15% more users and improve SEO"
        });
    }

    // Always include these if we don't have 6 yet
    if (list.length < 6) {
        list.push({
            title: "Enable Browser Caching",
            description: "Configure your server to set proper cache headers for static resources (images, CSS, JS) to reduce repeat visitor load times.",
            priority: "Medium",
            impact: "50-70% faster for returning visitors"
        });
    }

    if (list.length < 6) {
        list.push({
            title: "Install SSL Certificate",
            description: "Secure your website with HTTPS to protect user data, build trust, and improve search rankings (required by Google).",
            priority: "High",
            impact: "Trust + SEO boost + security"
        });
    }

    return list.slice(0, 6);
}
