const AppDataSource = require("../config/dataSource");
const bcrypt = require("bcrypt");
const { Not, In } = require("typeorm");
const logger = require("../config/logger");

/**
 * [HELPER] Loại bỏ trường password khỏi đối tượng user trước khi trả về.
 * @param {ObjectLiteral} user - Đối tượng người dùng từ TypeORM
 */
const toUserResponse = (user) => {
    try {
        if (!user) return null;
        const { password, ...response } = user;
        return response;
    } catch (error) {
        logger.error('Error in toUserResponse:', error);
        return null;
    }
};

/**
 * Tạo một CBTD mới
 * @param {object} userData - Dữ liệu người dùng từ controller
 */
exports.createUser = async (userData) => {
    try {
        if (!userData) {
            throw new Error('User data is required');
        }

        const { username, employee_code, password } = userData;

        if (!username || !employee_code || !password) {
            throw new Error('Username, employee_code, and password are required');
        }

        const userRepository = AppDataSource.getRepository("User");

        // 1. Kiểm tra username hoặc mã nhân viên đã tồn tại chưa
        let existingUser;
        try {
            existingUser = await userRepository.findOne({
                where: [{ username }, { employee_code }],
            });
        } catch (dbError) {
            logger.error('Database error checking existing user:', dbError);
            throw new Error('Failed to check existing user');
        }

        if (existingUser) {
            throw new Error("Tên đăng nhập hoặc Mã nhân viên đã tồn tại.");
        }

        // 2. Băm mật khẩu
        let hashedPassword;
        try {
            hashedPassword = await bcrypt.hash(password, 10);
        } catch (hashError) {
            logger.error('Error hashing password:', hashError);
            throw new Error('Failed to process password');
        }

        // 3. Tạo và lưu người dùng mới
        const newUser = userRepository.create({
            ...userData,
            password: hashedPassword,
        });

        try {
            await userRepository.save(newUser);
        } catch (saveError) {
            logger.error('Error saving new user:', saveError);
            throw new Error('Failed to create user');
        }

        // 4. Trả về dữ liệu người dùng (loại bỏ mật khẩu)
        const { password: _, ...userWithoutPassword } = newUser;
        logger.info(`User created successfully: ${employee_code}`);
        return userWithoutPassword;

    } catch (error) {
        logger.error('Error in createUser:', error);
        throw error;
    }
};

exports.getAllUsers = async (user_employee_code, filters = {}) => {
    try {
        if (!user_employee_code) {
            throw new Error('User employee code is required');
        }

        const userRepository = AppDataSource.getRepository("User");

        // Build where condition with validation
        let whereCondition = {
            employee_code: Not(user_employee_code)
        };

        // Add department filter if provided and valid
        if (filters.dept && typeof filters.dept === 'string' && filters.dept !== 'all') {
            whereCondition.dept = filters.dept;
        }

        // Add branch filter if provided and valid
        if (filters.branch_code && typeof filters.branch_code === 'string' && filters.branch_code !== 'all') {
            whereCondition.branch_code = filters.branch_code;
        }

        let users;
        try {
            users = await userRepository.find({
                where: whereCondition,
                order: {created_at: "ASC"},
                select: ["employee_code", "username", "fullname", "branch_code", "dept", "role", "status", "created_at"]
            });
        } catch (dbError) {
            logger.error('Database error in getAllUsers:', dbError);
            throw new Error('Failed to retrieve users');
        }

        logger.info(`Retrieved ${users.length} users for employee ${user_employee_code}`);
        return users;

    } catch (error) {
        logger.error('Error in getAllUsers:', error);
        throw error;
    }
};

exports.getUserById = async (id) => {
    try {
        if (!id) {
            throw new Error('User ID is required');
        }

        const userRepository = AppDataSource.getRepository("User");

        let user;
        try {
            user = await userRepository.findOne({
                where: { employee_code: id },
            });
        } catch (dbError) {
            logger.error(`Database error getting user ${id}:`, dbError);
            throw new Error('Failed to retrieve user');
        }

        if (!user) {
            throw new Error("Người dùng không tồn tại.");
        }

        // Trả về dữ liệu người dùng (loại bỏ mật khẩu)
        const { password: _, ...userWithoutPassword } = user;
        return userWithoutPassword;

    } catch (error) {
        logger.error(`Error in getUserById for ${id}:`, error);
        throw error;
    }
};

/**
 * Update user by ID
 * @param {string} id - Employee code của user cần update
 * @param {object} updateData - Dữ liệu cần cập nhật
 */
