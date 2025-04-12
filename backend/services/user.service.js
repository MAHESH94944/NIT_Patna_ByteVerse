import usermodel from '../models/user.model.js';

export const createUser = async ({
    email, password
})=>{
    if(!email|| !password){
        throw new Error('Email and password are required');
    }

    const hashedPassword = await usermodel.hashedPassword(password);

    const user = await usermodel.create({
        email,
        password: hashedPassword;
    });

    return user;
    
}