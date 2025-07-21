const AppDataSource = require("../config/dataSource");
const bcrypt = require("bcrypt");
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
