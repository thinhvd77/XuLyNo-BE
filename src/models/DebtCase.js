const { EntitySchema } = require('typeorm');

const DebtCase = new EntitySchema({
  // Tên của entity, dùng trong TypeORM
  name: 'DebtCase',
  
  // Tên của bảng trong PostgreSQL
  tableName: 'debt_cases',

  // Định nghĩa các cột
  columns: {
    case_id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid', // Tự động tạo UUID cho mỗi hồ sơ mới
    },
    customer_code: {
      type: 'varchar',
      unique: true,
    },
    customer_name: {
      type: 'varchar',
    },
    address: {
      type: 'text',
      nullable: true, // Cho phép địa chỉ có thể trống
    },
    outstanding_debt: {
      type: 'numeric',
      precision: 19,
      scale: 2, // Dùng để lưu trữ chính xác giá trị tiền tệ
    },
    state: {
      type: 'enum',
      enum: ['Mới', 'Đang xử lý', 'Đã khởi kiện', 'Đang thi hành án', 'Hoàn tất'],
      default: 'Mới',
    },
    created_date: {
      type: 'timestamptz',
      createDate: true, // TypeORM sẽ tự động gán ngày giờ tạo
    },
    last_modified_date: {
      type: 'timestamptz',
      updateDate: true, // TypeORM sẽ tự động cập nhật ngày giờ mỗi khi bản ghi thay đổi
    },
    assigned_employee_code: {
      type: 'varchar',
      length: 50,
      nullable: true, // Cho phép hồ sơ chưa được gán cho ai
    },
  },
  
  // Định nghĩa các mối quan hệ
  relations: {
    // Mối quan hệ Nhiều-Một với CreditOfficer
    officer: {
      target: 'User', // Tên của entity đích
      type: 'many-to-one',
      joinColumn: {
        name: 'assigned_employee_code', // Cột khóa ngoại trong bảng này
      },
      onDelete: 'SET NULL', // Nếu cán bộ bị xóa, gán cho hồ sơ này là NULL
    }
  },
});

module.exports = { DebtCase };