const User = require('../models/User');
const fs = require('fs');
const csv = require('csv-parser');
const db = require('../database/db.js');
const UserRole = require('../models/UserRole');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const Role = require('../models/Role');
const UserRepository = require("../repository/UserRepository");
const RoleRepository = require("../repository/RoleRepository");
const {isArrayEquals} = require("../utils/array.util");
const {validateEmail} = require("../utils/emailUtils");
const {buildVerificationEmail, sendEmail} = require('../utils/emailUtils');

exports.getUserById = (req, res) => {
    UserRepository.findUserById(req.body.userid).then(result => {
        res.send({userdata: result});
    });
}

exports.updateUserProfile = (req, res) => {
    const firstName = req.body.first_name;
    const lastName = req.body.last_name;
    const profileImg = req.body.profileimg;
    const address = req.body.address;
    const phoneNum = req.body.phonenum;
    const userId = req.body.userid;

    UserRepository.updateUserProfile(firstName, lastName, profileImg, address, phoneNum, userId)
        .then((result) => {
            res.send({result: result});
        });
}

exports.registerUser = async (req, res) => {
    const today = new Date();
    const roleId = req.body.roleId;
    const userData = {
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        email: req.body.email,
        password: req.body.password,
        created: today,
    };

    const selectedRole = await RoleRepository.findRoleById(roleId);

    if (selectedRole != null) {
        UserRepository.findUserByEmail(userData.email)
            .then((user) => {
                if (!user) {
                    bcrypt.hash(req.body.password, 10, (err, hash) => {
                        userData.password = hash;
                        UserRepository.createUser(userData)
                            .then((user) => {
                                user.addRole(selectedRole);
                                res.json({status: user.email + ' registered'});
                            }).catch(err => {
                            res.status(500).json(`error: ${err.toString()}`)
                        });
                    });
                } else {
                    res.status(400).json({error: ' User already exists'});
                }
            })
            .catch((err) => {
                res.status(500).send('error: ' + err);
            });
    } else {
        res.status(404).json('error: Role is invalid');
    }

}

exports.loginWithRole = (req, res) => {
    UserRepository.findUserByEmail(req.body.email)
        .then((results) => {
            if (results) {
                console.log('user exists');

                if (bcrypt.compareSync(req.body.password, results.password)) {
                    let mydata = JSON.stringify(results);
                    mydata = JSON.parse(mydata);
                    mydata['role'] = req.body.role;
                    console.log(JSON.stringify(mydata));
                    let token = jwt.sign(mydata, process.env.SECRET_KEY);
                    console.log("Correct password");
                    //check role
                    UserRepository.findUserByEmailAndRole(req.body.email,req.body.role)
                        .then((results) => {
                            if (results) {
                                res.send({token: token});
                            } else {
                                console.log('Wrong role selected');
                                res.status(400).json({error: 'Wrong role selected'});
                            }
                        })
                        .catch((err) => {
                            console.log(err);
                            res.status(400).json({error:"error is here"});
                        });


                } else {
                    console.log('Wrong password');
                    res.status(400).json({error: 'Wrong password'});
                }
            } else {
                console.log('user does not exist');
                res.status(404).json({error: "User does not exist"})
            }
        })
        .catch((err) => {
            res.status(400).json({error: err.toString()});
        });
}

exports.registerUserByCsv = async (req, res) => {
    const email = req.body.email;
    const role = req.body.role;
    if (req.file) {
        await createUserByCsv(req, res);
        try {
            fs.unlinkSync(path.resolve(__dirname, '..', req.file.path));
        } catch (err) {
            console.log(err);
        }
    } else if (email) {
        await createUser(req, res);
    }
}

exports.completeRegistration = (req, res) => {
    const userId = req.body.userid;
    const firstName = req.body.first_name;
    const lastName = req.body.last_name;
    const profileimg = req.body.profileimg;
    const address = req.body.address;
    const phonenum = req.body.phonenum;
    const password = req.body.password;

    const hashPassword = bcrypt.hashSync(password, 10);

    UserRepository.findUserById(userId).then(user => {
        user.first_name = firstName;
        user.last_name = lastName;
        user.profileimg = profileimg;
        user.address = address;
        user.phonenum = phonenum;
        user.password = hashPassword;
        user.active = true;
        user.verification_hash = '';
        return user.save();
    }).then(result => {
        res.json(result);
    }).catch(err => {
        res.status(400).json({message: err});
    })
}

exports.getRegistrationCsv = (req, res) => {
    var csvLink = req.protocol + '://' + req.get('host');

    if (req.query.role === 'teacher') {
        csvLink += '/uploads/registration/teacher/' + 'Format.csv';
    } else {
        csvLink += '/uploads/registration/admin/' + 'Format.csv';
    }

    res.send(csvLink);
}

exports.getUserByVerificationHash = (req, res) => {
    const hash = req.body.hash;
    User.findOne({where: {verification_hash: hash}}).then(user => {
        const userId = user.id;
        // res.json(user);
        UserRole.findOne({where: {user_id: userId}}).then(userRole => {
            const roleId = userRole.role_id;
            Role.findOne({where: {id: roleId}}).then(role => {
                // const role = role.name;
                res.json({user, role});
            })
        })
    }).catch(err => {
        res.status(400).json({message: 'User have been registered'});
    });
}


