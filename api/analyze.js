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

        return {
            overallScore,
            performance,
            seo,
            mobile,
            accessibility
        };

    } catch (err) {
        console.error("PageSpeed API error:", err.message);

        return {
            overallScore: 50,
            performance: 50,
            seo: 50,
            mobile: 50,
            accessibility: 50
        };
    }
}

/* ================= GEMINI ================= */

async function generateAIRecommendations(url, pageSpeedData) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        const prompt = `
Analyze this website and give 6 actionable recommendations.

URL: ${url}
Performance: ${pageSpeedData.performance}
SEO: ${pageSpeedData.seo}
Mobile: ${pageSpeedData.mobile}
Accessibility: ${pageSpeedData.accessibility}

Return ONLY valid JSON array:
[
 { "title":"", "description":"", "priority":"High", "impact":"" }
]
`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
            {
                contents: [{ parts: [{ text: prompt }] }]
            },
            { timeout: 30000 }
        );

        const text =
            response.data.candidates[0].content.parts[0].text;

        const jsonMatch = text.match(/\[[\s\S]*\]/);

        if (!jsonMatch) throw new Error("JSON parse failed");

        return JSON.parse(jsonMatch[0]).slice(0, 6);

    } catch (err) {
        console.error("Gemini error:", err.message);
        return getFallbackRecommendations(pageSpeedData);
    }
}

/* ================= FALLBACK ================= */

function getFallbackRecommendations(data) {

    const list = [];

    if (data.performance < 70) {
        list.push({
            title: "Optimize Images",
            description: "Compress images, use WebP, lazy loading.",
            priority: "High",
            impact: "2–5s faster load"
        });
    }

    if (data.seo < 70) {
        list.push({
            title: "Fix Meta Tags",
            description: "Add title, meta description, OG tags.",
            priority: "High",
            impact: "Better rankings"
        });
    }

    if (data.mobile < 70) {
        list.push({
            title: "Mobile Optimization",
            description: "Fix responsive layout and font sizes.",
            priority: "High",
            impact: "Better mobile UX"
        });
    }

    if (data.accessibility < 70) {
        list.push({
            title: "Accessibility",
            description: "Add alt text, contrast, ARIA labels.",
            priority: "Medium",
            impact: "Wider audience"
        });
    }

    list.push({
        title: "Enable HTTPS",
        description: "Install SSL certificate.",
        priority: "High",
        impact: "Trust + SEO"
    });

    return list.slice(0, 6);
}
