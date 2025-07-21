const LocalStrategy = require("passport-local").Strategy;
const JwtStrategy = require("passport-jwt").Strategy;
const ExtractJwt = require("passport-jwt").ExtractJwt;
const bcrypt = require("bcrypt");
const AppDataSource = require("./dataSource");
const User = require("../models/User").User;

module.exports = function (passport) {
    const userRepository = AppDataSource.getRepository("User");
    // --- Local Strategy (cho việc đăng nhập) ---
    passport.use(
        new LocalStrategy(
            { usernameField: "username" },
            async (username, password, done) => {
                try {
                    const user = await userRepository.findOneBy({ username });

                    if (!user) {
                        return done(null, false, {
                            message: "Tên đăng nhập không tồn tại.",
                        });
                    }

                    const isMatch = await bcrypt.compare(
                        password,
                        user.password
                    );
                    if (isMatch) {
                        return done(null, user);
                    } else {
                        return done(null, false, {
                            message: "Mật khẩu không chính xác.",
                        });
                    }
                } catch (err) {
                    return done(err);
                }
            }
        )
    );

    // --- JWT Strategy (để bảo vệ các route) ---
    const opts = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET,
    };

    passport.use(
        new JwtStrategy(opts, async (jwt_payload, done) => {
            try {
                const user = await userRepository.findOneBy({
                    employee_code: jwt_payload.sub,
                });
                if (user) {
                    return done(null, user);
                }
                return done(null, false);
            } catch (err) {
                return done(err, false);
            }
        })
    );
};