const createUserByCsv = async (req, res) => {
    const file = req.file;
    const allowedRoles = req.body.allowedRoles;
    const registrationLinkPrefix = req.body.registrationLinkPrefix;
    if (file.mimetype === 'application/vnd.ms-excel' || file.mimetype === 'text/csv') {
        const emails = [];
        const rows = {};
        var errMessage = [];
        var rowNum = 1;

        source = fs.createReadStream(file.path)
            .pipe(csv({skipComments: true}))
            .on('headers', headers => {
                const isCsvFormatCorrect = isArrayEquals(['email', 'role'], headers);
                if (!isCsvFormatCorrect) {
                    res.status(400).json({message: ['The csv is in incorrect format']});
                    source.destroy();
                } else if (allowedRoles === undefined || allowedRoles.length === 0) {
                    res.status(400).json({message: ['Allowed roles are empty']});
                    source.destroy();
                } else if (registrationLinkPrefix === undefined) {
                    res.status(400).json({message: ['Registration link prefix not found']});
                    source.destroy();
                }
            })
            .on('data', (row) => {
                if (!validateEmail(row['email'])) {
                    errMessage.push('Invalid email format at line ' + rowNum);
                } else if (emails.includes(row['email'])) {
                    errMessage.push('Duplication of emails at line ' + rowNum);
                } else if (!allowedRoles.includes(row['role'])) {
                    console.log(allowedRoles.toString(), row['role']);
                    errMessage.push('Invalid roles assignment at line ' + rowNum);
                }
                emails.push(row['email']);
                rows[row['email']] = row['role'];
                rowNum += 1;
            })
            .on('end', async () => {
                const existingUsers = (await User.findAll({where: {email: emails}}));
                if (existingUsers.length > 0) {
                    for (var i = 0; i < existingUsers.length; i++) {
                        errMessage.push(existingUsers[i].email + ' user existed');
                    }
                }
                if (errMessage.length > 0) {
                    res.status(400).json({message: errMessage});
                } else {

                    usersData = emails.map(email => {
                        const hashEmail = bcrypt.hashSync(email, 10).replace('/', '.');
                        return {'email': email, 'active': false, verification_hash: hashEmail};
                    });

                    console.log("usersData", usersData);

                    db.sequelize.transaction(t => {
                        var promises = [];
                        for (var i = 0; i < usersData.length; i++) {
                            promises[i] = User.create(usersData[i], {transaction: t});
                        }
                        return Promise.all(promises).then(users => {
                            var userRolePromises = [];
                            for (var i = 0; i < users.length; i++) {
                                userRolePromises.push(UserRole.create({
                                    user_id: users[i].id,
                                    role_id: rows[users[i].email]
                                }, {transaction: t}));
                            }
                            return Promise.all(userRolePromises);
                        });
                    }).then(function (result) {
                        const addedUserId = result.map(userRole => {
                            return userRole.user_id;
                        })
                        User.findAll({where: {id: addedUserId}}).then(users => {
                            users.forEach(user => {
                                const email = user.email;
                                const verification_hash = user.verification_hash;
                                const registrationLink = registrationLinkPrefix + '/' + verification_hash;
                                const {subject, text} = buildVerificationEmail(email, registrationLink);
                                sendEmail(email, subject, text);
                            });
                        }).then(() => {
                            res.send(result);
                        }).catch(err => {
                            console.log(err);
                            res.status(400).json({message: 'Email to users operations failed'});
                        })
                    }).catch(function (err) {
                        console.log(err);
                        return res.send(err);
                        // res.status(400).json({ message: errMessage });
                    })
                }


            });
    } else {
        res.json('Wrong document format')
    }
}

const createUser = async (req, res) => {
    const today = new Date();
    const roleId = req.body.role;
    const allowedRoles = req.body.allowedRoles;
    const email = req.body.email;
    const registrationLinkPrefix = req.body.registrationLinkPrefix;

    const role = await RoleRepository.findRoleById(roleId);

    if (allowedRoles.includes(roleId) && role && email) {
        const hashEmail = bcrypt.hashSync(email, 10);
        const userData = {
            email: req.body.email,
            verification_hash: hashEmail.replace('/', '.'),
            status: false,
            created: today,
        };
        UserRepository.findUserByEmail(req.body.email)
            .then((user) => {
                if (!user) {
                    UserRepository.createUser(userData)
                            .then((user) => {
                                user.setRole(role);

                                // return UserRole.create({
                                //     role_id: roleId,
                                //     user_id: user.id
                                // }, {transaction: t}).then(userRole => {
                                //     return user;
                                // });
                    }).then(async (userResult) => {
                        const verification_hash = userResult.verification_hash;
                        const registrationLink = registrationLinkPrefix + '/' + verification_hash;
                        const {subject, text} = buildVerificationEmail(email, registrationLink);
                        await sendEmail(email, subject, text, res);

                        res.json({status: userResult.email + ' registered'});

                    }).catch(function (err) {
                        console.log(err);
                        return res.status(400).json({message: 'error: ' + err});
                    });
                } else {
                    res.status(400).json({message: ' User already exists'});
                }
            })
            .catch((err) => {
                res.status(400).json({message: 'error: ' + err});
            });
    } else {
        res.status(400).json({message: 'Invalid role assignment'});
    }

}