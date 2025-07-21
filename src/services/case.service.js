const { AppDataSource } = require('../config/dataSource');

// Lấy repository cho cả hai entity
// const caseDocumentRepository = AppDataSource.getRepository('CaseDocument');

/**
 * Thêm một tài liệu mới vào hồ sơ
 */
// exports.addDocumentToCase = async (caseId, fileInfo, uploader) => {
//   const newDocumentData = {
//     case_id: caseId,
//     original_filename: fileInfo.originalname,
//     file_path: fileInfo.path,
//     mime_type: fileInfo.mimetype,
//     file_size: fileInfo.size,
//     document_type: 'Khác', 
//     uploaded_by_employee_code: uploader.employee_code,
//   };

//   const document = caseDocumentRepository.create(newDocumentData);
//   await caseDocumentRepository.save(document);
//   return document;
// };

/**
 * MỚI: Tìm tất cả hồ sơ được phân công cho một nhân viên cụ thể
 */
exports.findCasesByEmployeeCode = async (employeeCode) => {
  const caseRepository = AppDataSource.getRepository("DebtCase");
  const cases = await caseRepository.find({
    where: {
      assigned_employee_code: employeeCode,
    },
    order: {
      last_modified_date: 'DESC', // Sắp xếp theo ngày cập nhật mới nhất
    },
  });
  return cases;
};