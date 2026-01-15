// Configuration - Replace with your actual API keys
const CONFIG = {
    GEMINI_API_KEY: 'AIzaSyATnKVuskzKnY7abfs3AA1zM0Nh5ItR11w',
    PAGESPEED_API_KEY: 'AIzaSyDcrKlFSjvVbxDej2QWR8zxJTvEI410qkw',
    EMAILJS_SERVICE_ID: 'service_ilsc3fs',
    EMAILJS_TEMPLATE_ID: 'template_q487fnh',
    EMAILJS_PUBLIC_KEY: 'Sb4pCt7LOQI8Yde6z'
};

// Form submission handler
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('auditForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
});

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const url = document.getElementById('websiteUrl').value.trim();
    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('name').value.trim() || 'User';
    
    // Validate URL
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    // Update button state
    const btn = document.getElementById('analyzeBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    
    try {
        // Call the analysis API
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, email, name })
        });
        
        if (!response.ok) {
            throw new Error('Analysis failed');
        }
        
        const results = await response.json();
        
        // Store results in localStorage
        localStorage.setItem('auditResults', JSON.stringify(results));
        
        // Redirect to results page
        window.location.href = 'audit.html';
        
    } catch (error) {
        console.error('Error:', error);
        alert('Sorry, something went wrong. Please try again or contact support.');
    } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}
// Payment handler for unlock button
if (document.getElementById('unlockReportBtn')) {
    document.getElementById('unlockReportBtn').addEventListener('click', async function() {
        const results = JSON.parse(localStorage.getItem('auditResults'));
        
        if (!results) {
            alert('Session expired. Please run audit again.');
            window.location.href = 'index.html';
            return;
        }

        const button = this;
        button.disabled = true;
        button.innerHTML = '<span class="spinner"></span> Redirecting to payment...';

        try {
            const response = await fetch('/api/create-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: results.email,
                    url: results.url,
                    amount: 499 // ₹499
                })
            });

            const data = await response.json();
            
            if (data.url) {
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            } else {
                throw new Error('Payment session creation failed');
            }

        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed. Please try again or contact support.');
            button.disabled = false;
            button.innerHTML = '🔓 Unlock Full Report Now';
        }
    });
}
