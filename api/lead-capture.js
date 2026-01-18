const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

module.exports = async (req, res) => {
    /* ---------- CORS ---------- */
    res.setHeader('Access-Control-Allow-Credentials', true);
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
        const { type, name, email, phone, company, message, auditResults } = req.body;

        // Validate required fields
        if (!type || !email) {
            return res.status(400).json({ error: 'Type and email are required' });
        }

        /* ---------- ENVIRONMENT VARIABLES CHECK ---------- */
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
            console.error('Supabase credentials missing');
            return res.status(500).json({ error: 'Database configuration missing' });
        }

        /* ---------- SAVE TO SUPABASE ---------- */
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );

        const leadData = {
            type,
            name: name || null,
            email,
            phone: phone || null,
            company: company || null,
            message: message || null,
            website_url: auditResults?.url || null,
            audit_score: auditResults?.overallScore || null,
            audit_data: auditResults || null,
            status: 'new',
            zoho_synced: false
        };

        console.log('Saving lead to Supabase:', { type, email });

        const { data: savedLead, error: dbError } = await supabase
            .from('leads')
            .insert([leadData])
            .select()
            .single();

        if (dbError) {
            console.error('Supabase error:', dbError);
            throw new Error('Failed to save lead');
        }

        console.log('Lead saved successfully:', savedLead.id);

        /* ---------- SEND EMAIL VIA EMAILJS ---------- */
        // Note: EmailJS is called from frontend, not backend
        // We'll trigger it from the client side

        /* ---------- SYNC TO ZOHO CRM ---------- */
        try {
            if (process.env.ZOHO_WEBHOOK_URL) {
                await syncToZoho(savedLead);
            }
        } catch (zohoError) {
            console.error('Zoho sync failed (non-critical):', zohoError.message);
            // Don't fail the request if Zoho sync fails
        }

        /* ---------- SEND NOTIFICATION EMAIL TO YOUR TEAM ---------- */
        try {
            await sendTeamNotification(leadData);
        } catch (emailError) {
            console.error('Team notification failed (non-critical):', emailError.message);
        }

        /* ---------- RESPONSE ---------- */
        return res.status(200).json({
            success: true,
            message: 'Lead captured successfully',
            leadId: savedLead.id,
            type: type
        });

    } catch (error) {
        console.error('Lead capture error:', error);
        return res.status(500).json({
            error: 'Failed to capture lead',
            message: error.message
        });
    }
};

/* ================= ZOHO CRM SYNC ================= */
async function syncToZoho(lead) {
    const webhookUrl = process.env.ZOHO_WEBHOOK_URL;
    
    if (!webhookUrl) {
        console.log('Zoho webhook URL not configured, skipping sync');
        return;
    }

    // Format data for Zapier webhook with proper name handling
    const nameParts = (lead.name || 'Website User').trim().split(' ');
    const firstName = nameParts[0] || 'Website';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';
    
    const zohoData = {
        first_name: firstName,
        last_name: lastName,
        email: lead.email,
        phone: lead.phone || '',
        company: lead.company || lead.website_url || 'Not Provided',
        description: lead.message || `${lead.type} request from website audit tool`,
        website: lead.website_url || '',
        lead_source: 'Web Download',
        lead_status: 'Attempted to Contact',
        // Additional fields as plain text in description
        audit_details: `Audit Score: ${lead.audit_score || 'N/A'}/100
Type: ${lead.type}
Performance: ${lead.audit_data?.performance || 'N/A'}
SEO: ${lead.audit_data?.seo || 'N/A'}
Mobile: ${lead.audit_data?.mobile || 'N/A'}
Accessibility: ${lead.audit_data?.accessibility || 'N/A'}`
    };

    console.log('Syncing to Zoho CRM via Make.com...', { email: zohoData.email });

    const response = await axios.post(webhookUrl, zohoData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000 // Increased to 20 seconds
    });

    console.log('Zoho sync successful via Make.com');
    return response.data;
}

/* ================= TEAM NOTIFICATION ================= */
async function sendTeamNotification(lead) {
    // This will send an email to your team when a new lead comes in
    // You can use SendGrid, AWS SES, or any email service
    
    // For now, we'll log it. You can integrate with your email service later
    console.log('New lead notification:', {
        type: lead.type,
        email: lead.email,
        name: lead.name,
        score: lead.audit_score
    });

    // Example with SendGrid (if you want to add it later):
    /*
    if (process.env.SENDGRID_API_KEY) {
        await axios.post('https://api.sendgrid.com/v3/mail/send', {
            personalizations: [{
                to: [{ email: 'your-team@digitalvint.com' }],
                subject: `New ${lead.type} Lead: ${lead.name || lead.email}`
            }],
            from: { email: 'noreply@digitalvint.com' },
            content: [{
                type: 'text/html',
                value: `
                    <h2>New Lead from Website Audit Tool</h2>
                    <p><strong>Type:</strong> ${lead.type}</p>
                    <p><strong>Name:</strong> ${lead.name || 'N/A'}</p>
                    <p><strong>Email:</strong> ${lead.email}</p>
                    <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
                    <p><strong>Company:</strong> ${lead.company || 'N/A'}</p>
                    <p><strong>Website:</strong> ${lead.website_url || 'N/A'}</p>
                    <p><strong>Audit Score:</strong> ${lead.audit_score || 'N/A'}/100</p>
                    <p><strong>Message:</strong> ${lead.message || 'N/A'}</p>
                `
            }]
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
    }
    */
}
