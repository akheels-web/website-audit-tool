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
    btnLoader.style.display = 'flex';

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, email, name })
        });
        
        if (!response.ok) {
            throw new Error('Analysis failed');
        }
        
        const results = await response.json();
        localStorage.setItem('auditResults', JSON.stringify(results));
        window.location.href = 'audit.html';
        
    } catch (error) {
        console.error('Error:', error);
        alert('Sorry, something went wrong. Please try again or contact support.');
        
    } finally {
        // Reset button (always)
        btn.disabled = false;
        btnLoader.style.display = 'none';
        btnText.style.display = 'flex';
    }
}
