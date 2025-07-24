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
            type: "varchar",
            length: 50,
        },
        role: {
            type: "varchar",
            length: 50,
            default: "employee",
        },
        status: {
            type: "varchar",
            default: "active",
        }
    },
});

module.exports = { User };
