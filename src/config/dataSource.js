const { DataSource } = require("typeorm");
require('dotenv').config();

// SỬA LẠI Ở ĐÂY: Export trực tiếp instance, không qua object
module.exports = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    logging: false,
    entities: [__dirname + '/../models/*.js'],
    migrations: [__dirname + '/../database/migrations/*.js'],
    extra: {
        // PostgreSQL connection options for Vietnamese character support
        client_encoding: 'UTF8',
        charset: 'utf8mb4'
    }
});

