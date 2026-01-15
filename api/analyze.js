const axios = require('axios');

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

        console.log('Received request:', { url, email, name });

        if (!url || !email) {
            return res.status(400).json({ error: 'URL and email are required' });
        }

        // Validate environment variables
        if (!process.env.PAGESPEED_API_KEY) {
            console.error('PAGESPEED_API_KEY is missing');
            return res.status(500).json({ error: 'Server configuration error: PageSpeed API key missing' });
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is missing');
            return res.status(500).json({ error: 'Server configuration error: Gemini API key missing' });
        }

        // 1. Get PageSpeed Insights data
        console.log('Fetching PageSpeed data...');
        const pageSpeedData = await getPageSpeedData(url);
        console.log('PageSpeed data received:', pageSpeedData);

        // 2. Generate AI recommendations
        console.log('Generating AI recommendations...');
        const aiRecommendations = await generateAIRecommendations(url, pageSpeedData);
        console.log('AI recommendations generated');

        // 3. Prepare response
        const results = {
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
        };

        console.log('Sending results');
        return res.status(200).json(results);

    } catch (error) {
        console.error('Analysis error:', error);
        return res.status(500).json({ 
            error: 'Analysis failed', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

async function getPageSpeedData(url) {
    try {
        const apiKey = process.env.PAGESPEED_API_KEY;
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&category=PERFORMANCE&category=SEO&category=ACCESSIBILITY&category=BEST_PRACTICES`;

        console.log('Calling PageSpeed API...');
        const response = await axios.get(apiUrl, { 
            timeout: 60000 // 60 second timeout
        });
        
        const data = response.data;
        const categories = data.lighthouseResult.categories;

        const performance = Math.round((categories.performance?.score || 0) * 100);
        const seo = Math.round((categories.seo?.score || 0) * 100);
        const accessibility = Math.round((categories.accessibility?.score || 0) * 100);
        const bestPractices = Math.round((categories['best-practices']?.score || 0) * 100);

        const mobile = Math.round((performance + bestPractices) / 2);
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
        console.error('PageSpeed API error:', error.message);
        
        // Return fallback scores if API fails
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
        const apiKey = process.env.GEMINI_API_KEY;
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

        const prompt = `You are a website optimization expert. Analyze this website audit data and provide 6 actionable recommendations.

Website URL: ${url}
Performance Score: ${pageSpeedData.performance}/100
SEO Score: ${pageSpeedData.seo}/100
Mobile Score: ${pageSpeedData.mobile}/100
Accessibility Score: ${pageSpeedData.accessibility}/100

Provide recommendations in this exact JSON format (return ONLY valid JSON, no markdown formatting):
[
  {
    "title": "Short recommendation title",
    "description": "Detailed explanation of the issue and how to fix it",
    "priority": "High",
    "impact": "What improvement this will bring"
  }
]

Focus on the weakest areas first. Keep descriptions practical and actionable.`;

        const response = await axios.post(
            `${apiUrl}?key=${apiKey}`,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const text = response.data.candidates[0].content.parts[0].text;
        console.log('Gemini response:', text);

        // Extract JSON from response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const recommendations = JSON.parse(jsonMatch[0]);
            return recommendations.slice(0, 6); // Limit to 6 recommendations
        }

        throw new Error('Could not parse AI response');

    } catch (error) {
        console.error('Gemini AI error:', error.message);
        
        // Return fallback recommendations
        return getFallbackRecommendations(pageSpeedData);
    }
}

function getFallbackRecommendations(pageSpeedData) {
    const recommendations = [];

    if (pageSpeedData.performance < 70) {
        recommendations.push({
            title: "Optimize Images for Faster Loading",
            description: "Your images are slowing down your website significantly. Compress all images using tools like TinyPNG or Squoosh. Convert images to modern WebP format which is 30% smaller than JPEG. Implement lazy loading so images only load when users scroll to them.",
            priority: "High",
            impact: "Can improve page load speed by 2-5 seconds, reducing bounce rate by 20-30%"
        });

        recommendations.push({
            title: "Enable Browser Caching",
            description: "Configure your server to cache static resources (CSS, JavaScript, images) for longer periods. Add cache-control headers with expiry times of at least 1 year for static assets. This dramatically speeds up your site for returning visitors.",
            priority: "High",
            impact: "50% faster load times for return visitors"
        });

        recommendations.push({
            title: "Minify CSS and JavaScript Files",
            description: "Your CSS and JavaScript files contain unnecessary whitespace and comments. Use tools like UglifyJS or online minifiers to reduce file sizes by 30-50%. This reduces bandwidth usage and speeds up parsing.",
            priority: "Medium",
            impact: "10-30% reduction in page size, faster initial load"
        });
    }

    if (pageSpeedData.seo < 70) {
        recommendations.push({
            title: "Add Essential Meta Tags",
            description: "Your website is missing important meta tags. Add meta description (150-160 characters), Open Graph tags for social sharing, and Twitter Card tags. Include title tags on all pages (50-60 characters) with target keywords.",
            priority: "High",
            impact: "Better search rankings, 15-25% higher click-through rates from search results"
        });

        recommendations.push({
            title: "Implement Structured Data (Schema Markup)",
            description: "Add JSON-LD structured data to help search engines understand your business better. Include Organization schema, LocalBusiness schema, and Service schema. This enables rich snippets in Google search results.",
            priority: "Medium",
            impact: "Enhanced search appearance with ratings, prices, and business info. 20-30% higher CTR"
        });
    }

    if (pageSpeedData.mobile < 70) {
        recommendations.push({
            title: "Fix Mobile Responsiveness Issues",
            description: "Your website has critical mobile usability problems. Ensure all text is readable without zooming (minimum 16px font size). Make tap targets at least 48x48 pixels. Remove horizontal scrolling. Use CSS media queries to adapt layout for mobile screens.",
            priority: "High",
            impact: "Better mobile rankings (60% of traffic is mobile), improved user experience"
        });
    }

    if (pageSpeedData.accessibility < 70) {
        recommendations.push({
            title: "Improve Website Accessibility",
            description: "Add descriptive alt text to all images. Ensure color contrast ratio of at least 4.5:1 for normal text and 3:1 for large text. Add ARIA labels to buttons and form elements. Make sure all functionality is keyboard accessible.",
            priority: "Medium",
            impact: "Reach 15% more users, better SEO, legal compliance with accessibility standards"
        });
    }

    recommendations.push({
        title: "Install SSL Certificate (HTTPS)",
        description: "If your site doesn't have HTTPS, install an SSL certificate immediately. HTTPS is now a ranking factor and shows a 'Not Secure' warning without it. Most hosts offer free Let's Encrypt certificates.",
        priority: "High",
        impact: "Better SEO rankings, increased user trust, required for modern web features"
    });

    recommendations.push({
        title: "Optimize Server Response Time",
        description: "Your server is taking too long to respond. Consider upgrading hosting, implementing server-side caching, optimizing database queries, and using a CDN (Content Delivery Network) to serve static files faster globally.",
        priority: "Medium",
        impact: "Faster initial page load, better user experience, improved SEO"
    });

    return recommendations.slice(0, 6);
}
