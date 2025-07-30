const AppDataSource = require("../config/dataSource");
const bcrypt = require("bcrypt");
const { Not } = require("typeorm");
const User = require("../models/User").User;
const { createChildLogger } = require("../config/logger");

const logger = createChildLogger("user.service");

/**
 * Tạo một CBTD mới
 * @param {object} userData - Dữ liệu người dùng từ controller
 */
exports.createUser = async (userData) => {
    const userRepository = AppDataSource.getRepository("User");
    const { username, employee_code, password } = userData;

    // 1. Kiểm tra username hoặc mã nhân viên đã tồn tại chưa
    const existingUser = await userRepository.findOne({
        where: [{ username }, { employee_code }],
    });
    if (existingUser) {
        throw new Error("Tên đăng nhập hoặc Mã nhân viên đã tồn tại.");
    }

    // 2. Băm mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Tạo và lưu người dùng mới
    const newUser = userRepository.create({
        ...userData,
        password: hashedPassword,
    });

    await userRepository.save(newUser);

    // 4. Trả về dữ liệu người dùng (loại bỏ mật khẩu)
    const { password: _, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
};

exports.getAllUsers = async (user_employee_code) => {
    const userRepository = AppDataSource.getRepository("User");
    return await userRepository.find({
        where: {
            employee_code: Not(user_employee_code)
        },
        // sắp xếp theo thời gian tạo mới nhất
        order: {
            created_at: "DESC"
        }
    });
};

exports.getUserById = async (id) => {
    const userRepository = AppDataSource.getRepository("User");
    const user = await userRepository.findOne({
        where: { employee_code: id },
    });

    if (!user) {
        throw new Error("Người dùng không tồn tại.");
    }

    // Trả về dữ liệu người dùng (loại bỏ mật khẩu)
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

/**
 * Update user by ID
 * @param {string} id - Employee code của user cần update
 * @param {object} updateData - Dữ liệu cần cập nhật
 */
exports.updateUser = async (id, updateData) => {
    const userRepository = AppDataSource.getRepository("User");
    
    // 1. Tìm user cần update
    const existingUser = await userRepository.findOne({
        where: { employee_code: id },
    });

    if (!existingUser) {
        throw new Error("Người dùng không tìm thấy.");
    }

    // 2. Kiểm tra username và employee_code có bị trùng với user khác không
    if (updateData.username && updateData.username !== existingUser.username) {
        const userWithSameUsername = await userRepository.findOne({
            where: { 
                username: updateData.username,
                employee_code: Not(id) // Loại trừ user hiện tại
            },
        });
        if (userWithSameUsername) {
            throw new Error("Tên đăng nhập đã tồn tại.");
        }
    }

    if (updateData.employee_code && updateData.employee_code !== existingUser.employee_code) {
        const userWithSameEmployeeCode = await userRepository.findOne({
            where: { 
                employee_code: updateData.employee_code,
                employee_code: Not(id) // Loại trừ user hiện tại
            },
        });
        if (userWithSameEmployeeCode) {
            throw new Error("Mã nhân viên đã tồn tại.");
        }
    }

    // 3. Băm mật khẩu mới nếu có
    if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // 4. Cập nhật user
    await userRepository.update(
        { employee_code: id },
        updateData
    );

    // 5. Lấy user đã được cập nhật
    const updatedUser = await userRepository.findOne({
        where: { employee_code: updateData.employee_code || id },
    });

    // 6. Trả về dữ liệu user (loại bỏ mật khẩu)
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
};

/**
 * Toggle user status (active/disabled)
 * @param {string} id - Employee code của user cần toggle status
 */
exports.toggleUserStatus = async (id) => {
    const userRepository = AppDataSource.getRepository("User");
    
    // 1. Tìm user cần toggle status
    const existingUser = await userRepository.findOne({
        where: { employee_code: id },
    });

    if (!existingUser) {
        throw new Error("Người dùng không tìm thấy.");
    }

    // 2. Toggle status: active <-> disabled
    const newStatus = existingUser.status === 'active' ? 'disabled' : 'active';

    // 3. Cập nhật status
    await userRepository.update(
        { employee_code: id },
        { status: newStatus }
    );

    // 4. Lấy user đã được cập nhật
    const updatedUser = await userRepository.findOne({
        where: { employee_code: id },
    });

    // 5. Trả về dữ liệu user (loại bỏ mật khẩu)
    const { password: _, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
};

/**
 * MỚI: Tìm nhân viên theo phòng ban và chi nhánh của người quản lý
 * @param {object} manager - Thông tin người quản lý đang đăng nhập
 */
exports.findOfficersByManager = async (manager) => {
    const userRepository = AppDataSource.getRepository("User");
    const officers = await userRepository.find({
        where: {
            dept: manager.dept, // Cùng phòng ban
            branch_code: manager.branch_code, // Cùng chi nhánh
            // Lấy các vai trò cấp dưới, ví dụ 'Nhân viên'
            role: "employee",
            // Loại trừ chính người quản lý ra khỏi danh sách
            employee_code: Not(manager.employee_code),
        },
        select: ["employee_code", "fullname", "username", "dept", "role"], // Chỉ trả về các trường an toàn
    });
    return officers;
};

// Xóa người dùng theo ID
exports.deleteUserById = async (id) => {
    const userRepository = AppDataSource.getRepository("User");
    const user = await userRepository.findOne({
        where: { employee_code: id },
    });

    if (!user) {
        throw new Error("Người dùng không tồn tại.");
    }

    await userRepository.remove(user);
    return { success: true, message: "Người dùng đã được xóa thành công." };
}