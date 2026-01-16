// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('auditForm');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
});

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const url = document.getElementById('websiteUrl').value.trim();
    const email = document.getElementById('email').value.trim();
    const name = document.getElementById('name').value.trim() || 'User';
    
    if (!isValidUrl(url)) {
        alert('Please enter a valid URL (e.g., https://example.com)');
        return;
    }
    
    const btn = document.getElementById('analyzeBtn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    
    // Show loader
    btn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    
    try {
        console.log('Sending request to /api/analyze...');
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, email, name })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Analysis failed');
        }
        
        const results = await response.json();
        console.log('Results received:', results);
        
        // Store results in localStorage
        localStorage.setItem('auditResults', JSON.stringify(results));
        
        // Redirect to results page
        window.location.href = 'audit.html';
        
    } catch (error) {
        console.error('Error:', error);
        alert('Sorry, something went wrong. Please try again.\n\nError: ' + error.message);
        
        // Reset button
        btn.disabled = false;
        btnLoader.style.display = 'none';
        btnText.style.display = 'inline-flex';
    }
}

// Validate URL format
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});
