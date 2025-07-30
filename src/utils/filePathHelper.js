const path = require('path');

/**
 * Helper functions để xử lý file paths cho hệ thống upload mới
 */

// Helper function để tạo đường dẫn tương đối từ root project
const getRelativeFilePath = (fullPath) => {
    // Chuyển đổi từ absolute path về relative path từ thư mục gốc của project
    const projectRoot = process.cwd();
    return path.relative(projectRoot, fullPath);
};

// Helper function để tạo absolute path từ relative path
const getAbsoluteFilePath = (relativePath) => {
    const projectRoot = process.cwd();
    return path.resolve(projectRoot, relativePath);
};

// Helper function để tạo web-accessible URL cho file
const getFileWebPath = (relativePath) => {
    // Chuyển đổi path separators cho web
    return relativePath.replace(/\\/g, '/');
};

// Helper function để extract thông tin từ file path
const extractFilePathInfo = (filePath) => {
    const parts = filePath.split(path.sep);
    
    // Assuming structure: FilesXuLyNo/CBTD Name/Customer Code/Case Type/Doc Type/filename
    if (parts.length >= 6 && parts[0] === 'FilesXuLyNo') {
        return {
            cbtdName: parts[1],
            customerCode: parts[2], 
            caseType: parts[3],
            documentType: parts[4],
            fileName: parts[parts.length - 1]
        };
    }
    
    return null;
};

// Helper function để tạo breadcrumb cho file path
const getFilePathBreadcrumb = (filePath) => {
    const info = extractFilePathInfo(filePath);
    if (!info) return filePath;
    
    return [
        'Files Xử Lý Nợ',
        info.cbtdName,
        info.customerCode,
        info.caseType,
        info.documentType,
        info.fileName
    ].join(' > ');
};

module.exports = {
    getRelativeFilePath,
    getAbsoluteFilePath,
    getFileWebPath,
    extractFilePathInfo,
    getFilePathBreadcrumb
};
