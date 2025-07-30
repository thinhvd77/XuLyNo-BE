// Test script for User Toggle Status API
// Run: node test-toggle-status.js

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000';
const TEST_USER_ID = 'EMP001'; // Replace with actual user employee_code
const TEST_TOKEN = 'your-jwt-token-here'; // Replace with actual token

const testToggleStatus = async () => {
    try {
        console.log('Testing User Toggle Status API...');
        console.log(`Target User ID: ${TEST_USER_ID}`);
        
        const response = await fetch(`${API_BASE_URL}/api/users/${TEST_USER_ID}/status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(result, null, 2));
        
        if (response.ok && result.success) {
            console.log('✅ SUCCESS: User status toggled successfully');
            console.log(`New status: ${result.user.status}`);
        } else {
            console.log('❌ FAILED: API call failed');
            console.log('Error:', result.message);
        }
        
    } catch (error) {
        console.error('❌ ERROR: Network or parsing error');
        console.error(error.message);
    }
};

// Run test
testToggleStatus();
