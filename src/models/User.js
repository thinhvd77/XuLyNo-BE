const { EntitySchema } = require("typeorm");

const User = new EntitySchema({
    name: "User",
    tableName: "users",
    columns: {
        employee_code: {
            primary: true,
            type: "varchar"
        },
        username: {
            type: "varchar",
            unique: true,
        },
        password: {
            type: "varchar",
        },
        fullname: {
            type: "varchar",
        },
        branch_code: {
            type: "varchar",
        },
        dept: {
            type: "enum",
            enum: ["KHCN","KHDN", "KH&QLRR", "BGĐ", "IT"],
        },
        role: {
            type: "enum",
            enum: [
                "Nhân viên",
                "Phó phòng",
                "Trưởng phòng",
                "Phó giám đốc",
                "Giám đốc",
                "Administrator"
            ],
            default: "Nhân viên",
        },
    },
});

module.exports = { User };