exports.updateUser = async (id, updateData) => {
    try {
        if (!id) {
            throw new Error('User ID is required');
        }

        if (!updateData || typeof updateData !== 'object') {
            throw new Error('Update data is required');
        }

        const userRepository = AppDataSource.getRepository("User");

        let userToUpdate;
        try {
            userToUpdate = await userRepository.findOneBy({ employee_code: id });
        } catch (dbError) {
            logger.error(`Database error finding user ${id}:`, dbError);
            throw new Error('Failed to find user');
        }

        if (!userToUpdate) {
            throw new Error("Người dùng không tìm thấy.");
        }

        // Gộp 2 lần kiểm tra trùng lặp vào 1 câu truy vấn
        if (updateData.username || updateData.employee_code) {
            const checkConditions = [];
            if (updateData.username) checkConditions.push({ username: updateData.username });
            if (updateData.employee_code) checkConditions.push({ employee_code: updateData.employee_code });

            let duplicateUser;
            try {
                duplicateUser = await userRepository.findOne({
                    where: checkConditions,
                });
            } catch (dbError) {
                logger.error('Database error checking duplicates:', dbError);
                throw new Error('Failed to validate user data');
            }

            // Kiểm tra trùng lặp (nhưng bỏ qua chính user đang được cập nhật)
            if (duplicateUser && duplicateUser.employee_code !== id) {
                throw new Error("Tên đăng nhập hoặc Mã nhân viên đã tồn tại.");
            }
        }

        // Băm mật khẩu mới nếu có
        if (updateData.password) {
            try {
                updateData.password = await bcrypt.hash(updateData.password, 10);
            } catch (hashError) {
                logger.error('Error hashing password for update:', hashError);
                throw new Error('Failed to process password');
            }
        }

        try {
            await userRepository.update({ employee_code: id }, updateData);
        } catch (updateError) {
            logger.error(`Database error updating user ${id}:`, updateError);
            throw new Error('Failed to update user');
        }

        // Lấy lại thông tin user đã cập nhật
        let updatedUser;
        try {
            updatedUser = await userRepository.findOneBy({ employee_code: id });
        } catch (dbError) {
            logger.error(`Database error retrieving updated user ${id}:`, dbError);
            throw new Error('User updated but failed to retrieve updated data');
        }

        logger.info(`User updated successfully: ${id}`);
        return toUserResponse(updatedUser);

    } catch (error) {
        logger.error(`Error in updateUser for ${id}:`, error);
        throw error;
    }
};

/**
 * Toggle user status (active/disabled)
 * @param {string} id - Employee code của user cần toggle status
 */
exports.toggleUserStatus = async (id) => {
    const userRepository = AppDataSource.getRepository("User");
    const userToUpdate = await userRepository.findOneBy({ employee_code: id });
    if (!userToUpdate) throw new Error("Người dùng không tìm thấy.");

    userToUpdate.status = userToUpdate.status === 'active' ? 'disabled' : 'active';
    const updatedUser = await userRepository.save(userToUpdate);

    return toUserResponse(updatedUser);
};


/**
 * Change user password (admin only)
 * @param {string} id - Employee code của user cần đổi mật khẩu
 * @param {string} newPassword - Mật khẩu mới
 */
exports.changeUserPassword = async (id, newPassword) => {
    const userRepository = AppDataSource.getRepository("User");
    const userToUpdate = await userRepository.findOneBy({ employee_code: id });
    if (!userToUpdate) throw new Error("Người dùng không tìm thấy.");

    userToUpdate.password = await bcrypt.hash(newPassword, 10);
    const updatedUser = await userRepository.save(userToUpdate);

    return toUserResponse(updatedUser);
};

/**
 * Change self password (requires old password verification)
 * @param {string} id - Employee code của user đang đăng nhập
 * @param {string} oldPassword - Mật khẩu hiện tại
 * @param {string} newPassword - Mật khẩu mới
 */
exports.changeSelfPassword = async (id, oldPassword, newPassword) => {
    const userRepository = AppDataSource.getRepository("User");
    const userToUpdate = await userRepository.findOneBy({ employee_code: id });
    if (!userToUpdate) throw new Error("Người dùng không tìm thấy.");

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, userToUpdate.password);
    if (!isOldPasswordValid) {
        throw new Error("Mật khẩu hiện tại không đúng.");
    }

    // Update to new password
    userToUpdate.password = await bcrypt.hash(newPassword, 10);
    const updatedUser = await userRepository.save(userToUpdate);

    return toUserResponse(updatedUser);
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

/**
 * MỚI: Lấy danh sách tất cả nhân viên để sử dụng cho filter dropdown
 */
exports.getEmployeesForFilter = async (directorBranchCode = null) => {
    try {
        logger.info("Starting to fetch employees for filter dropdown", { directorBranchCode });

        if (!directorBranchCode) {
            throw new Error('Director branch code is required');
        }

        const userRepository = AppDataSource.getRepository("User");

        // Build where condition based on director's branch
        let whereCondition = {
            dept: In(["KH", "KHDN", "KHCN", "PGD"]),
            status: "active"
        };

        // Branch-based access control
        if (directorBranchCode !== '6421') {
            // Non-6421 directors can only see employees from their own branch
            whereCondition.branch_code = directorBranchCode;
            logger.info(`Applying branch filter for director: ${directorBranchCode}`);
        } else {
            // Directors from branch 6421 can see all employees
            logger.info('Director from branch 6421 - showing all employees');
        }

        let employees;
        try {
            employees = await userRepository.find({
                where: whereCondition,
                select: ["employee_code", "fullname", "branch_code"],
                order: { fullname: "ASC" }
            });
        } catch (dbError) {
            logger.error('Database error in getEmployeesForFilter:', dbError);
            throw new Error('Failed to retrieve employees');
        }

        logger.info(`Successfully retrieved ${employees.length} employees for director branch ${directorBranchCode}`);
        return employees;

    } catch (error) {
        logger.error('Error in getEmployeesForFilter:', error);
        throw error;
    }
};

/**
 * Lấy danh sách chi nhánh (branch) để hiển thị trong dropdown filter
 */
exports.getBranchesForFilter = async () => {
    const userRepository = AppDataSource.getRepository("User");
    
    // Lấy danh sách branch_code và branch_name duy nhất từ bảng User
    const branches = await userRepository
        .createQueryBuilder("user")
        .select([
            "user.branch_code AS branch_code"
        ])
        .where("user.branch_code IS NOT NULL")
        .groupBy("user.branch_code")
        .orderBy("user.branch_code", "DESC")
        .getRawMany();
    
    return branches;
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