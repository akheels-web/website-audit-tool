const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, email, name } = req.body;

        if (!url || !email) {
            return res.status(400).json({ error: 'URL and email are required' });
        }

        // 1. Get PageSpeed Insights data
        const pageSpeedData = await getPageSpeedData(url);

        // 2. Generate AI recommendations using Gemini
        const aiRecommendations = await generateAIRecommendations(url, pageSpeedData);

        // 3. Prepare response
        const results = {
            url,
            email,
            name,
            timestamp: new Date().toISOString(),
            overallScore: pageSpeedData.overallScore,
            performance: pageSpeedData.performance,
            seo: pageSpeedData.seo,
            mobile: pageSpeedData.mobile,
            accessibility: pageSpeedData.accessibility,
            recommendations: aiRecommendations
        };

        // 4. Send email (optional - implement if EmailJS is configured)
        // await sendEmail(email, name, results);

        return res.status(200).json(results);

    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({ 
            error: 'Analysis failed', 
            message: error.message 
        });
    }
};

async function getPageSpeedData(url) {
    try {
        const apiKey = process.env.PAGESPEED_API_KEY;
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES`;

        const response = await axios.get(apiUrl, { timeout: 30000 });
        const data = response.data;

        const categories = data.lighthouseResult.categories;

        const performance = Math.round((categories.performance?.score || 0) * 100);
        const seo = Math.round((categories.seo?.score || 0) * 100);
        const accessibility = Math.round((categories.accessibility?.score || 0) * 100);
        const bestPractices = Math.round((categories['best-practices']?.score || 0) * 100);

        // Mobile is approximated from performance and best practices
        const mobile = Math.round((performance + bestPractices) / 2);

        // Overall score is average of all metrics
        const overallScore = Math.round((performance + seo + accessibility + mobile) / 4);

        return {
            overallScore,
            performance,
            seo,
            mobile,
            accessibility,
            rawData: data.lighthouseResult
        };

    } catch (error) {
        console.error('PageSpeed API error:', error);
        // Return default scores if API fails
        return {
            overallScore: 50,
            performance: 50,
            seo: 50,
            mobile: 50,
            accessibility: 50,
            rawData: null
        };
    }
}

async function generateAIRecommendations(url, pageSpeedData) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const prompt = `You are a website optimization expert. Analyze this website audit data and provide 6-8 actionable recommendations.

Website URL: ${url}
Performance Score: ${pageSpeedData.performance}/100
SEO Score: ${pageSpeedData.seo}/100
Mobile Score: ${pageSpeedData.mobile}/100
Accessibility Score: ${pageSpeedData.accessibility}/100

Provide recommendations in this exact JSON format:
[
  {
    "title": "Short recommendation title",
    "description": "Detailed explanation of the issue and how to fix it",
    "priority": "High|Medium|Low",
    "impact": "What improvement this will bring"
  }
]

Focus on:
1. Performance optimization (image optimization, caching, minification)
2. SEO improvements (meta tags, structured data, mobile-friendliness)
3. Accessibility fixes (alt tags, ARIA labels, contrast)
4. Mobile experience enhancements
5. Security best practices
6. User experience improvements

Return ONLY valid JSON array, no other text.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const recommendations = JSON.parse(jsonMatch[0]);
            return recommendations;
        }

        // Fallback recommendations if AI fails
        return getFallbackRecommendations(pageSpeedData);

    } catch (error) {
        console.error('Gemini AI error:', error);
        return getFallbackRecommendations(pageSpeedData);
    }
}

function getFallbackRecommendations(pageSpeedData) {
    const recommendations = [];

    if (pageSpeedData.performance < 70) {
        recommendations.push({
            title: "Optimize Images",
            description: "Large images are slowing down your website. Compress images using tools like TinyPNG or convert to modern formats like WebP. Aim to reduce image sizes by 60-80% without quality loss.",
            priority: "High",
            impact: "Can improve page load speed by 2-5 seconds"
        });

        recommendations.push({
            title: "Enable Browser Caching",
            description: "Configure your server to cache static resources (CSS, JS, images) for longer periods. This reduces server requests for returning visitors and speeds up page loads.",
            priority: "High",
            impact: "50% faster load times for return visitors"
        });
    }

    if (pageSpeedData.seo < 70) {
        recommendations.push({
            title: "Add Missing Meta Tags",
            description: "Your website is missing important meta tags like meta description, Open Graph tags, and Twitter cards. These help search engines understand your content and improve click-through rates.",
            priority: "High",
            impact: "Better search rankings and social media sharing"
        });

        recommendations.push({
            title: "Implement Structured Data",
            description: "Add JSON-LD structured data to help search engines better understand your business. This can enable rich snippets in search results (ratings, prices, events).",
            priority: "Medium",
            impact: "Enhanced search appearance and 20-30% higher CTR"
        });
    }

    if (pageSpeedData.mobile < 70) {
        recommendations.push({
            title: "Improve Mobile Responsiveness",
            description: "Your website has mobile usability issues. Ensure text is readable without zooming, tap targets are appropriately sized (48x48px minimum), and content fits the screen width.",
            priority: "High",
            impact: "Better mobile user experience and rankings"
        });
    }

    if (pageSpeedData.accessibility < 70) {
        recommendations.push({
            title: "Fix Accessibility Issues",
            description: "Add alt text to all images, ensure sufficient color contrast (4.5:1 for normal text), and add ARIA labels to interactive elements. This makes your site usable for everyone.",
            priority: "Medium",
            impact: "Reach 15% more users and comply with standards"
        });
    }

    recommendations.push({
        title: "Minify CSS and JavaScript",
        description: "Reduce file sizes by removing unnecessary characters, whitespace, and comments from your CSS and JavaScript files. Use tools like UglifyJS or online minifiers.",
        priority: "Medium",
        impact: "10-30% reduction in page size"
    });

    recommendations.push({
        title: "Add SSL Certificate",
        description: "If not already installed, add an SSL certificate (HTTPS) to your website. This is now a ranking factor and essential for user trust and security.",
        priority: "High",
        impact: "Better SEO rankings and user trust"
    });

    return recommendations.slice(0, 6);
}
