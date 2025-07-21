require("dotenv").config();
require("reflect-metadata");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const bcrypt = require("bcrypt");
const apiRoutes = require("./api");
const { AppDataSource } = require("./config/dataSource");
const { User } = require("./models/User");

// Khởi tạo server
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cấu hình Passport
app.use(passport.initialize());
require("./config/passport")(passport);

// Kết nối CSDL và khởi động server
AppDataSource.initialize()
    .then(async () => {
        console.log("✅ Đã kết nối cơ sở dữ liệu thành công!");

        const officerRepository = AppDataSource.getRepository("User");
        const caseRepository = AppDataSource.getRepository("DebtCase");

        let admin = await officerRepository.findOneBy({
            username: "admin",
        });
        if (!admin) {
            console.log("Tạo Administrator...");
            const adminData = {
                employee_code: "99999999",
                username: "admin",
                fullname: "Administrator",
                dept: "IT",
                branch_code: "6421",
                role: "Administrator",
                password: await bcrypt.hash("Admin@6421", 10),
            };
            admin = officerRepository.create(adminData);
            await officerRepository.save(admin);
            console.log("✅ Tạo Administrator thành công!");
        }

        // Routes
        app.use("/api", apiRoutes);

        // Route gốc để health check
        app.get("/", (req, res) => {
            res.send("Welcome to Debt Collection API with Express.js!");
        });

        app.listen(PORT, () => {
            console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
        });
    })
    .catch((error) => console.log("❌ Lỗi kết nối cơ sở dữ liệu: ", error));
