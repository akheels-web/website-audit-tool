const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, url, amount } = req.body;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card', 'upi'], // UPI support for Indian users!
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: 'Detailed Website Audit Report',
                            description: `Complete analysis for ${url}`,
                            images: ['https://your-vercel-url.vercel.app/report-preview.png'],
                        },
                        unit_amount: amount * 100, // Convert to paise
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/audit.html`,
            customer_email: email,
            metadata: {
                website_url: url,
                email: email,
            },
        });

        return res.status(200).json({ 
            sessionId: session.id,
            url: session.url 
        });

    } catch (error) {
        console.error('Stripe error:', error);
        return res.status(500).json({ 
            error: 'Payment creation failed',
            message: error.message 
        });
    }
};
