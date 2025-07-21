const caseService = require('../services/case.service');

/**
 * Xử lý việc upload tài liệu
 */
// exports.uploadDocument = async (req, res) => {
//   try {
//     const caseId = req.params.caseId;
//     const uploader = req.user; 
//     const file = req.file;

//     if (!file) {
//       return res.status(400).json({ message: 'Vui lòng chọn một file để tải lên.' });
//     }

//     const documentRecord = await caseService.addDocumentToCase(caseId, file, uploader);

//     res.status(201).json({ 
//       message: 'Tải file lên thành công!', 
//       document: documentRecord 
//     });

//   } catch (error) {
//     console.error('Lỗi khi tải file:', error);
//     res.status(500).json({ message: 'Đã có lỗi xảy ra trên server.' });
//   }
// };

/**
 * MỚI: Lấy danh sách hồ sơ của người dùng đang đăng nhập
 */
exports.getMyCases = async (req, res) => {
    try {
        // req.user được Passport.js thêm vào sau khi xác thực JWT thành công
        const employeeCode = req.user.employee_code;

        if (!employeeCode) {
            return res.status(400).json({ message: 'Không tìm thấy thông tin nhân viên.' });
        }

        const cases = await caseService.findCasesByEmployeeCode(employeeCode);
        res.status(200).json(cases);

    } catch (error) {
        console.error('Lỗi khi lấy danh sách hồ sơ:', error);
        res.status(500).json({ message: 'Đã có lỗi xảy ra trên server.' });
    }
};