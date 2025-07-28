const AppDataSource = require("../config/dataSource");
const bcrypt = require("bcrypt");
const { Not } = require("typeorm");
const User = require("../models/User").User;

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
        order: {
            branch_code: "DESC",
            dept: "ASC",
            role: "DESC",
            fullname: "ASC"
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

// update người dùng theo ID
exports.updateUserById = async (id, dataUpdate) => {
    const userRepository = AppDataSource.getRepository("User");
    const user = await userRepository.findOne({
        where: { employee_code: id },
    });

    if (!user) {
        throw new Error("Người dùng không tồn tại.");
    }

    //Cập nhật các trường mới
    Object.assign(user, dataUpdate);

    await userRepository.save(user);
    return { success: true, message: "Người dùng đã được cập nhật thành công." };
}