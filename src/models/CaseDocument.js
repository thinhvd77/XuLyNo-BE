const { EntitySchema } = require('typeorm');

const CaseDocument = new EntitySchema({
  name: 'CaseDocument',
  tableName: 'case_documents',
  columns: {
    document_id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    case_id: {
      type: 'uuid',
    },
    original_filename: {
      type: 'varchar',
    },
    file_path: {
      type: 'text',
    },
    mime_type: {
      type: 'varchar',
    },
    file_size: {
      type: 'bigint',
    },
    document_type: {
      type: 'enum',
      enum: ['Tài liệu Tòa án', 'Tài liệu Thi hành án', 'Tài liệu Bán nợ', 'Tài liệu Tài sản', 'Tài liệu Khách hàng', 'Khác'],
    },
    uploaded_by_employee_code: {
      type: 'varchar',
      nullable: true,
    },
    upload_date: {
      type: 'timestamptz',
      createDate: true,
    },
  },
  relations: {
    // Thêm các quan hệ ở đây nếu cần
  },
});

module.exports = { CaseDocument };