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
            enum: ["KHDN", "KH&QLRR", "BGĐ"],
        },
        role: {
            type: "enum",
            enum: [
                "Nhân viên",
                "Phó phòng",
                "Trưởng phòng",
                "Phó giám đốc",
                "Giám đốc",
            ],
            default: "Nhân viên",
        },
    },
});

module.exports = { User };
