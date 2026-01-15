module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { sessionId } = req.body;
        
        // Verify payment with Stripe
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({ error: 'Payment not completed' });
        }

        // Get website URL from metadata
        const url = session.metadata.website_url;
        
        // Generate detailed report (reuse analyze.js logic with more details)
        const detailedReport = await generateDetailedReport(url);

        return res.status(200).json({
            success: true,
            report: detailedReport,
            downloadUrl: `/download-pdf?session=${sessionId}`
        });

    } catch (error) {
        console.error('PDF generation error:', error);
        return res.status(500).json({ error: 'Report generation failed' });
    }
};

async function generateDetailedReport(url) {
    // This would include MORE detailed analysis
    // For now, return enhanced version
    return {
        url,
        detailedRecommendations: [
            // 20+ recommendations instead of 6-8
        ],
        competitorAnalysis: {},
        actionPlan: [],
        priorityMatrix: []
    };
}
