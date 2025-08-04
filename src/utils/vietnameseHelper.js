/**
 * Comprehensive Vietnamese Character Support Utilities
 * Ensures proper handling of Vietnamese characters throughout the application
 */

/**
 * Normalize Vietnamese text to ensure consistent Unicode representation
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized Vietnamese text
 */
const normalizeVietnamese = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }
    
    // Normalize to Unicode NFC (Canonical Decomposition, followed by Canonical Composition)
    // This ensures Vietnamese characters are represented consistently
    return text.normalize('NFC');
};

/**
 * Detect if text contains Vietnamese characters
 * @param {string} text - Text to check
 * @returns {boolean} - True if contains Vietnamese characters
 */
const containsVietnamese = (text) => {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    // Vietnamese character pattern (including tones and special characters)
    const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
    return vietnamesePattern.test(text);
};

/**
 * Fix common Vietnamese encoding issues
 * @param {string} text - Text that might have encoding issues
 * @returns {string} - Fixed text
 */
const fixVietnameseEncoding = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // Common double-encoding patterns for Vietnamese
    const fixes = [
        // Fix double-encoded common Vietnamese characters
        { from: /Ã¡/g, to: 'á' },
        { from: /Ã /g, to: 'à' },
        { from: /áº¡/g, to: 'ạ' },
        { from: /áº£/g, to: 'ả' },
        { from: /Ã£/g, to: 'ã' },
        { from: /Ã¢/g, to: 'â' },
        { from: /áº§/g, to: 'ầ' },
        { from: /áº¥/g, to: 'ấ' },
        { from: /áº­/g, to: 'ậ' },
        { from: /áº©/g, to: 'ẩ' },
        { from: /áº«/g, to: 'ẫ' },
        { from: /Äƒ/g, to: 'ă' },
        { from: /áº±/g, to: 'ằ' },
        { from: /áº¯/g, to: 'ắ' },
        { from: /áº·/g, to: 'ặ' },
        { from: /áº³/g, to: 'ẳ' },
        { from: /áºµ/g, to: 'ẵ' },
        { from: /Ã¨/g, to: 'è' },
        { from: /Ã©/g, to: 'é' },
        { from: /áº¹/g, to: 'ẹ' },
        { from: /áº»/g, to: 'ẻ' },
        { from: /áº½/g, to: 'ẽ' },
        { from: /Ãª/g, to: 'ê' },
        { from: /á»/g, to: 'ề' },
        { from: /áº¿/g, to: 'ế' },
        { from: /á»‡/g, to: 'ệ' },
        { from: /á»ƒ/g, to: 'ể' },
        { from: /á»…/g, to: 'ễ' },
        { from: /Ã¬/g, to: 'ì' },
        { from: /Ã­/g, to: 'í' },
        { from: /á»‹/g, to: 'ị' },
        { from: /á»‰/g, to: 'ỉ' },
        { from: /Ä©/g, to: 'ĩ' },
        { from: /Ã²/g, to: 'ò' },
        { from: /Ã³/g, to: 'ó' },
        { from: /á»/g, to: 'ọ' },
        { from: /á»/g, to: 'ỏ' },
        { from: /Ãµ/g, to: 'õ' },
        { from: /Ã´/g, to: 'ô' },
        { from: /á»/g, to: 'ồ' },
        { from: /á»'/g, to: 'ố' },
        { from: /á»™/g, to: 'ộ' },
        { from: /á»•/g, to: 'ổ' },
        { from: /á»—/g, to: 'ỗ' },
        { from: /Æ¡/g, to: 'ơ' },
        { from: /á»/g, to: 'ờ' },
        { from: /á»›/g, to: 'ớ' },
        { from: /á»£/g, to: 'ợ' },
        { from: /á»Ÿ/g, to: 'ở' },
        { from: /á»¡/g, to: 'ỡ' },
        { from: /Ã¹/g, to: 'ù' },
        { from: /Ãº/g, to: 'ú' },
        { from: /á»¥/g, to: 'ụ' },
        { from: /á»§/g, to: 'ủ' },
        { from: /Å©/g, to: 'ũ' },
        { from: /Æ°/g, to: 'ư' },
        { from: /á»«/g, to: 'ừ' },
        { from: /á»©/g, to: 'ứ' },
        { from: /á»±/g, to: 'ự' },
        { from: /á»­/g, to: 'ử' },
        { from: /á»¯/g, to: 'ữ' },
        { from: /á»³/g, to: 'ỳ' },
        { from: /Ã½/g, to: 'ý' },
        { from: /á»µ/g, to: 'ỵ' },
        { from: /á»·/g, to: 'ỷ' },
        { from: /á»¹/g, to: 'ỹ' },
        { from: /Ä'/g, to: 'đ' },
        // Uppercase variants
        { from: /Ã?/g, to: 'À' },
        { from: /Ã/g, to: 'Á' },
        { from: /áº /g, to: 'Ạ' },
        { from: /áº¢/g, to: 'Ả' },
        { from: /Ãƒ/g, to: 'Ã' },
        { from: /Ã‚/g, to: 'Â' },
        { from: /áº¦/g, to: 'Ầ' },
        { from: /áº¤/g, to: 'Ấ' },
        { from: /áº¬/g, to: 'Ậ' },
        { from: /áº¨/g, to: 'Ẩ' },
        { from: /áºª/g, to: 'Ẫ' },
        { from: /Ä‚/g, to: 'Ă' },
        { from: /áº°/g, to: 'Ằ' },
        { from: /áº®/g, to: 'Ắ' },
        { from: /áº¶/g, to: 'Ặ' },
        { from: /áº²/g, to: 'Ẳ' },
        { from: /áº´/g, to: 'Ẵ' },
        { from: /Ãˆ/g, to: 'È' },
        { from: /Ã‰/g, to: 'É' },
        { from: /áº¸/g, to: 'Ẹ' },
        { from: /áºº/g, to: 'Ẻ' },
        { from: /áº¼/g, to: 'Ẽ' },
        { from: /ÃŠ/g, to: 'Ê' },
        { from: /á»€/g, to: 'Ề' },
        { from: /áº¾/g, to: 'Ế' },
        { from: /á»†/g, to: 'Ệ' },
        { from: /á»‚/g, to: 'Ể' },
        { from: /á»„/g, to: 'Ễ' },
        { from: /ÃŒ/g, to: 'Ì' },
        { from: /Ã/g, to: 'Í' },
        { from: /á»Š/g, to: 'Ị' },
        { from: /á»ˆ/g, to: 'Ỉ' },
        { from: /Ä¨/g, to: 'Ĩ' },
        { from: /Ã'/g, to: 'Ò' },
        { from: /Ã"/g, to: 'Ó' },
        { from: /á»Œ/g, to: 'Ọ' },
        { from: /á»Ž/g, to: 'Ỏ' },
        { from: /Ã•/g, to: 'Õ' },
        { from: /Ã"/g, to: 'Ô' },
        { from: /á»'/g, to: 'Ồ' },
        { from: /á»Ž/g, to: 'Ố' },
        { from: /á»˜/g, to: 'Ộ' },
        { from: /á»"/g, to: 'Ổ' },
        { from: /á»–/g, to: 'Ỗ' },
        { from: /Æ /g, to: 'Ơ' },
        { from: /á»'/g, to: 'Ờ' },
        { from: /á»š/g, to: 'Ớ' },
        { from: /á»¢/g, to: 'Ợ' },
        { from: /á»ž/g, to: 'Ở' },
        { from: /á» /g, to: 'Ỡ' },
        { from: /Ã™/g, to: 'Ù' },
        { from: /Ãš/g, to: 'Ú' },
        { from: /á»¤/g, to: 'Ụ' },
        { from: /á»¦/g, to: 'Ủ' },
        { from: /Å¨/g, to: 'Ũ' },
        { from: /Æ¯/g, to: 'Ư' },
        { from: /á»ª/g, to: 'Ừ' },
        { from: /á»¨/g, to: 'Ứ' },
        { from: /á»°/g, to: 'Ự' },
        { from: /á»¬/g, to: 'Ử' },
        { from: /á»®/g, to: 'Ữ' },
        { from: /á»²/g, to: 'Ỳ' },
        { from: /Ã/g, to: 'Ý' },
        { from: /á»´/g, to: 'Ỵ' },
        { from: /á»¶/g, to: 'Ỷ' },
        { from: /á»¸/g, to: 'Ỹ' },
        { from: /Ä/g, to: 'Đ' }
    ];

    let fixed = text;
    
    // Apply fixes sequentially
    for (const fix of fixes) {
        fixed = fixed.replace(fix.from, fix.to);
    }

    // Normalize after fixing
    return normalizeVietnamese(fixed);
};

/**
 * Ensure text is properly encoded for Vietnamese display
 * @param {string} text - Text to process
 * @returns {string} - Properly encoded Vietnamese text
 */
const ensureVietnameseDisplay = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // First try to fix common encoding issues
    let processed = fixVietnameseEncoding(text);
    
    // Then normalize
    processed = normalizeVietnamese(processed);
    
    return processed;
};

/**
 * Process Vietnamese text for safe storage and display
 * @param {string} text - Text to process
 * @returns {string} - Processed Vietnamese text
 */
const processVietnameseText = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    // Ensure proper encoding and normalization
    return ensureVietnameseDisplay(text);
};

/**
 * Recursively process Vietnamese text in objects and arrays
 * @param {any} data - Data to process
 * @returns {any} - Data with processed Vietnamese text
 */
const processVietnameseData = (data) => {
    if (typeof data === 'string') {
        return processVietnameseText(data);
    } else if (Array.isArray(data)) {
        return data.map(processVietnameseData);
    } else if (data && typeof data === 'object') {
        const processed = {};
        for (const [key, value] of Object.entries(data)) {
            processed[key] = processVietnameseData(value);
        }
        return processed;
    }
    return data;
};

/**
 * Validate Vietnamese text for proper encoding
 * @param {string} text - Text to validate
 * @returns {object} - Validation result with status and issues
 */
const validateVietnameseText = (text) => {
    if (!text || typeof text !== 'string') {
        return { isValid: true, issues: [] };
    }

    const issues = [];
    
    // Check for common encoding issues
    if (/Ã[àáâäãåæèéêë]/g.test(text)) {
        issues.push('Detected double-encoded Vietnamese characters');
    }
    
    // Check for replacement characters
    if (/\uFFFD/g.test(text)) {
        issues.push('Contains Unicode replacement characters (�)');
    }
    
    // Check for mixed encodings
    if (/[Ã][0-9A-Fa-f]{2}/g.test(text)) {
        issues.push('Possible mixed character encoding detected');
    }

    return {
        isValid: issues.length === 0,
        issues: issues,
        containsVietnamese: containsVietnamese(text)
    };
};

module.exports = {
    normalizeVietnamese,
    containsVietnamese,
    fixVietnameseEncoding,
    ensureVietnameseDisplay,
    processVietnameseText,
    processVietnameseData,
    validateVietnameseText
};