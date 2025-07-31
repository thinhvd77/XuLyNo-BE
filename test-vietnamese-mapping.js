// Test Vietnamese mapping functions
const getVietnameseStatus = (status) => {
    const statusMapping = {
        // English values
        'beingFollowedUp': 'Đang đôn đốc',
        'completed': 'Hoàn thành',
        'new': 'Mới',
        'processing': 'Đang xử lý',
        'overdue': 'Quá hạn',
        'pending': 'Chờ xử lý',
        'rejected': 'Từ chối',
        'approved': 'Đã duyệt',
        // Vietnamese values (pass through)
        'Đang đôn đốc': 'Đang đôn đốc',
        'Đang xử lý': 'Đang xử lý',
        'Mới': 'Mới',
        'Hoàn thành': 'Hoàn thành',
        'Quá hạn': 'Quá hạn',
        'Chờ xử lý': 'Chờ xử lý',
        'Từ chối': 'Từ chối',
        'Đã duyệt': 'Đã duyệt'
    };
    return statusMapping[status] || status;
};

const getVietnameseCaseType = (caseType) => {
    const caseTypeMapping = {
        // English values
        'internal': 'Nội bảng',
        'external': 'Ngoại bảng',
        'onBalance': 'Nội bảng',
        'offBalance': 'Ngoại bảng',
        // Vietnamese values (pass through)
        'Nội bảng': 'Nội bảng',
        'Ngoại bảng': 'Ngoại bảng'
    };
    return caseTypeMapping[caseType] || caseType;
};

// Test cases
console.log('=== Testing Status Mapping ===');
console.log('beingFollowedUp ->', getVietnameseStatus('beingFollowedUp'));
console.log('completed ->', getVietnameseStatus('completed'));
console.log('Đang xử lý ->', getVietnameseStatus('Đang xử lý'));
console.log('unknownStatus ->', getVietnameseStatus('unknownStatus'));

console.log('\n=== Testing Case Type Mapping ===');
console.log('internal ->', getVietnameseCaseType('internal'));
console.log('external ->', getVietnameseCaseType('external'));
console.log('Nội bảng ->', getVietnameseCaseType('Nội bảng'));
console.log('unknownType ->', getVietnameseCaseType('unknownType'));

// Test sample data
const sampleData = [
    { debt_cases_state: 'beingFollowedUp', debt_cases_case_type: 'internal' },
    { debt_cases_state: 'Hoàn thành', debt_cases_case_type: 'Ngoại bảng' },
    { debt_cases_state: 'completed', debt_cases_case_type: 'external' }
];

console.log('\n=== Testing Sample Data Conversion ===');
sampleData.forEach((item, index) => {
    console.log(`Item ${index + 1}:`);
    console.log(`  Original: ${item.debt_cases_state} | ${item.debt_cases_case_type}`);
    console.log(`  Converted: ${getVietnameseStatus(item.debt_cases_state)} | ${getVietnameseCaseType(item.debt_cases_case_type)}`);
});
