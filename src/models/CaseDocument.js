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
      type: 'varchar',
    },
    upload_date: {
      type: 'timestamptz',
      createDate: true,
    },
  },
  relations: {
    case: {
      type: 'many-to-one',
      target: 'DebtCase',
      joinColumn: {
        name: 'case_id',
        referencedColumnName: 'case_id',
      },
      onDelete: 'CASCADE', // Xóa tài liệu khi xóa trường hợp
    },
  },
});

module.exports = { CaseDocument };