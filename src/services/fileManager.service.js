/**
 * File management utilities cho hệ thống upload mới
 */

const fs = require('fs');
const path = require('path');
const { getAbsoluteFilePath } = require('../utils/filePathHelper');

/**
 * Lấy cấu trúc cây thư mục cho một CBTD
 */
const getDirectoryStructure = (cbtdName) => {
    const baseDir = path.join('FilesXuLyNo', cbtdName);
    const absoluteBaseDir = getAbsoluteFilePath(baseDir);
    
    if (!fs.existsSync(absoluteBaseDir)) {
        return { cbtdName, customers: [] };
    }
    
    const structure = {
        cbtdName,
        customers: []
    };
    
    try {
        const customerDirs = fs.readdirSync(absoluteBaseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        for (const customerCode of customerDirs) {
            const customerDir = path.join(absoluteBaseDir, customerCode);
            const customer = {
                customerCode,
                caseTypes: []
            };
            
            if (fs.existsSync(customerDir)) {
                const caseTypeDirs = fs.readdirSync(customerDir, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => dirent.name);
                
                for (const caseType of caseTypeDirs) {
                    const caseTypeDir = path.join(customerDir, caseType);
                    const caseTypeObj = {
                        caseType,
                        documentTypes: []
                    };
                    
                    if (fs.existsSync(caseTypeDir)) {
                        const docTypeDirs = fs.readdirSync(caseTypeDir, { withFileTypes: true })
                            .filter(dirent => dirent.isDirectory())
                            .map(dirent => dirent.name);
                        
                        for (const docType of docTypeDirs) {
                            const docTypeDir = path.join(caseTypeDir, docType);
                            const docTypeObj = {
                                documentType: docType,
                                files: []
                            };
                            
                            if (fs.existsSync(docTypeDir)) {
                                docTypeObj.files = fs.readdirSync(docTypeDir, {withFileTypes: true})
                                    .filter(dirent => dirent.isFile())
                                    .map(dirent => {
                                        const filePath = path.join(docTypeDir, dirent.name);
                                        const stats = fs.statSync(filePath);
                                        return {
                                            fileName: dirent.name,
                                            size: stats.size,
                                            modifiedDate: stats.mtime,
                                            relativePath: path.relative(process.cwd(), filePath)
                                        };
                                    });
                            }
                            
                            caseTypeObj.documentTypes.push(docTypeObj);
                        }
                    }
                    
                    customer.caseTypes.push(caseTypeObj);
                }
            }
            
            structure.customers.push(customer);
        }
    } catch (error) {
        console.error('Error reading directory structure:', error);
    }
    
    return structure;
};

/**
 * Lấy thống kê storage cho toàn hệ thống
 */
const getStorageStats = () => {
    const baseDir = getAbsoluteFilePath('FilesXuLyNo');
    
    if (!fs.existsSync(baseDir)) {
        return {
            totalFiles: 0,
            totalSize: 0,
            cbtdCount: 0,
            customerCount: 0
        };
    }
    
    let totalFiles = 0;
    let totalSize = 0;
    let cbtdCount = 0;
    let customerCount = 0;
    
    try {
        const cbtdDirs = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory());
        
        cbtdCount = cbtdDirs.length;
        
        for (const cbtdDir of cbtdDirs) {
            const cbtdPath = path.join(baseDir, cbtdDir.name);
            
            if (fs.existsSync(cbtdPath)) {
                const customerDirs = fs.readdirSync(cbtdPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory());
                
                customerCount += customerDirs.length;
                
                // Recursively count files and sizes
                const walkDir = (dir) => {
                    const items = fs.readdirSync(dir, { withFileTypes: true });
                    
                    for (const item of items) {
                        const itemPath = path.join(dir, item.name);
                        
                        if (item.isDirectory()) {
                            walkDir(itemPath);
                        } else if (item.isFile()) {
                            totalFiles++;
                            const stats = fs.statSync(itemPath);
                            totalSize += stats.size;
                        }
                    }
                };
                
                walkDir(cbtdPath);
            }
        }
    } catch (error) {
        console.error('Error calculating storage stats:', error);
    }
    
    return {
        totalFiles,
        totalSize,
        totalSizeFormatted: formatFileSize(totalSize),
        cbtdCount,
        customerCount
    };
};

/**
 * Format file size to human-readable format
 */
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Cleanup empty directories
 */
const cleanupEmptyDirectories = (dirPath) => {
    if (!fs.existsSync(dirPath)) return;
    
    try {
        const items = fs.readdirSync(dirPath);
        
        // Recursively cleanup subdirectories first
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                cleanupEmptyDirectories(itemPath);
            }
        }
        
        // Check if directory is empty after cleanup
        const updatedItems = fs.readdirSync(dirPath);
        if (updatedItems.length === 0) {
            fs.rmdirSync(dirPath);
            console.log('Removed empty directory:', dirPath);
        }
    } catch (error) {
        console.error('Error cleaning up directory:', dirPath, error);
    }
};

module.exports = {
    getDirectoryStructure,
    getStorageStats,
    formatFileSize,
    cleanupEmptyDirectories
};
