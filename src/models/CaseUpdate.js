const { EntitySchema } = require('typeorm');

const CaseUpdate = new EntitySchema({
  name: 'CaseUpdate',
  tableName: 'case_updates',
  columns: {
    update_id: {
      primary: true,
      type: 'uuid',
      generated: 'uuid',
    },
    case_id: {
      type: 'uuid',
    },
    update_content: {
      type: 'text',
    },
    created_by_employee_code: {
      type: 'varchar',
      length: 50,
      nullable: true,
    },
    created_date: {
      type: 'timestamptz',
      createDate: true,
    },
  },
  relations: {
    debtCase: {
      target: 'DebtCase',
      type: 'many-to-one',
      joinColumn: { name: 'case_id' },
      onDelete: 'CASCADE',
    },
    officer: {
      target: 'User',
      type: 'many-to-one',
      joinColumn: { name: 'created_by_employee_code', referencedColumnName: 'employee_code' },
      onDelete: 'SET NULL',
    },
  },
});

module.exports = { CaseUpdate };