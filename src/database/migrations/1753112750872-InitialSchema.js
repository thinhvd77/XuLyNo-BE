/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class InitialSchema1753112750872 {
    name = 'InitialSchema1753112750872'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "users" ("employee_code" character varying NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "fullname" character varying NOT NULL, "branch_code" character varying NOT NULL, "dept" "public"."users_dept_enum" NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'Nhân viên', CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_8ae048b57cb451eb306035b1e69" PRIMARY KEY ("employee_code"))`);
        await queryRunner.query(`CREATE TABLE "debt_cases" ("case_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_code" character varying NOT NULL, "customer_name" character varying NOT NULL, "address" text, "outstanding_debt" numeric(19,2) NOT NULL, "state" "public"."debt_cases_state_enum" NOT NULL DEFAULT 'Mới', "created_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "last_modified_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "assigned_employee_code" character varying(50), CONSTRAINT "UQ_047c03231b00c9eda481edac0d1" UNIQUE ("customer_code"), CONSTRAINT "PK_34373fb66e7fad167db14cd6a9c" PRIMARY KEY ("case_id"))`);
        await queryRunner.query(`CREATE TYPE "public"."case_documents_document_type_enum" AS ENUM('Tài liệu Tòa án', 'Tài liệu Thi hành án', 'Tài liệu Bán nợ', 'Tài liệu Tài sản', 'Tài liệu Khách hàng', 'Khác')`);
        await queryRunner.query(`CREATE TABLE "case_documents" ("document_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "case_id" uuid NOT NULL, "original_filename" character varying NOT NULL, "file_path" text NOT NULL, "mime_type" character varying NOT NULL, "file_size" bigint NOT NULL, "document_type" "public"."case_documents_document_type_enum" NOT NULL, "uploaded_by_employee_code" character varying, "upload_date" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_32654dd2fd20e29ef73fa1c6a0e" PRIMARY KEY ("document_id"))`);
        await queryRunner.query(`ALTER TABLE "debt_cases" ADD CONSTRAINT "FK_9d416e9b86802921dd04615d784" FOREIGN KEY ("assigned_employee_code") REFERENCES "users"("employee_code") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "debt_cases" DROP CONSTRAINT "FK_9d416e9b86802921dd04615d784"`);
        await queryRunner.query(`DROP TABLE "case_documents"`);
        await queryRunner.query(`DROP TYPE "public"."case_documents_document_type_enum"`);
        await queryRunner.query(`DROP TABLE "debt_cases"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }
}
