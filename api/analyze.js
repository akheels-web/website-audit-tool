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

/* ================= GEMINI 1.5 FLASH ================= */

async function generateAIRecommendations(url, pageSpeedData) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        // Using Gemini 1.5 Flash with correct v1beta endpoint
        const apiUrl =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

        const prompt = `
Analyze this website and give 6 actionable recommendations.

URL: ${url}
Performance: ${pageSpeedData.performance}
SEO: ${pageSpeedData.seo}
Mobile: ${pageSpeedData.mobile}
Accessibility: ${pageSpeedData.accessibility}

Return ONLY valid JSON array with exactly 6 recommendations:
[
 { "title":"Recommendation Title", "description":"Detailed description", "priority":"High", "impact":"Expected impact" }
]

Do not include any markdown formatting or code blocks, just the JSON array.
`;

        console.log('Calling Gemini API for recommendations...');

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

        console.log('Gemini raw response:', text);

        // Extract JSON from response (handles cases where AI adds markdown)
        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (!jsonMatch) {
            console.error("Invalid AI response - no JSON found:", text);
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
            description: "Compress images, use WebP format, and implement lazy loading to reduce page load time.",
            priority: "High",
            impact: "2–5s faster load time"
        });
    }

    if (data.seo < 70) {
        list.push({
            title: "Fix Meta Tags",
            description: "Add proper title tags, meta descriptions, and Open Graph tags for better search visibility.",
            priority: "High",
            impact: "Better search rankings"
        });
    }

    if (data.mobile < 70) {
        list.push({
            title: "Mobile Optimization",
            description: "Fix responsive layout issues and adjust font sizes for better mobile user experience.",
            priority: "High",
            impact: "Better mobile UX"
        });
    }

    if (data.accessibility < 70) {
        list.push({
            title: "Improve Accessibility",
            description: "Add alt text to images, improve color contrast, and add ARIA labels for screen readers.",
            priority: "Medium",
            impact: "Wider audience reach"
        });
    }

    list.push({
        title: "Enable HTTPS",
        description: "Install SSL certificate to secure your website and improve trust with visitors.",
        priority: "High",
        impact: "Trust + SEO boost"
    });

    list.push({
        title: "Minify CSS and JavaScript",
        description: "Reduce file sizes by removing unnecessary characters and whitespace from code.",
        priority: "Medium",
        impact: "Faster page loads"
    });

    return list.slice(0, 6);
}
