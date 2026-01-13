# Website Audit Tool - Digital Vint

Free AI-powered website audit tool built with Next.js and deployed on Vercel.

## Setup Instructions

### 1. Get API Keys (All FREE)

#### Gemini API Key:
1. Go to https://aistudio.google.com/app/apikey
2. Sign in and create API key
3. Copy the key

#### PageSpeed API Key:
1. Go to https://console.cloud.google.com/
2. Create project
3. Enable PageSpeed Insights API
4. Create credentials (API Key)
5. Copy the key

#### EmailJS (Optional):
1. Go to https://www.emailjs.com/
2. Sign up and setup Gmail service
3. Get Service ID, Template ID, and Public Key

### 2. Deploy to Vercel

1. Push this code to GitHub
2. Go to https://vercel.com
3. Click "New Project"
4. Import your GitHub repository
5. Add environment variables:
   - `GEMINI_API_KEY`: Your Gemini API key
   - `PAGESPEED_API_KEY`: Your PageSpeed API key
6. Click "Deploy"

### 3. Configure Domain (Optional)

To use `audit.digitalvint.com`:
1. Go to your Vercel project settings
2. Add domain: `audit.digitalvint.com`
3. Go to GoDaddy DNS settings
4. Add CNAME record:
   - Name: `audit`
   - Value: `cname.vercel-dns.com`

## Features

- ✅ AI-powered website analysis
- ✅ Performance scoring
- ✅ SEO recommendations
- ✅ Mobile-friendliness check
- ✅ Accessibility audit
- ✅ Lead capture
- ✅ Email reports
- ✅ Beautiful UI

## Cost

- Hosting: FREE (Vercel)
- Gemini API: FREE (1,500 requests/day)
- PageSpeed API: FREE (25,000 requests/day)
- Total: ₹0/month

## Support

For issues, contact: your-email@digitalvint.com
